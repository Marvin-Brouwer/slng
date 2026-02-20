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
export const document = (props: Omit<HttpDocument, 'type'>): HttpDocument => ({
	type: 'http',
	...props,
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

export class NodeError extends Error {
	constructor(public readonly errorNode: ErrorNode) {
		super(errorNode.reason)
	}
}
export interface RequestNode extends BaseNode {
	type: 'request'
	method: TextNode | ErrorNode
	url: ValueNode | ValuesNode | ErrorNode
	// TODO check allowed protocols and versions
	protocol: ProtocolNode | ErrorNode
}
export interface ResponseNode extends BaseNode {
	type: 'response'
	protocol: ProtocolNode
	status: TextNode | ErrorNode
	statusText: TextNode | ErrorNode
}
export const allowedProtocols = [
	{ protocol: 'HTTP', version: '1.1' },
]
export interface ProtocolNode extends BaseNode {
	type: 'protocol'
	value: typeof allowedProtocols[number]['protocol']
	version: typeof allowedProtocols[number]['version']
}
export const request = (
	method: TextNode | ErrorNode,
	url: ValueNode | ValuesNode | ErrorNode,
	protocol: typeof allowedProtocols[number]['protocol'],
	version: typeof allowedProtocols[number]['version'],
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
	protocol: typeof allowedProtocols[number]['protocol'],
	version: typeof allowedProtocols[number]['version'],
	status: TextNode,
	statusText: TextNode,
): ResponseNode => ({
	type: 'response',
	status,
	statusText,
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

export interface BodyNode<T extends BaseNode = BaseNode> extends BaseNode {
	type: 'body'
	contentType: string
	value: T
}
export const body = <T extends BaseNode = BaseNode>(contentType: string, value: T): BodyNode => ({
	type: 'body',
	contentType,
	value,
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

export type HttpNode
	= HttpDocument
	| ErrorNode
	| RequestNode
	| ResponseNode
	| ProtocolNode
	| HeaderNode
	| BodyNode
	| ValueNode
	| ValuesNode
	| TextNode
	| MaskedNode
