import { BodyNode } from '../../../../definition/src/http/http.nodes'
import { SimpleElement } from '../element-helper'

import { jsonBodyRenderer } from './body-display.json'
import { textBodyRenderer } from './body-display.text'

import type { BaseNode } from 'estree'

export interface BodyRenderer<T extends BaseNode> {
	canProcess(mimeType: string): boolean
	renderAst(nodes: BodyNode<T>): HTMLElement
}

const bodyRenderers: BodyRenderer<BaseNode>[] = [
	jsonBodyRenderer,
]

export class HttpBody extends SimpleElement {
	static tagName = 'body-display'

	public bodyNode: BodyNode

	protected onMount(): void {
		if (!this.bodyNode) throw new Error('Expected this element to be created programatically')

		const renderer: BodyRenderer<BaseNode> = bodyRenderers
			.find(r => r.canProcess(this.bodyNode.contentType))
			?? textBodyRenderer

		// There needs to be an empty line before the body
		this.append(this.createElement('br'))
		this.append(renderer.renderAst(this.bodyNode))
	}
}

SimpleElement.register(HttpBody)
