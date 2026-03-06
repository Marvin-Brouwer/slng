import chevronDownSvg from '@vscode/codicons/src/icons/chevron-down.svg'
import eyeClosedSvg from '@vscode/codicons/src/icons/eye-closed.svg'
import eyeSvg from '@vscode/codicons/src/icons/eye.svg'
import { Button } from '@vscode/webview-ui-toolkit'

import { SimpleElement } from '../element-helper'

import { MaskedValue } from './masked-value'

export class MaskToggle extends SimpleElement {
	static tagName = 'mask-toggle'

	public container!: HTMLElement

	protected onMount(): void {
		if (!this.container) throw new Error('Expected this element to be created programatically')

		const splitContainer = this.appendElement('div', {
			className: 'split-button mask-button',
			role: 'group',
			ariaLabel: 'Mask values',
		})

		const mainButton = this.appendElementTo<Button>(splitContainer, 'vscode-button', {
			type: 'button',
			appearance: 'secondary',
			className: 'main-button',
			title: 'Mask all revealed values',
			ariaLabel: 'Mask all values',
		})
		this.appendElementTo(mainButton, 'span', {
			slot: 'start',
			innerHTML: eyeClosedSvg,
		})
		mainButton.append('Mask all')
		mainButton.addEventListener('click', () => {
			this.maskAll()
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
			ariaLabel: 'More mask options',
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

		const unmaskAllButton = this.appendElementTo<Button>(dropdownMenu, 'vscode-button', {
			className: 'dropdown-item',
			appearance: 'secondary',
			title: 'Reveal all masked values',
			role: 'menuitem',
			ariaLabel: 'Reveal all masked values',
		})
		this.appendElementTo(unmaskAllButton, 'span', {
			slot: 'start',
			innerHTML: eyeSvg,
		})
		unmaskAllButton.append('Unmask all')
		unmaskAllButton.addEventListener('click', (event) => {
			event.stopPropagation()
			this.unmaskAll()
			this.closeDropdown(dropdownMenu, dropdownToggle)
		})

		mainButton.disabled = true
		dropdownToggle.disabled = true

		const updateButtonStates = () => {
			const allMaskedValues = this.container.querySelectorAll<MaskedValue>('masked-value')
			const anyRevealed = [...allMaskedValues].some(element => Object.hasOwn(element.dataset, 'revealed'))
			const anyMasked = [...allMaskedValues].some(element => !Object.hasOwn(element.dataset, 'revealed'))
			mainButton.disabled = !anyRevealed
			unmaskAllButton.disabled = !anyMasked
			dropdownToggle.disabled = !anyMasked
		}

		document.addEventListener('masked-value-changed', updateButtonStates)
		updateButtonStates()

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

	private maskAll() {
		const revealedValues = this.container.querySelectorAll<HTMLElement>('masked-value[data-revealed]')
		for (const element of revealedValues) {
			element.querySelector<HTMLElement>('vscode-button')?.click()
		}
	}

	private unmaskAll() {
		const maskedValues = this.container.querySelectorAll<HTMLElement>('masked-value:not([data-revealed])')
		for (const element of maskedValues) {
			element.querySelector<HTMLElement>('vscode-button')?.click()
		}
	}

	private openDropdown(dropdownMenu: HTMLElement, dropdownToggle: HTMLElement) {
		dropdownMenu.classList.add('open')
		dropdownToggle.setAttribute('aria-expanded', 'true')
	}

	private closeDropdown(dropdownMenu: HTMLElement, dropdownToggle: HTMLElement) {
		dropdownMenu.classList.remove('open')
		dropdownToggle.setAttribute('aria-expanded', 'false')
	}
}

SimpleElement.register(MaskToggle)
