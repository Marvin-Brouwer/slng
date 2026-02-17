import { describe, expect, it } from 'vitest'

import { buildBodyAst, parseTemplateDisplay } from '../src/display-parser.js'
import { secret } from '../src/masking/secret.js'
import { sensitive } from '../src/masking/sensitive.js'

import type { SlingInterpolation } from '../src/types.js'

// Helper to simulate tagged template strings/values
function templateParts(
	strings: TemplateStringsArray,
	...values: SlingInterpolation[]
) {
	return { strings, values }
}

describe('parseTemplateDisplay', () => {
	it('parses request with no masked values', () => {
		const { strings, values } = templateParts`
			GET https://api.example.com/users HTTP/1.1

			Content-Type: application/json
		`
		const result = parseTemplateDisplay(strings, values, [])

		expect(result.method).toBe('GET')
		expect(result.url).toBe('https://api.example.com/users')
		expect(result.headers['Content-Type']).toBe('application/json')
		expect(result.body).toBeUndefined()
	})

	it('stores fully masked header value as MaskedReference', () => {
		const token = secret('my-secret-token')
		const { strings, values } = templateParts`
			GET https://api.example.com HTTP/1.1

			Authorization: ${token}
		`
		const maskedValues = [token]
		const result = parseTemplateDisplay(strings, values, maskedValues)

		expect(result.headers['Authorization']).toEqual({
			index: 0,
			mask: '●●●●●',
		})
	})

	it('inlines mask display text for mixed header values', () => {
		const token = secret('my-secret-token')
		const { strings, values } = templateParts`
			GET https://api.example.com HTTP/1.1

			Authorization: Bearer ${token}
		`
		const maskedValues = [token]
		const result = parseTemplateDisplay(strings, values, maskedValues)

		expect(result.headers['Authorization']).toBe('Bearer ●●●●●')
	})

	it('keeps non-masked header values as plain strings', () => {
		const { strings, values } = templateParts`
			GET https://api.example.com HTTP/1.1

			Content-Type: ${'application/json'}
		`
		const result = parseTemplateDisplay(strings, values, [])

		expect(result.headers['Content-Type']).toBe('application/json')
	})

	it('builds JSON body AST with masked string value', () => {
		const apiKey = secret('real-key')
		const { strings, values } = templateParts`
			POST https://api.example.com HTTP/1.1

			Content-Type: application/json

			{"apiKey": "${apiKey}"}
		`
		const maskedValues = [apiKey]
		const result = parseTemplateDisplay(strings, values, maskedValues)

		expect(result.body).toBeDefined()
		expect(result.body).toHaveLength(1)

		const root = result.body![0]
		expect(root).toHaveProperty('type', 'object')
		if (root.type !== 'object') throw new Error('Expected object')

		const [key, value] = root.entries[0]
		expect(key).toEqual({ type: 'string', value: 'apiKey' })
		expect(value).toEqual({ type: 'masked', index: 0, mask: '●●●●●' })
	})

	it('builds JSON body AST with mixed masked and plain values', () => {
		const apiKey = secret('real-key')
		const { strings, values } = templateParts`
			POST https://api.example.com HTTP/1.1

			Content-Type: application/json

			{"user": "john", "apiKey": "${apiKey}"}
		`
		const maskedValues = [apiKey]
		const result = parseTemplateDisplay(strings, values, maskedValues)

		const root = result.body![0]
		if (root.type !== 'object') throw new Error('Expected object')

		const [userKey, userValue] = root.entries[0]
		expect(userKey).toEqual({ type: 'string', value: 'user' })
		expect(userValue).toEqual({ type: 'string', value: 'john' })

		const [apiKeyKey, apiKeyValue] = root.entries[1]
		expect(apiKeyKey).toEqual({ type: 'string', value: 'apiKey' })
		expect(apiKeyValue).toEqual({ type: 'masked', index: 0, mask: '●●●●●' })
	})

	it('builds plain text body AST with masked segments', () => {
		const token = secret('abc123')
		const { strings, values } = templateParts`
			POST https://api.example.com HTTP/1.1

			Content-Type: text/plain

			token=${token}&user=john
		`
		const maskedValues = [token]
		const result = parseTemplateDisplay(strings, values, maskedValues)

		expect(result.body).toEqual([
			{ type: 'text', value: 'token=' },
			{ type: 'masked', index: 0, mask: '●●●●●' },
			{ type: 'text', value: '&user=john' },
		])
	})

	it('resolves contentType from headers', () => {
		const { strings, values } = templateParts`
			POST https://api.example.com HTTP/1.1

			Content-Type: application/json; charset=utf-8

			{"test": true}
		`
		const result = parseTemplateDisplay(strings, values, [])

		expect(result.contentType).toBe('application/json')
	})

	it('handles multiple masked values with correct indices', () => {
		const username = sensitive('admin-user')
		const password = secret('super-secret')
		const { strings, values } = templateParts`
			POST https://api.example.com HTTP/1.1

			Content-Type: application/json

			{"user": "${username}", "pass": "${password}"}
		`
		const maskedValues = [username, password]
		const result = parseTemplateDisplay(strings, values, maskedValues)

		const root = result.body![0]
		if (root.type !== 'object') throw new Error('Expected object')

		const [, userValue] = root.entries[0]
		expect(userValue).toEqual({ type: 'masked', index: 0, mask: 'admin-****' })

		const [, passValue] = root.entries[1]
		expect(passValue).toEqual({ type: 'masked', index: 1, mask: '●●●●●' })
	})
})

describe('buildBodyAst', () => {
	it('parses JSON body into AST', () => {
		const result = buildBodyAst('{"name": "test", "count": 42}', 'application/json')

		expect(result).toHaveLength(1)
		const root = result[0]
		expect(root).toHaveProperty('type', 'object')
		if (root.type !== 'object') throw new Error('Expected object')

		expect(root.entries).toHaveLength(2)
		expect(root.entries[0]).toEqual([
			{ type: 'string', value: 'name' },
			{ type: 'string', value: 'test' },
		])
		expect(root.entries[1]).toEqual([
			{ type: 'string', value: 'count' },
			{ type: 'number', value: '42' },
		])
	})

	it('parses JSON array', () => {
		const result = buildBodyAst('[1, "two", true, null]', 'application/json')

		expect(result).toHaveLength(1)
		const root = result[0]
		if (root.type !== 'array') throw new Error('Expected array')

		expect(root.items).toEqual([
			{ type: 'number', value: '1' },
			{ type: 'string', value: 'two' },
			{ type: 'boolean', value: true },
			{ type: 'null' },
		])
	})

	it('falls back to text for invalid JSON', () => {
		const result = buildBodyAst('not json', 'application/json')

		expect(result).toEqual([{ type: 'text', value: 'not json' }])
	})

	it('returns plain text for non-JSON content types', () => {
		const result = buildBodyAst('hello world', 'text/plain')

		expect(result).toEqual([{ type: 'text', value: 'hello world' }])
	})

	it('handles +json content types', () => {
		const result = buildBodyAst('{"key": "val"}', 'application/vnd.api+json')

		expect(result).toHaveLength(1)
		expect(result[0]).toHaveProperty('type', 'object')
	})
})
