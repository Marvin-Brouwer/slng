import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import { Button } from '@vscode/webview-ui-toolkit'
import '../webview'

// TODO figure out why all te eslint errors are here
/* eslint-disable */

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
function copyElementText(el: HTMLElement) {
	if (!el) return
	// TODO this doesn't work, use Clipboard.writeText when const vscode = acquireVsCodeApi(); becomes available
	navigator.clipboard.writeText(el.textContent || "")
		.then(() => console.log("Copied!"))
		.catch(err => console.error("Copy failed:", err))
}

function createElement<TElement extends HTMLElement>(element: string, props?: Partial<TElement>) {
	return Object.assign(document.createElement(element) as TElement, props ?? {})
}

class CopyButton extends HTMLElement {

	private styleLink: HTMLLinkElement

	constructor() {
		super()

		// Attach shadow DOM
		const shadow = this.attachShadow({ mode: 'open' })

		// Scoped styles for the split button layout, loaded via <link> to comply with CSP
		// href/nonce are set in connectedCallback, since attributes aren't available in the constructor
		this.styleLink = createElement<HTMLLinkElement>('link', { rel: 'stylesheet' })

		// Container for the split button
		const container = createElement('div', { className: 'split-button' })

		// Main "Copy" button
		const mainButton = createElement<Button>('vscode-button', {
			textContent: 'Copy',
			type: 'button',
			appearance: 'secondary',
			className: 'main-button'
		})
		mainButton.appendChild(createElement('span', {
			slot: 'start',
			innerHTML: copyIconSvg
		}))

		// Dropdown toggle button with chevron-down icon
		const dropdownToggle = createElement<Button>('vscode-button', {
			type: 'button',
			appearance: 'secondary',
			className: 'dropdown-toggle',
			innerHTML: chevronDownSvg
		})

		// Dropdown menu with "Copy unmasked" option
		const dropdownMenu = createElement('div', {
			className: 'dropdown-menu'
		})
		const copyUnmaskedItem = createElement('button', {
			className: 'dropdown-item',
			textContent: 'Copy unmasked'
		})
		dropdownMenu.appendChild(copyUnmaskedItem)

		container.appendChild(mainButton)
		container.appendChild(dropdownToggle)

		function copyDefault() {
			// TODO, I guess postmessage, use vscode clipboard api
			console.log('Copy button clicked!')
			copyElementText(document.getElementById('response-data'))
			// TODO show toast in postmessage instead
			mainButton.textContent = 'Copied!'
		}
		function copyUnmasked() {
			// TODO, I guess postmessage, use vscode clipboard api
			console.log('Copy unmasked button clicked!')
			copyElementText(document.getElementById('response-data'))
			// TODO show toast in postmessage instead
			mainButton.textContent = 'Copied!'
			closeDropdown()
		}

		mainButton.addEventListener('click', copyDefault)

		function openDropdown() {
			dropdownMenu.classList.add('open')
		}
		function closeDropdown() {
			dropdownMenu.classList.remove('open')
		}

		// Toggle dropdown on chevron click
		dropdownToggle.addEventListener('click', (e) => {
			e.stopPropagation()
			if (dropdownMenu.classList.contains('open')) {
				closeDropdown()
			} else {
				openDropdown()
			}
		})

		copyUnmaskedItem.addEventListener('click', (e) => {
			e.stopPropagation()
			copyUnmasked()
		})

		// Close dropdown when clicking outside
		document.addEventListener('click', () => {
			closeDropdown()
		})
		shadow.addEventListener('click', (e) => {
			if (e.target !== dropdownToggle && !dropdownToggle.contains(e.target as Node)) {
				closeDropdown()
			}
		})

		// Assemble shadow DOM
		shadow.appendChild(this.styleLink)
		shadow.appendChild(container)
		shadow.appendChild(dropdownMenu)
	}
	connectedCallback() {
		this.styleLink.href = this.getAttribute('style-src')!
		this.styleLink.nonce = this.getAttribute('style-nonce')!
	}
}

// Register the custom element
customElements.define('copy-button', CopyButton)
