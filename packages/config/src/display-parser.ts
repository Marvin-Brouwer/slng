import { buildJsonBodyAst, isJsonContentType, jsonValueToAst } from './display-parser.json.js'
import { makeSentinel, SENTINEL_RE } from './display-parser.sentinel.js'
import { buildPlainTextBodyAst } from './display-parser.text.js'
import { isMask, type Masked } from './masking/mask.js'
import { parseHttpText, resolveInterpolationDisplay } from './parser.js'

import type {
	BodyAstNode,
	DisplayHttpRequest,
	MaskedReference,
	SlingInterpolation,
} from './types.js'

/**
 * Build a {@link DisplayHttpRequest} from the template parts.
 *
 * Masked interpolations are tracked by index into `maskedValues` and
 * surfaced as {@link MaskedReference} in headers or `masked` AST nodes in the body.
 */
export function parseTemplateDisplay(
	strings: ReadonlyArray<string>,
	values: ReadonlyArray<SlingInterpolation>,
	maskedValues: ReadonlyArray<Masked<unknown>>,
): DisplayHttpRequest {
	// Build a mapping from template value index → maskedValues index
	const maskIndexMap = new Map<number, number>()
	for (const [valueIndex, value] of values.entries()) {
		if (isMask(value)) {
			const maskedIndex = maskedValues.indexOf(value as Masked<unknown>)
			if (maskedIndex !== -1) maskIndexMap.set(valueIndex, maskedIndex)
		}
	}

	// Assemble the raw HTTP text with sentinels for masked values
	const displayValues = values.map((value, index) => {
		if (maskIndexMap.has(index)) {
			return makeSentinel(maskIndexMap.get(index)!)
		}
		return resolveInterpolationDisplay(value)
	})

	let assembled = ''
	for (const [index, string_] of strings.entries()) {
		assembled += string_
		if (index < displayValues.length) {
			assembled += displayValues[index]
		}
	}

	// Parse the assembled text to get method/url/headers/body
	const parsed = parseHttpText(assembled)

	// Process headers: replace sentinel values with MaskedReference
	const headers: Record<string, string | MaskedReference> = {}
	for (const [key, value] of Object.entries(parsed.headers)) {
		const sentinelMatch = SENTINEL_RE.exec(value)
		SENTINEL_RE.lastIndex = 0

		if (sentinelMatch && sentinelMatch[0] === value) {
			// Entire header value is a single masked value
			const maskedIndex = Number(sentinelMatch[1])
			const mask = maskedValues[maskedIndex]
			headers[key] = { index: maskedIndex, mask: mask.value }
		}
		else if (SENTINEL_RE.test(value)) {
			// Mixed content — replace sentinels with their display text
			SENTINEL_RE.lastIndex = 0
			headers[key] = value.replaceAll(SENTINEL_RE, (_match, index: string) => {
				return maskedValues[Number(index)].value
			})
		}
		else {
			headers[key] = value
		}
	}

	// Resolve content type
	const contentType = getContentTypeHeader(parsed.headers)

	// Build body AST
	const body = parsed.body === undefined
		? undefined
		: buildBodyAstWithMasks(parsed.body, contentType, maskedValues)

	return {
		method: parsed.method,
		url: parsed.url,
		httpVersion: parsed.httpVersion,
		headers,
		body,
		contentType,
	}
}

/**
 * Build a body AST from a plain body string (no masked values).
 * Used for response bodies.
 */
export function buildBodyAst(
	body: string,
	contentType: string | undefined,
): BodyAstNode[] {
	if (isJsonContentType(contentType)) {
		try {
			const parsed: unknown = JSON.parse(body)
			return [jsonValueToAst(parsed)]
		}
		catch {
			return [{ type: 'text', value: body }]
		}
	}
	return [{ type: 'text', value: body }]
}

// ── Internal helpers ─────────────────────────────────────────

function buildBodyAstWithMasks(
	body: string,
	contentType: string | undefined,
	maskedValues: ReadonlyArray<Masked<unknown>>,
): BodyAstNode[] {
	if (isJsonContentType(contentType)) {
		return buildJsonBodyAst(body, maskedValues)
	}
	return buildPlainTextBodyAst(body, maskedValues)
}

function getContentTypeHeader(headers: Record<string, string>): string | undefined {
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === 'content-type') return value.split(';')[0].trim()
	}
	return undefined
}
