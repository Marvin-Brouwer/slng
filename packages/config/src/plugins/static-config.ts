import type { ParameterType } from '../parameters.js'
import type { SlingPlugin } from '../types.js'

/**
 * Provide static configuration values for one or more environments.
 *
 * Each key in `environmentConfigs` is an environment name, and its value
 * is a flat record of parameters.  Values are merged into the sling
 * context (existing values from earlier plugins are preserved, new keys
 * are added, and overlapping keys are overwritten by this plugin).
 *
 * The first listed environment is set as the active one by default
 * (unless an earlier plugin already chose one).
 *
 * @param environmentConfigs  A mapping of environment names to their parameters.
 *
 * @example
 * ```ts
 * import sling, { useConfig } from '@slng/config'
 *
 * export default sling(
 *   useConfig({
 *     dev: { app: 'testapp', profile: 'dev' },
 *     staging: { app: 'testapp', profile: 'staging' },
 *   }),
 * )
 * ```
 */
export function useConfig(environmentConfigs: Record<string, Record<string, ParameterType>>): SlingPlugin {
	return {
		name: 'static-config',
		setup(context) {
			const environments = Object.keys(environmentConfigs)

			for (const environment in environmentConfigs) {
				const currentEnvironment = context.envSets.get(environment)

				const environmentVariables = environmentConfigs[environment] ?? {}

				// Merge
				const merged = { ...currentEnvironment, ...environmentVariables }
				context.envSets.set(environment, merged)
				context.environments.push(environment)
			}

			// First environment is the default active one
			if (environments.length > 0 && context.activeEnvironment === undefined) {
				context.activeEnvironment = environments[0]
			}
		},
	}
}
