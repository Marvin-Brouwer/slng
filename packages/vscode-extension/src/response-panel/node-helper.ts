import { ErrorNode, HttpNode, RequestNode, ResponseNode } from '../../../config/src/http/http.nodes'

export function assertResponse(node: HttpNode): asserts node is ResponseNode {}
export function assertRequest(node: HttpNode): asserts node is RequestNode {}
export function assertNotError(node: HttpNode): asserts node is Exclude<HttpNode, ErrorNode> {}
export function assertNoErrors<T extends HttpNode>(node: T[]): asserts node is Exclude<T, ErrorNode>[] {}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
