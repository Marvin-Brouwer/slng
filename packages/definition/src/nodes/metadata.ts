import { Masked } from '../masking/mask'
import { MimeType, PrimitiveValue } from '../types'

import { CommandString, ErrorNode } from './nodes'

export class Metadata {
	public parameters: (PrimitiveValue | Masked<PrimitiveValue> | undefined)[] = []
	public contentType: MimeType | undefined
	public errors: ErrorNode[] = []

	public appendParameter(value: PrimitiveValue | Masked<PrimitiveValue> | undefined): number {
		return this.parameters.push(value) - 1
	}

	public appendError(constructor: { reason: string }): ErrorNode
	public appendError(constructor: { reason: string, suggestions: CommandString[] }): ErrorNode
	public appendError(constructor: { reason: string, autoFix: CommandString }): ErrorNode
	public appendError(constructor: Omit<ErrorNode, 'type'>): ErrorNode {
		const node: ErrorNode = { type: 'error', ...constructor }
		this.errors.push(node)
		return node
	}

	/**
	 * Because the parameters should never be visible on the client's side
	 * We serialize to a custom set of properties
	 */
	toJSON() {
		return {
			contentType: this.contentType?.split(';')[0],
		}
	}
}
