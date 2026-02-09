#!/usr/bin/env node

import { parseArguments, HELP_TEXT } from './arguments.js'
import { loadFile, loadGlob, autoDiscover } from './loader.js'
import { runDefinitions } from './runner.js'

try {
	const arguments_ = parseArguments(process.argv.slice(2))

	if (arguments_.help) {
		console.log(HELP_TEXT)
	}
	else {
		let definitions

		if (arguments_.file) {
			definitions = await loadFile(arguments_.file)
		}
		else if (arguments_.files) {
			definitions = await loadGlob(arguments_.files)
		}
		else {
			// Auto-discover: look for .mts files in CWD (excluding config files)
			definitions = await autoDiscover()
		}

		await runDefinitions(definitions, {
			name: arguments_.name,
			verbose: arguments_.verbose,
			mask: arguments_.mask,
			environment: arguments_.environment,
		})
	}
}
catch (error: unknown) {
	console.error('Fatal error:', error)
	process.exitCode = 1
}
