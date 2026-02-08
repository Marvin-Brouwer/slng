import type { ParameterType, SlingParameters } from "./parameters.js";

/**
 * Symbol used to brand sling definitions.
 *
 * Internals are stored behind this Symbol so they stay invisible
 * in IDE auto-complete / IntelliSense.
 *
 * @example
 * ```ts
 * import { sling } from '@slng/config'
 *
 * const internals = definition[sling]
 * console.log(internals.parsed.method) // "GET"
 * ```
 */
export const sling = Symbol.for("sling");

// ── Error types ──────────────────────────────────────────────

/**
 * An HTTP-level error. Returned (not thrown) by {@link DataAccessor}
 * methods when the request fails or returns an unexpected status code.
 */
export class HttpError extends Error {
  readonly name = "HttpError";
  constructor(
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * Returned (not thrown) by {@link DataAccessor.value} when the
 * requested JSON path does not exist in the response body.
 */
export class InvalidJsonPathError extends Error {
  readonly name = "InvalidJsonPathError";
  constructor(readonly path: string) {
    super(`Path "${path}" not found in response body`);
  }
}

// ── Masked values ────────────────────────────────────────────

/**
 * A value that should be masked in logs and UI.
 */
export interface MaskedValue {
  readonly __masked: true;
  readonly type: "secret" | "sensitive";
  /** The real value, used when executing the request. */
  readonly value: string;
  /** The display value shown in logs / response viewer. */
  readonly displayValue: string;
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
 */
export interface DataAccessor {
  /**
   * Extract the value at the JSON path.
   * Returns the value on success, or an error type on failure.
   */
  value<T = string>(): Promise<T | HttpError | InvalidJsonPathError>;
  /** Check if the extraction would succeed (valid status + path exists). */
  validate(): Promise<boolean>;
  /**
   * Extract the value, returning `undefined` for missing paths.
   * HTTP errors are still returned as {@link HttpError}.
   */
  tryValue<T = string>(): Promise<T | HttpError | undefined>;
}

/**
 * A promised {@link DataAccessor}. The promise resolves immediately
 * to a DataAccessor whose methods lazily trigger the HTTP request.
 *
 * Can be used directly as a sling template interpolation value —
 * the template resolver awaits the promise, then calls `.value()`.
 */
export type ResponseDataAccessor = Promise<DataAccessor>;

/**
 * Alias for {@link ResponseDataAccessor}.
 * Returned by {@link SlingDefinition.json}.
 */
export type ResponseJsonAccessor = ResponseDataAccessor;

// ── Interpolation types ──────────────────────────────────────

/**
 * Primitive values that can be inlined directly into a template.
 */
export type PrimitiveValue = string | number | boolean;

/**
 * Valid interpolation values inside a sling tagged template.
 *
 * - `PrimitiveValue` — inlined as-is (`string`, `number`, `boolean`)
 * - `MaskedValue` — inlined but masked in output
 * - `ResponseDataAccessor` — resolved lazily at execution time (for chaining)
 */
export type SlingInterpolation =
  | PrimitiveValue
  | MaskedValue
  | ResponseDataAccessor;

// ── HTTP types ───────────────────────────────────────────────

/**
 * Parsed HTTP request components extracted from the template literal.
 */
export interface ParsedHttpRequest {
  readonly method: string;
  readonly url: string;
  readonly httpVersion: string;
  readonly headers: Record<string, string>;
  readonly body: string | undefined;
}

/**
 * Internal data stored on a sling definition, hidden behind `[sling]`.
 */
export type SlingInternals = {
  readonly version: "v1";
  /** Name of the export (set by the CLI/extension after module loading). */
  name?: string;
  /** Source file path (set by the CLI/extension after module loading). */
  sourcePath?: string;
  /** The original template parts, for re-rendering with masking. */
  readonly template: {
    readonly strings: ReadonlyArray<string>;
    readonly values: ReadonlyArray<SlingInterpolation>;
  };
  /** Parsed HTTP request (with unresolved interpolations as placeholders). */
  readonly parsed: ParsedHttpRequest;
  /** Collected masked values from this definition. */
  readonly maskedValues: ReadonlyArray<MaskedValue>;
};

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
  cacheTime?: number | false;
  /**
   * Whether to read from the cache if a cached response is available.
   * Defaults to `true`.
   */
  readFromCache?: boolean;
}

/**
 * Options for the `json()` helper.
 */
export type JsonOptions = CacheOptions & {
  /**
   * HTTP status codes to treat as valid.
   * Defaults to accepting any 2xx status code.
   */
  validResponseCodes?: number[];
};

/**
 * Options for executing a sling request.
 */
export interface ExecuteOptions extends CacheOptions {
  /** Override the active environment. */
  environment?: string;
  /** If true, log full details including secrets. **Never use in production.** */
  verbose?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** If true, mask secret/sensitive values in the returned response metadata. */
  maskOutput?: boolean;
}

// ── Response & definition ────────────────────────────────────

/**
 * The response from executing a sling request.
 */
export interface SlingResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  /** The raw fetch Response, if available. */
  readonly raw: Response;
  /** Total duration in milliseconds. */
  readonly duration: number;
}

/**
 * A sling request definition. Returned by the tagged template.
 *
 * Internals (template, parsed request, masked values) are stored behind
 * the `[sling]` Symbol to keep them out of IDE auto-complete.
 * Use `definition[sling]` to access them when needed.
 */
export interface SlingDefinition {
  /** Symbol-branded internals. */
  readonly [sling]: SlingInternals;
  /** Execute the request, resolving all lazy interpolations. */
  execute: (options?: ExecuteOptions) => Promise<SlingResponse>;
  /**
   * Create a data accessor that extracts a value from the JSON response body
   * using a simple path expression.
   *
   * Returns a `Promise<DataAccessor>` ({@link ResponseJsonAccessor}).
   * The promise resolves immediately — the actual HTTP request is
   * deferred until a method on the accessor is called.
   *
   * Can be used directly as a template interpolation value:
   * the template resolver awaits the promise, then calls `.value()`
   * to obtain a string for interpolation.
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
  json(jsonPath: string, options?: JsonOptions): ResponseJsonAccessor;
}

// ── Config & plugins ─────────────────────────────────────────

/**
 * The sling context, modified by plugins during setup.
 */
export interface SlingContext {
  /** All loaded environment variables, keyed by environment name. */
  readonly envSets: Map<string, Record<string, ParameterType | undefined>>;
  /** Names of available environments. */
  readonly environments: string[];
  /** The currently active environment. */
  activeEnvironment: string | undefined;
}

/**
 * A plugin that hooks into the sling configuration.
 */
export interface SlingPlugin {
  readonly name: string;
  setup: (context: SlingContext) => void | Promise<void>;
}

/**
 * A configured sling tagged template function.
 *
 * Use as: `sling\`GET https://...\``
 *
 * Also carries the resolved context for CLI/extension use.
 */
export interface ConfiguredSling {
  (
    strings: TemplateStringsArray,
    ...values: SlingInterpolation[]
  ): SlingDefinition;
  /** The resolved configuration context. */
  readonly context: SlingContext;
  readonly parameters: SlingParameters;
}
