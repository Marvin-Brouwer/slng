import {
  sling,
  HttpError,
  InvalidJsonPathError,
  type DataAccessor,
  type ResponseJsonAccessor,
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

    json(jsonPath: string, options?: JsonOptions): ResponseJsonAccessor {
      return Promise.resolve(createDataAccessor(this, jsonPath, options));
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
 * Create a {@link DataAccessor} for a JSON path on a definition.
 *
 * The accessor's methods lazily trigger the HTTP request via
 * `definition.execute()` and extract the value at the given path.
 * Errors are returned as values ({@link HttpError}, {@link InvalidJsonPathError})
 * rather than thrown.
 */
function createDataAccessor(
  definition: SlingDefinition,
  jsonPath: string,
  options?: JsonOptions,
): DataAccessor {
  const validCodes = options?.validResponseCodes;

  /** Shared extraction logic: execute, validate status, parse, traverse. */
  async function extract(): Promise<
    { value: unknown; found: boolean } | HttpError
  > {
    let response: SlingResponse;
    try {
      response = await definition.execute(options);
    } catch (err) {
      return new HttpError(
        0,
        "Request failed",
        err instanceof Error ? { cause: err } : undefined,
      );
    }

    // Validate response status
    if (validCodes && validCodes.length > 0) {
      if (!validCodes.includes(response.status)) {
        return new HttpError(
          response.status,
          `Request failed with status ${response.status} ${response.statusText}. ` +
            `Expected one of: ${validCodes.join(", ")}`,
        );
      }
    } else if (response.status < 200 || response.status >= 300) {
      return new HttpError(
        response.status,
        `Request failed with status ${response.status} ${response.statusText}`,
      );
    }

    try {
      const body = JSON.parse(response.body);
      const value = resolveJsonPath(body, jsonPath);
      return { value, found: value !== undefined };
    } catch {
      return new HttpError(
        response.status,
        "Response body is not valid JSON",
      );
    }
  }

  return {
    async value<T = string>(): Promise<T | HttpError | InvalidJsonPathError> {
      const result = await extract();
      if (result instanceof HttpError) return result;
      if (!result.found) return new InvalidJsonPathError(jsonPath);
      return result.value as T;
    },

    async validate(): Promise<boolean> {
      const result = await extract();
      if (result instanceof HttpError) return false;
      return result.found;
    },

    async tryValue<T = string>(): Promise<T | HttpError | undefined> {
      const result = await extract();
      if (result instanceof HttpError) return result;
      return result.found ? (result.value as T) : undefined;
    },
  };
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

  // Resolve all interpolations (including async accessors for chaining)
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
