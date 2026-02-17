import type { BodyAstNode, JsonAstNode } from '@slng/config'
import type { BodyRenderer } from './body-display'

function isJsonContentType(contentType: string): boolean {
	return contentType === 'application/json' || contentType.endsWith('+json')
}

export const jsonBodyRenderer: BodyRenderer = {
	canProcess: mimeType => isJsonContentType(mimeType),
	renderAst(nodes: BodyAstNode[]): string {
		return nodes.map(node => renderJsonAst(node as JsonAstNode, 0)).join('')
	},
}

const MAX_BRACKET_PAIR_COLORS = 6
const INDENT = '  '

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

function bracketClass(depth: number): string {
	return `json-bracket json-bracket-${(Math.max(0, depth) % MAX_BRACKET_PAIR_COLORS) + 1}`
}

/**
 * Render a JSON AST node to syntax-highlighted HTML with pretty-printing.
 */
export function renderJsonAst(node: JsonAstNode, depth: number): string {
	switch (node.type) {
		case 'object': {
			return renderObject(node.entries, depth)
		}
		case 'array': {
			return renderArray(node.items, depth)
		}
		case 'string': {
			return `<span class="json-string">${escapeHtml(JSON.stringify(node.value))}</span>`
		}
		case 'number': {
			return `<span class="json-number">${escapeHtml(node.value)}</span>`
		}
		case 'boolean': {
			return `<span class="json-keyword">${node.value}</span>`
		}
		case 'null': {
			return `<span class="json-keyword">null</span>`
		}
		case 'masked': {
			return `<masked-value data-index="${node.index}">${escapeHtml(node.mask)}</masked-value>`
		}
	}
}

function renderObject(entries: [JsonAstNode, JsonAstNode][], depth: number): string {
	if (entries.length === 0) {
		return `<span class="${bracketClass(depth)}">{</span><span class="${bracketClass(depth)}">}</span>`
	}

	const innerIndent = INDENT.repeat(depth + 1)
	const outerIndent = INDENT.repeat(depth)

	const items = entries.map(([key, value], index) => {
		const keyHtml = key.type === 'string'
			? `<span class="json-key">${escapeHtml(JSON.stringify(key.value))}</span>`
			: renderJsonAst(key, depth + 1)
		const valueHtml = renderJsonAst(value, depth + 1)
		const comma = index < entries.length - 1
			? '<span class="json-punctuation">,</span>'
			: ''
		return `${innerIndent}${keyHtml}<span class="json-punctuation">: </span>${valueHtml}${comma}`
	})

	return [
		`<span class="${bracketClass(depth)}">{</span>`,
		...items,
		`${outerIndent}<span class="${bracketClass(depth)}">}</span>`,
	].join('\n')
}

function renderArray(items: JsonAstNode[], depth: number): string {
	if (items.length === 0) {
		return `<span class="${bracketClass(depth)}">[</span><span class="${bracketClass(depth)}">]</span>`
	}

	const innerIndent = INDENT.repeat(depth + 1)
	const outerIndent = INDENT.repeat(depth)

	const rendered = items.map((item, index) => {
		const valueHtml = renderJsonAst(item, depth + 1)
		const comma = index < items.length - 1
			? '<span class="json-punctuation">,</span>'
			: ''
		return `${innerIndent}${valueHtml}${comma}`
	})

	return [
		`<span class="${bracketClass(depth)}">[</span>`,
		...rendered,
		`${outerIndent}<span class="${bracketClass(depth)}">]</span>`,
	].join('\n')
}
