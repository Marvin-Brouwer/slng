import { ProtocolProcessor } from '../protocol-processor'

import { parseHttpTemplate } from './http-parser/http-parser.request'
import { HttpNode } from './http.nodes'

const httpRegex = /HTTP\//

export const httpProtocolProcessor: ProtocolProcessor<HttpNode> = {
	canProcess(template) {
		return template.strings.some(s => httpRegex.test(s))
	},
	processProtocol(context, chunks, literalLocation) {
		return parseHttpTemplate(context, chunks, literalLocation)
	},
}
