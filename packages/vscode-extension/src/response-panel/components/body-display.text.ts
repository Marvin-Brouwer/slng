import { ValueNode, ValuesNode, BodyNode } from '../../../../definition/src/http/http.nodes'
import { addComponent, createElement } from '../element-helper'

import { BodyRenderer } from './body-display'
import { MaskedValue } from './masked-value'

function renderTextAst(container: HTMLElement, node: ValueNode | ValuesNode): HTMLElement {
	switch (node.type) {
		case 'text': {
			container.textContent += escapeHtml(node.value)
			return container
		}
		case 'masked': {
			addComponent(container, MaskedValue, {
				reference: node.reference,
				mask: node.mask,
			})
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

export const textBodyRenderer: BodyRenderer<ValueNode | ValuesNode> = {
	canProcess: _mimeType => true,
	renderAst(body: BodyNode<ValueNode | ValuesNode>) {
		const container = createElement('pre')
		if (body.value.type === 'values') for (const node of body.value.values) renderTextAst(container, node)
		else renderTextAst(container, body.value)
		return container
	},
}
