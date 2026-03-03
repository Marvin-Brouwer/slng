import { isMask } from '../masking/mask'
import { Metadata } from '../nodes/metadata'
import { ValueNode, ValuesNode } from '../nodes/nodes'

export function resolveString(node: ValueNode | ValuesNode, metadata: Metadata): string {
	if (node.type === 'text') return node.value
	if (node.type === 'reference') {
		const parameter = metadata.parameters[node.reference]
		if (parameter === undefined) return ''
		if (isMask(parameter)) return String(parameter.unmask())
		return String(parameter)
	}

	return node.values.map(value => resolveString(value, metadata)).join('')
}
