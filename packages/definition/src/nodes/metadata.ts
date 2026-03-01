import { Masked } from '../masking/mask'
import { MimeType, PrimitiveValue } from '../types'

import { ErrorNode } from './nodes'

export class Metadata {
	public parameters: (PrimitiveValue | Masked<PrimitiveValue> | undefined)[] = []
	public contentType: MimeType | undefined
	public errors: ErrorNode[] | undefined

	public appendParameter(value: PrimitiveValue | Masked<PrimitiveValue> | undefined): number {
		return this.parameters.push(value) - 1
	}
}
