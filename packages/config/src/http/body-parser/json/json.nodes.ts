import { BaseNode } from 'estree'

import { Masked } from '../../../masking/mask'
import { PrimitiveValue } from '../../../types'
import { Metadata } from '../../http.nodes'

export interface JsonNode extends BaseNode {
	type: `json:${string}`
}
export interface JsonNullNode extends JsonNode {
	type: 'json:null'
}
export const _null = (): JsonNullNode => ({
	type: 'json:null',
})
export interface JsonUnknownNode extends JsonNode {
	type: 'json:unknown'
	value: unknown
}
export const unknown = (value: unknown): JsonUnknownNode => ({
	type: 'json:unknown',
	value,
})
export interface JsonValueNode<T> extends JsonNode {
	value: T
}
export const string = (value: string): JsonValueNode<string> => ({
	type: 'json:string',
	value,
})
export const number = (value: number): JsonValueNode<number> => ({
	type: 'json:number',
	value,
})
export const boolean = (value: boolean): JsonValueNode<boolean> => ({
	type: 'json:boolean',
	value,
})
export interface JsonMaskedNode extends JsonNode {
	type: `json:masked:${string}`
	reference: number
	mask: string
}
export const jsonMask = (metadata: Metadata, value: Masked<PrimitiveValue>): JsonMaskedNode => ({
	type: `json:masked:${typeof value.unmask()}`,
	reference: metadata.appendMaskedValue(value),
	mask: value.value,
})
export interface JsonArrayNode extends JsonNode {
	type: 'json:array'
	items: JsonAstNode[]
}
export interface JsonCompositeValueNode<T extends string | number> extends JsonNode {
	type: `json:composite:${'string' | 'number'}`
	parts: (JsonValueNode<T> | JsonMaskedNode)[]
}
export const composite = <T extends string | number>(
	type: 'string' | 'number',
	parts: (JsonValueNode<T> | JsonMaskedNode)[],
): JsonCompositeValueNode<T> => ({
	type: `json:composite:${type}`,
	parts,
})
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
export const whitespace = (value: string): JsonWhitespaceNode => ({
	type: 'json:whitespace',
	value,
})

export interface JsonPunctuationNode extends JsonNode {
	type: 'json:punctuation'
	value: ',' | ':'
}
export const punctuation = (value: ',' | ':'): JsonPunctuationNode => ({
	type: 'json:punctuation',
	value,
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
	| JsonValueNode<string>
	| JsonValueNode<number>
	| JsonValueNode<boolean>
	| JsonMaskedNode
	| JsonCompositeValueNode<string>
	| JsonCompositeValueNode<number>
	| JsonArrayNode
	| JsonObjectNode
	| JsonWhitespaceNode
	| JsonCommentNode
