import { error, SlingNode } from '../nodes/nodes'
import { SlingContext, StringTemplate } from '../types'

export type ProtocolProcessor<TNode extends SlingNode = SlingNode> = {
	canProcess(template: StringTemplate): boolean
	processProtocol(
		context: SlingContext,
		template: StringTemplate,
		literalLocation: { start: { line: number, column: number }, end: { line: number, column: number } },
	): TNode | undefined
}

export function getProtocolProcessor<TNode extends SlingNode>(context: SlingContext, template: StringTemplate) {
	if (!template) return error({
		reason: 'No protocol defined',
	})
	const processor = [...context.protocolProcessors.values()]
		.find(processor => processor.canProcess(template)) as ProtocolProcessor<TNode> | undefined
	return processor ?? error({
		reason: 'No protocol detected',
	})
}
