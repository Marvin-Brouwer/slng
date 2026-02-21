import { SimpleElement } from '../element-helper'

import { jsonBodyRenderer } from './body-display.json'
import { textBodyRenderer } from './body-display.text'

import type { httpNodes, SlingNode } from '@slng/definition'

export interface BodyRenderer<T extends SlingNode> {
	canProcess(mimeType: string): boolean
	renderAst(nodes: httpNodes.BodyNode<T>): HTMLElement
}

const bodyRenderers: BodyRenderer<SlingNode>[] = [
	jsonBodyRenderer,
]

export class HttpBody extends SimpleElement {
	static tagName = 'body-display'

	public bodyNode: httpNodes.BodyNode

	protected onMount(): void {
		if (!this.bodyNode) throw new Error('Expected this element to be created programatically')

		const renderer: BodyRenderer<SlingNode> = bodyRenderers
			.find(r => r.canProcess(this.bodyNode.contentType))
			?? textBodyRenderer

		// There needs to be an empty line before the body
		this.append(this.createElement('br'))
		this.append(renderer.renderAst(this.bodyNode))
	}
}

SimpleElement.register(HttpBody)
