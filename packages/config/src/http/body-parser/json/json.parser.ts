import { BaseNode } from 'estree'

import { Metadata } from '../../http.nodes'

import { LexerToken, MaskedToken, PunctuationToken, ValueToken } from './json.lexer'
import {
	_null, array, boolean, commentBlock, commentLine, composite, jsonMask, number, object, punctuation, string, unknown, whitespace,
} from './json.nodes'

import type { JsonAstNode, JsonMaskedNode, JsonObjectNode, JsonValueNode } from './json.nodes'

type ParserState = {
	cursor: number
	tokens: LexerToken[]
	metadata: Metadata
}

const peek = (state: ParserState) => state.tokens[state.cursor]
const advance = (state: ParserState) => state.cursor++

/**
 * Entry point for the parser
 */
export function parseJsonTokens(tokens: LexerToken[], metadata: Metadata): JsonAstNode[] {
	const state: ParserState = { cursor: 0, tokens, metadata }
	const nodes: JsonAstNode[] = []

	while (peek(state)?.type !== 'EOF') {
		const node = parseNode(state)
		if (node) nodes.push(node)
	}

	return nodes
}

function parseNode(state: ParserState, variant: 'key' | 'value' = 'value'): JsonAstNode | undefined {
	const token = peek(state)
	if (!token) return undefined

	// eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
	switch (token.type) {
		case 'json-token:whitespace': {
			advance(state)
			return whitespace(token.value)
		}

		case 'json-token:comment-body':
		case '//':
		case '/*':
		case '*/': {
			return parseComment(state)
		}

		case '{': {
			return parseObject(state)
		}

		case '[': {
			return parseArray(state)
		}

		case '"': {
			return parseString(state, variant)
		}

		case 'json-token:literal': {
			advance(state)
			return parseLiteralValue(token.value, variant)
		}

		case 'json-token:masked': {
			advance(state)
			// Registering with metadata as discussed previously
			return jsonMask(state.metadata, (token as MaskedToken).value)
		}

		case ':':
		case ',': {
			advance(state)
			return punctuation(token.type)
		}

		default: {
			advance(state)
			return undefined
		}
	}
}

function parseObject(state: ParserState): JsonObjectNode {
	advance(state) // Skip '{'
	const children: JsonAstNode[] = []
	let position: 'key' | 'value' = 'key'

	while (state.cursor < state.tokens.length) {
		const token = peek(state)
		if (isPunctuationToken(token, '}') || isEnd(token)) break

		if (isPunctuationToken(token, ':')) {
			advance(state)
			children.push(punctuation(':'))
			position = 'value'
			continue
		}

		if (isPunctuationToken(token, ',')) {
			advance(state)
			children.push(punctuation(','))
			position = 'key'
			continue
		}

		const node = parseNode(state, position)
		if (node) children.push(node)
	}

	advance(state) // Skip '}'

	return object(children)
}

function parseArray(state: ParserState) {
	advance(state) // Skip '['
	const items: JsonAstNode[] = []

	while (state.cursor < state.tokens.length) {
		const token = peek(state)
		if (isPunctuationToken(token, ']') || isEnd(token)) break

		const node = parseNode(state)
		if (node) items.push(node)
	}

	advance(state) // Skip ']'
	return array(items)
}

function parseString(state: ParserState, variant: 'key' | 'value' = 'value') {
	advance(state) // Skip opening '"'
	const parts: (JsonValueNode<string> | JsonMaskedNode)[] = []

	while (state.cursor < state.tokens.length) {
		const token = peek(state)
		if (isPunctuationToken(token, '"') || isEnd(token)) break

		if (isValueToken(token, 'json-token:string-content')) {
			parts.push(string(token.value, variant))
			advance(state)
			continue
		}
		if (token.type === 'json-token:masked') {
			parts.push(jsonMask(state.metadata, (token as MaskedToken).value))
			advance(state)
			continue
		}

		// Unexpected token inside a string, treat as text or skip
		advance(state)
	}

	advance(state) // Skip closing '"'

	if (parts.length === 0) return string('', variant)
	if (parts.length === 1 && parts[0].type === 'json:string') return parts[0]
	return composite('string', parts, variant)
}

function parseComment(state: ParserState) {
	const startToken = peek(state)
	const variant = startToken.type === '//' ? 'line' : 'block'
	let value = ''

	// Collect everything until the comment logic is finished
	while (state.cursor < state.tokens.length) {
		const token = peek(state)
		if (isCommentPunctuation(token)) {
			value += token.type
			advance(state)
			if (token.type === '*/') break
		}
		else if (isValueToken(token, 'json-token:comment-body')) {
			value += token.value
			advance(state)
			if (variant === 'line' && token.value?.toString().includes('\n')) break
		}
		else {
			break
		}
	}

	return variant === 'line' ? commentLine(value) : commentBlock(value)
}

function parseLiteralValue(value: string, variant: 'key' | 'value' = 'value'): JsonAstNode {
	if (value === 'true') return boolean(true)
	if (value === 'false') return boolean(false)
	if (value === 'null') return _null()
	// Illegal value fallback
	if (value === 'undefined') return _null()

	const numberValue = Number(value)
	if (!Number.isNaN(numberValue)) return number(numberValue, variant)

	// Unknown values are handled here, this SHOULD never happen
	return unknown(value)
}

function isCommentPunctuation(token: LexerToken): token is PunctuationToken {
	return token.type === '//' || token.type === '/*' || token.type === '*/'
}

function isPunctuationToken(token: LexerToken, type?: PunctuationToken['type']): token is PunctuationToken {
	if (!type) return !Object.hasOwn(token, 'value')
	return type === token.type
}
function isValueToken(token: LexerToken, type: ValueToken['type']): token is ValueToken {
	return Object.hasOwn(token, 'value') && type === token.type
}

function isEnd(token: LexerToken): token is (BaseNode & { type: 'EOF' }) {
	return token.type == 'EOF'
}
