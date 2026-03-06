import { Metadata } from '../nodes/metadata'
import { TemplateChunks } from '../template-chunks'
import { MimeType } from '../types'

import { lexJson } from './json/json.lexer'
import { document, JsonDocument } from './json/json.nodes'
import { parseJsonTokens } from './json/json.parser'
import { PayloadProcessor } from './payload-processor'

// TODO re-check exports

export function isJsonContentType(contentType: MimeType | undefined): boolean {
	if (!contentType) return false
	return contentType === 'application/json' || contentType.endsWith('+json')
}

export function convertToJsonAst(metadata: Metadata, chunks: TemplateChunks): JsonDocument {
	const tokens = lexJson(chunks)
	const ast = parseJsonTokens(tokens, metadata)
	return document(ast)
}

// eslint-disable-next-line
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
	processPayload(metadata, chunks) {
		return convertToJsonAst(metadata, chunks)
	},
})
