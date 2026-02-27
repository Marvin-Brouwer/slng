import { isMask, Masked } from '../masking/mask'
import { PrimitiveValue } from '../types'
import type { BaseNodeWithoutComments } from 'estree'

export class Metadata {
	public maskedValues: Masked<PrimitiveValue>[] = []
	public contentType: string | undefined
	public errors: ErrorNode[] | undefined

	public appendMaskedValue(value: Masked<PrimitiveValue>) {
		return this.maskedValues.push(value) - 1
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

export type ValueNode = TextNode | MaskedNode
export interface TextNode extends SlingNode {
	type: 'text'
	value: string
}
export interface MaskedNode extends SlingNode {
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

export type Node
	= ErrorNode
	| ValueNode
	| ValuesNode
	| TextNode
	| MaskedNode
