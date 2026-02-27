import { plugin, SlingPlugin } from '../../plugin.js'
import { JsonOptions, jsonPayloadProcessor } from '../../../payload/payload-processor.json.js'

export function useJson(options: JsonOptions): SlingPlugin {

	return plugin('sling:payload:json', {

		config: options,

		setupProcessors(context) {
			context.payloadProcessors.set('json', jsonPayloadProcessor(options))
		},
	})
}