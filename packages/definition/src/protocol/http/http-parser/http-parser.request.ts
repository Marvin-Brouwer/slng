import { isPrimitiveMask, Masked } from '../../../masking/mask'
import { Metadata } from '../../../nodes/metadata'
import { ErrorNode, text, ValueNode, ValuesNode } from '../../../nodes/nodes'
import { getProcessor } from '../../../payload/payload-processor'
import { TemplateChunks } from '../../../template-chunks'
import { PrimitiveValue, ResolvedStringTemplate, SlingContext, TemplateChunk } from '../../../types'
import { validateDefaults } from '../../protocol-processor'
import {
	allowedProtocols,
	body,
	BodyNode,
	document,
	HttpDocument,
	RequestNode,
	request,
} from '../http.nodes'

import { parseHeaders, resolveCompoundNode, resolveSingleNode, TemplateLine, TemplateLines } from './http-parser'

export function parseHttpRequest(context: SlingContext, requestTemplate: ResolvedStringTemplate): HttpDocument | ErrorNode | undefined {
	const { strings, values } = requestTemplate
	const metadata = new Metadata()

	// 1. Boundary Checks
	const startsWithNewline = /^\s*\n/.test(strings[0])
	const lastString = strings.at(-1)!
	const endsWithNewline = /\n\s*$/.test(lastString)

	// 2. Interleave strings and values into lines
	const lines: TemplateLines = [[]]
	let indent = -1

	for (const [index, string_] of strings.entries()) {
		if (string_ !== undefined) {
			const split = string_.split('\n')
			for (let sIndex = 0; sIndex < split.length; sIndex++) {
				const rawText = split[sIndex]

				// Establish the common indent based on the first line with content
				// (We only check lines that are actually new lines, not continuations)
				if (indent < 0 && rawText.trim() && (index === 0 || sIndex > 0)) {
					indent = rawText.length - rawText.trimStart().length
				}

				// Only strip indent if this is a NEW line (sIndex > 0)
				// or the very first line of the template (index === 0)
				const isContinuation = index > 0 && sIndex === 0
				const text = isContinuation
					? rawText
					: rawText.slice(Math.max(0, indent))

				// Skip leading empty lines (but keep continuations like ".com")
				if (indent < 0 && !text && !isContinuation) continue

				lines.at(-1)!.push({
					part: text,
				})

				if (sIndex < split.length - 1) {
					lines.push([])
				}
			}
		}

		if (index < values.length) {
			const value = values[index]

			if (value) lines.at(-1)!.push({
				part: value,
			})
		}
	}

	// 3. Segment the Lines
	const startLineParts = lines.shift() || []
	const startLine = parseRequestStart(startLineParts, metadata)

	const emptyLineIndex = lines.findIndex(l => l.length === 0 || (l.length === 1 && l[0].part === ''))
	const headerLines = emptyLineIndex === -1 ? lines : lines.slice(0, emptyLineIndex)
	const bodyLines = emptyLineIndex === -1 ? [] : lines.slice(emptyLineIndex + 1)

	if (!startsWithNewline) {
		metadata.appendError({
			reason: 'HTTP request template should start with a newline.',
			autoFix: 'sling.insert_leading_newline',
		})
	}

	if (!endsWithNewline) {
		metadata.appendError({
			reason: 'HTTP request template should end with a newline.',
			autoFix: 'sling.insert_trailing_newline',
		})
	}

	const headers = parseHeaders(headerLines, metadata)
	const textBody = collapseTemplate(bodyLines.slice(0, endsWithNewline ? bodyLines.length - 1 : bodyLines.length - 2))
	const filteredBody = textBody.filter((p): p is PrimitiveValue | Masked<PrimitiveValue> => p !== undefined)
	const body = parseHttpBody(context, metadata, partsToChunks(filteredBody))

	return document({
		startLine,
		headers,
		body,
		metadata,
	})
}

function collapseTemplate(template: TemplateLines) {
	return template.flatMap((line, index) => {
		const lineParts = line.map(part => part.part)
		if (index === 0) return lineParts
		return ['\n', ...lineParts]
	})
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'] as const
const ALLOWED_PROTOCOL_VERSIONS = allowedProtocols.map(a => `${a.protocol}/${a.version}`).join(', ')

/** RFC 3986 allowed characters for a URI (excluding percent-encoding sequences which are already matched by %). */
const URL_VALID_CHARS = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/

function parseRequestStart(parts: TemplateLine, metadata: Metadata): RequestNode | ErrorNode {
	const tokens: TemplateLine = []

	// 1. Re-tokenize strings within the line
	for (const p of parts) {
		if (typeof p.part === 'string') {
			const regex = /(\S+)/g
			let match
			while ((match = regex.exec(p.part)) !== null) {
				const word = match[0]
				tokens.push({
					part: word,
				})
			}
		}
		else {
			tokens.push(p)
		}
	}

	if (tokens.length < 3) {
		return metadata.appendError({
			reason: `Invalid request line. Expected: Method URL Protocol`,
			suggestions: ['sling.check_spacing'],
		})
	}

	// 2. Extract Components
	// Method is always the first token
	const methodPart = tokens[0]

	// Protocol is always the last token
	const protoPart = tokens.at(-1)!

	// URL is everything in between (allows for spaces or multiple interpolation parts)
	const urlParts = tokens.slice(1, -1)

	// 3. Resolve Nodes
	const method = resolveSingleNode(methodPart, metadata)
	if (method.type !== 'text') {
		return metadata.appendError({
			reason: 'Method must be a static string',
		})
	}

	// Validate method against known HTTP methods
	if (!HTTP_METHODS.includes(method.value.toUpperCase() as typeof HTTP_METHODS[number])) {
		return metadata.appendError({
			reason: `Unknown HTTP method: "${method.value}". Expected one of: ${HTTP_METHODS.join(', ')}.`,
		})
	}
	const normalizedMethod = text(method.value.toUpperCase())

	// URL can be complex (ValueNode), so we use the compound resolver
	const url = resolveCompoundNode(urlParts, metadata)

	// Validate static URL parts for illegal characters (parameter inserts are exempt)
	validateUrlParts(url, metadata)

	// 4. Validate Protocol
	if (typeof protoPart.part !== 'string') {
		return metadata.appendError({
			reason: 'Protocol must be a literal string (e.g., HTTP/1.1)',
		})
	}

	const [protoName, protoVersion] = protoPart.part.trim().split('/')
	if (!protoName || !allowedProtocols.some(a => a.protocol === protoName.toUpperCase() && a.version == protoVersion)) {
		return metadata.appendError({
			reason: `Unsupported protocol version: "${protoPart.part.trim()}". Supported: ${ALLOWED_PROTOCOL_VERSIONS}.`,
			suggestions: ['sling.use_http_1_1'],
		})
	}

	return request(
		normalizedMethod, url,
		protoName,
		protoVersion,
	)
}

function validateUrlParts(url: ValuesNode | ValueNode, metadata: Metadata): void {
	if (url.type === 'text') {
		if (url.value && !URL_VALID_CHARS.test(url.value)) {
			metadata.appendError({
				reason: `URL contains illegal characters: "${url.value}". Use percent-encoding for special characters.`,
			})
		}
	}
	else if (url.type === 'values') {
		for (const part of url.values) {
			if (part.type === 'text' && part.value && !URL_VALID_CHARS.test(part.value)) {
				metadata.appendError({
					reason: `URL contains illegal characters: "${part.value}". Use percent-encoding for special characters.`,
				})
			}
		}
	}
}

export function parseHttpBody(context: SlingContext, metadata: Metadata, bodyChunks: TemplateChunks): BodyNode | undefined {
	const processor = getProcessor<ValueNode | ValuesNode>(context, metadata.contentType)
	const contentType = metadata.contentType ?? 'text/undefined'
	const valueNodes = processor.processPayload(metadata, bodyChunks)
	return body(contentType, valueNodes ?? text(''))
}

/** Convert a flat list of resolved parts to TemplateChunks (no loc info; for execution-time use). */
function partsToChunks(parts: (PrimitiveValue | Masked<PrimitiveValue>)[]): TemplateChunks {
	const chunks: TemplateChunk[] = []
	let index = 0
	for (const part of parts) {
		if (typeof part === 'string' || typeof part === 'number' || typeof part === 'boolean') {
			chunks.push({ type: 'chunk:string', value: String(part) })
		}
		else {
			chunks.push({ type: 'chunk:reference', value: part, index: index })
		}
		index++
	}
	return new TemplateChunks(chunks)
}

/**
 * Parse an HTTP request from a {@link TemplateChunks} at definition load time.
 *
 * Unlike {@link parseHttpRequest} (which requires a fully-resolved template),
 * this function accepts the raw template chunks before async DataAccessors are resolved.
 * It pre-populates {@link Metadata.parameters} with all template values so that
 * DataAccessor slots (stored as `undefined`) can be filled at execute time.
 *
 * Source line numbers are read from chunk `loc` and attached to structural nodes.
 */
export function parseHttpTemplate(
	context: SlingContext,
	chunks: TemplateChunks,
	literalLocation: { start: { line: number, column: number }, end: { line: number, column: number } },
): HttpDocument | ErrorNode | undefined {
	const metadata = new Metadata()

	const defaultValidations = validateDefaults(metadata, chunks)
	if (defaultValidations) return document({ startLine: defaultValidations, metadata })

	// Pre-populate metadata.parameters from reference chunks in template value order.
	// DataAccessor / MaskedDataAccessor → undefined slot (filled at execute time).
	for (const chunk of chunks) {
		if (chunk.type !== 'chunk:reference') continue
		const { value } = chunk
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			metadata.parameters.push(value)
		}
		else if (isPrimitiveMask(value)) {
			metadata.parameters.push(value)
		}
		else {
			metadata.parameters.push(undefined)
		}
	}

	// Split at blank line (header/body boundary)
	const split = chunks.splitAtStringPattern(/\n\n/)
	const headerChunks = split ? split[0] : chunks
	const bodyChunks = split ? split[1] : new TemplateChunks([])

	// Build TemplateLines from header chunks, tracking source line numbers
	const lines: TemplateLines = [[]]
	let sourceLine = literalLocation.start.line
	const lineSourceLines: number[] = [sourceLine]
	let indent = -1
	let afterReference = false

	for (const chunk of headerChunks) {
		if (chunk.type === 'chunk:reference') {
			const { value, index } = chunk
			const isPrim = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
			const partValue: PrimitiveValue | Masked<PrimitiveValue> | undefined
				= isPrim ? value as PrimitiveValue : (isPrimitiveMask(value) ? value : undefined)
			lines.at(-1)!.push({ part: partValue, valueIndex: index })
			afterReference = true
		}
		else {
			const stringSplit = chunk.value.split('\n')
			for (let sIndex = 0; sIndex < stringSplit.length; sIndex++) {
				const rawText = stringSplit[sIndex]

				if (sIndex > 0) {
					sourceLine++
					lineSourceLines[lines.length - 1] = sourceLine
				}

				if (indent < 0 && rawText.trim() && (!afterReference || sIndex > 0)) {
					indent = rawText.length - rawText.trimStart().length
				}

				const isContinuation = afterReference && sIndex === 0
				const stripped = isContinuation ? rawText : rawText.slice(Math.max(0, indent))

				if (indent < 0 && !stripped && !isContinuation) continue

				lines.at(-1)!.push({ part: stripped })

				if (sIndex < stringSplit.length - 1) {
					lines.push([])
					lineSourceLines.push(sourceLine)
				}
			}
			afterReference = false
		}
	}

	// Segment header lines
	const startLineParts = lines.shift() || []
	const startLineNumber = lineSourceLines.shift() ?? sourceLine
	const startLine = parseRequestStart(startLineParts, metadata)
	startLine.loc = pointLoc(startLineNumber, Math.max(0, indent))

	const emptyLineIndex = lines.findIndex(l => l.length === 0 || (l.length === 1 && l[0].part === ''))
	const headerLines = emptyLineIndex === -1 ? lines : lines.slice(0, emptyLineIndex)
	const headerLineNums = emptyLineIndex === -1 ? lineSourceLines : lineSourceLines.slice(0, emptyLineIndex)

	const headers = parseHeaders(headerLines, metadata)
	if (headers) {
		for (const [index, header] of headers.entries()) {
			const lineNumber = headerLineNums[index]
			if (lineNumber !== undefined) header.loc = pointLoc(lineNumber, Math.max(0, indent))
		}
	}

	// Parse body — loc comes directly from the body chunks
	const firstBodyChunk = bodyChunks.chunks[0]
	const bodyStartLoc = firstBodyChunk?.loc?.start
	const bodyNode = parseHttpBody(context, metadata, bodyChunks)
	if (bodyNode && bodyStartLoc) {
		bodyNode.loc = pointLoc(bodyStartLoc.line, bodyStartLoc.column)
	}

	const document_ = document({ startLine, headers, body: bodyNode, metadata })
	document_.loc = { start: literalLocation.start, end: literalLocation.end }
	return document_
}

/** Build a zero-width SourceLocation pointing at (line, column). */
function pointLoc(line: number, column: number) {
	const pos = { line, column }
	return { start: pos, end: pos }
}
