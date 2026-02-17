import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import { Button } from '@vscode/webview-ui-toolkit'

import { createElement, SimpleElement } from '../element-helper'

// TODO client scripts will go here
/*

//https://github.com/microsoft/vscode-webview-ui-toolkit
 In case we need communication between the client and extension:
 https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts#L209
 https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/media/main.js
 However, most likely we will only use this to reveal secrets by button
 If we do, we must enable inline scripts to get access to the vscode API
 https://stackoverflow.com/a/74971047 import "vscode-webview"

 https://stackoverflow.com/questions/54632431/vscode-api-read-clipboard-text-content
 https://vshaxe.github.io/vscode-extern/vscode/Clipboard.html

 see for icon buton https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/src/button/README.md#start-icon
 for dropdown https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/src/dropdown/README.md
 */

/**
 * Copy the text content of an element to the clipboard (VS Code webview friendly)
 * @param el - HTMLElement to copy from
 */
function copyElementText(element: HTMLElement) {
	if (!element) return
	element.focus()
	// eslint-disable-next-line unicorn/prefer-dom-node-text-content -- innerText preserves visual line breaks
	const plainText = (element.innerText || '').replaceAll('\u00A0\t', ' ')
	const html = element.innerHTML
	const item = new ClipboardItem({
		'text/plain': new Blob([plainText], { type: 'text/plain' }),
		'text/html': new Blob([html], { type: 'text/html' }),
	})
	navigator.clipboard.write([item])
		.then(() => console.log('Copied!'))
		.catch(error => console.error('Copy failed:', error))
	// TODO  use postmessage for a toast when const vscode = acquireVsCodeApi(); becomes available
}

export class CopyButton extends SimpleElement {
	protected onMount(): void {
		const type = this.getAttribute('type') ?? 'value'
		const valueSelector = this.getAttribute('for') ?? undefined

		const splitContainer = this.createElement('div', {
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
		mainButton.addEventListener('click', (_event) => {
			this.copyDefault(this.resolveValueElement(valueSelector))
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})

		const dropdownMenu = this.createElement('div', {
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
		copyUnmaskedButton.addEventListener('click', (event) => {
			event.stopPropagation()
			this.copyUnmasked(this.resolveValueElement(valueSelector))
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

		this.append(createElement<HTMLLinkElement>('link', {
			rel: 'stylesheet',
			href: this.getAttribute('style-src'),
			nonce: this.getAttribute('style-nonce'),
			// Only once the styles are loaded do we show the button
			onload: () => {
				this.append(splitContainer)
				this.append(dropdownMenu)
			},
		}))
	}

	openDropdown(dropdownMenu: HTMLElement, dropdownToggle: HTMLElement) {
		dropdownMenu.classList.add('open')
		dropdownToggle.setAttribute('aria-expanded', 'true')
	}

	closeDropdown(dropdownMenu: HTMLElement, dropdownToggle: HTMLElement) {
		dropdownMenu.classList.remove('open')
		dropdownToggle.setAttribute('aria-expanded', 'false')
	}

	copyDefault(element: HTMLElement) {
		if (!element) return
		// TODO, I guess postmessage, use vscode clipboard api
		console.log('Copy button clicked!')
		copyElementText(element)
		// TODO show toast in postmessage
	}

	copyUnmasked(element: HTMLElement) {
		if (!element) return
		// TODO, I guess postmessage, use vscode clipboard api
		console.log('Copy unmasked button clicked!')
		copyElementText(element)
		// TODO show toast in postmessage instead
	}

	private resolveValueElement(valueSelector: string): HTMLElement | undefined {
		return document.querySelector(valueSelector) ?? undefined
	}
}

customElements.define('copy-button', CopyButton)
