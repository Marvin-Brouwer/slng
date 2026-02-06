import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import type { SlingPlugin } from "../types.js";

/**
 * Load `.env` files into the sling context as named environments.
 *
 * Always loads `.env` as the base. Each environment name maps to
 * `.env.<name>` (e.g. `useDotEnv('local', 'staging')` loads
 * `.env`, `.env.local`, and `.env.staging`).
 *
 * The first listed environment is set as the active one by default.
 *
 * @param environments  One or more environment names to load.
 *
 * @example
 * ```ts
 * import sling, { useDotEnv } from '@slng/config'
 *
 * export default sling(
 *   useDotEnv('local', 'staging'),
 * )
 * ```
 */
export function useDotEnv(...environments: string[]): SlingPlugin {
  return {
    name: "dotenv",
    setup(context) {
      const cwd = process.cwd();

      // Always load base .env
      const baseEnv = loadEnvFile(resolve(cwd, ".env"));

      for (const env of environments) {
        const currentEnv = context.envSets.get(env) 

        const envFile = resolve(cwd, `.env.${env}`);
        const envVars = loadEnvFile(envFile);
        // Convert numbers and bools on read
        const concreteEnvVars = Object.fromEntries(Object.entries(envVars)
          .map(([key, value]) => [key, JSON.stringify(value)])
        )


        // Merge: base .env values are overridden by .env.<name>
        const merged = { ...currentEnv, ...baseEnv, ...concreteEnvVars };
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

function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = readFileSync(filePath, "utf-8");
  return parse(content);
}