import type { ParameterType, SlingParameters } from "./parameters.js";

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

/**
 * Valid interpolation values inside a sling tagged template.
 *
 * - `string | number` — inlined as-is
 * - `MaskedValue` — inlined but masked in output
 * - `() => string | Promise<string>` — resolved lazily at execution time (for chaining)
 */
export type SlingInterpolation =
  | string
  | number
  | MaskedValue
  | (() => string | Promise<string>);

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
 * Options for executing a sling request.
 */
export interface ExecuteOptions {
  /** Override the active environment. */
  environment?: string;
  /** If true, log full details including secrets. **Never use in production.** */
  verbose?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** If true, mask secret/sensitive values in the returned response metadata. */
  maskOutput?: boolean;
}

/**
 * The response from executing a sling request.
 */
export interface SlingResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  /** Parse the body as JSON. */
  json: <T = unknown>() => T;
  /** The raw fetch Response, if available. */
  readonly raw: Response;
  /** Total duration in milliseconds. */
  readonly duration: number;
}

/**
 * A sling request definition. Returned by the tagged template.
 *
 * This object contains everything the CLI and editor extensions need
 * to display, execute, and debug the request.
 */
export interface SlingDefinition {
  /** Brand field for runtime identification. */
  readonly __sling: true;
  /** The original template parts, for re-rendering with masking. */
  readonly template: {
    readonly strings: ReadonlyArray<string>;
    readonly values: ReadonlyArray<SlingInterpolation>;
  };
  /** Parsed HTTP request (with unresolved interpolations as placeholders). */
  readonly parsed: ParsedHttpRequest;
  /** Collected masked values from this definition. */
  readonly maskedValues: ReadonlyArray<MaskedValue>;
  /** Execute the request, resolving all lazy interpolations. */
  execute: (options?: ExecuteOptions) => Promise<SlingResponse>;
  /**
   * Lazy, cached response. Accessing this triggers execution.
   * Useful for chaining requests.
   */
  readonly response: Promise<SlingResponse>;
  /** Name of the export (set by the CLI/extension after module loading). */
  name?: string;
  /** Source file path (set by the CLI/extension after module loading). */
  sourcePath?: string;
}

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
  readonly parameters: SlingParameters
}