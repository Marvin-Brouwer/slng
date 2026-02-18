import { body, document, header, HttpDocument, Metadata, response, text } from '../http.nodes'

export async function buildHttpResponse(fetchResponse: Response): Promise<HttpDocument> {
	const metadata = new Metadata()

	const startLine = response('HTTP', '1.1', text(fetchResponse.status), text(fetchResponse.statusText))

	const headers = [...fetchResponse.headers.entries()].map(([k, v]) => header(text(k), text(v)))
	metadata.contentType = fetchResponse.headers.get('contentType')?.split(';')[0] ?? undefined

	const bodyNode = body(await makeBody(fetchResponse, metadata.contentType))

	return document({
		startLine,
		headers,
		body: bodyNode,
		metadata,
	})
}

function makeBody(fetchResponse: Response, contentType: string | undefined) {
	/* eslint-disable @typescript-eslint/switch-exhaustiveness-check, unicorn/switch-case-braces */
	switch (contentType) {
		// TODO return colorized json
		case 'application/json': return fetchResponse.text()
	}
	return fetchResponse.text()
	/* eslint-enable @typescript-eslint/switch-exhaustiveness-check, unicorn/switch-case-braces */
}
