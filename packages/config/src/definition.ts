import {
  sling,
  type Accessor,
  type SlingDefinition,
  type SlingInternals,
  type SlingInterpolation,
  type SlingResponse,
  type SlingContext,
  type MaskedValue,
  type ExecuteOptions,
  type JsonOptions,
  type ParsedHttpRequest,
} from "./types.js";
import {
  parseTemplatePreview,
  parseTemplateResolved,
  assembleTemplate,
  resolveInterpolationDisplay,
} from "./parser.js";

interface CachedResponse {
  response: SlingResponse;
  timestamp: number;
}

/**
 * Create a SlingDefinition from a tagged template invocation.
 */
export function createDefinition(
  strings: TemplateStringsArray,
  values: SlingInterpolation[],
  _context: SlingContext,
): SlingDefinition {
  // Collect masked values
  const maskedValues: MaskedValue[] = values.filter(
    (v): v is MaskedValue =>
      typeof v === "object" && v !== null && "__masked" in v,
  );

  // Parse a preview (with deferred values as placeholders)
  const parsed = parseTemplatePreview(strings, values);

  // Response cache (shared across execute/json calls)
  let cached: CachedResponse | undefined;

  const internals: SlingInternals = {
    version: "v1",
    name: undefined,
    sourcePath: undefined,
    template: { strings: [...strings], values },
    parsed,
    maskedValues,
  };

  const definition: SlingDefinition = {
    [sling]: internals,

    async execute(options?: ExecuteOptions): Promise<SlingResponse> {
      const readFromCache = options?.readFromCache !== false;
      const cacheTime = options?.cacheTime;
      const cachingDisabled = cacheTime === false || cacheTime === 0;

      // Check cache
      if (readFromCache && cached && !cachingDisabled) {
        const effectiveCacheTime = cacheTime ?? Infinity;
        const age = Date.now() - cached.timestamp;
        if (effectiveCacheTime === Infinity || age < effectiveCacheTime) {
          return cached.response;
        }
      }

      const response = await executeRequest(strings, values, options);

      // Store in cache (unless caching is explicitly disabled)
      if (!cachingDisabled) {
        cached = { response, timestamp: Date.now() };
      }

      return response;
    },

    json(jsonPath: string, options?: JsonOptions): Accessor {
      return createAccessor(this, jsonPath, options);
    },
  };

  return definition;
}

/**
 * Resolve a value from a parsed JSON object using a simple path expression.
 *
 * Supports dot-notation (`user.name`) and bracket indexing (`users[0]`).
 * Returns `undefined` when the path cannot be fully traversed.
 */
function resolveJsonPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  // Parse "data.users[0].name" → ["data", "users", "0", "name"]
  const segments = path
    .split(".")
    .flatMap((part) => {
      if (!part.includes("[")) return [part];
      // "users[0]" → ["users", "0"]
      return part.split("[").map((s) => s.replace("]", ""));
    })
    .filter(Boolean);

  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

/**
 * Create a callable Accessor for a JSON path on a definition.
 *
 * The returned function satisfies `() => Promise<string>` so it
 * can be used directly as a `SlingInterpolation` value in templates.
 * It also exposes `.get()`, `.tryGet()`, and `.validate()` for
 * explicit value extraction.
 */
function createAccessor(
  definition: SlingDefinition,
  jsonPath: string,
  options?: JsonOptions,
): Accessor {
  const validCodes = options?.validResponseCodes;

  /** Shared extraction logic: execute, validate status, parse, traverse. */
  async function extract(): Promise<{ value: unknown; found: boolean }> {
    const response = await definition.execute(options);

    // Validate response status
    if (validCodes && validCodes.length > 0) {
      if (!validCodes.includes(response.status)) {
        throw new Error(
          `Request failed with status ${response.status} ${response.statusText}. ` +
            `Expected one of: ${validCodes.join(", ")}`,
        );
      }
    } else if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Request failed with status ${response.status} ${response.statusText}`,
      );
    }

    const body = JSON.parse(response.body);
    const value = resolveJsonPath(body, jsonPath);
    return { value, found: value !== undefined };
  }

  // The callable itself — resolves to string for template interpolation
  const fn = async (): Promise<string> => {
    const { value } = await extract();
    return stringifyForInterpolation(value);
  };

  fn.get = async <T = unknown>(): Promise<T> => {
    const { value, found } = await extract();
    if (!found) {
      throw new Error(`Path "${jsonPath}" not found in response body`);
    }
    return value as T;
  };

  fn.validate = async (): Promise<boolean> => {
    try {
      const { found } = await extract();
      return found;
    } catch {
      return false;
    }
  };

  fn.tryGet = async <T = unknown>(): Promise<T | undefined> => {
    try {
      const { value, found } = await extract();
      return found ? (value as T) : undefined;
    } catch {
      return undefined;
    }
  };

  return fn as Accessor;
}

/** Convert an extracted JSON value to a string for template interpolation. */
function stringifyForInterpolation(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Execute the HTTP request defined by a sling template.
 */
async function executeRequest(
  strings: ReadonlyArray<string>,
  values: ReadonlyArray<SlingInterpolation>,
  options?: ExecuteOptions,
): Promise<SlingResponse> {
  const startTime = performance.now();

  // Resolve all interpolations (including async functions for chaining)
  const resolved = await parseTemplateResolved(strings, values);

  const fetchResponse = await performFetch(resolved, options);

  const duration = performance.now() - startTime;
  const responseBody = await fetchResponse.text();

  // Convert headers
  const responseHeaders: Record<string, string> = {};
  fetchResponse.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const slingResponse: SlingResponse = {
    status: fetchResponse.status,
    statusText: fetchResponse.statusText,
    headers: responseHeaders,
    body: responseBody,
    raw: fetchResponse,
    duration,
  };

  if (options?.verbose) {
    logRequest(strings, values, resolved, slingResponse, options.maskOutput);
  }

  return slingResponse;
}

async function performFetch(
  parsed: ParsedHttpRequest,
  options?: ExecuteOptions,
): Promise<Response> {
  const init: RequestInit = {
    method: parsed.method,
    headers: parsed.headers,
    signal: options?.signal,
  };

  // Only attach body for methods that support it
  if (parsed.body && !["GET", "HEAD"].includes(parsed.method)) {
    init.body = parsed.body;
  }

  return fetch(parsed.url, init);
}

function logRequest(
  strings: ReadonlyArray<string>,
  values: ReadonlyArray<SlingInterpolation>,
  parsed: ParsedHttpRequest,
  response: SlingResponse,
  mask?: boolean,
): void {
  // When mask is true, show display values (with secrets masked).
  // When mask is false, show the resolved (real) values.
  const displayValues = mask !== false
    ? values.map(resolveInterpolationDisplay)
    : values.map((v) => String(v));

  const displayText = assembleTemplate(strings, displayValues);

  console.warn("\u2500".repeat(60));
  console.warn(`\u2192 ${parsed.method} ${parsed.url}`);
  console.warn(displayText.trim());
  console.warn(`\u2190 ${response.status} ${response.statusText} (${Math.round(response.duration)}ms)`);
  console.warn("\u2500".repeat(60));
}

/**
 * Check if an unknown value is a SlingDefinition.
 */
export function isSlingDefinition(value: unknown): value is SlingDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    sling in value &&
    (value as SlingDefinition)[sling].version === "v1"
  );
}
