import { httpNodes, jsonNodes } from '@slng/definition/nodes'

import { addComponent, addElement, createElement } from '../element-helper'
import { escapeHtml } from '../node-helper'

import { MaskedValue } from './masked-value'

import type { BodyRenderer } from './body-display'

function isJsonContentType(contentType: string): boolean {
	return contentType === 'application/json' || contentType.endsWith('+json')
}

const MAX_BRACKET_PAIR_COLORS = 6
function bracketClass(depth: number): string {
	return `json-bracket json-bracket-${(Math.max(0, depth) % MAX_BRACKET_PAIR_COLORS) + 1}`
}

export const jsonBodyRenderer: BodyRenderer<jsonNodes.JsonDocument> = {
	canProcess: mimeType => isJsonContentType(mimeType),
	renderAst(bodyNode: httpNodes.BodyNode<jsonNodes.JsonDocument>) {
		const wrapper = createElement('pre')

		for (const node of bodyNode.value.value) {
			renderJson(wrapper, node, 0)
		}

		return wrapper
	},
}

function renderJson(container: HTMLElement, node: jsonNodes.JsonAstNode, depth: number) {
	if (node.type === 'json:unknown') return void 0

	if (node.type === 'json:punctuation') {
		const p = node
		let cls: string
		if (p.value === '"')
			cls = p.variant === 'key' ? 'json-key' : 'json-string'
		else if (p.value === '{' || p.value === '}' || p.value === '[' || p.value === ']')
			cls = bracketClass(depth)
		else
			cls = 'json-punctuation'
		return addElement(container, 'span', { className: cls, textContent: p.value })
	}
	if (node.type === 'json:whitespace') return addElement(container, 'span', {
		className: 'json-whitespace',
		innerHTML: escapeHtml((node).value.replaceAll(String.raw`\n`, '\n')),
	})
	if (node.type === 'json:comment') return addElement(container, 'span', {
		className: 'json-comment',
		innerHTML: (node).variant === 'line'
			? `//${escapeHtml(JSON.stringify(node.value))}`
			: `/*${escapeHtml(JSON.stringify(node.value))}*/`,
	})
	if (node.type === 'json:value') {
		const vNode = node
		return addElement(container, 'span', {
			className: vNode.variant === 'key' ? 'json-key' : 'json-string',
			textContent: escapeHtml(String(vNode.value)),
		})
	}
	if (node.type === 'json:string') {
		const stringNode = node
		for (const part of stringNode.parts) {
			renderJson(container, part as jsonNodes.JsonAstNode, depth)
		}
		return
	}
	if (node.type === 'json:number') {
		const numberNode = node
		for (const part of numberNode.parts) {
			if (part.type === 'json:value') {
				const vNode = part
				addElement(container, 'span', {
					className: numberNode.variant === 'key' ? 'json-key' : 'json-number',
					textContent: escapeHtml(JSON.stringify(vNode.value)),
				})
			}
			else {
				const maskedNode = part
				const jsonElement = addElement(container, 'span', { className: 'json-number' })
				addComponent(jsonElement, MaskedValue, {
					mask: maskedNode.mask,
					reference: maskedNode.reference,
				})
			}
		}
		return
	}
	if (node.type === 'json:boolean') return addElement(container, 'span', {
		className: 'json-boolean',
		textContent: escapeHtml(JSON.stringify((node).value)),
	})
	if (node.type === 'json:null') return addElement(container, 'span', {
		className: 'json-null',
		textContent: 'null',
	})

	if (node.type.startsWith('json:masked:')) {
		const maskedNode = node as jsonNodes.JsonMaskedNode
		const isString = node.type === 'json:masked:string'
		const isNumber = node.type === 'json:masked:number'
		const cls = isString ? 'json-string' : (isNumber ? 'json-number' : 'json-boolean')
		const jsonElement = addElement(container, 'span', { className: cls })
		addComponent(jsonElement, MaskedValue, {
			mask: maskedNode.mask,
			reference: maskedNode.reference,
		})
		return
	}

	if (node.type === 'json:array') {
		const arrayNode = node
		for (const valueNode of arrayNode.items) {
			renderJson(container, valueNode, valueNode.type === 'json:punctuation' ? depth : depth + 1)
		}
		return
	}

	if (node.type === 'json:object') {
		const objectNode = node
		for (const valueNode of objectNode.children) {
			renderJson(container, valueNode, valueNode.type === 'json:punctuation' ? depth : depth + 1)
		}
		return
	}
}
