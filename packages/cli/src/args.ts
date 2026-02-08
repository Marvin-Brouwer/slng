export interface CliArguments {
	/** Specific file to run. */
	file?: string
	/** Glob pattern for multiple files. */
	files?: string
	/** Specific export name to run. If omitted, run all. */
	name?: string
	/** Environment to activate. */
	environment?: string
	/** Show verbose output including full request/response. */
	verbose: boolean
	/** Mask secrets in output. */
	mask: boolean
	/** Show help. */
	help: boolean
}

export function parseArgs(argv: string[]): CliArguments {
	const arguments_: CliArguments = {
		verbose: false,
		mask: true,
		help: false,
	}

	let index = 0
	while (index < argv.length) {
		const argument = argv[index]

		switch (argument) {
			case '--file':
			case '-f': {
				arguments_.file = argv[++index]
				break
			}
			case '--files': {
				arguments_.files = argv[++index]
				break
			}
			case '--env':
			case '-e': {
				arguments_.environment = argv[++index]
				break
			}
			case '--verbose':
			case '-v': {
				arguments_.verbose = true
				break
			}
			case '--no-mask': {
				arguments_.mask = false
				break
			}
			case '--help':
			case '-h': {
				arguments_.help = true
				break
			}
			default: {
				// Positional argument = export name
				if (!argument.startsWith('-')) {
					arguments_.name = argument
				}
				break
			}
		}

		index++
	}

	return arguments_
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
`.trim()
