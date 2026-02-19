import { describe, test, expect } from 'vitest'

import { secret } from '../dist'
import { nodes } from '../src'
import { parseHttpRequest } from '../src/http/http-parser/http-parser.request'
import { Metadata } from '../src/http/http.nodes'
import { Masked } from '../src/masking/mask'
import { readHttpTemplate, resolveTemplateDependencies } from '../src/template-reader'
import { PrimitiveValue } from '../src/types'

// TODO call the http parser from sling, then call the resolver
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.values(
						nodes.text('https://'),
						nodes.text('someurl'),
						nodes.text('.com/'),
						nodes.masked(0, '●●●●●'),
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(nodes.error({
			reason: 'HTTP requests cannot be empty string',
			autoFix: 'sling.initial-format',
		}))
	})
	test('Incorrect whitespace', async () => {
		// ARRANGE
		const request = await http`GET https://someurl.com HTTP/1.1`

		// ACT
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				metadata: meta({
					errors: [
						nodes.error({
							reason: 'HTTP request template should start with a newline.',
							autoFix: 'sling.insert_leading_newline',
						}),
						nodes.error({
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					nodes.header(
						nodes.text('authorization'),
						nodes.values(nodes.text('Bearer '), nodes.masked(0, '●●●●●'), nodes.text('')),
					),
					nodes.header(
						nodes.text('content-type'),
						nodes.text('text/plain'),
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				body: nodes.body('text/undefined', nodes.text('This is body content')),
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					nodes.header(
						nodes.text('authorization'),
						nodes.values(nodes.text('Bearer '), nodes.masked(0, '●●●●●'), nodes.text('')),
					),
					nodes.header(
						nodes.text('content-type'),
						nodes.text('text/plain'),
					),
				],
				body: nodes.body('text/plain', nodes.text('This is body content')),
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					nodes.error({
						reason: 'Illegal header name, invalid characters',
					}),
					nodes.header(
						nodes.text('age'),
						nodes.text('today'),
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
		const result = await parseHttpRequest(request)

		// ASSERT
		expect(result).toEqual(
			nodes.document({
				startLine: nodes.request(
					nodes.text('GET'),
					nodes.text('https://someurl.com'),
					'HTTP', '1.1',
				),
				headers: [
					nodes.error({
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
