import { JsonArrayNode, JsonAstNode, JsonCommentNode, JsonCompositeValueNode, JsonDocument, JsonMaskedNode, JsonObjectNode, JsonPunctuationNode, JsonWhitespaceNode } from '../../../../config/src/http/body-parser/json/json.nodes'
import { BodyNode } from '../../../../config/src/http/http.nodes'
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

export const jsonBodyRenderer: BodyRenderer<JsonDocument> = {
	canProcess: mimeType => isJsonContentType(mimeType),
	renderAst(bodyNode: BodyNode<JsonDocument>) {
		const wrapper = createElement('pre')

		for (const node of bodyNode.value.value) {
			renderJson(wrapper, node)
		}

		return wrapper
	},
}

function renderJson(container: HTMLElement, node: JsonAstNode, appendContainerGrammar = true, depth = 0) {
	if (node.type === 'json:unknown') return void 0

	if (node.type === 'json:punctuation') return addElement(container, 'span', {
		className: 'json-punctuation',
		textContent: escapeHtml((node as JsonPunctuationNode).value),
	})
	if (node.type === 'json:whitespace') return addElement(container, 'span', {
		className: 'json-whitespace',
		innerHTML: escapeHtml((node as JsonWhitespaceNode).value.replaceAll(String.raw`\n`, '\n')),
	})
	if (node.type === 'json:comment') return addElement(container, 'span', {
		className: 'json-comment',
		innerHTML: (node as JsonCommentNode).variant === 'line'
			? `//${escapeHtml(JSON.stringify(node.value))}`
			: `/*${escapeHtml(JSON.stringify(node.value))}*/`,
	})
	if (node.type === 'json:string') {
		const stringElement = addElement(container, 'span', {
			className: 'json-string',
			textContent: escapeHtml(JSON.stringify(node.value)),
		})

		if (appendContainerGrammar) stringElement.prepend('"')
		if (appendContainerGrammar) stringElement.append('"')
	}
	if (node.type === 'json:number') return addElement(container, 'span', {
		className: 'json-number',
		textContent: escapeHtml(JSON.stringify(node.value)),
	})
	if (node.type === 'json:boolean') return addElement(container, 'span', {
		className: 'json-boolean',
		textContent: escapeHtml(JSON.stringify(node.value)),
	})
	if (node.type === 'json:null') return addElement(container, 'span', {
		className: 'json-null',
		textContent: 'null',
	})

	if (node.type === 'json:masked:string') {
		const maskedNode = node as JsonMaskedNode
		const jsonElement = addElement(container, 'span', {
			className: 'json-string',
		})
		if (appendContainerGrammar) jsonElement.append('"')
		addComponent(jsonElement, MaskedValue, {
			mask: maskedNode.mask,
			reference: maskedNode.reference,
		})
		if (appendContainerGrammar) jsonElement.append('"')
		return
	}
	if (node.type === 'json:masked:number') {
		const maskedNode = node as JsonMaskedNode
		const jsonElement = addElement(container, 'span', {
			className: 'json-number',
		})
		return addComponent(jsonElement, MaskedValue, {
			mask: maskedNode.mask,
			reference: maskedNode.reference,
		})
	}
	if (node.type === 'json:masked:boolean') {
		const maskedNode = node as JsonMaskedNode
		const jsonElement = addElement(container, 'span', {
			className: 'json-boolean',
		})
		return addComponent(jsonElement, MaskedValue, {
			mask: maskedNode.mask,
			reference: maskedNode.reference,
		})
	}
	if (node.type === 'json:composite:string') {
		const compositeNode = node as JsonCompositeValueNode<string>
		for (const valueNode of compositeNode.parts) {
			renderJson(container, valueNode, false, depth)
		}
		return
	}

	if (node.type === 'json:array') {
		const arrayNode = node as JsonArrayNode
		if (appendContainerGrammar) addElement(container, 'span', {
			className: bracketClass(depth),
			textContent: '[',
		})
		for (const valueNode of arrayNode.items) {
			renderJson(container, valueNode, false, depth)
		}
		if (appendContainerGrammar) addElement(container, 'span', {
			className: bracketClass(depth),
			textContent: ']',
		})
		return
	}

	if (node.type === 'json:object') {
		const objectNode = node as JsonObjectNode
		if (appendContainerGrammar) addElement(container, 'span', {
			className: bracketClass(depth),
			textContent: '{',
		})
		for (const valueNode of objectNode.children) {
			renderJson(container, valueNode, false, depth)
		}
		if (appendContainerGrammar) addElement(container, 'span', {
			className: bracketClass(depth),
			textContent: '}',
		})
		return
	}
}
