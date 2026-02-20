/**
 * Read-only parameter bag returned by a configured sling instance.
 *
 * Parameters are populated by plugins (e.g. `useDotEnv`, `useConfig`)
 * and can be accessed either via `get`/`getRequired` or by indexing
 * the object directly (e.g. `sling.parameters.TOKEN`).
 *
 * **Note:** The generic `T` on `get`/`getRequired` is a convenience
 * cast — it does not perform runtime validation. The returned value
 * is whatever the plugin stored (string, number, or boolean).
 */
export type SlingParameters = Record<string, unknown> & {
	get<T extends ParameterType = string>(key: string): T | undefined
	getRequired<T extends ParameterType = string>(key: string): T
}

export type ParameterType = string | number | boolean

export type SlingParameterDictionary = SlingParameters & {
	set(key: string, value: ParameterType): void
}

/**
 * Create a `SlingParameterDictionary` backed by an optional initial
 * set of key/value pairs.
 *
 * The returned object exposes:
 * - **`get(key)`** — returns the value or `undefined`
 * - **`getRequired(key)`** — returns the value or throws
 * - **`set(key, value)`** — stores a value (used by plugins)
 * - **index access** — initial values are available as own properties
 *
 * **Note:** The generic `T` on `get`/`getRequired` is purely a
 * convenience cast for the call-site — no runtime conversion is
 * performed.
 */
export function createSlingParameters(initial?: Record<string, ParameterType | undefined>): SlingParameterDictionary {
	const parameters: Record<string, ParameterType | undefined> = initial ?? {}

	function set(key: string, value: ParameterType) {
		parameters[key] = value
	}

	function get<T>(key: string) {
		const value = parameters[key]
		if (value === undefined) return

		return value as T
	}

	function getRequired<T>(key: string) {
		const value = get<T>(key)
		if (value === undefined) throw new Error(`Required parameter '${key}' was not loaded.`)
		return value
	}

	return Object.assign({}, parameters, { get, getRequired, set })
}
