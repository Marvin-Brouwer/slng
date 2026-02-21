import type { httpNodes } from '@slng/definition'

export function assertResponse(node: httpNodes.HttpNode): asserts node is httpNodes.ResponseNode {}
export function assertRequest(node: httpNodes.HttpNode): asserts node is httpNodes.RequestNode {}
export function assertNotError(node: httpNodes.HttpNode): asserts node is Exclude<httpNodes.HttpNode, httpNodes.ErrorNode> {}
export function assertNoErrors<T extends httpNodes.HttpNode>(node: T[]): asserts node is Exclude<T, httpNodes.ErrorNode>[] {}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
