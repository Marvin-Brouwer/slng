export type AttributeConstructor = {
	attributes?: Record<string, string>
}
export function createComponent<TComponent extends SimpleElement>(component: (new () => TComponent) & SimpleElementConstructor, properties?: Partial<TComponent> | AttributeConstructor) {
	return createElement<TComponent>(component.tagName, properties)
}
export function createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
	const { attributes, ...assignableProperties } = { ...properties }
	const newElement = Object.assign(document.createElement(element) as TElement, assignableProperties)

	for (const [key, value] of Object.entries((properties as AttributeConstructor)?.attributes ?? {})) {
		newElement.setAttribute(key, value)
	}

	return newElement
}
export function addElement<TElement extends HTMLElement>(parent: Element | ShadowRoot, element: string, properties?: Partial<TElement> | AttributeConstructor) {
	const newElement = createElement<TElement>(element, properties)
	parent.append(newElement)
	return newElement
}
export function addComponent<TComponent extends SimpleElement>(parent: Element | ShadowRoot, component: (new () => TComponent) & SimpleElementConstructor, properties?: Partial<TComponent> | AttributeConstructor) {
	const newElement = createComponent<TComponent>(component, properties)
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

	appendComponentTo<TComponent extends SimpleElement>(parent: Element | ShadowRoot, component: (new () => TComponent) & SimpleElementConstructor, properties?: Partial<TComponent> | AttributeConstructor) {
		return addComponent<TComponent>(parent, component, properties)
	}

	createElement<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
		return createElement<TElement>(element, properties)
	}

	createComponent<TComponent extends SimpleElement>(component: (new () => TComponent) & SimpleElementConstructor, properties?: Partial<TComponent> | AttributeConstructor) {
		return createComponent<TComponent>(component, properties)
	}

	createHtml<TElement extends HTMLElement>(element: string, properties?: Partial<TElement> | AttributeConstructor) {
		return createElement<TElement>(element, properties).outerHTML
	}
}
