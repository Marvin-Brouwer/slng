import { SimpleElement } from '../element-helper'

import type { MaskedReference, RequestReference, SlingResponse } from '@slng/config'

/** https://en.wikipedia.org/wiki/HTTP#Example */
export class HttpResponseDisplay extends SimpleElement {
	static tagName = 'http-response'

	protected onMount(): void {
		const response = JSON.parse(this.textContent) as SlingResponse
		const startLine = `${response.request.display.httpVersion} ${response.status} ${response.statusText}`
		const headers = Object.entries(response.headers)
			.map(([key, value]) => {
				return `<header-row key=${key}>${value}</header-row>`
			})
			.join('\n').replaceAll('\t', '')

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

		this.appendElementTo(responseDataDiv, 'pre', {
			className: 'start-line',
			textContent: startLine,
		})
		this.appendElementTo(responseDataDiv, 'header-display', {
			className: 'start-line',
			innerHTML: headers,
		})
		this.appendElementTo(responseDataDiv, 'body-display', {
			textContent: response.bodyAst ? JSON.stringify(response.bodyAst) : '',
			attributes: {
				'content-type': response.request.display.contentType ?? '',
			},
		})
		this.innerHTML = responseDataDiv.outerHTML
	}
}

/** https://en.wikipedia.org/wiki/HTTP#Example */
export class HttpRequestDisplay extends SimpleElement {
	static tagName = 'http-request'

	protected onMount(): void {
		const request = JSON.parse(this.textContent) as RequestReference
		const display = request.display
		const startLine = `${display.method} ${display.url} ${display.httpVersion}`

		const headers = Object.entries(display.headers)
			.map(([key, value]) => {
				const displayValue = isMaskedReference(value)
					? value.mask
					: value
				return `<header-row key=${key}>${displayValue}</header-row>`
			})
			.join('\n').replaceAll('\t', '')

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

		this.appendElementTo(requestDataDiv, 'pre', {
			className: 'start-line',
			textContent: startLine,
		})
		this.appendElementTo(requestDataDiv, 'header-display', {
			className: 'start-line',
			innerHTML: headers,
		})
		this.appendElementTo(requestDataDiv, 'body-display', {
			textContent: display.body ? JSON.stringify(display.body) : '',
			attributes: {
				'content-type': display.contentType ?? '',
			},
		})
		this.innerHTML = requestDataDiv.outerHTML
	}
}

SimpleElement.register(HttpResponseDisplay)
SimpleElement.register(HttpRequestDisplay)

function isMaskedReference(value: string | MaskedReference): value is MaskedReference {
	return typeof value === 'object' && 'index' in value && 'mask' in value
}
