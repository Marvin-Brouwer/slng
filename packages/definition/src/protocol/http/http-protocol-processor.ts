import { ProtocolProcessor } from '../protocol-processor'

import { parseHttpTemplate } from './http-parser/http-parser.request'
import { HttpNode } from './http.nodes'

export const httpProtocolProcessor: ProtocolProcessor<HttpNode> = {
	processProtocol(context, chunks, literalLocation) {
		return parseHttpTemplate(context, chunks, literalLocation)
	},
}
