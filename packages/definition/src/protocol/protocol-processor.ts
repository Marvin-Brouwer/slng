import { error, SlingNode } from '../nodes/nodes'
import { SlingContext, StringTemplate } from '../types'

export type ProtocolProcessor<TNode extends SlingNode = SlingNode> = {
	canProcess(template: StringTemplate): boolean
	processProtocol(
		context: SlingContext,
		template: StringTemplate,
		literalLocation: { start: { line: number, column: number }, end: { line: number, column: number } },
	): TNode | undefined
	// TODO, perhaps executeProtocol should go here
	// Then http can call http 1/2/3 specifically, or use fetch when HTTP/*
	// undici — for http 1.1 and 2
	// quiche - for http 3
	// Additionally we should think about a generalized result type so we can render errors generically in the vscode extension
	// Something like ExecutionResult<T> = { success: false, error: string } | { success: true, result: T, error: string | undefined }
	// When success false an error toast is shown, when success true an error toast is shown if error is not undefined and the panel is updated.
	// Then maybe also add requestViewElement: (HtmlElementConstructor & TRequest) and responseViewElement: (HtmlElementConstructor & TResponse)
	// So the rendering is part of the protocol, but I'm not sure about that yet.
	// Eventually, anyone can add a content type, but not a new protocol, so maybe it's too overengineered and having the display in the extension is fine.
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
