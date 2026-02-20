import { Masked } from '../../masking/mask'
import { PrimitiveValue } from '../../types'
import { Metadata } from '../http.nodes'

import { lexJson } from './json/json.lexer'
import { document, JsonDocument } from './json/json.nodes'
import { parseJsonTokens } from './json/json.parser'

export function isJsonContentType(contentType: string | undefined): boolean {
	if (!contentType) return false
	return contentType === 'application/json' || contentType.endsWith('+json')
}

export function convertToJsonAst(metadata: Metadata, parts: (PrimitiveValue | Masked<PrimitiveValue>)[]): JsonDocument {
	const tokens = lexJson(parts)
	const ast = parseJsonTokens(tokens, metadata)
	return document(ast)
}
