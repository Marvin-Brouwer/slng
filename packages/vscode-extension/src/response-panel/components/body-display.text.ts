import { addComponent, createElement } from '../element-helper'

import { BodyRenderer } from './body-display'
import { MaskedValue } from './masked-value'

import type { httpNodes, nodes } from '@slng/definition'

function renderTextAst(container: HTMLElement, node: nodes.ValueNode | nodes.ValuesNode): HTMLElement {
	switch (node.type) {
		case 'text': {
			container.textContent += escapeHtml(node.value)
			return container
		}
		case 'reference': {
			if (node.variant === 'mask') {
				addComponent(container, MaskedValue, { mask: String(node.value), reference: node.reference })
			} else if (node.value !== '') {
				container.textContent += escapeHtml(String(node.value))
			}
			return container
		}
		case 'values': {
			for (const childNode of node.values) {
				renderTextAst(container, childNode)
			}
			return container
		}
	}
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

export const textBodyRenderer: BodyRenderer<nodes.ValueNode | nodes.ValuesNode> = {
	canProcess: _mimeType => true,
	renderAst(body: httpNodes.BodyNode<nodes.ValueNode | nodes.ValuesNode>) {
		const container = createElement('pre')
		if (body.value.type === 'values') for (const node of body.value.values) renderTextAst(container, node)
		else renderTextAst(container, body.value)
		return container
	},
}
