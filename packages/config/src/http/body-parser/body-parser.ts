import { isJsonContentType } from '../../display-parser.json'
import { isMask } from '../../masking/mask'
import { TemplateLines } from '../http-parser/http-parser'
import { body, BodyNode, masked, Metadata, text, values } from '../http.nodes'

import { convertToJsonAst } from './body-parser.json'

export function parseHttpBody(metadata: Metadata, fetchResponse: Response): Promise<BodyNode>
export function parseHttpBody(metadata: Metadata, requestBody: TemplateLines): Promise<BodyNode>

export async function parseHttpBody(metadata: Metadata, body: TemplateLines | Response): Promise<BodyNode | undefined> {
	if (isJsonContentType(metadata.contentType)) return await createJsonBody(metadata, body)
	return await createTextBody(metadata, body)
}

async function createJsonBody(metadata: Metadata, bodyValue: TemplateLines | Response) {
	const jsonBody = bodyValue instanceof Request
		? stringToTemplate(await bodyValue.text())
		: bodyValue as TemplateLines

	return body(metadata.contentType!, convertToJsonAst(metadata, jsonBody))
}

async function createTextBody(metadata: Metadata, bodyValue: TemplateLines | Response) {
	const textBody = bodyValue instanceof Request
		? stringToTemplate(await bodyValue.text())
		: bodyValue as TemplateLines

	const contentType = metadata.contentType ?? 'text/undefined'

	if (textBody.length === 0) return

	const bodyNodes = textBody.flatMap(line => line.map(lp => (isMask(lp.part) ? lp.part : lp.part))).map((part) => {
		if (isMask(part)) return masked(metadata.appendMaskedValue(part), part.value)
		return text(part)
	})

	if (bodyNodes.length === 0) return
	if (bodyNodes.length === 1) return body(contentType, bodyNodes[0])

	return body(contentType, values(...bodyNodes))
}

function stringToTemplate(value: string): TemplateLines {
	return [
		[{
			part: value,
		}],
	]
}
