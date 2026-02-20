import { HeaderNode } from '../../../../definition/src/http/http.nodes'
import { SimpleElement } from '../element-helper'
import { assertNotError } from '../node-helper'
import { resolveElements } from '../node-helper.component'

export class HttpHeaders extends SimpleElement {
	static tagName = 'header-display'

	public headerNodes: HeaderNode[]

	protected onMount(): void {
		if (!this.headerNodes) throw new Error('Expected this element to be created programatically')

		const table = this.createElement('table')
		for (const headerNode of this.headerNodes) {
			assertNotError(headerNode.name)
			const name = headerNode.name.value
			assertNotError(headerNode.value)

			const tr = this.appendElementTo(table, 'tr')
			this.appendElementTo(tr, 'td', {
				className: 'header-key',
				textContent: name + ':',
			})
			const valueElement = this.appendElementTo(tr, 'td', {
				className: 'header-value',
			})

			resolveElements(valueElement, headerNode.value)
		}

		const wrapper = this.createElement('div', { className: 'headers' })
		wrapper.append(table)
		this.innerHTML = ''
		this.append(wrapper)
	}
}

export class HttpHeaderRow extends HTMLElement {
	static tagName = 'header-row'
}

SimpleElement.register(HttpHeaderRow)
SimpleElement.register(HttpHeaders)
