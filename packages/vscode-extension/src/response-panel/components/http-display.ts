import { HttpDocument } from '../../../../config/src/http/http.nodes'
import { SimpleElement } from '../element-helper'
import { assertNoErrors, assertNotError, assertRequest, assertResponse } from '../node-helper'
import { resolveElements } from '../node-helper.component'

import { HttpBody } from './body-display'
import { CopyButton } from './copy-button'
import { HttpHeaders } from './header-display'

const nbsp = '\u00A0'

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
		this.appendComponentTo(copyPanel, CopyButton, {
			attributes: {
				for: '#response-data',
				type: 'response',
			},
		})

		const response = JSON.parse(this.textContent) as HttpDocument
		assertResponse(response.startLine)

		assertNotError(response.startLine.protocol)
		assertNotError(response.startLine.status)
		assertNotError(response.startLine.statusText)
		const startLine = this.appendElementTo(responseDataDiv, 'pre', {
			className: 'start-line',
		})
		startLine.append(`${response.startLine.protocol.value}/${response.startLine.protocol.version}`)
		startLine.append(nbsp)
		startLine.append(response.startLine.status.value)
		startLine.append(nbsp)
		startLine.append(response.startLine.statusText.value)

		assertNoErrors(response.headers)
		this.appendComponentTo(responseDataDiv, HttpHeaders, {
			headerNodes: response.headers,
		})

		assertNotError(response.body)
		this.appendComponentTo(responseDataDiv, HttpBody, {
			bodyNode: response.body,
		})

		this.innerHTML = ''
		this.append(responseDataDiv)
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
		this.appendComponentTo(copyPanel, CopyButton, {
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
		const startLine = this.appendElementTo(requestDataDiv, 'pre', {
			className: 'start-line',
		})
		startLine.append(request.startLine.method.value)
		startLine.append(nbsp)
		resolveElements(startLine, request.startLine.url)
		startLine.append(nbsp)
		startLine.append(`${request.startLine.protocol.value}/${request.startLine.protocol.version}`)

		assertNoErrors(request.headers)
		this.appendComponentTo(requestDataDiv, HttpHeaders, {
			headerNodes: request.headers,
		})

		assertNotError(request.body)
		this.appendComponentTo(requestDataDiv, HttpBody, {
			bodyNode: request.body,
		})

		this.innerHTML = ''
		this.append(requestDataDiv)
	}
}

SimpleElement.register(HttpResponseDisplay)
SimpleElement.register(HttpRequestDisplay)
