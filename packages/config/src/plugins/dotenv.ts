import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import type { SlingPlugin } from "../types.js";
import type { ParameterType } from "../parameters.js";

export interface DotEnvOptions {
  /** Directory to resolve `.env` files from. Defaults to `process.cwd()`. */
  dir?: string;
  /** One or more environment names to load. */
  environments: string[];
}

/**
 * Load `.env` files into the sling context as named environments.
 *
 * Always loads `.env` as the base. Each environment name maps to
 * `.env.<name>` (e.g. `useDotEnv('local', 'staging')` loads
 * `.env`, `.env.local`, and `.env.staging`).
 *
 * The first listed environment is set as the active one by default.
 *
 * @param args  Either environment name strings, or a single options object
 *              with `dir` (defaults to `process.cwd()`) and `environments`.
 *
 * @example
 * ```ts
 * import sling, { useDotEnv } from '@slng/config'
 *
 * // Simple — resolve .env files from process.cwd()
 * export default sling(
 *   useDotEnv('local', 'staging'),
 * )
 * ```
 *
 * @example
 * ```ts
 * // With explicit directory (e.g. relative to the config file)
 * export default sling(
 *   useDotEnv({ dir: import.meta.dirname, environments: ['local', 'staging'] }),
 * )
 * ```
 */
export function useDotEnv(...args: string[]): SlingPlugin;
export function useDotEnv(options: DotEnvOptions): SlingPlugin;
export function useDotEnv(...args: [DotEnvOptions] | string[]): SlingPlugin {
  let dir: string;
  let environments: string[];

  if (args.length === 1 && typeof args[0] === "object") {
    const options = args[0] as DotEnvOptions;
    dir = options.dir ?? process.cwd();
    environments = options.environments;
  } else {
    dir = process.cwd();
    environments = args as string[];
  }

  return {
    name: "dotenv",
    setup(context) {
      // Always load base .env (with type conversion)
      const rawBaseEnv = loadEnvFile(resolve(dir, ".env"));
      const baseEnv = Object.fromEntries(
        Object.entries(rawBaseEnv).map(([key, value]) => [key, parseEnvValue(value)])
      );

      for (const env of environments) {
        const currentEnv = context.envSets.get(env);

        const envFile = resolve(dir, `.env.${env}`);
        const envVars = loadEnvFile(envFile);
        // Convert numbers and bools from their string representation
        const concreteEnvVars = Object.fromEntries(Object.entries(envVars)
          .map(([key, value]) => [key, parseEnvValue(value)])
        );

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

/**
 * Parse a string value from a .env file into its concrete type.
 * `"true"` / `"false"` become booleans, numeric strings become numbers,
 * everything else stays as a string.
 */
function parseEnvValue(value: string): ParameterType {
  if (value === "true") return true;
  if (value === "false") return false;
  const num = Number(value);
  if (value.trim() !== "" && !Number.isNaN(num)) return num;
  return value;
}
