import path from 'node:path'

import * as vscode from 'vscode'

import { registerSendCommand } from './commands/send.js'
import { registerShowDetailsFromHoverCommand } from './commands/show-details.hover.js'
import { registerUpdateFileCommand, updateFile } from './commands/update-file.js'
import createContext from './context.js'
import { launchDebugSession } from './debug/launcher.js'
import { registerResponsePanel } from './response-panel/response-panel.webview.js'
import { registerCodeLens } from './visual/codelens.js'
import { registerMethodHighlight } from './visual/method-highlight.js'

export async function activate(vscodeContext: vscode.ExtensionContext) {
	const context = createContext(vscodeContext)
	context.log.info('Initializing', vscodeContext.extension.id)

	const responsePanel = registerResponsePanel(
		context,
		vscodeContext.extensionUri)

	if (vscodeContext.extensionMode === vscode.ExtensionMode.Development) {
		// Show the logs on screen
		context.log.show(true)
		// Reset to standard for developers
		responsePanel.hide()
		await Promise.all(vscodeContext.workspaceState.keys().map(key => vscodeContext.workspaceState.update(key, void 0)))

		// TODO remove once we fixed the issue where we can't launch vscode with a log level
		context.log.info('Current log level:', context.log.logLevel.toString())
		await new Promise(resolve => setTimeout(resolve, 1300))
		while (context.log.logLevel >= vscode.LogLevel.Info) {
			await vscode.commands.executeCommand('workbench.action.setLogLevel')
		}
	}

	registerCodeLens(context)
	registerMethodHighlight(context)

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
	const statusIcon = vscode.window.createTextEditorDecorationType({
		// TODO icons for sending, success and error
		gutterIconPath: vscode.Uri.file(
			path.join(vscodeContext.extensionPath, 'media', 'info.svg'),
		),
		gutterIconSize: 'contain',
	})

	// TODO how useful would the status icon be?
	const editor = vscode.window.activeTextEditor
	if (editor) {
		let definitionLine = editor.document.lineAt(6)

		editor.setDecorations(statusIcon, [
			{
				range: definitionLine.range,
			},
		])

		definitionLine = editor.document.lineAt(12)
		editor.setDecorations(statusIcon, [
			{
				range: definitionLine.range,
			},
		])
	}

	vscode.window.onDidChangeActiveTextEditor(runExtension, undefined, vscodeContext.subscriptions)
	await runExtension(vscode.window.activeTextEditor)

	context.log.info('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}
