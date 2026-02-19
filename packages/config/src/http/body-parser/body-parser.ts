import { isJsonContentType } from '../../display-parser.json'
import { isMask } from '../../masking/mask'
import { TemplateLines } from '../http-parser/http-parser'
import { body, BodyNode, text, Metadata } from '../http.nodes'

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

	if (textBody.length === 0) return

	const bodyContent = textBody
		.map(line => line.map(lp => (isMask(lp.part) ? lp.part.value : String(lp.part))).join(''))
		.join('\n').trim()

	if (!bodyContent) return

	return body(metadata.contentType ?? 'text/undefined', text(bodyContent))
}

function stringToTemplate(value: string): TemplateLines {
	return [
		[{
			part: value,
		}],
	]
}
