import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import { Button } from '@vscode/webview-ui-toolkit'
import '../webview'

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
	// TODO this doesn't work, use Clipboard.writeText when const vscode = acquireVsCodeApi(); becomes available
	navigator.clipboard.writeText(element.textContent || '')
		.then(() => console.log('Copied!'))
		.catch(error => console.error('Copy failed:', error))
}

function createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement>) {
	return Object.assign(document.createElement(element) as TElement, properties ?? {})
}

class CopyButton extends HTMLElement {
	private root: ShadowRoot
	private dropdownMenu: HTMLElement
	private splitContainer: HTMLElement

	constructor() {
		super()

		this.root = this.attachShadow({ mode: 'open' })

		this.splitContainer = createElement('div', { className: 'split-button' })

		// Main "Copy" button
		const mainButton = createElement<Button>('vscode-button', {
			textContent: 'Copy',
			type: 'button',
			appearance: 'secondary',
			className: 'main-button',
		})
		mainButton.append(createElement('span', {
			slot: 'start',
			innerHTML: copyIconSvg,
		}))
		mainButton.addEventListener('click', _event => this.copyDefault())
		this.splitContainer.append(mainButton)

		// Dropdown toggle button with chevron-down icon
		const dropdownToggle = createElement<Button>('vscode-button', {
			type: 'button',
			appearance: 'secondary',
			className: 'dropdown-toggle',
			innerHTML: chevronDownSvg,
		})
		this.splitContainer.append(dropdownToggle)

		// Dropdown menu with "Copy unmasked" option
		this.dropdownMenu = createElement('div', {
			className: 'dropdown-menu',
		})
		const copyUnmaskedItem = createElement<Button>('vscode-button', {
			className: 'dropdown-item',
			textContent: 'Copy unmasked',
			appearance: 'secondary',
		})
		this.dropdownMenu.append(copyUnmaskedItem)

		// Toggle dropdown on chevron click
		dropdownToggle.addEventListener('click', (event) => {
			event.stopPropagation()
			if (this.dropdownMenu.classList.contains('open')) {
				this.closeDropdown()
			}
			else {
				this.openDropdown()
			}
		})

		copyUnmaskedItem.addEventListener('click', (event) => {
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
			if (event.target !== dropdownToggle && !dropdownToggle.contains(event.target as Node)) {
				this.closeDropdown()
			}
		})
	}

	connectedCallback() {
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
	}

	openDropdown() {
		this.dropdownMenu.classList.add('open')
	}

	closeDropdown() {
		this.dropdownMenu.classList.remove('open')
	}

	copyDefault() {
		// TODO, I guess postmessage, use vscode clipboard api
		console.log('Copy button clicked!')
		copyElementText(document.querySelector('#response-data'))
		// TODO show toast in postmessage
	}

	copyUnmasked() {
		// TODO, I guess postmessage, use vscode clipboard api
		console.log('Copy unmasked button clicked!')
		copyElementText(document.querySelector('#response-data'))
		// TODO show toast in postmessage instead
		this.closeDropdown()
	}
}

// Register the custom element
customElements.define('copy-button', CopyButton)
