import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import { Button } from '@vscode/webview-ui-toolkit'

import { createElement } from '../element-helper'

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

export class CopyButton extends HTMLElement {
	private valueSelector: string | undefined
	private valueElement: HTMLElement | undefined

	private root: ShadowRoot

	private mainButton: Button
	private copyUnmaskedButton: Button
	private dropdownToggle: Button

	private dropdownMenu: HTMLElement
	private splitContainer: HTMLElement

	constructor() {
		super()

		this.root = this.attachShadow({ mode: 'open' })

		this.splitContainer = createElement('div', { className: 'split-button' })
		this.splitContainer.setAttribute('role', 'group')
		this.splitContainer.setAttribute('aria-label', 'Copy value')

		// Main "Copy" button
		this.mainButton = createElement<Button>('vscode-button', {
			textContent: 'Copy',
			type: 'button',
			appearance: 'secondary',
			className: 'main-button',
		})
		this.mainButton.setAttribute('aria-label', 'Copy value to clipboard')
		this.mainButton.append(createElement('span', {
			slot: 'start',
			innerHTML: copyIconSvg,
		}))
		this.mainButton.addEventListener('click', _event => this.copyDefault())
		this.splitContainer.append(this.mainButton)

		// Dropdown toggle button with chevron-down icon
		this.dropdownToggle = createElement<Button>('vscode-button', {
			type: 'button',
			title: 'More options',
			appearance: 'secondary',
			className: 'dropdown-toggle',
			innerHTML: chevronDownSvg,
		})
		this.dropdownToggle.setAttribute('aria-label', 'More copy options')
		this.dropdownToggle.setAttribute('aria-haspopup', 'menu')
		this.dropdownToggle.setAttribute('aria-expanded', 'false')
		this.splitContainer.append(this.dropdownToggle)

		// Dropdown menu with "Copy unmasked" option
		this.dropdownMenu = createElement('div', {
			className: 'dropdown-menu',
		})
		this.dropdownMenu.setAttribute('role', 'menu')
		this.copyUnmaskedButton = createElement<Button>('vscode-button', {
			className: 'dropdown-item',
			textContent: 'Copy unmasked',
			appearance: 'secondary',
		})
		this.copyUnmaskedButton.setAttribute('role', 'menuitem')
		this.dropdownMenu.append(this.copyUnmaskedButton)

		// Toggle dropdown on chevron click
		this.dropdownToggle.addEventListener('click', (event) => {
			event.stopPropagation()
			if (this.dropdownMenu.classList.contains('open')) {
				this.closeDropdown()
			}
			else {
				this.openDropdown()
			}
		})

		this.copyUnmaskedButton.addEventListener('click', (event) => {
			event.stopPropagation()
			this.copyUnmasked()
		})

		// Close dropdown when clicking outside
		document.addEventListener('click', () => {
			this.closeDropdown()
		})
		window.addEventListener('blur', () => {
			this.closeDropdown()
		})

		this.root.addEventListener('click', (event) => {
			if (event.target !== this.dropdownToggle && !this.dropdownToggle.contains(event.target as Node)) {
				this.closeDropdown()
			}
		})
	}

	connectedCallback() {
		this.valueSelector = this.getAttribute('for') ?? undefined
		requestAnimationFrame(() => {
			const type = this.getAttribute('type')
			if (type) {
				this.mainButton.title = `Copy the ${type} with sensitive values masked`
				this.copyUnmaskedButton.title = `Copy the ${type} with sensitive values UNMASKED`
				this.splitContainer.setAttribute('aria-label', `Copy ${type}`)
				this.mainButton.setAttribute('aria-label', `Copy ${type} to clipboard`)
			}
			// Scoped styles for the split button layout, loaded via <link> to comply with CSP
			// href/nonce are set in connectedCallback, since attributes aren't available in the constructor
			this.root.append(createElement<HTMLLinkElement>('link', {
				rel: 'stylesheet',
				href: this.getAttribute('style-src'),
				nonce: this.getAttribute('style-nonce'),
				// Only once the styles are loaded do we show the button
				onload: () => {
					this.root.append(this.splitContainer)
					this.root.append(this.dropdownMenu)
				},
			}))
		})
	}

	private resolveValueElement(): HTMLElement | undefined {
		if (!this.valueElement && this.valueSelector) {
			this.valueElement = document.querySelector(this.valueSelector) ?? undefined
		}
		return this.valueElement
	}

	openDropdown() {
		this.dropdownMenu.classList.add('open')
		this.dropdownToggle.setAttribute('aria-expanded', 'true')
	}

	closeDropdown() {
		this.dropdownMenu.classList.remove('open')
		this.dropdownToggle.setAttribute('aria-expanded', 'false')
	}

	copyDefault() {
		const element = this.resolveValueElement()
		if (!element) return
		// TODO, I guess postmessage, use vscode clipboard api
		console.log('Copy button clicked!')
		copyElementText(element)
		// TODO show toast in postmessage
	}

	copyUnmasked() {
		const element = this.resolveValueElement()
		if (!element) return
		// TODO, I guess postmessage, use vscode clipboard api
		console.log('Copy unmasked button clicked!')
		copyElementText(element)
		// TODO show toast in postmessage instead
		this.closeDropdown()
	}
}

customElements.define('copy-button', CopyButton)
