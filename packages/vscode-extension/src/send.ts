import { isSlingDefinition, SlingDefinition, SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

import { loadModuleFile } from './require'

export async function sendRequest(
	fileUri: vscode.Uri,
	exportName: string,
	channel: vscode.LogOutputChannel,
): Promise<SlingResponse | false> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri)
	if (!workspaceFolder) {
		vscode.window.showErrorMessage(
			'Cannot send: file is not in a workspace folder.',
		)
		return false
	}

	channel?.info(`invoking '${exportName}' in "${fileUri.path}"`)

	// TODO, we are returning the result now, perhaps it's better to have a single function that either shows progress, error, or the response pane.
	return await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Sling: sending ${exportName}...`,
			cancellable: true,
		},
		async (_progress, token) => {
			const abortController = new AbortController()
			token.onCancellationRequested(abortController.abort.bind(void 0))
			const result = await sendHttpRequest(fileUri.fsPath, exportName, abortController.signal).catch(error => error as Error)

			if (result instanceof Error) {
				// npm might error
				/*
					npm error code E401
					npm error Unable to authenticate, your authentication token seems to be invalid.
					npm error To correct this please try logging in again with:
					npm error   npm login
					npm error A complete log of this run can be found in:
				*/
				channel.appendLine('ERROR')
				channel.appendLine(result.toString())
				vscode.window.showErrorMessage(
					`Sling: ${exportName} failed — ${result.message}`,
				)
				return false
			}
			if (!result) {
				vscode.window.showErrorMessage(
					`Sling: ${exportName} failed to return a result`,
				)
				channel.appendLine(`${fileUri.toString()} -> ${exportName} had no result`)
				return false
			}

			return result
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
