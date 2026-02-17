export type AttributeConstructor = {
	attributes?: Record<string, string>
}
export function createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
	const assignablePropserties = { ...properties, attributes: undefined }
	delete assignablePropserties.attributes
	return Object.assign(document.createElement(element) as TElement, assignablePropserties)
}
export function addElement<TElement extends HTMLElement>(parent: Element | ShadowRoot, element: string, properties?: Partial<TElement> | AttributeConstructor) {
	const newElement = createElement<TElement>(element, properties)
	for (const [key, value] of Object.entries((properties as AttributeConstructor)?.attributes ?? {})) {
		newElement.setAttribute(key, value)
	}
	parent.append(newElement)
	return newElement
}

export type SimpleElementConstructor = CustomElementConstructor & {
	tagName: string
}
export abstract class SimpleElement extends HTMLElement {
	static register<TElement extends SimpleElementConstructor>(element: TElement) {
		customElements.define(element.tagName, element)
	}

	constructor() {
		super()
		const root = this.attachShadow({ mode: 'open' })
		this.appendElementTo(root, 'slot')
	}

	protected abstract onMount(): void

	connectedCallback() {
		requestAnimationFrame(() => {
			this.onMount()
		})
	}

	appendElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
		return addElement<TElement>(this, element, properties)
	}

	appendElementTo<TElement extends HTMLElement>(parent: Element | ShadowRoot, element: string, properties?: Partial<TElement> | AttributeConstructor) {
		return addElement<TElement>(parent, element, properties)
	}

	createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
		return createElement<TElement>(element, properties)
	}

	createHtml<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
		return createElement<TElement>(element, properties).outerHTML
	}
}
