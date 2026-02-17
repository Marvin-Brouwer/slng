import type { BodyAstNode, PlainTextAstNode } from '@slng/config'

export function renderTextBodyAst(nodes: BodyAstNode[]): string {
	return nodes.map(node => renderTextAst(node as PlainTextAstNode)).join('')
}


function renderTextAst(node: PlainTextAstNode): string {
	switch (node.type) {
		case 'text': {
			return escapeHtml(node.value)
		}
		case 'masked': {
			return `<masked-value data-index="${node.index}">${escapeHtml(node.mask)}</masked-value>`
		}
	}
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
