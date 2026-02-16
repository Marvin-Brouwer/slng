import { SimpleElement, SimpleElementConstructor } from '../element-helper'

import { HttpJsonBody } from './body-display.json'

export type BodyDisplayElementConstructor = SimpleElementConstructor & {
	canProcess(mimeType: string): boolean
}

const contentTypeMap = new Set<BodyDisplayElementConstructor>([
	HttpJsonBody,
])

export class HttpBody extends SimpleElement {
	static tagName = 'body-display'

	protected onMount(): void {
		const contentType = this.getAttribute('content-type').trim().toLowerCase()
		const contentDisplay = contentTypeMap.values()
			.find(entry => entry.canProcess(contentType))
			?.tagName ?? 'pre'

		this.innerHTML = this.createHtml(contentDisplay, {
			textContent: this.textContent,
		})
	}
}

SimpleElement.register(HttpBody)
