import { Metadata } from '../../nodes/metadata'
import { SlingNode } from '../../nodes/nodes'

import { LexerToken, MaskedToken, PunctuationToken, ValueToken } from './json.lexer'
import {
	_null, array, boolean, commentBlock, commentLine, jsonMask, number, object, punctuation, string, unknown, valueContent, whitespace,
} from './json.nodes'

import type { JsonAstNode, JsonMaskedNode, JsonObjectNode, JsonStringNode, JsonValueContentNode } from './json.nodes'

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
			return whitespace(token.value, token.loc)
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
			return parseLiteralValue(token.value, variant, token.loc)
		}

		case 'json-token:masked': {
			advance(state)
			return wrapMaskedNode(state, token as MaskedToken, variant)
		}

		case ':':
		case ',': {
			advance(state)
			return punctuation(token.type, undefined, token.loc)
		}

		default: {
			advance(state)
			return undefined
		}
	}
}

/**
 * Wraps a bare masked token (outside a string literal) in the appropriate container.
 * - masked string → json:string { parts: [punct'"', masked, punct'"'] }
 * - masked number → json:number { parts: [masked] }
 * - masked boolean/other → bare masked node
 */
function wrapMaskedNode(state: ParserState, token: MaskedToken, variant: 'key' | 'value'): JsonAstNode {
	const maskedNode = jsonMask(state.metadata, token.value, token.loc)
	const maskedType = maskedNode.type // 'json:masked:string' | 'json:masked:number' | ...

	if (maskedType === 'json:masked:string') {
		const openQuote = punctuation('"', variant, token.loc ? { start: token.loc.start, end: token.loc.start } : undefined)
		const closeQuote = punctuation('"', variant, token.loc ? { start: token.loc.end, end: token.loc.end } : undefined)
		return string([openQuote, maskedNode, closeQuote], variant, token.loc)
	}

	if (maskedType === 'json:masked:number') {
		return number([maskedNode], variant, token.loc)
	}

	// boolean and other masked types — return bare masked node
	return maskedNode
}

function parseObject(state: ParserState): JsonObjectNode {
	const openBrace = peek(state) // '{'
	advance(state)
	const children: JsonAstNode[] = []
	type Phase = 'key' | 'colon' | 'value' | 'after-value'
	let phase: Phase = 'key'
	let hasEntries = false
	let lastCommaLoc: JsonAstNode['loc'] | undefined
	let lastNodeLoc: JsonAstNode['loc'] | undefined

	while (state.cursor < state.tokens.length) {
		const token = peek(state)

		if (isEnd(token)) {
			state.metadata.appendError({ reason: 'Unterminated object, expected "}"', loc: openBrace?.loc })
			break
		}

		if (isPunctuationToken(token, '}')) {
			if (phase === 'key' && hasEntries) {
				state.metadata.appendError({ reason: 'Trailing comma is not allowed', loc: lastCommaLoc })
			}
			break
		}

		if (isTransparent(token)) {
			const node = parseNode(state, phase === 'key' ? 'key' : 'value')
			if (node) children.push(node)
			continue
		}

		if (isPunctuationToken(token, ':')) {
			if (phase !== 'colon') {
				state.metadata.appendError({ reason: 'Unexpected ":"', loc: token.loc })
			}
			advance(state)
			children.push(punctuation(':', undefined, token.loc))
			phase = 'value'
			continue
		}

		if (isPunctuationToken(token, ',')) {
			if (phase !== 'after-value') {
				state.metadata.appendError({ reason: 'Unexpected ","', loc: token.loc })
			}
			advance(state)
			children.push(punctuation(',', undefined, token.loc))
			lastCommaLoc = token.loc
			phase = 'key'
			continue
		}

		// Content token (key, value, nested structure)
		if (phase === 'after-value') {
			state.metadata.appendError({ reason: 'Expected "," or "}" after object value', loc: lastNodeLoc })
			phase = 'key'
		}
		if (phase === 'colon') {
			state.metadata.appendError({ reason: 'Expected ":" after object key', loc: lastNodeLoc })
			phase = 'value'
		}

		const nodeVariant: 'key' | 'value' = phase === 'key' ? 'key' : 'value'
		const node = parseNode(state, nodeVariant)
		if (node) {
			children.push(node)
			lastNodeLoc = node.loc
			phase = nodeVariant === 'key' ? 'colon' : 'after-value'
			hasEntries = true
		}
	}

	const closeBrace = peek(state) // '}'
	advance(state)

	if (openBrace?.loc) children.unshift(setLoc(punctuation('{'), openBrace.loc))
	if (closeBrace?.loc && closeBrace.type !== 'EOF') children.push(setLoc(punctuation('}'), closeBrace.loc))

	const node = object(children)
	if (openBrace?.loc && closeBrace?.loc && closeBrace.type !== 'EOF') {
		node.loc = { start: openBrace.loc.start, end: closeBrace.loc.end }
	}
	return node
}

function parseArray(state: ParserState) {
	const openBracket = peek(state) // '['
	advance(state)
	const items: JsonAstNode[] = []
	type Phase = 'value' | 'after-value'
	let phase: Phase = 'value'
	let hasEntries = false
	let lastCommaLoc: JsonAstNode['loc'] | undefined
	let lastNodeLoc: JsonAstNode['loc'] | undefined

	while (state.cursor < state.tokens.length) {
		const token = peek(state)

		if (isEnd(token)) {
			state.metadata.appendError({ reason: 'Unterminated array, expected "]"', loc: openBracket?.loc })
			break
		}

		if (isPunctuationToken(token, ']')) {
			if (phase === 'value' && hasEntries) {
				state.metadata.appendError({ reason: 'Trailing comma is not allowed', loc: lastCommaLoc })
			}
			break
		}

		if (isTransparent(token)) {
			const node = parseNode(state)
			if (node) items.push(node)
			continue
		}

		if (isPunctuationToken(token, ',')) {
			if (phase !== 'after-value') {
				state.metadata.appendError({ reason: 'Unexpected ","', loc: token.loc })
			}
			advance(state)
			items.push(punctuation(',', undefined, token.loc))
			lastCommaLoc = token.loc
			phase = 'value'
			continue
		}

		// Content token
		if (phase === 'after-value') {
			state.metadata.appendError({ reason: 'Expected "," or "]" after array item', loc: lastNodeLoc })
		}

		const node = parseNode(state)
		if (node) {
			items.push(node)
			lastNodeLoc = node.loc
			phase = 'after-value'
			hasEntries = true
		}
	}

	const closeBracket = peek(state) // ']'
	advance(state)

	if (openBracket?.loc) items.unshift(setLoc(punctuation('['), openBracket.loc))
	if (closeBracket?.loc && closeBracket.type !== 'EOF') items.push(setLoc(punctuation(']'), closeBracket.loc))

	const node = array(items)
	if (openBracket?.loc && closeBracket?.loc && closeBracket.type !== 'EOF') {
		node.loc = { start: openBracket.loc.start, end: closeBracket.loc.end }
	}
	return node
}

function parseString(state: ParserState, variant: 'key' | 'value' = 'value'): JsonStringNode {
	const openQuote = peek(state)
	advance(state) // Skip opening '"'
	const parts: (JsonValueContentNode | JsonMaskedNode)[] = []

	while (state.cursor < state.tokens.length) {
		const token = peek(state)
		if (isPunctuationToken(token, '"') || isEnd(token)) break

		if (isValueToken(token, 'json-token:string-content')) {
			parts.push(setLoc(valueContent(token.value, variant), token.loc))
			advance(state)
			continue
		}
		if (token.type === 'json-token:masked') {
			parts.push(setLoc(jsonMask(state.metadata, token.value), token.loc))
			advance(state)
			continue
		}

		// Unexpected token inside a string, treat as text or skip
		advance(state)
	}

	const closeQuote = peek(state)
	advance(state) // Skip closing '"'

	if (closeQuote.type === 'EOF') {
		state.metadata.appendError({ reason: 'Unterminated string literal', loc: openQuote.loc })
	}

	const openQuotePunct = setLoc(punctuation('"', variant), openQuote.loc)
	const closeQuotePunct = closeQuote.type === 'EOF'
		? undefined
		: setLoc(punctuation('"', variant), closeQuote.loc)

	const allParts: JsonStringNode['parts'] = [
		openQuotePunct,
		...parts,
		...(closeQuotePunct ? [closeQuotePunct] : []),
	]
	const result = string(allParts, variant)
	if (openQuote.loc && closeQuotePunct?.loc) {
		result.loc = { start: openQuote.loc.start, end: closeQuotePunct.loc.end }
	}
	return result
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

	const endToken = state.tokens[state.cursor - 1]
	const node = variant === 'line' ? commentLine(value) : commentBlock(value)
	if (startToken?.loc && endToken?.loc) {
		node.loc = { start: startToken.loc.start, end: endToken.loc.end }
	}
	return node
}

function parseLiteralValue(value: string, variant: 'key' | 'value' = 'value', loc?: SlingNode['loc']): JsonAstNode {
	if (value === 'true') return boolean(true, loc)
	if (value === 'false') return boolean(false, loc)
	if (value === 'null') return _null(loc)
	// Illegal value fallback
	if (value === 'undefined') return _null(loc)

	const numberValue = Number(value)
	if (!Number.isNaN(numberValue)) {
		const content = setLoc(valueContent(numberValue, variant), loc)
		return setLoc(number([content], variant), loc)
	}

	// Unknown values are handled here, this SHOULD never happen
	return unknown(value, loc)
}

function setLoc<T extends SlingNode>(node: T, loc: SlingNode['loc']): T {
	node.loc = loc
	return node
}

function isCommentPunctuation(token: LexerToken): token is PunctuationToken {
	return token.type === '//' || token.type === '/*' || token.type === '*/'
}

function isPunctuationToken<T extends PunctuationToken['type']>(token: LexerToken, type: T): token is PunctuationToken & { type: T }
function isPunctuationToken(token: LexerToken): token is PunctuationToken
function isPunctuationToken(token: LexerToken, type?: PunctuationToken['type']): token is PunctuationToken {
	if (!type) return !Object.hasOwn(token, 'value')
	return type === token.type
}
function isValueToken(token: LexerToken, type: ValueToken['type']): token is ValueToken {
	return Object.hasOwn(token, 'value') && type === token.type
}

function isEnd(token: LexerToken): token is (SlingNode & { type: 'EOF' }) {
	return token.type == 'EOF'
}

function isTransparent(token: LexerToken): boolean {
	return token.type === 'json-token:whitespace'
		|| token.type === '//'
		|| token.type === '/*'
}
