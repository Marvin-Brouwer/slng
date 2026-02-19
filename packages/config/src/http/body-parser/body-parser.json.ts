import { TemplateLines } from '../http-parser/http-parser'
import { Metadata } from '../http.nodes'

import { lexJson } from './json/json.lexer'
import { document, JsonDocument } from './json/json.nodes'
import { parseJsonTokens } from './json/json.parser'

export function isJsonContentType(contentType: string | undefined): boolean {
	if (!contentType) return false
	return contentType === 'application/json' || contentType.endsWith('+json')
}

export function convertToJsonAst(metadata: Metadata, lines: TemplateLines): JsonDocument {
	const tokens = lexJson(lines)
	const ast = parseJsonTokens(tokens, metadata)
	return document(ast)
}
