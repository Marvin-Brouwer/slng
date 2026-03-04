import path from 'node:path'

import * as vscode from 'vscode'

import { registerSendCommand } from './commands/send.js'
import { registerShowDetailsFromHoverCommand } from './commands/show-details.hover.js'
import { registerUpdateFileCommand, updateFile } from './commands/update-file.js'
import createContext from './context.js'
import { launchDebugSession } from './debug/launcher.js'
import { registerResponsePanel } from './response-panel/response-panel.webview.js'
import { registerCodeLens } from './visual/codelens.js'
import { registerDiagnostics } from './visual/diagnostics.js'

export async function activate(vscodeContext: vscode.ExtensionContext) {
	const context = await createContext(vscodeContext)
	context.log.info('Initializing', vscodeContext.extension.id)

	const responsePanel = registerResponsePanel(
		context,
		vscodeContext.extensionUri)

	if (__DEV__ && vscodeContext.extensionMode === vscode.ExtensionMode.Development) {
		// Reset to standard for developers
		await Promise.all(vscodeContext.workspaceState.keys().map(key => vscodeContext.workspaceState.update(key, void 0)))
	}

	registerCodeLens(context)
	registerDiagnostics(context)

	registerSendCommand(context, responsePanel)
	registerUpdateFileCommand(context)
	registerShowDetailsFromHoverCommand(context)

	async function runExtension(activeEditor: vscode.TextEditor | undefined) {
		if (!activeEditor) return
		context.log.debug('activeEditor', activeEditor.document.uri.toString())
		await updateFile()
	}

	context.addSubscriptions(
		// TODO figure out how we want to do debugging
		vscode.commands.registerCommand(
			'slng.debug',
			async (fileUri: vscode.Uri, exportName: string, lineNumber: number) => {
				await launchDebugSession(fileUri, exportName, lineNumber)
			},
		),
	)

	let debounceTimer: ReturnType<typeof setTimeout> | undefined
	vscode.window.onDidChangeActiveTextEditor(runExtension, undefined, vscodeContext.subscriptions)
	vscode.workspace.onDidSaveTextDocument(
		async (document) => {
			if (!document.fileName.endsWith('.mts')) return
			await runExtension(vscode.window.activeTextEditor)
		},
		undefined,
		vscodeContext.subscriptions,
	)
	context.addSubscriptions(
		vscode.workspace.onDidChangeTextDocument((event) => {
			if (!event.document.fileName.endsWith('.mts')) return
			clearTimeout(debounceTimer)
			// eslint-disable-next-line  @typescript-eslint/no-misused-promises
			debounceTimer = setTimeout(async () => await runExtension(vscode.window.activeTextEditor), 500)
		}),
		{ dispose: () => clearTimeout(debounceTimer) },
	)
	await runExtension(vscode.window.activeTextEditor)

	context.log.info('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}
