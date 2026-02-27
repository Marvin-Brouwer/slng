import { Metadata, text } from '../../nodes/nodes'
import { SlingContext } from '../../types'
import { parseHttpBody } from '../http-parser/http-parser.request'
import { document, header, HttpDocument, response } from '../http.nodes'

export async function buildHttpResponse(context: SlingContext, fetchResponse: Response): Promise<HttpDocument> {
	const metadata = new Metadata()

	const startLine = response('HTTP', '1.1', text(fetchResponse.status), text(fetchResponse.statusText))

	const headers = [...fetchResponse.headers.entries()].map(([k, v]) => header(text(k), text(v)))
	metadata.contentType = fetchResponse.headers.get('content-type')?.split(';')[0] ?? undefined
	const bodyString = await fetchResponse.text()

	const bodyNode = parseHttpBody(context, metadata, [bodyString])

	return document({
		startLine,
		headers,
		body: bodyNode,
		metadata,
	})
}
