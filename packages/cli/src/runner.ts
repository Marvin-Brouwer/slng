import { slingBrand, type SlingResponse, type ExecuteOptions } from "@slng/config";
import type { LoadedDefinition } from "./loader.js";

interface RunOptions {
  name?: string;
  verbose: boolean;
  mask: boolean;
  environment?: string;
}

interface RunResult {
  name: string;
  sourcePath: string;
  response?: SlingResponse;
  error?: Error;
}

/**
 * Run loaded definitions and print results to stdout.
 */
export async function runDefinitions(
  definitions: LoadedDefinition[],
  options: RunOptions,
): Promise<RunResult[]> {
  let toRun = definitions;

  // Filter by name if specified
  if (options.name) {
    toRun = definitions.filter((d) => d.name === options.name);
    if (toRun.length === 0) {
      const available = definitions.map((d) => d.name).join(", ");
      console.error(
        `No definition found with name "${options.name}". Available: ${available || "(none)"}`,
      );
      process.exitCode = 1;
      return [];
    }
  }

  if (toRun.length === 0) {
    console.error("No sling definitions found.");
    process.exitCode = 1;
    return [];
  }

  const results: RunResult[] = [];

  for (const { name, definition, sourcePath } of toRun) {
    const internals = definition[slingBrand];
    printHeader(name, internals.parsed.method, internals.parsed.url, sourcePath);

    const executeOptions: ExecuteOptions = {
      verbose: options.verbose,
      maskOutput: options.mask,
      environment: options.environment,
    };

    try {
      const response = await definition.execute(executeOptions);
      printResponse(name, response, options.verbose);
      results.push({ name, sourcePath, response });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      printError(name, error);
      results.push({ name, sourcePath, error });
    }
  }

  printSummary(results);
  return results;
}

function printHeader(
  name: string,
  method: string,
  url: string,
  sourcePath: string,
): void {
  console.warn("");
  console.warn(`${"─".repeat(60)}`);
  console.warn(`▶ ${name}`);
  console.warn(`  ${method} ${url}`);
  console.warn(`  ${sourcePath}`);
  console.warn(`${"─".repeat(60)}`);
}

function printResponse(
  _name: string,
  response: SlingResponse,
  verbose: boolean,
): void {
  const statusIcon = response.status < 400 ? "✓" : "✗";
  const duration = `${Math.round(response.duration)}ms`;

  console.warn(
    `  ${statusIcon} ${response.status} ${response.statusText} (${duration})`,
  );

  if (verbose) {
    console.warn("");
    console.warn("  Response Headers:");
    for (const [key, value] of Object.entries(response.headers)) {
      console.warn(`    ${key}: ${value}`);
    }
  }

  // Body always goes to stdout so it can be piped
  if (response.body) {
    try {
      // Pretty-print JSON
      const parsed = JSON.parse(response.body);
      console.log(JSON.stringify(parsed, null, 2));
    } catch {
      console.log(response.body);
    }
  }
}

function printError(name: string, error: Error): void {
  console.error(`  ✗ ${name} failed: ${error.message}`);
  if (error.cause) {
    console.error(`    Caused by: ${String(error.cause)}`);
  }
}

function printSummary(results: RunResult[]): void {
  const passed = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.warn("");
  console.warn(
    `Done: ${passed} passed, ${failed} failed, ${results.length} total`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}
