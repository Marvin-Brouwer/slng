import { SENTINEL_RE } from './display-parser.sentinel.js'
import { buildPlainTextBodyAst } from './display-parser.text.js'

import type { Masked } from './masking/mask.js'
import type {
	BodyAstNode,
	JsonAstNode,
} from './types.js'

export function isJsonContentType(contentType: string | undefined): boolean {
	if (!contentType) return false
	return contentType === 'application/json' || contentType.endsWith('+json')
}

export function buildJsonBodyAst(
	body: string,
	maskedValues: ReadonlyArray<Masked<unknown>>,
): BodyAstNode[] {
	try {
		const parsed: unknown = JSON.parse(body)
		return [jsonValueToAstWithMasks(parsed, maskedValues)]
	}
	catch {
		// Fall back to plain text if JSON is invalid
		return buildPlainTextBodyAst(body, maskedValues)
	}
}

export function jsonValueToAst(value: unknown): JsonAstNode {
	if (value === null) return { type: 'null' }
	if (typeof value === 'boolean') return { type: 'boolean', value }
	if (typeof value === 'number') return { type: 'number', value: String(value) }
	if (typeof value === 'string') return { type: 'string', value }
	if (Array.isArray(value)) {
		return {
			type: 'array',
			items: value.map(item => jsonValueToAst(item)),
		}
	}
	if (typeof value === 'object') {
		return {
			type: 'object',
			entries: Object.entries(value as Record<string, unknown>).map(
				([key, value_]) => [
					{ type: 'string' as const, value: key },
					jsonValueToAst(value_),
				],
			),
		}
	}
	return { type: 'string', value: String(value as string | number | boolean) }
}

function jsonValueToAstWithMasks(
	value: unknown,
	maskedValues: ReadonlyArray<Masked<unknown>>,
): JsonAstNode {
	if (value === null) return { type: 'null' }
	if (typeof value === 'boolean') return { type: 'boolean', value }
	if (typeof value === 'number') return { type: 'number', value: String(value) }
	if (typeof value === 'string') {
		// Check if this string is exactly a sentinel
		const match = SENTINEL_RE.exec(value)
		SENTINEL_RE.lastIndex = 0
		if (match && match[0] === value) {
			const index = Number(match[1])
			return { type: 'masked', index, mask: maskedValues[index].value }
		}
		return { type: 'string', value }
	}
	if (Array.isArray(value)) {
		return {
			type: 'array',
			items: value.map(item => jsonValueToAstWithMasks(item, maskedValues)),
		}
	}
	if (typeof value === 'object') {
		return {
			type: 'object',
			entries: Object.entries(value as Record<string, unknown>).map(
				([key, value_]) => [
					{ type: 'string' as const, value: key },
					jsonValueToAstWithMasks(value_, maskedValues),
				],
			),
		}
	}
	return { type: 'string', value: String(value as string | number | boolean) }
}
