import type { Masked } from '../../masking/mask'
import type { Metadata } from '../../nodes/metadata'
import type { SlingNode } from '../../nodes/nodes'
import type { PrimitiveValue } from '../../types'

export interface JsonNode extends SlingNode {
	type: `json:${string}`
}
export interface JsonNullNode extends JsonNode {
	type: 'json:null'
}
export const _null = (loc?: SlingNode['loc']): JsonNullNode => ({
	type: 'json:null',
	loc,
})
export interface JsonUnknownNode extends JsonNode {
	type: 'json:unknown'
	value: unknown
}
export const unknown = (value: unknown, loc?: SlingNode['loc']): JsonUnknownNode => ({
	type: 'json:unknown',
	value,
	loc,
})

/** Inner leaf node holding a raw string or number literal inside a json:string or json:number. */
export interface JsonValueContentNode extends JsonNode {
	type: 'json:value'
	value: string | number
	variant?: 'key' | 'value'
}
export const valueContent = (
	value: string | number,
	variant?: 'key' | 'value',
	loc?: SlingNode['loc'],
): JsonValueContentNode => ({
	type: 'json:value',
	value,
	...(variant === undefined ? {} : { variant }),
	loc,
})

export interface JsonMaskedNode extends JsonNode {
	type: `json:masked:${string}`
	reference: number
	mask: string
}
export const jsonMask = (metadata: Metadata, value: Masked<PrimitiveValue>, loc?: SlingNode['loc']): JsonMaskedNode => ({
	type: `json:masked:${typeof value.unmask()}`,
	reference: metadata.appendParameter(value),
	mask: value.value,
	loc,
})

export interface JsonStringNode extends JsonNode {
	type: 'json:string'
	variant: 'key' | 'value'
	parts: (JsonPunctuationNode | JsonValueContentNode | JsonMaskedNode)[]
}
export const string = (
	parts: (JsonPunctuationNode | JsonValueContentNode | JsonMaskedNode)[],
	variant: 'key' | 'value' = 'value',
	loc?: SlingNode['loc'],
): JsonStringNode => ({
	type: 'json:string',
	variant,
	parts,
	loc,
})

export interface JsonNumberNode extends JsonNode {
	type: 'json:number'
	variant: 'key' | 'value'
	parts: (JsonValueContentNode | JsonMaskedNode)[]
}
export const number = (
	parts: (JsonValueContentNode | JsonMaskedNode)[],
	variant: 'key' | 'value' = 'value',
	loc?: SlingNode['loc'],
): JsonNumberNode => ({
	type: 'json:number',
	variant,
	parts,
	loc,
})

export interface JsonBooleanNode extends JsonNode {
	type: 'json:boolean'
	variant: 'value'
	value: boolean
}
export const boolean = (value: boolean, loc?: SlingNode['loc']): JsonBooleanNode => ({
	type: 'json:boolean',
	variant: 'value',
	value,
	loc,
})

export interface JsonArrayNode extends JsonNode {
	type: 'json:array'
	items: JsonAstNode[]
}
export const array = (items: JsonAstNode[]): JsonArrayNode => ({
	type: 'json:array',
	items,
})
export interface JsonObjectNode extends JsonNode {
	type: 'json:object'
	children: JsonAstNode[]
}
export const object = (children: JsonAstNode[]): JsonObjectNode => ({
	type: 'json:object',
	children,
})

export interface JsonWhitespaceNode extends JsonNode {
	type: 'json:whitespace'
	value: string
}
export const whitespace = (value: string, loc?: SlingNode['loc']): JsonWhitespaceNode => ({
	type: 'json:whitespace',
	value,
	loc,
})

export interface JsonPunctuationNode extends JsonNode {
	type: 'json:punctuation'
	value: ',' | ':' | '{' | '}' | '[' | ']' | '"'
	variant?: 'key' | 'value'
}
export const punctuation = (
	value: ',' | ':' | '{' | '}' | '[' | ']' | '"',
	variant?: 'key' | 'value',
	loc?: SlingNode['loc'],
): JsonPunctuationNode => ({
	type: 'json:punctuation',
	value,
	...(variant === undefined ? {} : { variant }),
	loc,
})

export interface JsonCommentNode extends JsonNode {
	type: 'json:comment'
	variant: 'line' | 'block'
	value: string
}
export const commentLine = (value: string): JsonCommentNode => ({
	type: 'json:comment',
	variant: 'line',
	value,
})
export const commentBlock = (value: string): JsonCommentNode => ({
	type: 'json:comment',
	variant: 'block',
	value,
})

export type JsonDocument = JsonNode & {
	type: 'json:document'
	value: JsonAstNode[]
}
export const document = (value: JsonAstNode[]): JsonDocument => ({
	type: 'json:document',
	value,
})

export type JsonAstNode
	= JsonNullNode
	| JsonUnknownNode
	| JsonStringNode
	| JsonNumberNode
	| JsonBooleanNode
	| JsonMaskedNode
	| JsonArrayNode
	| JsonObjectNode
	| JsonWhitespaceNode
	| JsonCommentNode
	| JsonPunctuationNode
	| JsonValueContentNode
