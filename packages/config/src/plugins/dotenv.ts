import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse } from 'dotenv'

import type { ParameterType } from '../parameters.js'
import type { SlingPlugin } from '../types.js'

export interface DotEnvironmentOptions {
	/** Directory to resolve `.env` files from. Defaults to `process.cwd()`. */
	dir?: string
	/** One or more environment names to load. */
	environments: string[]
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
export function useDotEnv(...arguments_: string[]): SlingPlugin
export function useDotEnv(options: DotEnvironmentOptions): SlingPlugin
export function useDotEnv(...arguments_: [DotEnvironmentOptions] | string[]): SlingPlugin {
	let dir: string
	let environments: string[]

	if (arguments_.length === 1 && typeof arguments_[0] === 'object') {
		const options = arguments_[0]
		dir = options.dir ?? process.cwd()
		environments = options.environments
	}
	else {
		dir = process.cwd()
		environments = arguments_ as string[]
	}

	return {
		name: 'dotenv',
		setup(context) {
			// Always load base .env (with type conversion)
			const rawBaseEnvironment = loadEnvironmentFile(resolve(dir, '.env'))
			const baseEnvironment = Object.fromEntries(
				Object.entries(rawBaseEnvironment).map(([key, value]) => [key, parseEnvironmentValue(value)]),
			)

			for (const environment of environments) {
				const currentEnvironment = context.envSets.get(environment)

				const environmentFile = resolve(dir, `.env.${environment}`)
				const environmentVariables = loadEnvironmentFile(environmentFile)
				// Convert numbers and bools from their string representation
				const concreteEnvironmentVariables = Object.fromEntries(Object.entries(environmentVariables)
					.map(([key, value]) => [key, parseEnvironmentValue(value)]),
				)

				// Merge: base .env values are overridden by .env.<name>
				const merged = { ...currentEnvironment, ...baseEnvironment, ...concreteEnvironmentVariables }
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

function loadEnvironmentFile(filePath: string): Record<string, string> {
	if (!existsSync(filePath)) {
		return {}
	}
	const content = readFileSync(filePath, 'utf-8')
	return parse(content)
}

/**
 * Parse a string value from a .env file into its concrete type.
 * `"true"` / `"false"` become booleans, numeric strings become numbers,
 * everything else stays as a string.
 */
function parseEnvironmentValue(value: string): ParameterType {
	if (value === 'true') return true
	if (value === 'false') return false
	const number_ = Number(value)
	if (value.trim() !== '' && !Number.isNaN(number_)) return number_
	return value
}
