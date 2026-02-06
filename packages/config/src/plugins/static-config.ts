import type { SlingPlugin } from "../types.js";
import type { ParameterType } from "../parameters.js";

// TODO add doc similar to the dotenv plugin
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