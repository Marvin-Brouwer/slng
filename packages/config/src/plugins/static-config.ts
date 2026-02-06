import type { SlingPlugin } from "../types.js";
import type { ParameterType } from "../parameters.js";

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
    name: "static-config",
    setup(context) {
      const environments = Object.keys(environmentConfigs)

      for (const env in environmentConfigs) {
        const currentEnv = context.envSets.get(env) 

        const envVars = environmentConfigs[env] ?? {}

        // Merge
        const merged = { ...currentEnv, ...envVars };
        context.envSets.set(env, merged);
        context.environments.push(env);
      }

      // First environment is the default active one
      if (environments.length > 0 && context.activeEnvironment === undefined) {
        context.activeEnvironment = environments[0];
      }
    },
  };
}