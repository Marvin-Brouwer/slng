import { Masked } from '../masking/mask'
import { Metadata } from '../nodes/nodes'
import { MimeType, PrimitiveValue } from '../types'

import { lexJson } from './json/json.lexer'
import { document, JsonDocument } from './json/json.nodes'
import { parseJsonTokens } from './json/json.parser'
import { PayloadProcessor } from './payload-processor'

// TODO re-check exports

export function isJsonContentType(contentType: MimeType | string | undefined): boolean {
	if (!contentType) return false
	return contentType === 'application/json' || contentType.endsWith('+json')
}

export function convertToJsonAst(metadata: Metadata, parts: (PrimitiveValue | Masked<PrimitiveValue>)[]): JsonDocument {
	const tokens = lexJson(parts)
	const ast = parseJsonTokens(tokens, metadata)
	return document(ast)
}


export type JsonOptions = {
	// TODO configure JSON settings (doesn't have default values, a default JSON plugin is loaded, the user may override)
	// - commentMode  (defaults to `allow:strip`)
	//   - `allow:strict` = only allow application/jsonc or */*+jsonc
	//   - `allow:strip` = allow comments, strip when sending
	//   - `allow:keep` = always run as if jsonc
	// - trailingCommas (defaults to `allow:strip`)
	//   - `allow:strip` = allow but strip when sending
	//   - `allow:keep` = allow trailing comments
	//   - 'error' = error on trailing commas

}

export const jsonPayloadProcessor = (_options: JsonOptions): PayloadProcessor<JsonDocument> => ({
	canProcess: isJsonContentType,
	processPayload(metadata, parts) {
		return convertToJsonAst(metadata, parts)
	}
})