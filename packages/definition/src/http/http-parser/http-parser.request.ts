import { ResolvedStringTemplate } from '../../types'
import { parseHttpBody } from '../body-parser/body-parser'
import {
	allowedProtocols,
	document,
	HttpDocument,
	Metadata,
	RequestNode,
	ErrorNode,
	error,
	request,
} from '../http.nodes'

import { parseHeaders, resolveCompoundNode, resolveSingleNode, TemplateLine, TemplateLines } from './http-parser'

export function parseHttpRequest(requestTemplate: ResolvedStringTemplate): HttpDocument | ErrorNode | undefined {
	const { strings, values } = requestTemplate
	const metadata = new Metadata()

	if (!values || (values.length === 0 && strings.join('').trim().length === 0))
		return error({
			reason: 'HTTP requests cannot be empty string',
			autoFix: 'sling.initial-format',
		})

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
		metadata.errors = metadata.errors || []
		metadata.errors.push(error({
			reason: 'HTTP request template should start with a newline.',
			autoFix: 'sling.insert_leading_newline',
		}))
	}

	if (!endsWithNewline) {
		metadata.errors = metadata.errors || []
		metadata.errors.push(error({
			reason: 'HTTP request template should end with a newline.',
			autoFix: 'sling.insert_trailing_newline',
		}))
	}

	const headers = parseHeaders(headerLines, metadata)
	const textBody = collapseTemplate(bodyLines.slice(0, endsWithNewline ? bodyLines.length - 1 : bodyLines.length - 2))
	const body = parseHttpBody(metadata, textBody)

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
		return error({
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
		return error({
			reason: 'Method must be a static string',
		})
	}

	// URL can be complex (ValueNode), so we use the compound resolver
	const url = resolveCompoundNode(urlParts, metadata)

	// 4. Validate Protocol
	if (typeof protoPart.part !== 'string') {
		return error({
			reason: 'Protocol must be a literal string (e.g., HTTP/1.1)',
		})
	}

	const [protoName, protoVersion] = protoPart.part.trim().split('/')
	if (!protoName || !allowedProtocols.some(a => a.protocol === protoName.toUpperCase() && a.version == protoVersion)) {
		return error({
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
