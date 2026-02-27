import { isMask } from '../masking/mask'
import { masked, text, values } from '../nodes/nodes'

import { PayloadProcessor } from './payload-processor'

export const textPayloadProcessor: PayloadProcessor = {
	canProcess: (mimeType) => mimeType === 'text/plain',
	processPayload(metadata, parts) {
		if (parts.length === 0) return

		const bodyNodes = parts.map((part) => {
			if (isMask(part)) return masked(metadata.appendMaskedValue(part), part.value)
			return text(part)
		})

		if (bodyNodes.length === 1) return bodyNodes[0]

		return  values(...bodyNodes)
	}
}