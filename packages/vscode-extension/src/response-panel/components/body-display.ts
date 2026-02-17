import { SimpleElement } from '../element-helper'

import { jsonBodyRenderer } from './body-display.json'
import { renderTextBodyAst } from './body-display.text'

import type { BodyAstNode } from '@slng/config'

export interface BodyRenderer {
	canProcess(mimeType: string): boolean
	renderAst(nodes: BodyAstNode[]): string
}

const bodyRenderers: BodyRenderer[] = [
	jsonBodyRenderer,
]

export class HttpBody extends SimpleElement {
	static tagName = 'body-display'

	protected onMount(): void {
		const raw = this.textContent?.trim()

		if (!raw) return

		const contentType = this.getAttribute('content-type') ?? ''
		const ast = JSON.parse(raw) as BodyAstNode[]
		const renderer = bodyRenderers.find(r => r.canProcess(contentType))
		const renderAst = renderer ? renderer.renderAst : renderTextBodyAst

		this.innerHTML = this.createHtml('pre', {
			innerHTML: renderAst(ast),
		})

		// There needs to be an empty line before the body
		this.prepend(this.createElement('br'))
	}
}

SimpleElement.register(HttpBody)
