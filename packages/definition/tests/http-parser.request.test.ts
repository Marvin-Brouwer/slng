import { describe, test, expect } from 'vitest'

import { parseHttpRequest } from '../src/http/http-parser/http-parser.request'
import * as httpNodes from '../src/http/http.nodes'
import { Metadata } from '../src/http/http.nodes'
import { Masked } from '../src/masking/mask'
import { secret } from '../src/masking/secret'
import { readHttpTemplate, resolveTemplateDependencies } from '../src/template-reader'
import { PrimitiveValue } from '../src/types'

async function http(strings: TemplateStringsArray, ...values: (PrimitiveValue | Masked<PrimitiveValue>)[]) {
	const template = readHttpTemplate(strings, values)
	return await resolveTemplateDependencies(template)
}

describe('parseHttpRequest', () => {
	test('single line', async () => {
		// ARRANGE
		const request = await http`
			GET https://someurl.com HTTP/1.1
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				metadata: meta(),
			}),
		)
	})
	test('single line + parameters', async () => {
		// ARRANGE
		const someUrl = 'someurl'
		const someSecret = secret('someSecret')
		const request = await http`
			GET https://${someUrl}.com/${someSecret} HTTP/1.1
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.values(
						httpNodes.text('https://'),
						httpNodes.text('someurl'),
						httpNodes.text('.com/'),
						httpNodes.masked(0, '●●●●●'),
					),
					'HTTP', '1.1',
				),
				metadata: meta({
					maskedValues: [
						someSecret,
					],
				}),
			}),
		)
	})
	test('empty line', async () => {
		// ARRANGE
		const request = await http``

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(httpNodes.error({
			reason: 'HTTP requests cannot be empty string',
			autoFix: 'sling.initial-format',
		}))
	})
	test('Incorrect whitespace', async () => {
		// ARRANGE
		const request = await http`GET https://someurl.com HTTP/1.1`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				metadata: meta({
					errors: [
						httpNodes.error({
							reason: 'HTTP request template should start with a newline.',
							autoFix: 'sling.insert_leading_newline',
						}),
						httpNodes.error({
							reason: 'HTTP request template should end with a newline.',
							autoFix: 'sling.insert_trailing_newline',
						}),
					],
				}),
			}),
		)
	})

	test('with headers only', async () => {
		// ARRANGE
		const token = secret('token')
		const request = await http`
			GET https://someurl.com HTTP/1.1
			Authorization: Bearer ${token}
			Content-Type: text/plain
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					httpNodes.header(
						httpNodes.text('authorization'),
						httpNodes.values(httpNodes.text('Bearer '), httpNodes.masked(0, '●●●●●'), httpNodes.text('')),
					),
					httpNodes.header(
						httpNodes.text('content-type'),
						httpNodes.text('text/plain'),
					),
				],
				metadata: meta({
					maskedValues: [token],
					contentType: 'text/plain',
				}),
			}),
		)
	})

	test('with body only', async () => {
		// ARRANGE
		const request = await http`
			GET https://someurl.com HTTP/1.1

			This is body content
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				body: httpNodes.body('text/undefined', httpNodes.text('This is body content')),
				metadata: meta(),
			}),
		)
	})

	test('full request', async () => {
		// ARRANGE
		const token = secret('token')
		const request = await http`
			GET https://someurl.com HTTP/1.1
			Authorization: Bearer ${token}
			Content-Type: text/plain

			This is body content
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					httpNodes.header(
						httpNodes.text('authorization'),
						httpNodes.values(httpNodes.text('Bearer '), httpNodes.masked(0, '●●●●●'), httpNodes.text('')),
					),
					httpNodes.header(
						httpNodes.text('content-type'),
						httpNodes.text('text/plain'),
					),
				],
				body: httpNodes.body('text/plain', httpNodes.text('This is body content')),
				metadata: meta({
					maskedValues: [token],
					contentType: 'text/plain',
				}),
			}),
		)
	})

	test('illegal header name', async () => {
		// ARRANGE
		const request = await http`
			GET https://someurl.com HTTP/1.1
			Content Type: text/plain
			Age: today
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					httpNodes.error({
						reason: 'Illegal header name, invalid characters',
					}),
					httpNodes.header(
						httpNodes.text('age'),
						httpNodes.text('today'),
					),
				],
				metadata: meta(),
			}),
		)
	})

	test('missing header name', async () => {
		// ARRANGE
		const request = await http`
			GET https://someurl.com HTTP/1.1
			: no name here
		`

		// ACT
		const result = parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			httpNodes.document({
				startLine: httpNodes.request(
					httpNodes.text('GET'),
					httpNodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					httpNodes.error({
						reason: 'Empty header name',
					}),
				],
				metadata: meta(),
			}),
		)
	})
})

function meta(meta?: Partial<Metadata>): Metadata {
	return {
		...meta,
		maskedValues: meta?.maskedValues ?? [],
	} as Metadata
}
