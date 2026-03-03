import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import { Button } from '@vscode/webview-ui-toolkit'

import { SimpleElement } from '../element-helper'

const vscodeApi = acquireVsCodeApi()

// TODO convert to programmatic arguments over attributes
// TODO copy headers (CSV) / copy body (JSON) instead of copy unmasked
export class CopyButton extends SimpleElement {
	static tagName = 'copy-button'

	protected onMount(): void {
		const type = this.getAttribute('type') ?? 'value'
		const valueSelector = this.getAttribute('for') ?? undefined

		const splitContainer = this.appendElement('div', {
			className: 'split-button',
			role: 'group',
			ariaLabel: `Copy ${type}`,
		})

		const mainButton = this.appendElementTo<Button>(splitContainer, 'vscode-button', {
			textContent: 'Copy',
			type: 'button',
			appearance: 'secondary',
			className: 'main-button',

			title: `Copy the ${type} with sensitive values masked`,
			ariaLabel: `Copy ${type} to clipboard`,
		})
		this.appendElementTo(mainButton, 'span', {
			slot: 'start',
			innerHTML: copyIconSvg,
		})
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		mainButton.addEventListener('click', async (_event) => {
			await this.copyDefault(this.resolveValueElement(valueSelector))
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

		const copyUnmaskedButton = this.appendElementTo<Button>(dropdownMenu, 'vscode-button', {
			className: 'dropdown-item',
			textContent: 'Copy unmasked',
			appearance: 'secondary',

			title: `Copy the ${type} with sensitive values UNMASKED`,
			role: 'menuitem',
			ariaLabel: `Copy ${type} to clipboard with masked values revealed`,
		})
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		copyUnmaskedButton.addEventListener('click', async (event) => {
			event.stopPropagation()
			await this.copyUnmasked(this.resolveValueElement(valueSelector))
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})

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

	private async copyDefault(element: HTMLElement) {
		if (!element) return
		console.log('Copy button clicked!')
		await this.copyElementText(element)
	}

	private async copyUnmasked(element: HTMLElement) {
		if (!element) return
		console.log('Copy unmasked button clicked!')
		await this.copyElementText(element)
	}

	private resolveValueElement(valueSelector: string): HTMLElement | undefined {
		return document.querySelector(valueSelector) ?? undefined
	}

	/**
	 * Copy the text content of an element to the clipboard (VS Code webview friendly)
	 * @param el - HTMLElement to copy from
	 */
	private async copyElementText(element: HTMLElement) {
		if (!element) return
		element.focus()
		// eslint-disable-next-line unicorn/prefer-dom-node-text-content -- innerText preserves visual line breaks
		const plainText = (element.innerText || '').replaceAll('\u00A0\t', ' ')
		const html = element.innerHTML
		const item = new ClipboardItem({
			'text/plain': new Blob([plainText], { type: 'text/plain' }),
			'text/html': new Blob([html], { type: 'text/html' }),
		})
		await navigator.clipboard.write([item])
			.then(() => vscodeApi.postMessage({ command: 'copied' }))
			.catch(error => console.error('Copy failed:', error))
	}
}

SimpleElement.register(CopyButton)
