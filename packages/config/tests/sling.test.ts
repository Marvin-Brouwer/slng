import { describe, it, expect } from 'vitest'

import { isSlingDefinition } from '../src/definition.js'
import { secret, sensitive } from '../src/index.js'
import { sling as slingFactory } from '../src/sling.js'

import type { DataAccessor, SlingInterpolation } from '../src/types.js'

describe('sling', () => {
	it('creates a tagged template function', () => {
		const s = slingFactory()
		expect(typeof s).toBe('function')
		expect(s.context).toBeDefined()
	})

	it('returns a SlingDefinition from tagged template', () => {
		const s = slingFactory()
		const definition = s`
      GET https://api.example.com/users HTTP/1.1
    `

		expect(definition.getInternals().version).toBe('v1')
		expect(definition.getInternals().parsed.method).toBe('GET')
		expect(definition.getInternals().parsed.url).toBe('https://api.example.com/users')
	})

	it('handles string interpolations', () => {
		const s = slingFactory()
		const host = 'api.example.com'
		const definition = s`
      GET https://${host}/users HTTP/1.1
    `

		expect(definition.getInternals().parsed.url).toBe('https://api.example.com/users')
	})

	it('handles secret interpolations', () => {
		const s = slingFactory()
		const token = secret('my-secret-token')
		const definition = s`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer ${token}
    `

		expect(definition.getInternals().maskedValues).toHaveLength(1)
		expect(definition.getInternals().maskedValues[0].type).toBe('secret')
		// Preview shows masked value
		expect(definition.getInternals().parsed.headers['Authorization']).toBe('Bearer *****')
	})

	it('handles sensitive interpolations', () => {
		const s = slingFactory()
		const email = sensitive('marvin@example.com')
		const definition = s`
      POST https://api.example.com/users HTTP/1.1

      Content-Type: application/json

      {"email": "${email}"}
    `

		expect(definition.getInternals().maskedValues).toHaveLength(1)
		expect(definition.getInternals().maskedValues[0].type).toBe('sensitive')
	})

	it('handles ResponseDataAccessor interpolations as <deferred> in preview', () => {
		const s = slingFactory()
		const getToken: SlingInterpolation = Promise.resolve({
			value: () => Promise.resolve('dynamic-token'),
			validate: () => Promise.resolve(true),
			tryValue: () => Promise.resolve('dynamic-token'),
		} satisfies DataAccessor)
		const definition = s`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer ${getToken}
    `

		expect(definition.getInternals().parsed.headers['Authorization']).toBe('Bearer <deferred>')
	})

	it('collects template parts for later re-rendering', () => {
		const s = slingFactory()
		const host = 'example.com'
		const definition = s`GET https://${host}/api`

		expect(definition.getInternals().template.strings).toHaveLength(2)
		expect(definition.getInternals().template.values).toHaveLength(1)
		expect(definition.getInternals().template.values[0]).toBe('example.com')
	})
})

describe('isSlingDefinition', () => {
	it('returns true for sling definitions', () => {
		const s = slingFactory()
		const definition = s`GET https://example.com`
		expect(isSlingDefinition(definition)).toBe(true)
	})

	it('returns false for other objects', () => {
		expect(isSlingDefinition({})).toBe(false)
		// eslint-disable-next-line unicorn/no-null
		expect(isSlingDefinition(null)).toBe(false)
		expect(isSlingDefinition('string')).toBe(false)
		expect(isSlingDefinition(42)).toBe(false)
	})
})
