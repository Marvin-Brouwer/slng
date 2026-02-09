import {
	HttpError,
	InvalidJsonPathError,
	type ParsedHttpRequest,
	type SlingInterpolation,
	type DataAccessor,
} from './types.js'

const REQUEST_LINE_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(\S+)(?:\s+(HTTP\/[\d.]+))?$/

/**
 * Check whether a value looks like a thenable (Promise / ResponseDataAccessor).
 */
function isThenable(value: unknown): value is PromiseLike<DataAccessor> {
	return (
		typeof value === 'object'
    && value !== null
    && 'then' in value
    && typeof (value as Record<string, unknown>).then === 'function'
	)
}

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
	if (typeof value === 'object' && value !== null) {
		if ('__masked' in value) {
			return (value).value
		}
		if (isThenable(value)) {
			const accessor = await value
			const result = await accessor.value()
			if (result instanceof HttpError) throw result
			if (result instanceof InvalidJsonPathError) throw result
			return stringifyForInterpolation(result)
		}
	}
	return String(value)
}

/**
 * Resolve a single interpolation to its display string (masked).
 */
export function resolveInterpolationDisplay(
	value: SlingInterpolation,
): string {
	if (typeof value === 'object' && value !== null) {
		if ('__masked' in value) {
			return (value).displayValue
		}
		if (isThenable(value)) {
			return '<deferred>'
		}
	}
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
	const trimmed = raw.trim()
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

/**
 * Fully resolve the template and parse it. Awaits all async interpolations.
 */
export async function parseTemplateResolved(
	strings: ReadonlyArray<string>,
	values: ReadonlyArray<SlingInterpolation>,
): Promise<ParsedHttpRequest> {
	const resolvedValues = await Promise.all(values.map(v => resolveInterpolation(v)))
	const raw = assembleTemplate(strings, resolvedValues)
	return parseHttpText(raw)
}

export class SlingParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SlingParseError'
	}
}
