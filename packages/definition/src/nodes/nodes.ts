import { Metadata } from './metadata'

import type { PrimitiveValue } from '../types'
import type { BaseNodeWithoutComments } from 'estree'

/* eslint-disable @typescript-eslint/no-empty-object-type */

/** This is just {@link BaseNodeWithoutComments}, re-exported so extensions don't need to install `estree` */
export interface SlingNode extends BaseNodeWithoutComments {}
export interface SlingDocument extends SlingNode {
	metadata: Metadata
}

export type CommandString = `sling.${string}`
export interface ErrorNode extends SlingNode {
	type: 'error'
	reason: string
	suggestions?: CommandString[]
	autoFix?: CommandString
}
export class NodeError extends Error {
	constructor(public readonly errorNode: ErrorNode) {
		super(errorNode.reason)
	}
}

export interface ValuesNode extends SlingNode {
	type: 'values'
	values: ValueNode[]
}
export const values = (...nodes: ValueNode[]): ValuesNode => ({
	type: 'values',
	values: nodes,
})

export type ValueNode = TextNode | ReferenceNode
export interface TextNode extends SlingNode {
	type: 'text'
	value: string
}
export interface ReferenceNode extends SlingNode {
	type: 'reference'
	variant: 'value' | 'mask'
	value: PrimitiveValue
	reference: number
	name?: string
}
export const text = (value: PrimitiveValue): TextNode => ({
	type: 'text',
	value: String(value),
})
export const reference = (
	index: number,
	variant: 'value' | 'mask',
	value: PrimitiveValue,
	name?: string,
): ReferenceNode => ({
	type: 'reference',
	variant,
	value,
	reference: index,
	...(name === undefined ? {} : { name }),
})

export type Node
	= ErrorNode
	| ValueNode
	| ValuesNode
	| TextNode
	| ReferenceNode
