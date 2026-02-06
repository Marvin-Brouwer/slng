import type {
  SlingDefinition,
  SlingInterpolation,
  SlingResponse,
  SlingContext,
  MaskedValue,
  ExecuteOptions,
  ParsedHttpRequest,
} from "./types.js";
import {
  parseTemplatePreview,
  parseTemplateResolved,
  assembleTemplate,
  resolveInterpolationDisplay,
} from "./parser.js";

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

  // Lazy response (cached)
  let cachedResponse: Promise<SlingResponse> | undefined;

  const definition: SlingDefinition = {
    __sling: true,
    template: { strings: [...strings], values },
    parsed,
    maskedValues,
    name: undefined,
    sourcePath: undefined,

    async execute(options?: ExecuteOptions): Promise<SlingResponse> {
      return executeRequest(strings, values, options);
    },

    get response(): Promise<SlingResponse> {
      if (!cachedResponse) {
        cachedResponse = this.execute();
      }
      return cachedResponse;
    },
  };

  return definition;
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
    json: <T = unknown>(): T => JSON.parse(responseBody) as T,
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

  console.warn("─".repeat(60));
  console.warn(`→ ${parsed.method} ${parsed.url}`);
  console.warn(displayText.trim());
  console.warn(`← ${response.status} ${response.statusText} (${Math.round(response.duration)}ms)`);
  console.warn("─".repeat(60));
}

/**
 * Check if an unknown value is a SlingDefinition.
 */
export function isSlingDefinition(value: unknown): value is SlingDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "__sling" in value &&
    (value as SlingDefinition).__sling === true
  );
}
