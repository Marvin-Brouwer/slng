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

	// TODO call "Copy📄", with icon, add dropdown button, with option for "Copy unmasked"
	constructor() {
		super()

		// Attach shadow DOM
		const shadow = this.attachShadow({ mode: 'open' })

		// Create the vscode-button from the toolkit
		const button = createElement<Button>('vscode-button', {
			textContent: 'Copy',
			type: 'button',
			appearance: 'secondary'
		})

		// Inline SVG copy icon from @vscode/codicons (inlined at build time via tsup loader)
		const iconWrapper = document.createElement('span')
		iconWrapper.setAttribute('slot', 'start')
		iconWrapper.innerHTML = copyIconSvg
		button.appendChild(iconWrapper)

		// Default click handler (can be overridden by adding your own listener)
		button.addEventListener('click', () => {
			// TODO, I guess postmessage, use vscode clipboard api
			console.log('Copy button clicked!')
			copyElementText(document.getElementById('response-data'))
			// TODO show toast in postmessage instead
			button.textContent = 'Copy done'
		})

		// Append to shadow DOM
		shadow.appendChild(button)
	}
}

// Register the custom element
customElements.define('copy-button', CopyButton)
