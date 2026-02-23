import { isMask, type Masked } from '../../masking/mask.js'
import type { SlingNode } from '../../sling-node.js'
import type { PrimitiveValue } from '../../types.js'
import { body, BodyNode, masked, Metadata, text, values } from '../http.nodes.js'
import { convertToJsonAst, isJsonContentType } from './body-parser.json.js'

/**
 * A pluggable body content parser. The map key is the parser name, making
 * entries overridable by downstream plugins or user config.
 *
 * @example Replacing the default JSON parser:
 * ```ts
 * import { defaultBodyParsers } from '@slng/definition'
 * defaultBodyParsers['json'] = myJsonParser
 * ```
 */
export interface BodyContentParser<T extends SlingNode = SlingNode> {
	/** Returns true when this parser should handle the given content type. */
	canProcess(contentType: string | undefined): boolean
	/**
	 * Parse raw body parts into a typed BodyNode.
	 * Returns undefined when the body is empty.
	 */
	parse(
		metadata: Metadata,
		textBody: (PrimitiveValue | Masked<PrimitiveValue>)[],
	): BodyNode<T> | undefined
}

/**
 * Default body parsers keyed by name. The name makes each entry overridable.
 * Parsers are tried in insertion order — first match wins.
 */
export const defaultBodyParsers: Record<string, BodyContentParser> = {
	json: {
		canProcess: (contentType) => isJsonContentType(contentType),
		parse(metadata, textBody) {
			if (!metadata.contentType) return undefined
			return body(metadata.contentType, convertToJsonAst(metadata, textBody))
		},
	},
	text: {
		canProcess: (contentType) => {
			if (!contentType) return false
			return contentType.startsWith('text/')
		},
		parse(metadata, textBody) {
			const contentType = metadata.contentType ?? 'text/undefined'
			if (textBody.length === 0) return undefined

			const bodyNodes = textBody.map((part) => {
				if (isMask(part)) return masked(metadata.appendMaskedValue(part), part.value)
				return text(part)
			})

			if (bodyNodes.length === 1) return body(contentType, bodyNodes[0])
			return body(contentType, values(...bodyNodes))
		},
	},
}

/** Find the first parser that can handle the given content type. */
export function resolveBodyParser(
	contentType: string | undefined,
	parsers: Record<string, BodyContentParser> = defaultBodyParsers,
): BodyContentParser | undefined {
	for (const parser of Object.values(parsers)) {
		if (parser.canProcess(contentType)) return parser
	}
	return undefined
}
