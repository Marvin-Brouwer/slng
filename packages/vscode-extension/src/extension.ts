import path from 'node:path'

import * as vscode from 'vscode'

import { registerSendCommand } from './commands/send.js'
import { registerShowDetailsFromHoverCommand } from './commands/show-details.hover.js'
import { registerUpdateFileCommand, updateFile } from './commands/update-file.js'
import { launchDebugSession } from './debug/launcher.js'
import { registerResponseView } from './views/response.js'
import { registerCodeLens } from './visual/codelens.js'

export async function activate(context: vscode.ExtensionContext) {
	// Register CodeLens provider for .mts files
	const channel = vscode.window.createOutputChannel('Sling', { log: true })
	channel.info('Initializing', context.extension.id)

	const responseViewProvider = registerResponseView(
		context.subscriptions, context.workspaceState,
		context.extensionUri,
		channel)

	if (context.extensionMode === vscode.ExtensionMode.Development) {
		// Show the logs on screen
		channel.show(true)
		// Reset to standard for developers
		responseViewProvider.hide()
		await Promise.all(context.workspaceState.keys().map(key => context.workspaceState.update(key, void 0)))

		// TODO remove once we fixed the issue where we can't launch vscode with a log level
		channel.info('Current log level:', channel.logLevel.toString())
		await new Promise(resolve => setTimeout(resolve, 1300))
		while (channel.logLevel >= vscode.LogLevel.Info) {
			await vscode.commands.executeCommand('workbench.action.setLogLevel')
		}
	}

	registerCodeLens(context.subscriptions)

	registerSendCommand(context.subscriptions, context.workspaceState, channel, responseViewProvider)
	registerUpdateFileCommand(context.subscriptions, context.workspaceState, channel)
	registerShowDetailsFromHoverCommand(context.subscriptions, channel)

	async function runExtension(activeEditor: vscode.TextEditor | undefined) {
		if (!activeEditor) return
		channel.debug('activeEditor', activeEditor.document.uri.toString())
		await updateFile()
	}

	context.subscriptions.push(
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
			path.join(context.extensionPath, 'media', 'info.svg'),
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

	vscode.window.onDidChangeActiveTextEditor(runExtension, undefined, context.subscriptions)
	await runExtension(vscode.window.activeTextEditor)

	channel.info('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}
