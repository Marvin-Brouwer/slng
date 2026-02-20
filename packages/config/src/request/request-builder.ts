import { resolveString } from '../display/node-helpers'
import { ErrorNode, HeaderNode, HttpDocument, Metadata, NodeError } from '../http/http.nodes'
import { isPrimitiveMask } from '../masking/mask'
import { ParsedHttpRequest, ResolvedStringTemplate } from '../types'

export function buildRequest(document: HttpDocument, resolvedTemplate: ResolvedStringTemplate | undefined): ParsedHttpRequest | Error {
	if (document.startLine.type === 'error') return new NodeError(document.startLine)
	if (document.startLine.type !== 'request') return new Error('Unreachable code detected, not a request')

	const methodNode = document.startLine.method
	if (methodNode.type === 'error') return new NodeError(methodNode)
	const method = methodNode.value
	const urlNode = document.startLine.url
	if (urlNode.type === 'error') return new NodeError(urlNode)
	const url = resolveString(urlNode, document.metadata)
	const protocolNode = document.startLine.protocol
	if (protocolNode.type === 'error') return new NodeError(protocolNode)
	const httpVersion = protocolNode.version

	const headers = buildHeaders(document.metadata, document.headers)
	if (headers instanceof Error) return headers

	const body = buildBody(document.metadata, resolvedTemplate)
	if (body instanceof Error) return body

	return { method, url, httpVersion, headers, body }
}

function buildHeaders(metadata: Metadata, headerNodes: (ErrorNode | HeaderNode)[] | undefined) {
	const headers: Record<string, string> = {}
	if (headerNodes === undefined) return headers

	for (const headerNode of headerNodes) {
		if (headerNode.type === 'error') return new NodeError(headerNode)

		const nameNode = headerNode.name
		if (nameNode.type === 'error') return new NodeError(nameNode)
		const valueNode = headerNode.value
		if (valueNode.type === 'error') return new NodeError(valueNode)

		headers[nameNode.value] = resolveString(valueNode, metadata)
	}

	return headers
}

function buildBody(metadata: Metadata, resolvedTemplate: ResolvedStringTemplate | undefined) {
	if (resolvedTemplate === undefined) return
	if (metadata.contentType === undefined) return

	if (metadata.contentType === 'application/json') return buildBodyTextFromTemplate(resolvedTemplate)
	if (metadata.contentType === 'text/plain') return buildBodyTextFromTemplate(resolvedTemplate)

	return new Error(`contentType ${metadata.contentType} not supported!`)
}

// TODO, it's possibly better to dedent this too, figure out a way to solve this
function buildBodyTextFromTemplate(resolvedTemplate: ResolvedStringTemplate) {
	// eslint-disable-next-line unicorn/no-array-reduce
	return resolvedTemplate.strings.reduce((accumulator, currentString, index) => {
		const value = resolvedTemplate.values[index]
		if (!value) return accumulator + currentString
		if (!isPrimitiveMask(value)) return accumulator + currentString + String(value)
		// Add the current static string, then the value at the current index (if it exists)
		return accumulator + currentString + String(value.unmask())
	}, '')
		.split('\n\n')[1]
}
