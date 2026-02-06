import type { ParsedHttpRequest, SlingInterpolation, MaskedValue } from "./types.js";

const REQUEST_LINE_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+(\S+)(?:\s+(HTTP\/[\d.]+))?$/;

/**
 * Resolve a single interpolation value to a string.
 * Async functions are awaited; MaskedValues use their real value.
 */
export async function resolveInterpolation(
  value: SlingInterpolation,
): Promise<string> {
  if (typeof value === "function") {
    return String(await value());
  }
  if (typeof value === "object" && value !== null && "__masked" in value) {
    return (value as MaskedValue).value;
  }
  return String(value);
}

/**
 * Resolve a single interpolation to its display string (masked).
 */
export function resolveInterpolationDisplay(
  value: SlingInterpolation,
): string {
  if (typeof value === "object" && value !== null && "__masked" in value) {
    return (value as MaskedValue).displayValue;
  }
  if (typeof value === "function") {
    return "<deferred>";
  }
  return String(value);
}

/**
 * Assemble the full raw HTTP text from template strings and resolved values.
 */
export function assembleTemplate(
  strings: ReadonlyArray<string>,
  resolvedValues: string[],
): string {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < resolvedValues.length) {
      result += resolvedValues[i];
    }
  }
  return result;
}

/**
 * Parse raw HTTP text into structured components.
 *
 * Expected format:
 * ```
 * METHOD URL [HTTP/VERSION]
 *
 * Header: Value
 * Header: Value
 *
 * body
 * ```
 *
 * The blank line separates headers from body.
 */
export function parseHttpText(raw: string): ParsedHttpRequest {
  const trimmed = raw.trim();
  const lines = trimmed.split(/\r?\n/);

  // First non-empty line is the request line
  let requestLineIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0) {
      requestLineIndex = i;
      break;
    }
  }

  if (requestLineIndex === -1) {
    throw new SlingParseError("Empty request template");
  }

  const requestLine = lines[requestLineIndex]!.trim();
  const match = REQUEST_LINE_RE.exec(requestLine);
  if (!match) {
    throw new SlingParseError(
      `Invalid request line: "${requestLine}". Expected: METHOD URL [HTTP/VERSION]`,
    );
  }

  const method = match[1]!;
  const url = match[2]!;
  const httpVersion = match[3] ?? "HTTP/1.1";

  // Parse headers and body
  const headers: Record<string, string> = {};
  let bodyStartIndex = -1;
  let foundBlankLine = false;

  for (let i = requestLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;

    if (!foundBlankLine) {
      if (line.trim() === "") {
        // Could be the separator between headers and body,
        // or just a blank line after the request line before headers.
        // Peek ahead to see if more headers follow.
        const remaining = lines.slice(i + 1);
        const nextNonEmpty = remaining.find((l) => l.trim().length > 0);
        if (nextNonEmpty && /^[\w-]+\s*:/.test(nextNonEmpty)) {
          // More headers coming, skip this blank line
          continue;
        }
        foundBlankLine = true;
        bodyStartIndex = i + 1;
        continue;
      }

      const headerMatch = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
      if (headerMatch) {
        headers[headerMatch[1]!] = headerMatch[2]!.trim();
      }
    }
  }

  let body: string | undefined;
  if (bodyStartIndex >= 0 && bodyStartIndex < lines.length) {
    const bodyText = lines.slice(bodyStartIndex).join("\n").trim();
    body = bodyText.length > 0 ? bodyText : undefined;
  }

  return { method, url, httpVersion, headers, body };
}

/**
 * Parse the template at definition time using display values (for preview).
 * Async/function interpolations show as `<deferred>`.
 */
export function parseTemplatePreview(
  strings: ReadonlyArray<string>,
  values: ReadonlyArray<SlingInterpolation>,
): ParsedHttpRequest {
  const displayValues = values.map(resolveInterpolationDisplay);
  const raw = assembleTemplate(strings, displayValues);
  return parseHttpText(raw);
}

/**
 * Fully resolve the template and parse it. Awaits all async interpolations.
 */
export async function parseTemplateResolved(
  strings: ReadonlyArray<string>,
  values: ReadonlyArray<SlingInterpolation>,
): Promise<ParsedHttpRequest> {
  const resolvedValues = await Promise.all(values.map(resolveInterpolation));
  const raw = assembleTemplate(strings, resolvedValues);
  return parseHttpText(raw);
}

export class SlingParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlingParseError";
  }
}
