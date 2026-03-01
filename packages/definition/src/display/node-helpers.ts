import { isMask } from '../masking/mask'
import { Metadata, ValueNode, ValuesNode } from '../nodes/nodes'

export function resolveString(node: ValueNode | ValuesNode, metadata: Metadata): string {
	if (node.type === 'text') return node.value
	if (node.type === 'reference') {
		const param = metadata.parameters[node.reference]
		if (param === undefined) return ''
		if (isMask(param)) return String(param.unmask())
		return String(param)
	}

	return node.values.map(value => resolveString(value, metadata)).join('')
}
