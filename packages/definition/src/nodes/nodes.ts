import { isMask, Masked } from '../masking/mask'
import { PrimitiveValue } from '../types'
import type { BaseNodeWithoutComments } from 'estree'

export class Metadata {
	public parameters: (PrimitiveValue | Masked<PrimitiveValue> | undefined)[] = []
	public contentType: string | undefined
	public errors: ErrorNode[] | undefined

	public appendParameter(value: PrimitiveValue | Masked<PrimitiveValue> | undefined): number {
		return this.parameters.push(value) - 1
	}
}

/* eslint-disable @typescript-eslint/no-empty-object-type */

/** This is just {@link BaseNodeWithoutComments}, re-exported so extensions don't need to install `estree` */
export interface SlingNode extends BaseNodeWithoutComments {}


type CommandString = `sling.${string}`
export interface ErrorNode extends SlingNode {
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
	...(name !== undefined ? { name } : {}),
})

export type Node
	= ErrorNode
	| ValueNode
	| ValuesNode
	| TextNode
	| ReferenceNode
