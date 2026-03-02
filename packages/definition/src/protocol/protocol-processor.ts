import { Metadata } from '../nodes/metadata'
import { SlingDocument, SlingNode } from '../nodes/nodes'
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

export function validateDefaults(metadata: Metadata, template: StringTemplate) {
	if (!template.values || (template.values.length === 0 && template.strings.join('').trim().length === 0))
		return metadata.appendError({
			reason: 'Sling protocols cannot be empty string',
			autoFix: 'sling.initial-format',
		})

	// 1. Boundary Checks
	const startsWithNewline = /^\s*\n/.test(template.strings[0])
	const lastString = template.strings.at(-1)!
	const endsWithNewline = /\n\s*$/.test(lastString)

	if (!startsWithNewline) {
		metadata.appendError({
			reason: 'Sling protocol template should start with a newline.',
			autoFix: 'sling.insert_leading_newline',
		})
	}

	if (!endsWithNewline) {
		metadata.appendError({
			reason: 'Sling protocol template should end with a newline.',
			autoFix: 'sling.insert_trailing_newline',
		})
	}
}

const fallbackProcessor: ProtocolProcessor<SlingDocument> = {
	canProcess() { return true },
	processProtocol(_context, template, _literalLocation) {
		const metadata = new Metadata()
		const defaultValidations = validateDefaults(metadata, template)
		if (defaultValidations) return {
			type: 'unsupported',
			metadata,
		}

		metadata.appendError({
			reason: 'No usable protocol detected',
		})

		return {
			type: 'unsupported',
			metadata,
		}
	},
}

export function getProtocolProcessor<TNode extends SlingNode>(context: SlingContext, template: StringTemplate) {
	if (!template) return fallbackProcessor

	const processor = [...context.protocolProcessors.values()]
		.find(processor => processor.canProcess(template)) as ProtocolProcessor<TNode> | undefined
	return processor ?? fallbackProcessor
}
