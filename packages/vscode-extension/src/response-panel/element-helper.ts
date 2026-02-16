export function createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement>) {
	return Object.assign(document.createElement(element) as TElement, properties ?? {})
}
export function addElement<TElement extends HTMLElement>(parent: Element | ShadowRoot, element: string, properties?: Partial<TElement>) {
	const newElement = createElement<TElement>(element, properties)
	parent.append(newElement)
	return newElement
}

export type SimpleElementConstructor = CustomElementConstructor & { tagName: string }
export abstract class SimpleElement extends HTMLElement {
	private root: ShadowRoot

	static register<TElement extends SimpleElementConstructor>(element: TElement) {
		customElements.define(element.tagName, element)
	}

	constructor() {
		super()

		this.root = this.attachShadow({ mode: 'open' })
	}

	protected abstract onMount(): void

	connectedCallback() {
		requestAnimationFrame(() => {
			this.onMount()
		})
	}

	appendElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement>) {
		return addElement<TElement>(this.root, element, properties)
	}

	appendElementTo<TElement extends HTMLElement>(parent: Element | ShadowRoot, element: string, properties?: Partial<TElement>) {
		return addElement<TElement>(parent, element, properties)
	}

	createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement>) {
		return createElement<TElement>(element, properties)
	}
}
