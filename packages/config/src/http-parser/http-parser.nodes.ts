import { BaseNode } from 'estree'

import { isMask, Masked } from '../masking/mask'
import { PrimitiveValue } from '../types'

export class Metadata {
	public maskedValues: Masked<PrimitiveValue>[] = []
	public contentType: string | undefined
	public errors: ErrorNode[] | undefined

	public appendMaskedValue(value: Masked<PrimitiveValue>) {
		return this.maskedValues.push(value) - 1
	}
}
export interface HttpDocument extends BaseNode {
	type: 'http'
	startLine: RequestNode | ResponseNode | ErrorNode
	headers?: (HeaderNode | ErrorNode)[]
	body?: BodyNode
	metadata: Metadata
}
export const document = (constructor: Omit<HttpDocument, 'type'>): HttpDocument => ({
	type: 'http',
	...constructor,
})

type CommandString = `sling.${string}`
export interface ErrorNode extends BaseNode {
	type: 'error'
	reason: string
	suggestions?: CommandString[]
	autoFix?: CommandString
}
export function error(constructor: { reason: string }): ErrorNode
export function error(constructor: { reason: string, suggestions: CommandString[] }): ErrorNode
export function error(constructor: { reason: string, autoFix: CommandString }): ErrorNode
export function error(constructor: Omit<ErrorNode, 'type'>): ErrorNode {
	return {
		type: 'error',
		...constructor,
	}
}
export interface RequestNode extends BaseNode {
	type: 'request'
	method: TextNode | ErrorNode
	url: ValueNode | ValuesNode | ErrorNode
	protocol: ProtocolNode
}
export interface ResponseNode extends BaseNode {
	type: 'response'
	protocol: ProtocolNode
	status: TextNode | ErrorNode
	statusCode: TextNode | ErrorNode
}
export class ProtocolNodes {
	public static allowed = [
		{ protocol: 'HTTP', version: '1.1' },
	]
}
export interface ProtocolNode extends BaseNode {
	type: 'protocol'
	value: typeof ProtocolNodes.allowed[number]['protocol']
	version: typeof ProtocolNodes.allowed[number]['version']
}
export const request = (
	method: TextNode | ErrorNode,
	url: ValueNode | ValuesNode | ErrorNode,
	protocol: typeof ProtocolNodes.allowed[number]['protocol'],
	version: typeof ProtocolNodes.allowed[number]['version'],
): RequestNode => ({
	type: 'request',
	method,
	url,
	protocol: {
		type: 'protocol',
		value: protocol.toUpperCase(),
		version: version,
	},
})
export const response = (
	protocol: typeof ProtocolNodes.allowed[number]['protocol'],
	version: typeof ProtocolNodes.allowed[number]['version'],
	status: TextNode | ErrorNode,
	statusCode: TextNode | ErrorNode,
): ResponseNode => ({
	type: 'response',
	status,
	statusCode,
	protocol: {
		type: 'protocol',
		value: protocol.toUpperCase(),
		version: version,
	},
})

/**
 * ```
 * field-name = token
 * token = 1*tchar
 * tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*"
 *       / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
 *       / DIGIT / ALPHA
 * ```
 */
export interface HeaderNode extends BaseNode {
	type: 'header'
	name: TextNode | ErrorNode
	value: ValueNode | ValuesNode | ErrorNode
}
export const header = (name: TextNode | ErrorNode, value: ValueNode | ValuesNode | ErrorNode): HeaderNode => ({
	type: 'header',
	name,
	value,
})

export interface BodyNode extends BaseNode {
	type: 'body'
	value: string
}
export const body = (value: PrimitiveValue): BodyNode => ({
	type: 'body',
	value: String(value),
})

export interface ValuesNode extends BaseNode {
	type: 'values'
	values: ValueNode[]
}
export const values = (...nodes: ValueNode[]): ValuesNode => ({
	type: 'values',
	values: nodes,
})

export type ValueNode = TextNode | MaskedNode
export interface TextNode extends BaseNode {
	type: 'text'
	value: string
}
export interface MaskedNode extends BaseNode {
	type: 'masked'
	mask: string
	reference: number
}
export const text = (value: PrimitiveValue): TextNode => ({
	type: 'text',
	value: String(value),
})
export const masked = (reference: number, value: PrimitiveValue | Masked<PrimitiveValue>): MaskedNode => ({
	type: 'masked',
	reference,
	mask: isMask(value) ? value.value : String(value),
})

export type HTTPNode
	= HttpDocument
	| ErrorNode
	| RequestNode
	| ProtocolNode
	| HeaderNode
	| BodyNode
	| ValueNode
	| ValuesNode
	| TextNode
	| MaskedNode

export class HTTPNodes {
	// TODO build out node helpers
	public static isHttpDocument(node: HTTPNode): node is HttpDocument {
		return node.type === 'http'
	}
}
