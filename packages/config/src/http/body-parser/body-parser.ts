import { isJsonContentType } from '../../display-parser.json'
import { isMask, Masked } from '../../masking/mask'
import { PrimitiveValue } from '../../types'
import { body, BodyNode, masked, Metadata, text, values } from '../http.nodes'

import { convertToJsonAst } from './body-parser.json'

export function parseHttpBody(metadata: Metadata, textBody: (PrimitiveValue | Masked<PrimitiveValue>)[]): BodyNode | undefined {
	if (isJsonContentType(metadata.contentType)) return createJsonBody(metadata, textBody)
	return createTextBody(metadata, textBody)
}

function createJsonBody(metadata: Metadata, textBody: (PrimitiveValue | Masked<PrimitiveValue>)[]) {
	return body(metadata.contentType!, convertToJsonAst(metadata, textBody))
}

function createTextBody(metadata: Metadata, textBody: (PrimitiveValue | Masked<PrimitiveValue>)[]) {
	const contentType = metadata.contentType ?? 'text/undefined'

	if (textBody.length === 0) return

	const bodyNodes = textBody.map((part) => {
		if (isMask(part)) return masked(metadata.appendMaskedValue(part), part.value)
		return text(part)
	})

	if (bodyNodes.length === 0) return
	if (bodyNodes.length === 1) return body(contentType, bodyNodes[0])

	return body(contentType, values(...bodyNodes))
}
