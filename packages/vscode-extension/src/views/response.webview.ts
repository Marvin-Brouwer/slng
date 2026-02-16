import copyIconSvg from '@vscode/codicons/src/icons/copy.svg'
import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
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

	constructor() {
		super()

		// Attach shadow DOM
		const shadow = this.attachShadow({ mode: 'open' })

		// Scoped styles for the split button layout
		const style = createElement('style')
		style.textContent = /*css*/`
			:host {
				display: inline-block;
				position: relative;
			}
			.split-button {
				display: inline-flex;
				align-items: stretch;
			}
			.split-button vscode-button.main-button {
				border-top-right-radius: 0;
				border-bottom-right-radius: 0;
			}
			.split-button vscode-button.dropdown-toggle {
				border-top-left-radius: 0;
				border-bottom-left-radius: 0;
				border-left: 1px solid var(--vscode-button-separator, rgba(255,255,255,0.2));
				padding: 0 4px;
				min-width: 0;
			}
			.split-button vscode-button.dropdown-toggle::part(control) {
				padding: 0 4px;
				min-width: 0;
			}
			.dropdown-toggle svg {
				width: 14px;
				height: 14px;
				fill: currentColor;
			}
			.dropdown-menu {
				display: none;
				position: absolute;
				top: 100%;
				right: 0;
				margin-top: 2px;
				z-index: 1000;
				background: var(--vscode-menu-background, var(--vscode-dropdown-background));
				border: 1px solid var(--vscode-menu-border, var(--vscode-dropdown-border));
				border-radius: 4px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
				min-width: 140px;
				padding: 4px 0;
			}
			.dropdown-menu.open {
				display: block;
			}
			.dropdown-item {
				display: block;
				width: 100%;
				padding: 4px 12px;
				border: none;
				background: none;
				color: var(--vscode-menu-foreground, var(--vscode-dropdown-foreground));
				font-family: var(--vscode-font-family, sans-serif);
				font-size: var(--vscode-font-size, 13px);
				text-align: left;
				cursor: pointer;
				white-space: nowrap;
				box-sizing: border-box;
			}
			.dropdown-item:hover {
				background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
				color: var(--vscode-menu-selectionForeground, var(--vscode-list-hoverForeground));
			}
		`

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
		const dropdownMenu = createElement('div', { className: 'dropdown-menu' })
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
			dropdownMenu.classList.remove('open')
		}

		mainButton.addEventListener('click', copyDefault)

		// Toggle dropdown on chevron click
		dropdownToggle.addEventListener('click', (e) => {
			e.stopPropagation()
			dropdownMenu.classList.toggle('open')
		})

		copyUnmaskedItem.addEventListener('click', (e) => {
			e.stopPropagation()
			copyUnmasked()
		})

		// Close dropdown when clicking outside
		document.addEventListener('click', () => {
			dropdownMenu.classList.remove('open')
		})
		shadow.addEventListener('click', (e) => {
			if (e.target !== dropdownToggle && !dropdownToggle.contains(e.target as Node)) {
				dropdownMenu.classList.remove('open')
			}
		})

		// Assemble shadow DOM
		shadow.appendChild(style)
		shadow.appendChild(container)
		shadow.appendChild(dropdownMenu)
	}
}

// Register the custom element
customElements.define('copy-button', CopyButton)
