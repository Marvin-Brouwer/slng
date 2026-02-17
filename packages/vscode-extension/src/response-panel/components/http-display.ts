import { RequestReference, SlingResponse } from '@slng/config'

import { SimpleElement } from '../element-helper'

/** https://en.wikipedia.org/wiki/HTTP#Example */
export class HttpResponseDisplay extends SimpleElement {
	static tagName = 'http-response'

	protected onMount(): void {
		const response = JSON.parse(this.textContent) as SlingResponse
		const startLine = `${response.request.parsed.httpVersion} ${response.status} ${response.statusText}`
		// TODO this may later contain masked values too
		const headers = Object.entries(response.headers)
			.map(([key, value]) => {
				return `<header-row key=${key}>${value}</header-row>`
			})
			.join('\n').replaceAll('\t', '')

		// TODO this may later contain masked values too
		const contentType = getContentTypeHeader(response.headers)

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
			textContent: response.body,
			attributes: {
				'content-type': contentType,
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
		const startLine = `${request.parsed.method} ${request.parsed.url} ${request.parsed.httpVersion}`
		// TODO resolve masked values with a peek button
		const headers = Object.entries(request.parsed.headers)
			.map(([key, value]) => {
				return `<header-row key=${key}>${value}</header-row>`
			})
			.join('\n').replaceAll('\t', '')

		// TODO this may later contain masked values too
		const contentType = getContentTypeHeader(request.parsed.headers)

		const responseDataDiv = this.createElement('div', {
			id: 'request-data',
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
			textContent: request.parsed.body,
			attributes: {
				'content-type': contentType,
			},
		})
		this.innerHTML = responseDataDiv.outerHTML
	}
}

SimpleElement.register(HttpResponseDisplay)
SimpleElement.register(HttpRequestDisplay)

function getContentTypeHeader(headers: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === 'content-type') return value.split(';')[0]
	}
	return void 0
}
