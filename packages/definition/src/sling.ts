import { createDefinition } from './definition.js'
import { namedMask } from './masking/mask.js'
import { secret } from './masking/secret.js'
import { sensitive } from './masking/sensitive.js'
import { createSlingParameters } from './parameters.js'
import { readHttpTemplate } from './template-reader.js'
import {
	type ConfiguredSling,
	type SlingContext,
	type SlingPlugin,
	type SlingInterpolation,
	SlingTemplateBuilder,
} from './types.js'

/**
 * Create a configured sling instance.
 *
 * Accepts zero or more plugins that modify the sling context
 * (e.g. loading environment variables).
 *
 * Returns a tagged template function that defines HTTP requests.
 *
 * @example
 * ```ts
 * // slng.config.mts
 * import sling, { useDotEnv } from '@slng/definition'
 *
 * export default sling(
 *   useDotEnv('local', 'staging'),
 * )
 * ```
 *
 * @example
 * ```ts
 * // some-api/requests.mts
 * import sling from '../slng.config.mjs'
 *
 * export const getUsers = sling`
 *   GET https://api.example.com/users HTTP/1.1
 *
 *   Authorization: Bearer ${process.env.TOKEN}
 * `
 * ```
 */
export function sling(...plugins: SlingPlugin[]): ConfiguredSling {
	// Run all plugin setup functions synchronously where possible.
	// If any are async, we store the promise and it must be awaited
	// before execution (the CLI/extension handles this).
	let setupPromise: Promise<void> | undefined

	const context: SlingContext = {
		envSets: new Map(),
		environments: [],
		activeEnvironment: undefined,
	}

	const results = plugins.map(p => p.setup(context))
	const hasAsync = results.some(
		r => r !== undefined && typeof (r).then === 'function',
	)
	if (hasAsync) {
		setupPromise = Promise.all(
			results.filter(Boolean) as Promise<void>[],
		).then(() => {})
	}

	const templateFunction = function slingTemplate(
		strings: TemplateStringsArray,
		...values: SlingInterpolation[]
	) {
		const template = readHttpTemplate(strings, values)
		return createDefinition(template, context)
	} as SlingTemplateBuilder

	// Attach parameters
	Object.defineProperty(templateFunction, 'context', {
		value: context,
		writable: false,
		enumerable: true,
	})

	// Parameters are derived from the active environment via a getter so
	// they automatically reflect environment switches at any point in time.
	Object.defineProperty(templateFunction, 'parameters', {
		get() {
			if (!context.activeEnvironment || !context.envSets.has(context.activeEnvironment)) {
				return createSlingParameters()
			}
			return createSlingParameters(context.envSets.get(context.activeEnvironment))
		},
		enumerable: true,
	})

	// Attach setup promise for CLI/extension to await if needed
	Object.defineProperty(templateFunction, '__setupPromise', {
		value: setupPromise,
		writable: false,
		enumerable: false,
	})

	// Attach helpers
	Object.defineProperty(templateFunction, 'namedMask', {
		value: namedMask,
		writable: false,
		enumerable: true,
	})
	Object.defineProperty(templateFunction, 'secret', {
		value: secret,
		writable: false,
		enumerable: true,
	})
	Object.defineProperty(templateFunction, 'sensitive', {
		value: sensitive,
		writable: false,
		enumerable: true,
	})

	return templateFunction as ConfiguredSling
}
