import { parseHttpBody } from '../body-parser/body-parser'
import { document, header, HttpDocument, Metadata, response, text } from '../http.nodes'

export async function buildHttpResponse(fetchResponse: Response): Promise<HttpDocument> {
	const metadata = new Metadata()

	const startLine = response('HTTP', '1.1', text(fetchResponse.status), text(fetchResponse.statusText))

	const headers = [...fetchResponse.headers.entries()].map(([k, v]) => header(text(k), text(v)))
	metadata.contentType = fetchResponse.headers.get('content-type')?.split(';')[0] ?? undefined
	const bodyString = await fetchResponse.text()

	const bodyNode = parseHttpBody(metadata, [bodyString])

	return document({
		startLine,
		headers,
		body: bodyNode,
		metadata,
	})
}
