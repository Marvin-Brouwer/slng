import { ErrorNode, HTTPNode, RequestNode, ResponseNode } from '../../../config/src/http/http.nodes'

export function assertResponse(node: HTTPNode): asserts node is ResponseNode {}
export function assertRequest(node: HTTPNode): asserts node is RequestNode {}
export function assertNotError(node: HTTPNode): asserts node is Exclude<HTTPNode, ErrorNode> {}
export function assertNoErrors<T extends HTTPNode>(node: T[]): asserts node is Exclude<T, ErrorNode>[] {}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
