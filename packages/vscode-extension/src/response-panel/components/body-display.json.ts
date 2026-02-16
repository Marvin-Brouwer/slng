import { SimpleElement } from '../element-helper'

export class HttpJsonBody extends SimpleElement {
	static tagName = 'json-body-display'

	protected onMount(): void {
		this.appendElement('pre', {
			textContent: 'TEST',
		})
	}
}

SimpleElement.register(HttpJsonBody)
