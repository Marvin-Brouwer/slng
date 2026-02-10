import path from 'node:path'

import * as vscode from 'vscode'

import { launchDebugSession } from './debug/launcher.js'
import { SlingCodeLensProvider } from './providers/codelens.js'
import { sendRequest } from './providers/send.js'
import { ResponseViewProvider } from './views/response.js'

export function activate(context: vscode.ExtensionContext): void {
	// Register CodeLens provider for .mts files
	const codeLensProvider = new SlingCodeLensProvider()
	const channel = vscode.window.createOutputChannel('Sling', { log: true })
	channel.show(true)
	channel.appendLine('testing views')
	const responseViewProvider = new ResponseViewProvider(channel)

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
				const result = await sendRequest(fileUri, exportName, channel).catch(error => error as Error)
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
				}
				else if (result) {
					responseViewProvider.update(result)
					responseViewProvider.show()
					// ResponsePanel.show(context, result, maskSecrets)
				}
				else {
					channel.appendLine(`${fileUri.toString()} -> ${exportName} had no result`)
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
		vscode.commands.registerCommand('sling.showDetails', (commandArguments) => {
			const { line } = commandArguments as { line: number }
			channel.append('openDetails called ') // <-- add this for debugging
			channel.appendLine(JSON.stringify(commandArguments))
			const editor = vscode.window.activeTextEditor
			channel.appendLine(editor ? 'editor' : 'no-editor')
			if (editor) {
				const range = new vscode.Range(line, 0, line, 0)
				editor.revealRange(range, vscode.TextEditorRevealType.Default)
				editor.selection = new vscode.Selection(range.start, range.end)
			}
			// do something here
			vscode.commands.executeCommand('sling.responseDetails.focus')
		}),
		vscode.window.registerWebviewViewProvider(
			ResponseViewProvider.viewType,
			responseViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
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
	const responseTag = vscode.window.createTextEditorDecorationType({
		after: {
			// todo figure out a way to position the status, perhaps after the HTTP/1.1?
			// todo ... when sending, // new vscode.ThemeColor('editorError.foreground') when error
			contentText: '⇌ OK (200)',
			color: new vscode.ThemeColor('editorCodeLens.foreground'),
			// ⇀ in progress
			margin: '0 0 0 1ex',
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	})
	const responseTagError = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: '⇌ Internal server error (500)',
			color: new vscode.ThemeColor('editorError.foreground'),
			// ⇀ in progress
			margin: '0 0 0 1ex',
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	})
	const hoverHelper = vscode.window.createTextEditorDecorationType({
		rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
	})
	const hoverHelperError = vscode.window.createTextEditorDecorationType({
		rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
	})
	const editor = vscode.window.activeTextEditor
	if (editor) {
		let definitionLine = editor.document.lineAt(8)
		let httpLine = editor.document.lineAt(9)
		let endLine = editor.document.lineAt(11)
		const md = [
			new vscode.MarkdownString(
				'`OK (200)`',
			), new vscode.MarkdownString(
				`[details](command:sling.showDetails?${encodeURIComponent(
					JSON.stringify({ uri: editor.document.uri.toString(), line: definitionLine.lineNumber }),
				)})`,
			),
		]
		md[1].isTrusted = true
		editor.setDecorations(statusIcon, [
			{
				range: definitionLine.range,
			},
		])
		editor.setDecorations(responseTag, [
			{
				range: new vscode.Range(
					httpLine.range.start.line, httpLine.range.start.character + 1,
					httpLine.range.end.line, httpLine.range.end.character + 10,
				),
			},
		])
		editor.setDecorations(hoverHelper, [
			{
				range: new vscode.Range(
					definitionLine.range.start,
					endLine.range.end,
				), // After the sling text
				hoverMessage: md,
			},
		])

		definitionLine = editor.document.lineAt(14)
		httpLine = editor.document.lineAt(15)
		endLine = editor.document.lineAt(17)
		const mdError = [
			new vscode.MarkdownString(
				'`Internal server error (500)`',
			), new vscode.MarkdownString(
				`[details](command:sling.showDetails?${encodeURIComponent(
					JSON.stringify({ uri: editor.document.uri.toString(), line: definitionLine.lineNumber }),
				)})`,
			),
		]
		mdError[1].isTrusted = true
		editor.setDecorations(statusIcon, [
			{
				range: definitionLine.range,
			},
		])
		editor.setDecorations(responseTagError, [
			{
				range: new vscode.Range(
					httpLine.range.start.line, httpLine.range.start.character + 1,
					httpLine.range.end.line, httpLine.range.end.character + 10,
				),
			},
		])
		editor.setDecorations(hoverHelperError, [
			{
				range: new vscode.Range(
					definitionLine.range.start,
					endLine.range.end,
				), // After the sling text
				hoverMessage: mdError,
			},
		])
	}
	console.log('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}
