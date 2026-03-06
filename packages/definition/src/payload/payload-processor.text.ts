import { isPrimitiveMask } from '../masking/mask'
import { reference, text, values } from '../nodes/nodes'

import { PayloadProcessor } from './payload-processor'

export const textPayloadProcessor: PayloadProcessor = {
	canProcess: mimeType => mimeType === 'text/plain',
	processPayload(metadata, chunks) {
		const bodyNodes = []
		for (const chunk of chunks) {
			if (chunk.type === 'chunk:reference') {
				if (isPrimitiveMask(chunk.value)) bodyNodes.push(reference(metadata.appendParameter(chunk.value), 'mask', chunk.value.value))
			}
			else if (chunk.value) {
				bodyNodes.push(text(chunk.value))
			}
		}

		if (bodyNodes.length === 0) return
		if (bodyNodes.length === 1) return bodyNodes[0]

		return values(...bodyNodes)
	},
}
