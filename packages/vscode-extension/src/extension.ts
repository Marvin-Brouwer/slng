import * as vscode from 'vscode'

import { launchDebugSession } from './debug/launcher.js'
import { ResponsePanel } from './panels/response.js'
import { SlingCodeLensProvider } from './providers/codelens.js'
import { sendRequest } from './providers/send.js'

export function activate(context: vscode.ExtensionContext): void {
	// Register CodeLens provider for .mts files
	const codeLensProvider = new SlingCodeLensProvider()

	context.subscriptions.push(
		vscode.languages.registerCodeLensProvider(
			{ language: 'typescript', pattern: '**/*.mts' },
			codeLensProvider,
		),
		// Refresh CodeLens on file save
		vscode.workspace.onDidSaveTextDocument(() => {
			codeLensProvider.refresh()
		}),
		// Register "Send" command
		vscode.commands.registerCommand(
			'slng.send',
			async (fileUri: vscode.Uri, exportName: string) => {
				const config = vscode.workspace.getConfiguration('slng')
				const maskSecrets = config.get<boolean>('maskSecrets', true)

				const result = await sendRequest(fileUri, exportName)
				if (result) {
					ResponsePanel.show(context, result, maskSecrets)
				}
			},
		),
		// Register "Debug" command
		vscode.commands.registerCommand(
			'slng.debug',
			async (fileUri: vscode.Uri, exportName: string, lineNumber: number) => {
				await launchDebugSession(fileUri, exportName, lineNumber)
			},
		),
	)

	console.log('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}
