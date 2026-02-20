import { Metadata, ValueNode, ValuesNode } from '../http/http.nodes'

export function resolveString(node: ValueNode | ValuesNode, metadata: Metadata): string {
	if (node.type === 'text') return node.value
	if (node.type === 'masked') return String(metadata.maskedValues[node.reference].unmask())

	return node.values.map(value => resolveString(value, metadata)).join('')
}
