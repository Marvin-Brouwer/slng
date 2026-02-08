import { resolve } from 'node:path'

import * as vscode from 'vscode'

/**
 * Launch a debug session that runs a specific sling definition.
 *
 * How it works:
 * 1. Creates a small runner script that imports the target file
 *    and calls `.execute()` on the named export.
 * 2. Launches a Node.js debug session with `--inspect-brk` via tsx.
 * 3. Sets a breakpoint at the export line so the user lands right
 *    where the request is defined.
 * 4. The user can step through their own code (interpolation functions,
 *    chaining, etc.) with full debugger support.
 * 5. When execution completes, the response is written to a temp file
 *    that the extension reads back to show in the response panel.
 *
 * No hidden magic — the user's code runs exactly as-is.
 */
export async function launchDebugSession(
	fileUri: vscode.Uri,
	exportName: string,
	lineNumber: number,
): Promise<void> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri)
	if (!workspaceFolder) {
		vscode.window.showErrorMessage(
			'Cannot debug: file is not in a workspace folder.',
		)
		return
	}

	const filePath = fileUri.fsPath
	const cwd = workspaceFolder.uri.fsPath
	const resultFile = resolve(cwd, `.slng-debug-result-${Date.now()}.json`)

	// Build inline runner script.
	// This is transparent — the user can see exactly what runs.
	const runnerScript = buildRunnerScript(filePath, exportName, resultFile)

	// Set a breakpoint at the definition line
	const breakpoint = new vscode.SourceBreakpoint(
		new vscode.Location(fileUri, new vscode.Position(lineNumber, 0)),
		true,
	)
	vscode.debug.addBreakpoints([breakpoint])

	// Launch debug config
	const debugConfig: vscode.DebugConfiguration = {
		type: 'node',
		request: 'launch',
		name: `Sling: ${exportName}`,
		runtimeExecutable: 'npx',
		runtimeArgs: ['tsx', '--eval', runnerScript],
		cwd,
		console: 'integratedTerminal',
		sourceMaps: true,
		resolveSourceMapLocations: ['**'],
		// Don't skip user files
		skipFiles: [],
		env: {
			SLNG_DEBUG: '1',
			SLNG_RESULT_FILE: resultFile,
		},
	}

	await vscode.debug.startDebugging(workspaceFolder, debugConfig)
}

function buildRunnerScript(
	filePath: string,
	exportName: string,
	resultFile: string,
): string {
	// Use pathToFileURL to handle Windows paths
	return `
    import { pathToFileURL } from 'node:url';
    import { writeFileSync } from 'node:fs';

    const exportName = ${JSON.stringify(exportName)};
    const fileUrl = pathToFileURL(${JSON.stringify(filePath)}).href;
    const mod = await import(fileUrl);
    const definition = mod[exportName];

    if (!definition || typeof definition.getInternals !== 'function') {
      console.error('Export "' + exportName + '" is not a sling definition');
      process.exit(1);
    }

    try {
      const response = await definition.execute({ verbose: true, maskOutput: true });
      const result = {
        name: exportName,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        duration: response.duration,
      };
      writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify(result, null, 2));
      console.log('\\n\\u2713 Response written to result file');
    } catch (err) {
      console.error('Request failed:', err);
      process.exit(1);
    }
  `.trim()
}
