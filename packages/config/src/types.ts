import { AstData } from './loader/file-loader.js'
import { namedMask, Masked, MaskedDataAccessor } from './masking/mask'
import { secret } from './masking/secret'
import { sensitive } from './masking/sensitive'

import type { ParameterType, SlingParameters } from './parameters.js'

// TODO, these types should be closer to their implementation.
// Errors and base types may have their own files in ./types/, at least a file per type.
// Specific types should live next to their implementation, for example:
// - ResponseJsonAccessor should live in definition.ts, etc.

// ── Error types ──────────────────────────────────────────────

/**
 * An HTTP-level error. Returned (not thrown) by {@link DataAccessor}
 * methods when the request fails or returns an unexpected status code.
 */
export class HttpError extends Error {
	readonly name = 'HttpError'
	constructor(
		readonly status: number,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options)
	}
}

/**
 * Returned (not thrown) by {@link DataAccessor.value} when the
 * requested JSON path does not exist in the response body.
 */
export class InvalidJsonPathError extends Error {
	readonly name = 'InvalidJsonPathError'
	constructor(readonly path: string) {
		super(`Path "${path}" not found in response body`)
	}
}

// ── Masked values ────────────────────────────────────────────

/**
 * A value that should be masked in logs and UI.
 */
export interface MaskedValue {
	readonly __masked: true
	readonly type: 'secret' | 'sensitive'
	/** The real value, used when executing the request. */
	readonly value: string
	/** The display value shown in logs / response viewer. */
	readonly displayValue: string
}

// ── Data accessor ────────────────────────────────────────────

/**
 * A data accessor for extracting values from a JSON response.
 *
 * Returned (inside a Promise) by {@link SlingDefinition.json}.
 * Methods return error types as values rather than throwing,
 * so callers can choose how to handle failures.
 *
 * @example
 * ```ts
 * const accessor = await session.json('token');
 *
 * // Strict — returns the value, or an error
 * const result = await accessor.value<string>();
 * if (result instanceof HttpError) { ... }
 *
 * // Safe — returns undefined for missing paths
 * const maybe = await accessor.tryValue<string>();
 *
 * // Boolean check
 * if (await accessor.validate()) { ... }
 * ```
 *
 * @internal
 */

export const dataAccessorSymbol = Symbol.for('dataAccessor')
// allow for the DataAccessor to pass the AbortSignal of the parent.
export type DataAccessor = {
	/**
   * Extract the value at the JSON path.
   * Returns the value on success, or an error type on failure.
   */
	value<T = string>(): Promise<T | HttpError | InvalidJsonPathError>
	/** Check if the extraction would succeed (valid status + path exists). */
	validate(): Promise<boolean>
	/**
   * Extract the value, returning `undefined` for missing paths.
   * HTTP errors are still returned as {@link HttpError}.
   */
	tryValue<T = string>(): Promise<T | HttpError | undefined>
}

export function isDataAccessor(value: unknown): value is DataAccessor {
	return !!value && typeof value === 'object' && Object.hasOwn(value, dataAccessorSymbol)
}
/**
 * Specific {@link DataAccessor} for `json(jsonPath)` queries. \
 * Returned by {@link SlingDefinition.json}.
 */
export type ResponseJsonAccessor = DataAccessor & {}

// ── Interpolation types ──────────────────────────────────────

/**
 * Primitive values that can be inlined directly into a template.
 */
export type PrimitiveValue = string | number | boolean

/**
 * Valid interpolation values inside a sling tagged template.
 *
 * - `PrimitiveValue` — inlined as-is (`string`, `number`, `boolean`)
 * - `MaskedValue` — inlined but masked in output
 * - `DataAccessor` — resolved lazily at execution time (for chaining)
 * - `MaskedDataAccessor` — resolved lazily at execution time (for chaining), but masked in output
 */
export type SlingInterpolation
	= | PrimitiveValue
	| Masked<PrimitiveValue>
	| DataAccessor
	| MaskedDataAccessor

// ── HTTP types ───────────────────────────────────────────────

/**
 * Parsed HTTP request components extracted from the template literal.
 */
export interface ParsedHttpRequest {
	readonly method: string
	readonly url: string
	readonly httpVersion: string
	readonly headers: Record<string, string>
	readonly body: string | undefined
}

/**
 * Internal data stored on a sling definition.
 * Access via {@link SlingDefinition.getInternals}.
 */
export type SlingInternals = {
	readonly version: 'v1'

	/** File AST information for cross referencing in editor-plugins, added when loading the file */
	readonly tsAst: AstData

	/** The original template parts, for re-rendering with masking. */
	readonly template: {
		readonly strings: ReadonlyArray<string>
		readonly values: ReadonlyArray<SlingInterpolation>
	}
	/** Parsed HTTP request (with unresolved interpolations as placeholders). */
	readonly parsed: ParsedHttpRequest
	/** Collected masked values from this definition. */
	readonly maskedValues: ReadonlyArray<Masked<unknown>>
}

// ── Options ──────────────────────────────────────────────────

/**
 * Options for controlling response caching.
 */
export interface CacheOptions {
	/**
   * How long to cache the response, in milliseconds.
   *
   * - `Infinity` (default) — cache for the lifetime of the process (session-scoped).
   * - `false` or `0` — disable caching; always make a fresh request.
   * - A positive number — cache for the specified duration in ms.
   */
	cacheTime?: number | false
	/**
   * Whether to read from the cache if a cached response is available.
   * Defaults to `true`.
   */
	readFromCache?: boolean
}

/**
 * Options for the `json()` helper.
 */
export type JsonOptions = CacheOptions & {
	/**
   * HTTP status codes to treat as valid.
   * Defaults to accepting any 2xx status code.
   */
	validResponseCodes?: number[]
}

/**
 * Options for executing a sling request.
 */
export interface ExecuteOptions extends CacheOptions {
	/** Override the active environment. */
	environment?: string
	/** If true, log full details including secrets. **Never use in production.** */
	verbose?: boolean
	/** AbortSignal for cancellation. */
	signal?: AbortSignal
	/** If true, mask secret/sensitive values in the returned response metadata. */
	maskOutput?: boolean
}

// ── Response & definition ────────────────────────────────────

/**
 * The response from executing a sling request.
 */
export interface SlingResponse {
	readonly status: number
	readonly statusText: string
	readonly headers: Record<string, string>
	readonly body: string
	/** The raw fetch Response, if available. */
	readonly raw: Response
	/** Total duration in milliseconds. */
	readonly duration: number

	readonly request: {
		/**
		 * The id of the request definition that initiated the request
		 * This is a unique value made up of the shape of the request in code, meaning the id changes if a user modifies the call.
		 * */
		readonly reference: string
		readonly parsed: ParsedHttpRequest
		readonly template: SlingInternals['template']
	}
}

/**
 * A sling request definition. Returned by the tagged template.
 */
export interface SlingDefinition {
	/**
	 * This is a unique value made up of the shape of the request in code, meaning the id changes if a user modifies the call.
	 * */
	id(): string
	/** Access the definition's internal data (parsed request, template parts, etc.). */
	getInternals(): SlingInternals
	/** Execute the request, resolving all lazy interpolations. */
	execute: (options?: ExecuteOptions) => Promise<SlingResponse>
	/**
   * Create a data accessor that extracts a value from the JSON response body
   * using a simple path expression.
   *
   * Returns a {@link ResponseJsonAccessor}.
   * The actual HTTP request, including resolving the json and path query, is
   * deferred until a method on the accessor is called.
   *
   * Can be used directly as a template interpolation value:
   * the template resolver calls the `.value()` to obtain a string for interpolation.
   *
   * Supports dot-notation and bracket indexing:
   * - `"user.name"` — access nested properties
   * - `"users[0].email"` — index into arrays
   * - `"data.items[2].tags[0]"` — mix freely
   *
   * Limitations:
   * - No wildcard or recursive descent (`..`, `*`).
   * - No filter expressions (`[?(@.price < 10)]`).
   * - No slice notation (`[0:5]`).
   *
   * @param jsonPath  A dot/bracket path into the response body.
   * @param options   Cache and validation options.
   *
   * @example
   * ```ts
   * // Use directly in template — no wrapper function needed
   * export const getUsers = sling`
   *   GET https://api.example.com/users
   *   Authorization: Bearer ${session.json('token')}
   * `
   *
   * // Or extract the value explicitly
   * const accessor = await session.json('token');
   * const token = await accessor.value<string>();
   * const maybe = await accessor.tryValue<number>();
   * ```
   */
	json(jsonPath: string, options?: JsonOptions): ResponseJsonAccessor
}

// ── Config & plugins ─────────────────────────────────────────

/**
 * The sling context, modified by plugins during setup.
 */
export interface SlingContext {
	/** All loaded environment variables, keyed by environment name. */
	readonly envSets: Map<string, Record<string, ParameterType | undefined>>
	/** Names of available environments. */
	readonly environments: string[]
	/** The currently active environment. */
	activeEnvironment: string | undefined
}

/**
 * A plugin that hooks into the sling configuration.
 */
export interface SlingPlugin {
	readonly name: string
	setup: (context: SlingContext) => void | Promise<void>
}

/**
 * A configured sling tagged template function.
 *
 * Use as: `http\`GET https://...\``
 */
export type SlingTemplateBuilder = (
	strings: TemplateStringsArray,
	...values: SlingInterpolation[]
) => SlingDefinition

/**
 * A configured sling tagged template function.
 *
 * Use as: `http\`GET https://...\``
 */
export type ConfiguredSling = SlingTemplateBuilder & {
	/** The resolved configuration context. */
	readonly context: SlingContext
	readonly parameters: SlingParameters

	namedMask: typeof namedMask
	secret: typeof secret
	sensitive: typeof sensitive
}
