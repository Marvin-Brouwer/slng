import { Metadata } from '../nodes/metadata'
import { SlingNode, ValueNode, ValuesNode } from '../nodes/nodes'
import { TemplateChunks } from '../template-chunks'
import { MimeType, SlingContext } from '../types'

import { textPayloadProcessor } from './payload-processor.text'

export type PayloadProcessor<TNode extends SlingNode = ValueNode | ValuesNode> = {
	canProcess(mimeType: MimeType): boolean
	processPayload(metadata: Metadata, chunks: TemplateChunks): TNode | undefined
	// TODO add displayElement: (HtmlElementConstructor & { node: TNode }) so the rendering can be done per payload processor
}

const defaultProcessor = textPayloadProcessor
export function getProcessor<TNode extends SlingNode>(context: SlingContext, mimeType: MimeType | undefined) {
	if (!mimeType) return defaultProcessor

	const processor = [...context.payloadProcessors.values()]
		.find(processor => processor.canProcess(mimeType)) as PayloadProcessor<TNode>

	return processor ?? defaultProcessor
}
