import { MimeType } from '../../types'

import type { ErrorNode, Node, SlingDocument, SlingNode, TextNode, ValueNode, ValuesNode } from '../../nodes/nodes'

export interface HttpDocument extends SlingDocument {
	type: 'http'
	startLine: RequestNode | ResponseNode | ErrorNode
	headers?: (HeaderNode | ErrorNode)[]
	body?: BodyNode
}
export const document = (properties: Omit<HttpDocument, 'type'>): HttpDocument => ({
	type: 'http',
	...properties,
})

export interface RequestNode extends SlingNode {
	type: 'request'
	method: TextNode | ErrorNode
	url: ValueNode | ValuesNode | ErrorNode
	// TODO check allowed protocols and versions
	protocol: ProtocolNode | ErrorNode
}
export interface ResponseNode extends SlingNode {
	type: 'response'
	protocol: ProtocolNode
	status: TextNode | ErrorNode
	statusText: TextNode | ErrorNode
}
export const allowedProtocols = [
	{ protocol: 'HTTP', version: '1.1' },
	{ protocol: 'HTTP', version: '2.0' },
]
export interface ProtocolNode extends SlingNode {
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
export interface HeaderNode extends SlingNode {
	type: 'header'
	name: TextNode | ErrorNode
	value: ValueNode | ValuesNode | ErrorNode
}
export const header = (name: TextNode | ErrorNode, value: ValueNode | ValuesNode | ErrorNode): HeaderNode => ({
	type: 'header',
	name,
	value,
})

export interface BodyNode<T extends SlingNode = SlingNode> extends SlingNode {
	type: 'body'
	contentType: MimeType
	value: T
}
export const body = <T extends SlingNode = SlingNode>(contentType: MimeType, value: T): BodyNode => ({
	type: 'body',
	contentType,
	value,
})

export type HttpNode
	= HttpDocument
	| RequestNode
	| ResponseNode
	| ProtocolNode
	| HeaderNode
	| BodyNode
	| Node
