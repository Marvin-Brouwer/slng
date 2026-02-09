import { execFile } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'

import * as vscode from 'vscode'

// TODO, this is very invisible, the plugin should log to the extensions log in vscode so we can see what's happening.
// Preferably via a logger.info kind of api so the console and the vscode extension log the same messages dictated by the config project.

interface SendResult {
	name: string
	method: string
	url: string
	status: number
	statusText: string
	headers: Record<string, string>
	body: string
	duration: number
}

/**
 * Execute a sling request by spawning a child process.
 *
 * Uses tsx to import the user's .mts file and run the named export.
 * The result is written to a temp JSON file and read back.
 * This keeps execution transparent and identical to CLI usage.
 */
export async function sendRequest(
	fileUri: vscode.Uri,
	exportName: string,
): Promise<SendResult | undefined> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri)
	if (!workspaceFolder) {
		vscode.window.showErrorMessage(
			'Cannot send: file is not in a workspace folder.',
		)
		return
	}

	const filePath = fileUri.fsPath
	const cwd = workspaceFolder.uri.fsPath
	const resultFile = path.resolve(cwd, `.slng-result-${Date.now()}.json`)

	const script = String.raw`
    import { pathToFileURL } from 'node:url';
    import { writeFileSync } from 'node:fs';

    const exportName = ${JSON.stringify(exportName)};
    const fileUrl = pathToFileURL(${JSON.stringify(filePath)}).href;
    const mod = await import(fileUrl);
    const definition = mod[exportName];

    if (!definition || typeof definition.getInternals !== 'function') {
      process.stderr.write('Export "' + exportName + '" is not a sling definition\n');
      process.exit(1);
    }

    const internals = definition.getInternals();
    const response = await definition.execute({ maskOutput: true });
    const result = {
      name: exportName,
      method: internals.parsed.method,
      url: internals.parsed.url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      duration: response.duration,
    };
    writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify(result));
  `.trim()

	return vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Sling: sending ${exportName}...`,
			cancellable: true,
		},
		(_progress, token) => {
			return new Promise<SendResult | undefined>((resolvePromise, reject) => {
				const child = execFile(
					'npx',
					['tsx', '--eval', script],
					{ cwd, timeout: 30_000 },
					(error, _stdout, stderr) => {
						if (token.isCancellationRequested) {
							resolvePromise(void 0)
							return
						}

						if (error) {
							vscode.window.showErrorMessage(
								`Sling: ${exportName} failed — ${stderr || error.message}`,
							)
							reject(new Error(stderr || error.message, { cause: error }))
							return
						}

						readFile(resultFile, 'utf8')
							.then((raw) => {
								const result = JSON.parse(raw) as SendResult
								return unlink(resultFile)
									.catch(() => {})
									.then(() => resolvePromise(result))
							})
							.catch((error_: unknown) => {
								reject(error_ instanceof Error ? error_ : new Error(String(error_)))
							})
					},
				)

				token.onCancellationRequested(() => {
					child.kill('SIGTERM')
				})
			})
		},
	)
}
