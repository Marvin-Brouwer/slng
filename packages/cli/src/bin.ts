#!/usr/bin/env node

import { parseArgs, HELP_TEXT } from "./args.js";
import { loadFile, loadGlob, autoDiscover } from "./loader.js";
import { runDefinitions } from "./runner.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  let definitions;

  if (args.file) {
    definitions = await loadFile(args.file);
  } else if (args.files) {
    definitions = await loadGlob(args.files);
  } else {
    // Auto-discover: look for .mts files in CWD (excluding config files)
    definitions = await autoDiscover();
  }

  await runDefinitions(definitions, {
    name: args.name,
    verbose: args.verbose,
    mask: args.mask,
    environment: args.environment,
  });
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
