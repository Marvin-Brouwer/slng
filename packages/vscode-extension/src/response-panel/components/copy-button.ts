import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import { Button } from '@vscode/webview-ui-toolkit'

import { SimpleElement } from '../element-helper'
import { vscodeApi } from '../vscode-api'
import { HttpBody } from './body-display'
import { HttpHeaders } from './header-display'

// TODO convert to programmatic arguments over attributes
// TODO copy headers (CSV) / copy body (JSON) instead of copy unmasked
export class CopyButton extends SimpleElement {
	static tagName = 'copy-button'

	public container!: HTMLElement
	public type!: string
	public contentType?: string

	protected onMount(): void {
		if (!this.container || !this.type) throw new Error('Expected this element to be created programatically')

		const splitContainer = this.appendElement('div', {
			className: 'split-button',
			role: 'group',
			ariaLabel: `Copy ${this.type}`,
		})

		const mainButton = this.appendElementTo<Button>(splitContainer, 'vscode-button', {
			textContent: `Copy ${this.type}`,
			type: 'button',
			appearance: 'secondary',
			className: 'main-button',

			title: `Copy the full ${this.type}`,
			ariaLabel: `Copy full ${this.type} to clipboard`,
		})
		this.appendElementTo(mainButton, 'span', {
			slot: 'start',
			innerHTML: copyIconSvg,
		})
		mainButton.addEventListener('click', (_event) => {
			this.copyDefault(this.container)
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})

		const dropdownMenu = this.appendElement('div', {
			className: 'dropdown-menu',
			role: 'menu',
		})

		const dropdownToggle = this.appendElementTo<Button>(splitContainer, 'vscode-button', {
			type: 'button',
			title: 'More options',
			appearance: 'secondary',
			className: 'dropdown-toggle',
			innerHTML: chevronDownSvg,

			ariaLabel: 'More copy options',
			ariaHasPopup: 'menu',
			ariaExpanded: 'false',
		})
		dropdownToggle.addEventListener('click', (event) => {
			event.stopPropagation()
			if (dropdownMenu.classList.contains('open')) {
				this.closeDropdown(dropdownMenu, dropdownToggle)
			}
			else {
				this.openDropdown(dropdownMenu, dropdownToggle)
			}
		})

		const copyHeadersButton = this.appendElementTo<Button>(dropdownMenu, 'vscode-button', {
			className: 'dropdown-item',
			textContent: 'Copy headers (csv)',
			appearance: 'secondary',

			title: `Copy the ${this.type} headers`,
			role: 'menuitem',
			ariaLabel: `Copy ${this.type}'s headers to clipboard`,
		})
		copyHeadersButton.addEventListener('click', (event) => {
			event.stopPropagation()
			const headerTableElement = this.container.querySelector<HTMLTableElement>(`${HttpHeaders.tagName} table`)

			this.copyPart(headerTableElement, 'text/csv', this.tableToCsv(headerTableElement))
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})

		if (this.contentType) {
			const copyBodyButton = this.appendElementTo<Button>(dropdownMenu, 'vscode-button', {
				className: 'dropdown-item',
				textContent: `Copy body (${this.contentType.split('/')[1]})`,
				appearance: 'secondary',

				title: `Copy the ${this.type} body`,
				role: 'menuitem',
				ariaLabel: `Copy ${this.type}'s body to clipboard`,
			})
			copyBodyButton.addEventListener('click', (event) => {
				event.stopPropagation()
				const bodyElement = this.container.getElementsByTagName(HttpBody.tagName)[0] as HTMLElement
				this.copyPart(bodyElement, this.contentType, bodyElement.textContent)
				this.closeDropdown(dropdownMenu, dropdownToggle)
			})
		}

		// Close dropdown when clicking outside
		document.addEventListener('click', () => {
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})
		window.addEventListener('blur', () => {
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})

		this.addEventListener('click', (event) => {
			if (event.target !== dropdownToggle && !dropdownToggle.contains(event.target as Node)) {
				this.closeDropdown(dropdownMenu, dropdownToggle)
			}
		})
	}

	private openDropdown(dropdownMenu: HTMLElement, dropdownToggle: HTMLElement) {
		dropdownMenu.classList.add('open')
		dropdownToggle.setAttribute('aria-expanded', 'true')
	}

	private closeDropdown(dropdownMenu: HTMLElement, dropdownToggle: HTMLElement) {
		dropdownMenu.classList.remove('open')
		dropdownToggle.setAttribute('aria-expanded', 'false')
	}

	private copyDefault(element: HTMLElement) {
		if (!element) return
		const buttons = element.querySelectorAll<HTMLElement>('masked-value vscode-button')
		for (const btn of buttons) btn.style.display = 'none'
		// eslint-disable-next-line unicorn/prefer-dom-node-text-content -- innerText preserves visual line breaks
		const plainText = (element.innerText || '').replaceAll('\u00A0\t', ' ')
		for (const btn of buttons) btn.style.display = ''
		vscodeApi.postMessage({ command: 'copy', content: plainText })
	}

	private tableToCsv(table: HTMLTableElement): string {
		return Array.from(table.rows).map(row =>
			Array.from(row.cells).map(cell => {
				const value = cell.innerText.replaceAll('"', '""')
				return /[,"\n\r]/.test(value) ? `"${value}"` : value
			}).join(',')
		).join('\n')
	}

	private copyPart(_element: HTMLElement, _contentType: string, content?: string) {
		if (!content) return
		vscodeApi.postMessage({ command: 'copy', content })
	}
}

SimpleElement.register(CopyButton)
