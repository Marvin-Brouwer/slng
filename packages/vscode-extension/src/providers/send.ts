import { isSlingDefinition, SlingDefinition, SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

import { loadModuleFile } from './require'

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
	channel?: vscode.LogOutputChannel,
): Promise<SlingResponse | undefined> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri)
	if (!workspaceFolder) {
		vscode.window.showErrorMessage(
			'Cannot send: file is not in a workspace folder.',
		)
		return
	}

	channel?.info(`invoking '${exportName}' in "${fileUri.path}"`)

	return await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Sling: sending ${exportName}...`,
			cancellable: true,
		},
		async (_progress, token) => {
			const abortController = new AbortController()
			token.onCancellationRequested(abortController.abort.bind(void 0))
			const result = await sendHttpRequest(fileUri.fsPath, exportName, abortController.signal)

			if (!result) {
				vscode.window.showErrorMessage(
					`Sling: ${exportName} failed to return a result`,
				)
				return
			}
			if (result instanceof Error) {
				vscode.window.showErrorMessage(
					`Sling: ${exportName} failed — ${result.message}`,
				)
				return
			}

			return result

			// name: exportName,
			// method: internals.parsed.method,
			// url: internals.parsed.url,
			// status: response.status,
			// statusText: response.statusText,
			// headers: response.headers,
			// body: response.body,
			// duration: response.duration,
		},
	)
}

async function sendHttpRequest(filePath: string, callName: string, signal: AbortSignal) {
	const definition = await loadModuleFile<Record<string, SlingDefinition>>(filePath)
	const callDefinition = definition[callName]
	if (!isSlingDefinition(callDefinition))
		throw new Error(`Export '${callName}' in "${filePath}" is not a sling definition`)

	return await callDefinition.execute({ maskOutput: true, signal }).catch(error => error as Error)
}
