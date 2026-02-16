import { SimpleElement, SimpleElementConstructor } from '../element-helper'

import { HttpJsonBody } from './body-display.json'

const contentTypeMap = new Map<string, SimpleElementConstructor>([
	['application/json', HttpJsonBody],
])

export class HttpBody extends SimpleElement {
	static tagName = 'body-display'

	protected onMount(): void {
		const contentType = this.getAttribute('content-type')
		const contentDisplay = contentType ? contentTypeMap.get(contentType) : undefined
		if (contentDisplay) {
			this.appendElement(contentDisplay.tagName, {
				textContent: this.textContent,
			})
		}
		else {
			this.appendElement('pre', {
				textContent: this.textContent,
			})
		}
	}
}

SimpleElement.register(HttpBody)
