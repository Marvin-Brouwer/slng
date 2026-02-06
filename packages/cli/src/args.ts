export interface CliArgs {
  /** Specific file to run. */
  file?: string;
  /** Glob pattern for multiple files. */
  files?: string;
  /** Specific export name to run. If omitted, run all. */
  name?: string;
  /** Environment to activate. */
  environment?: string;
  /** Show verbose output including full request/response. */
  verbose: boolean;
  /** Mask secrets in output. */
  mask: boolean;
  /** Show help. */
  help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    verbose: false,
    mask: true,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i]!;

    switch (arg) {
      case "--file":
      case "-f":
        args.file = argv[++i];
        break;
      case "--files":
        args.files = argv[++i];
        break;
      case "--env":
      case "-e":
        args.environment = argv[++i];
        break;
      case "--verbose":
      case "-v":
        args.verbose = true;
        break;
      case "--no-mask":
        args.mask = false;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        // Positional argument = export name
        if (!arg.startsWith("-")) {
          args.name = arg;
        }
        break;
    }

    i++;
  }

  return args;
}

export const HELP_TEXT = `
Usage: slng [options] [name]

Run sling HTTP request definitions from the terminal.

Arguments:
  name                 Name of a specific export to run (optional, runs all if omitted)

Options:
  -f, --file <path>    Path to a .mts file with sling definitions
  --files <glob>       Glob pattern to match multiple .mts files
  -e, --env <name>     Environment to activate (e.g. "local", "staging")
  -v, --verbose        Show full request and response details
  --no-mask            Disable secret masking in output (use with caution)
  -h, --help           Show this help message

Examples:
  npx @slng/cli --file ./api/users.mts
  npx @slng/cli --file ./api/users.mts "getUser"
  npx @slng/cli --files "./apis/*.mts"
  npx @slng/cli
`.trim();
