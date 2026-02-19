import { HttpDocument, HTTPNode, ErrorNode, RequestNode, ResponseNode } from '../../../../config/src/http/http.nodes'
import { SimpleElement } from '../element-helper'

function assertResponse(node: HTTPNode): asserts node is ResponseNode {}
function assertRequest(node: HTTPNode): asserts node is RequestNode {}
function assertNotError(node: HTTPNode): asserts node is Exclude<HTTPNode, ErrorNode> {}

/** https://en.wikipedia.org/wiki/HTTP#Example */
export class HttpResponseDisplay extends SimpleElement {
	static tagName = 'http-response'

	protected onMount(): void {
		const responseDataDiv = this.createElement('div', {
			id: 'response-data',
		})

		const copyPanel = this.appendElementTo(responseDataDiv, 'div', {
			className: 'copy-panel',
		})
		this.appendElementTo(copyPanel, 'copy-button', {
			attributes: {
				for: '#response-data',
				type: 'response',
			},
		})

		const response = JSON.parse(this.textContent) as HttpDocument
		assertResponse(response.startLine)
		assertNotError(response.startLine.status)
		assertNotError(response.startLine.statusCode)
		const startLine = [
			`${response.startLine.protocol.value}/${response.startLine.protocol.version}`,
			response.startLine.status.value,
			response.startLine.statusCode.value,
		].join(' ')
		console.log(startLine)

		// const headers = Object.entries(response.headers)
		// 	.map(([key, value]) => {
		// 		return `<header-row key=${key}>${value}</header-row>`
		// 	})
		// 	.join('\n').replaceAll('\t', '')

		// this.appendElementTo(responseDataDiv, 'pre', {
		// 	className: 'start-line',
		// 	textContent: startLine,
		// })
		// this.appendElementTo(responseDataDiv, 'header-display', {
		// 	className: 'start-line',
		// 	innerHTML: headers,
		// })
		// this.appendElementTo(responseDataDiv, 'body-display', {
		// 	textContent: response.bodyAst ? JSON.stringify(response.bodyAst) : '',
		// 	attributes: {
		// 		'content-type': response.request.display.contentType ?? '',
		// 	},
		// })
		this.innerHTML = responseDataDiv.outerHTML
	}
}

/** https://en.wikipedia.org/wiki/HTTP#Example */
export class HttpRequestDisplay extends SimpleElement {
	static tagName = 'http-request'

	protected onMount(): void {
		const requestDataDiv = this.createElement('div', {
			id: 'request-data',
		})
		const copyPanel = this.appendElementTo(requestDataDiv, 'div', {
			className: 'copy-panel',
		})
		this.appendElementTo(copyPanel, 'copy-button', {
			attributes: {
				for: '#request-data',
				type: 'request',
			},
		})

		const request = JSON.parse(this.textContent) as HttpDocument
		assertRequest(request.startLine)
		assertNotError(request.startLine.method)
		assertNotError(request.startLine.url)
		assertNotError(request.startLine.protocol)
		const startLine = [
			request.startLine.method.value,
			// TODO expose resolve values
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			request.startLine.url.toString(),
			`${request.startLine.protocol.value}/${request.startLine.protocol.version}`,
		].join(' ')
		console.log(startLine)

		// const headers = Object.entries(display.headers)
		// 	.map(([key, value]) => {
		// 		const displayValue = isMaskedReference(value)
		// 			? value.mask
		// 			: value
		// 		return `<header-row key=${key}>${displayValue}</header-row>`
		// 	})
		// 	.join('\n').replaceAll('\t', '')

		// this.appendElementTo(requestDataDiv, 'pre', {
		// 	className: 'start-line',
		// 	textContent: startLine,
		// })
		// this.appendElementTo(requestDataDiv, 'header-display', {
		// 	className: 'start-line',
		// 	innerHTML: headers,
		// })
		// this.appendElementTo(requestDataDiv, 'body-display', {
		// 	textContent: display.body ? JSON.stringify(display.body) : '',
		// 	attributes: {
		// 		'content-type': display.contentType ?? '',
		// 	},
		// })
		this.innerHTML = requestDataDiv.outerHTML
	}
}

SimpleElement.register(HttpResponseDisplay)
SimpleElement.register(HttpRequestDisplay)

// function isMaskedReference(value: string | MaskedReference): value is MaskedReference {
// 	return typeof value === 'object' && 'index' in value && 'mask' in value
// }
