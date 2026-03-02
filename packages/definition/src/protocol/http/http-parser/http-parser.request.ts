import { isPrimitiveMask, Masked } from '../../../masking/mask'
import { Metadata } from '../../../nodes/metadata'
import { ErrorNode, text, ValueNode, ValuesNode } from '../../../nodes/nodes'
import { getProcessor } from '../../../payload/payload-processor'
import { PrimitiveValue, ResolvedStringTemplate, SlingContext, StringTemplate } from '../../../types'
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
	const body = parseHttpBody(context, metadata, textBody)

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

	// URL can be complex (ValueNode), so we use the compound resolver
	const url = resolveCompoundNode(urlParts, metadata)

	// 4. Validate Protocol
	if (typeof protoPart.part !== 'string') {
		return metadata.appendError({
			reason: 'Protocol must be a literal string (e.g., HTTP/1.1)',
		})
	}

	const [protoName, protoVersion] = protoPart.part.trim().split('/')
	if (!protoName || !allowedProtocols.some(a => a.protocol === protoName.toUpperCase() && a.version == protoVersion)) {
		return metadata.appendError({
			reason: `Unsupported protocol: "${protoName}". Expected HTTP/1.1.`,
			suggestions: ['sling.use_http_1_1'],
		})
	}

	return request(
		method, url,
		protoName,
		protoVersion,
	)
}

export function parseHttpBody(context: SlingContext, metadata: Metadata, textBody: (PrimitiveValue | Masked<PrimitiveValue> | undefined)[]): BodyNode | undefined {
	const processor = getProcessor<ValueNode | ValuesNode>(context, metadata.contentType)
	const contentType = metadata.contentType ?? 'text/undefined'

	// Filter undefined slots — DataAccessor values are unknown at parse time
	const filteredBody = textBody.filter((p): p is PrimitiveValue | Masked<PrimitiveValue> => p !== undefined)
	const valueNodes = processor.processPayload(metadata, filteredBody)

	return body(contentType, valueNodes ?? text(''))
}

/**
 * Parse an HTTP request from a {@link StringTemplate} at definition load time.
 *
 * Unlike {@link parseHttpRequest} (which requires a fully-resolved template),
 * this function accepts the raw template before async DataAccessors are resolved.
 * It pre-populates {@link Metadata.parameters} with all template values so that
 * DataAccessor slots (stored as `undefined`) can be filled at execute time.
 *
 * Source line numbers are computed from `literalLocation` and attached to
 * structural nodes (RequestNode, HeaderNode, BodyNode, HttpDocument).
 */
export function parseHttpTemplate(
	context: SlingContext,
	template: StringTemplate,
	literalLocation: { start: { line: number, column: number }, end: { line: number, column: number } },
): HttpDocument | ErrorNode | undefined {
	const { strings, values } = template
	const metadata = new Metadata()

	const defaultValidations = validateDefaults(metadata, template)
	if (defaultValidations) return document({
		startLine: defaultValidations,
		metadata,
	})

	// Pre-populate metadata.parameters in template value order.
	// DataAccessor / MaskedDataAccessor → undefined slot (filled at execute time).
	// The index in metadata.parameters matches the index in template.values.
	for (const value of values) {
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

	// 2. Interleave strings and values into lines, tracking source line numbers.
	// sourceLine counts absolute line numbers starting from literalLocation.start.line.
	// lineSourceLines[i] = source line where lines[i] begins.
	const lines: TemplateLines = [[]]
	let sourceLine = literalLocation.start.line
	const lineSourceLines: number[] = [sourceLine]
	let indent = -1

	for (const [index, string_] of strings.entries()) {
		if (string_ !== undefined) {
			const split = string_.split('\n')
			for (let sIndex = 0; sIndex < split.length; sIndex++) {
				const rawText = split[sIndex]

				if (sIndex > 0) {
					sourceLine++
					// Update the source line for the last (current) lines[] entry
					lineSourceLines[lines.length - 1] = sourceLine
				}

				if (indent < 0 && rawText.trim() && (index === 0 || sIndex > 0)) {
					indent = rawText.length - rawText.trimStart().length
				}

				const isContinuation = index > 0 && sIndex === 0
				const stripped = isContinuation
					? rawText
					: rawText.slice(Math.max(0, indent))

				if (indent < 0 && !stripped && !isContinuation) continue

				lines.at(-1)!.push({ part: stripped })

				if (sIndex < split.length - 1) {
					lines.push([])
					lineSourceLines.push(sourceLine) // placeholder; updated at next sIndex > 0
				}
			}
		}

		if (index < values.length) {
			const value = values[index]
			const isPrim = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
			const partValue: PrimitiveValue | Masked<PrimitiveValue> | undefined
				= isPrim
					? value as PrimitiveValue
					: (isPrimitiveMask(value)
							? value
							: undefined)
			lines.at(-1)!.push({ part: partValue, valueIndex: index })
		}
	}

	// 3. Segment the Lines
	const startLineParts = lines.shift() || []
	const startLineNumber = lineSourceLines.shift() ?? sourceLine
	const startLine = parseRequestStart(startLineParts, metadata)
	startLine.loc = pointLoc(startLineNumber, Math.max(0, indent))

	const emptyLineIndex = lines.findIndex(l => l.length === 0 || (l.length === 1 && l[0].part === ''))
	const headerLines = emptyLineIndex === -1 ? lines : lines.slice(0, emptyLineIndex)
	const headerLineNums = emptyLineIndex === -1 ? lineSourceLines : lineSourceLines.slice(0, emptyLineIndex)
	const bodyLines = emptyLineIndex === -1 ? [] : lines.slice(emptyLineIndex + 1)
	const bodyLineNumber = emptyLineIndex === -1 ? undefined : lineSourceLines[emptyLineIndex + 1]

	const headers = parseHeaders(headerLines, metadata)
	if (headers) {
		for (const [index, header] of headers.entries()) {
			const lineNumber = headerLineNums[index]
			if (lineNumber !== undefined) header.loc = pointLoc(lineNumber, Math.max(0, indent))
		}
	}

	const lastString = template.strings.at(-1)!
	const endsWithNewline = /\n\s*$/.test(lastString)
	const textBody = collapseTemplate(bodyLines.slice(0, endsWithNewline ? bodyLines.length - 1 : bodyLines.length - 2))
	const bodyNode = parseHttpBody(context, metadata, textBody)
	if (bodyNode && bodyLineNumber !== undefined) {
		bodyNode.loc = pointLoc(bodyLineNumber, Math.max(0, indent))
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
