import { document, HttpDocument, Metadata, response, text } from '../http.nodes'

export function buildHttpResponse(fetchResponse: Response): HttpDocument | undefined {
	const startLine = response('HTTP', '1.1', text(fetchResponse.status), text(fetchResponse.statusText))
	// TODO headers // TODO content-type to meta
	// TODO body
	return document({
		startLine,
		// TODO headers
		// TODO body
		metadata: new Metadata(),
	})
}
