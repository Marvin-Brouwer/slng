import { isSlingDefinition, loadDefinitionFile, SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

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
			token.onCancellationRequested(() => abortController.abort())
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

				channel.error(result.message, result)
				vscode.window.showErrorMessage(
					`Sling: ${exportName} failed >> ${result.message}`,
				)

				return false
			}
			if (!result) {
				vscode.window.showErrorMessage(
					`Sling: ${exportName} failed to return a result`)
				channel.error(`${fileUri.toString()} -> ${exportName} had no result`)
				return false
			}
			// Negative status is fetch error
			if (result.status <= 0) {
				vscode.window.showWarningMessage(result.body)
				channel.error(result.statusText, result)
			}
			// Negative status is fetch error
			if (Math.round(result.status / 100) === 5) {
				vscode.window.showWarningMessage(`${result.status} ${result.statusText}`)
				channel.error(result.statusText, result)
			}

			return result
		},
	)
}

async function sendHttpRequest(filePath: string, callName: string, signal: AbortSignal) {
	// TODO fix ignores

	const definition = await loadDefinitionFile(filePath)
	if (definition instanceof Error) throw definition
	// TODO fix ignores

	const callDefinition = definition[callName]
	if (!isSlingDefinition(callDefinition))
		throw new Error(`Export '${callName}' in "${filePath}" is not a sling definition`)

	return await callDefinition.execute({
		signal,
		// We always mask
		maskOutput: true,
		// Don't read from cache if the button is pushed
		readFromCache: false,
	}).catch(error => error as Error)
}
