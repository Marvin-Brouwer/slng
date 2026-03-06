import { Metadata } from '../nodes/metadata'
import { SlingDocument, SlingNode } from '../nodes/nodes'
import { TemplateChunks } from '../template-chunks'
import { SlingContext, StringChunk, StringTemplate } from '../types'

export type ProtocolProcessor<TNode extends SlingNode = SlingNode> = {
	canProcess(template: StringTemplate): boolean
	processProtocol(
		context: SlingContext,
		chunks: TemplateChunks,
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

export function validateDefaults(metadata: Metadata, chunks: TemplateChunks) {
	const chunkArray = chunks.chunks
	const hasReferences = chunkArray.some(c => c.type === 'chunk:reference')
	const allStringContent = chunkArray
		.filter((c): c is StringChunk => c.type === 'chunk:string')
		.map(c => c.value)
		.join('')

	if (!hasReferences && allStringContent.trim().length === 0)
		return metadata.appendError({
			reason: 'Sling protocols cannot be empty string',
			autoFix: 'sling.initial-format',
		})

	const firstChunk = chunkArray[0]
	const startsWithNewline = firstChunk?.type === 'chunk:string' && /^\s*\n/.test(firstChunk.value)
	const lastChunk = chunkArray.at(-1)
	const endsWithNewline = lastChunk?.type === 'chunk:string' && /\n\s*$/.test(lastChunk.value)

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
	processProtocol(_context, chunks, _literalLocation) {
		const metadata = new Metadata()
		const defaultValidations = validateDefaults(metadata, chunks)
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
