import eyeClosedSvg from '@vscode/codicons/src/icons/eye-closed.svg'
import eyeSvg from '@vscode/codicons/src/icons/eye.svg'
import { Button } from '@vscode/webview-ui-toolkit'

import { SimpleElement } from '../element-helper'
import { escapeHtml } from '../node-helper'
import { vscodeApi } from '../vscode-api'

type RevealedMessage = { command: 'revealed', reference: number, value: string }

export class MaskedValue extends SimpleElement {
	static tagName = 'masked-value'

	public mask!: string
	public reference!: number

	protected onMount(): void {
		if (!this.mask || this.reference === undefined) throw new Error('Expected this element to be created programatically')

		const valueSpan = this.appendElement('span', {
			textContent: escapeHtml(this.mask),
		})

		let revealed = false

		const toggleButton = this.appendElement<Button>('vscode-button', {
			type: 'button',
			appearance: 'icon',
			title: 'Reveal value',
			ariaLabel: 'Toggle masked value visibility',
			innerHTML: eyeSvg,
		})

		toggleButton.addEventListener('click', () => {
			revealed = !revealed
			if (revealed) {
				const source = this.closest('http-response') ? 'response' : 'request'
				vscodeApi.postMessage({ command: 'reveal', reference: this.reference, source })
				toggleButton.innerHTML = eyeClosedSvg
				toggleButton.title = 'Mask value'
				valueSpan.textContent = ''
			}
			else {
				toggleButton.innerHTML = eyeSvg
				toggleButton.title = 'Reveal value'
				valueSpan.textContent = escapeHtml(this.mask)
			}
		})

		window.addEventListener('message', (event: MessageEvent<RevealedMessage>) => {
			const { command, reference, value } = event.data
			if (command === 'revealed' && reference === this.reference && revealed) {
				valueSpan.textContent = value
			}
		})
	}
}

SimpleElement.register(MaskedValue)
