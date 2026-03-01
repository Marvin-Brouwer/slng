import { ProtocolProcessor } from '../protocol-processor'

import { parseHttpTemplate } from './http-parser/http-parser.request'
import { HttpNode } from './http.nodes'

const httpRegex = /HTTP\/[1.1|2]/

export const httpProtocolProcessor: ProtocolProcessor<HttpNode> = {
	canProcess(template) {
		return template.strings.some(s => httpRegex.test(s))
	},
	processProtocol(context, template, literalLocation) {
		return parseHttpTemplate(context, template, literalLocation)
	},
}
