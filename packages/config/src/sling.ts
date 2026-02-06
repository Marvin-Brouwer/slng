import {
  type ConfiguredSling,
  type SlingContext,
  type SlingPlugin,
  type SlingInterpolation,
} from "./types.js";
import { createDefinition } from "./definition.js";
import { createSlingParameters } from "./parameters.js";

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
 * import sling, { useDotEnv } from '@slng/config'
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
  let setupPromise: Promise<void> | undefined;

  const context: SlingContext = {
    envSets: new Map(),
    environments: [],
    activeEnvironment: undefined
  };

  const results = plugins.map((p) => p.setup(context));
  const hasAsync = results.some(
    (r) => r !== undefined && typeof (r as Promise<void>).then === "function",
  );
  if (hasAsync) {
    setupPromise = Promise.all(
      results.filter(Boolean) as Promise<void>[],
    ).then(() => {});
  }

  const templateFn = function slingTemplate(
    strings: TemplateStringsArray,
    ...values: SlingInterpolation[]
  ) {
    return createDefinition(strings, values, context);
  } as ConfiguredSling;

  // Attach parameters
  Object.defineProperty(templateFn, "context", {
    value: context,
    writable: false,
    enumerable: true,
  });

  // Parameters are derived from the active environment via a getter so
  // they automatically reflect environment switches at any point in time.
  Object.defineProperty(templateFn, "parameters", {
    get() {
      if (!context.activeEnvironment || !context.envSets.has(context.activeEnvironment)) {
        return createSlingParameters();
      }
      return createSlingParameters(context.envSets.get(context.activeEnvironment));
    },
    enumerable: true,
  });

  // Attach setup promise for CLI/extension to await if needed
  Object.defineProperty(templateFn, "__setupPromise", {
    value: setupPromise,
    writable: false,
    enumerable: false,
  });

  return templateFn;
}
