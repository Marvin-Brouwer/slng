import { textPayloadProcessor } from '../../../payload/payload-processor.text.js'
import { plugin, SlingPlugin } from '../../plugin.js'

export function useText(): SlingPlugin {
	return plugin('sling:payload:text', {

		setupProcessors(context) {
			context.payloadProcessors.set('text', textPayloadProcessor)
		},
	})
}
