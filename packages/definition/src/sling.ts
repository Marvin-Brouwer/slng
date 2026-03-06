import { createDefinition } from './definition.js'
import { namedMask } from './masking/mask.js'
import { secret } from './masking/secret.js'
import { sensitive } from './masking/sensitive.js'
import { createSlingParameters } from './parameters.js'
import { loadPlugins } from './plugins/plugin-loader.js'
import { SlingPlugin } from './plugins/plugin.js'
import { httpProtocolProcessor } from './protocol/http/http-protocol-processor.js'
import { readHttpTemplate } from './template-reader.js'
import {
	type ConfiguredSling,
	type SlingContext,
	type SlingInterpolation,
	type SlingTemplateBuilder,
} from './types.js'

/**
 * Create a configured sling instance.
 *
 * Accepts zero or more plugins that modify the sling context
 * (e.g. loading environment variables).
 *
 * Returns an object with protocol-specific tagged template builders.
 *
 * @example
 * ```ts
 * // slng.config.ts
 * import sling, { useDotEnv } from '@slng/definition/config'
 *
 * export default await sling(
 *   useDotEnv({ directory: import.meta.dirname, environments: ['local', 'staging'] }),
 * )
 * ```
 *
 * @example
 * ```ts
 * // some-api/requests.ts
 * import s from '../slng.config.js'
 *
 * export const getUsers = s.http`
 *   GET https://api.example.com/users HTTP/1.1
 *   Accept: application/json
 * `
 * ```
 */
export async function sling(...plugins: SlingPlugin[]): Promise<ConfiguredSling> {
	const context: SlingContext = {
		envSets: new Map(),
		payloadProcessors: new Map(),
		protocolProcessors: new Map(),
		environments: [],
		activeEnvironment: undefined,
	}

	await loadPlugins(context, plugins)
	context.protocolProcessors.set('http', httpProtocolProcessor)

	function makeProtocolBuilder(protocolKey: string): SlingTemplateBuilder {
		return function (strings: TemplateStringsArray, ...values: SlingInterpolation[]) {
			const template = readHttpTemplate(strings, values)
			return createDefinition(template, context, protocolKey)
		}
	}

	return {
		get context() { return context },
		get parameters() {
			if (!context.activeEnvironment || !context.envSets.has(context.activeEnvironment)) {
				return createSlingParameters()
			}
			return createSlingParameters(context.envSets.get(context.activeEnvironment))
		},
		http: makeProtocolBuilder('http'),
		namedMask,
		secret,
		sensitive,
	} as ConfiguredSling
}
