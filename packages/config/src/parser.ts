import { BaseNode } from 'estree'

import { JsonAstNode } from './http/body-parser/json/json.nodes.js'
import { BodyNode, ErrorNode, HeaderNode, Metadata, HttpDocument, NodeError, ValueNode, ValuesNode } from './http/http.nodes'
import { isMask, isMaskedDataAccessor, isPrimitiveMask } from './masking/mask.js'
import {
	isDataAccessor,
	type ParsedHttpRequest,
	type SlingInterpolation,
} from './types.js'

const REQUEST_LINE_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(\S+)(?:\s+(HTTP\/[\d.]+))?$/

/**
 * Convert an extracted JSON value to a string for template interpolation.
 */
function stringifyForInterpolation(value: unknown): string {
	if (typeof value === 'string') return value
	if (value === null || value === undefined) return String(value)
	if (typeof value === 'object') return JSON.stringify(value)
	return String(value as number | boolean | bigint | symbol)
}

/**
 * Resolve a single interpolation value to a string.
 *
 * - `PrimitiveValue` — stringified directly
 * - `MaskedValue` — uses the real value
 * - `ResponseDataAccessor` (Promise) — awaited to get a {@link DataAccessor},
 *   then `.value()` is called. Errors are re-thrown so the request fails.
 */
export async function resolveInterpolation(
	value: SlingInterpolation,
): Promise<string> {
	// TODO fix eslint warning

	if (isDataAccessor(value)) {
		// TODO fix eslint warnings

		const result = await value.value()
		if (result instanceof Error) throw result
		return stringifyForInterpolation(result)
	}

	if (isMaskedDataAccessor(value)) {
		const result = await value.unmask()
		if (result instanceof Error) throw result
		return stringifyForInterpolation(result)
	}
	if (isPrimitiveMask(value)) {
		return String(value.unmask())
	}
	// This is only number/bool/string

	return String(value)
}

/**
 * Resolve a single interpolation to its display string (masked).
 */
export function resolveInterpolationDisplay(
	value: SlingInterpolation,
): string {
	if (value === undefined) return '<undefined>'
	if (value === null) return '<null>'

	// TODO fix eslint warning

	if (isDataAccessor(value)) {
		return '<deferred>'
	}
	if (isMask(value)) {
		return (value).value
	}

	// This is only number/bool/string

	return String(value)
}

/**
 * Assemble the full raw HTTP text from template strings and resolved values.
 */
export function assembleTemplate(
	strings: ReadonlyArray<string>,
	resolvedValues: string[],
): string {
	let result = ''
	for (const [index, string_] of strings.entries()) {
		result += string_
		if (index < resolvedValues.length) {
			result += resolvedValues[index]
		}
	}
	return result
}

/**
 * Remove common leading indentation from a multi-line string.
 * Finds the minimum indentation across all non-empty lines and strips it.
 */
function dedent(text: string): string {
	const lines = text.split(/\r?\n/)
	const indentedLines = lines.filter(line => line.trim().length > 0)
	if (indentedLines.length === 0) return ''

	const minIndent = Math.min(
		...indentedLines.map((line) => {
			const match = /^[ \t]*/.exec(line)
			return match ? match[0].length : 0
		}),
	)

	if (minIndent === 0) return text.trim()

	return lines
		.map(line => line.slice(minIndent))
		.join('\n')
		.trim()
}

/**
 * Parse raw HTTP text into structured components.
 *
 * Expected format:
 * ```
 * METHOD URL [HTTP/VERSION]
 *
 * Header: Value
 * Header: Value
 *
 * body
 * ```
 *
 * The blank line separates headers from body.
 */
export function parseHttpText(raw: string): ParsedHttpRequest {
	const trimmed = dedent(raw)
	const lines = trimmed.split(/\r?\n/)

	// First non-empty line is the request line
	let requestLineIndex = -1
	for (const [index, line] of lines.entries()) {
		if (line.trim().length > 0) {
			requestLineIndex = index
			break
		}
	}

	if (requestLineIndex === -1) {
		throw new SlingParseError('Empty request template')
	}

	const requestLine = lines[requestLineIndex].trim()
	const match = REQUEST_LINE_RE.exec(requestLine)
	if (!match) {
		throw new SlingParseError(
			`Invalid request line: "${requestLine}". Expected: METHOD URL [HTTP/VERSION]`,
		)
	}

	const method = match[1]
	const url = match[2]
	const httpVersion = match[3] ?? 'HTTP/1.1'

	// Parse headers and body
	const headers: Record<string, string> = {}
	let bodyStartIndex = -1
	let foundBlankLine = false

	for (let index = requestLineIndex + 1; index < lines.length; index++) {
		const line = lines[index]

		if (!foundBlankLine) {
			if (line.trim() === '') {
				// Could be the separator between headers and body,
				// or just a blank line after the request line before headers.
				// Peek ahead to see if more headers follow.
				const remaining = lines.slice(index + 1)
				const nextNonEmpty = remaining.find(l => l.trim().length > 0)
				if (nextNonEmpty && /^\s*[\w-]+\s*:/.test(nextNonEmpty)) {
					// More headers coming, skip this blank line
					continue
				}
				foundBlankLine = true
				bodyStartIndex = index + 1
				continue
			}

			const headerMatch = /^\s*([\w-]+)\s*:\s*(.*)$/.exec(line)
			if (headerMatch) {
				headers[headerMatch[1]] = headerMatch[2].trim()
			}
		}
	}

	let body: string | undefined
	if (bodyStartIndex >= 0 && bodyStartIndex < lines.length) {
		const bodyText = lines.slice(bodyStartIndex).join('\n').trim()
		body = bodyText.length > 0 ? bodyText : undefined
	}

	return { method, url, httpVersion, headers, body }
}

/**
 * Parse the template at definition time using display values (for preview).
 * Async/promise interpolations show as `<deferred>`.
 */
export function parseTemplatePreview(
	strings: ReadonlyArray<string>,
	values: ReadonlyArray<SlingInterpolation>,
): ParsedHttpRequest {
	const displayValues = values.map(v => resolveInterpolationDisplay(v))
	const raw = assembleTemplate(strings, displayValues)
	return parseHttpText(raw)
}

// TODO move to request-builder.ts
export function buildRequest(document: HttpDocument): ParsedHttpRequest | Error {
	if (document.startLine.type === 'error') return new NodeError(document.startLine)
	if (document.startLine.type !== 'request') return new Error('Unreachable code detected, not a request')

	const methodNode = document.startLine.method
	if (methodNode.type === 'error') return new NodeError(methodNode)
	const method = methodNode.value
	const urlNode = document.startLine.url
	if (urlNode.type === 'error') return new NodeError(urlNode)
	const url = resolveString(urlNode, document.metadata)
	const protocolNode = document.startLine.protocol
	if (protocolNode.type === 'error') return new NodeError(protocolNode)
	const httpVersion = protocolNode.version

	const headers = buildHeaders(document.metadata, document.headers)
	if (headers instanceof Error) return headers

	const body = buildBody(document.metadata, document.body)
	if (body instanceof Error) return body

	return { method, url, httpVersion, headers, body }
}

function resolveString(node: ValueNode | ValuesNode, metadata: Metadata): string {
	if (node.type === 'text') return node.value
	if (node.type === 'masked') return String(metadata.maskedValues[node.reference].unmask())

	return node.values.map(value => resolveString(value, metadata)).join('')
}

export class SlingParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SlingParseError'
	}
}
function buildHeaders(metadata: Metadata, headerNodes: (ErrorNode | HeaderNode)[] | undefined) {
	const headers: Record<string, string> = {}
	if (headerNodes === undefined) return headers

	for (const headerNode of headerNodes) {
		if (headerNode.type === 'error') return new NodeError(headerNode)

		const nameNode = headerNode.name
		if (nameNode.type === 'error') return new NodeError(nameNode)
		const valueNode = headerNode.value
		if (valueNode.type === 'error') return new NodeError(valueNode)

		headers[nameNode.value] = resolveString(valueNode, metadata)
	}

	return headers
}

function buildBody(metadata: Metadata, bodyNode: BodyNode<BaseNode> | undefined) {
	if (bodyNode === undefined) return

	if (bodyNode.contentType === 'application/json') return buildJsonBody(metadata, bodyNode.value as JsonAstNode)
	if (bodyNode.contentType === 'text/plain') return buildTextBody(metadata, bodyNode.value as ValueNode | ValuesNode)

	return new Error(`contentType ${bodyNode.contentType} not supported!`)
}

function buildTextBody(metadata: Metadata, valueNode: ValueNode | ValuesNode): string {
	if (valueNode.type === 'text') return valueNode.value
	if (valueNode.type === 'masked') return String(metadata.maskedValues[valueNode.reference].unmask())
	if (valueNode.type === 'values') return valueNode.values.map(value => buildTextBody(metadata, value)).join('')
	return ''
}

function buildJsonBody(_metadata: Metadata, valueNode: JsonAstNode): string {
	// TODO
	return JSON.stringify(valueNode)
}
