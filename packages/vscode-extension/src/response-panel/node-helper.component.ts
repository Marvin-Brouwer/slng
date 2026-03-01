import { MaskedValue } from './components/masked-value'
import { addComponent } from './element-helper'

import type { nodes } from '@slng/definition'

export function resolveElements(container: HTMLElement, node: nodes.ValueNode | nodes.ValuesNode) {
	if (node.type === 'text') {
		container.append(node.value)
		return container
	}
	if (node.type === 'reference') {
		if (node.variant === 'mask') {
			addComponent(container, MaskedValue, { mask: String(node.value), reference: node.reference })
		} else {
			if (node.value !== '') container.append(String(node.value))
		}
		return container
	}

	for (const value of node.values) resolveElements(container, value)
}
