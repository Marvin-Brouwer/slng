import { createElement, SimpleElement } from '../element-helper'
import { escapeHtml } from '../node-helper'

export class MaskedValue extends SimpleElement {
	static tagName = 'masked-value'

	public mask: string
	public reference: number

	protected onMount(): void {
		if (!this.mask || this.reference === undefined) throw new Error('Expected this element to be created programatically')

		this.append(createElement('span', {
			textContent: escapeHtml(this.mask),
		}))
	}
}

SimpleElement.register(MaskedValue)
