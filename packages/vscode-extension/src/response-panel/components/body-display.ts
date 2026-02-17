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

	private findDisplay(contentType: string | undefined) {
		if (contentType === undefined) return 'pre'
		return contentTypeMap.values()
			.find(entry => entry.canProcess(contentType))
			?.tagName ?? 'pre'
	}

	protected onMount(): void {
		const contentType = this.getAttribute('content-type')?.trim()?.toLowerCase()
		const contentDisplay = this.findDisplay(contentType)

		this.innerHTML = this.createHtml(contentDisplay, {
			textContent: this.textContent,
		})

		// There needs to be an empty line before the body
		this.prepend(this.createElement('br'))
	}
}

SimpleElement.register(HttpBody)
