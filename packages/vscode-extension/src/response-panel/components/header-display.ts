import { SimpleElement } from '../element-helper'

export class HttpHeader extends SimpleElement {
	static tagName = 'header-display'

	protected onMount(): void {
		const table = this.createElement('table')
		for (const row of this.querySelectorAll('header-row')) {
			const key = row.getAttribute('key')?.trim() ?? ''
			const value = row.textContent ?? ''

			const tr = this.appendElementTo(table, 'tr')
			this.appendElementTo(tr, 'td', {
				className: 'header-key',
				innerHTML: `${key}:&nbsp;`,
			})
			this.appendElementTo(tr, 'td', {
				className: 'header-value',
				textContent: value,
			})
		}

		const wrapper = this.createElement('div', { className: 'headers' })
		wrapper.append(table)
		this.innerHTML = wrapper.outerHTML
	}
}

export class HttpHeaderRow extends HTMLElement {
	static tagName = 'header-row'
}

SimpleElement.register(HttpHeaderRow)
SimpleElement.register(HttpHeader)
