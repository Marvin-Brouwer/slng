import { ValueNode, ValuesNode } from '../../../config/src/http/http.nodes'

import { MaskedValue } from './components/masked-value'
import { addComponent } from './element-helper'

export function resolveElements(container: HTMLElement, node: ValueNode | ValuesNode) {
	if (node.type === 'text') {
		container.append(node.value)
		return container
	}
	if (node.type === 'masked') {
		addComponent(container, MaskedValue, {
			mask: node.mask,
			reference: node.reference,
		})
		return container
	}

	for (const value of node.values) resolveElements(container, value)
}
