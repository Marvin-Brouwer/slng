import { SlingResponse } from '@slng/config'

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
		const contentType = response.headers['content-type']?.split(';')[0] ?? ''

		const responseDataDiv = this.createElement('div', {
			id: 'response-data',
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

SimpleElement.register(HttpResponseDisplay)
