import path from 'node:path'

import * as vscode from 'vscode'

import { registerSendCommand } from './commands/send.js'
import { createHoverUrl, registerShowDetailsFromHoverCommand } from './commands/show-details.hover.js'
import { launchDebugSession } from './debug/launcher.js'
import { registerResponseView } from './views/response.js'
import { registerCodeLens } from './visual/codelens.js'

export async function activate(context: vscode.ExtensionContext) {
	// Register CodeLens provider for .mts files
	const channel = vscode.window.createOutputChannel('Sling', { log: true })
	channel.show(true)
	channel.info('Initializing', context.extension.id)

	const responseViewProvider = registerResponseView(context.subscriptions, channel)

	if (context.extensionMode === vscode.ExtensionMode.Development) {
		// Reset to standard for developers
		responseViewProvider.hide()

		// TODO remove once we fixed the issue where we can't launch vscode with a log level
		channel.info('Current log level:', channel.logLevel.toString())
		await new Promise(resolve => setTimeout(resolve, 1300))
		while (channel.logLevel >= vscode.LogLevel.Info) {
			await vscode.commands.executeCommand('workbench.action.setLogLevel')
		}
	}

	registerCodeLens(context.subscriptions)

	registerSendCommand(context.subscriptions, channel, responseViewProvider)
	registerShowDetailsFromHoverCommand(context.subscriptions, channel)

	function runExtension(activeEditor: vscode.TextEditor | undefined) {
		if (!activeEditor) return

		channel.debug('activeEditor', activeEditor.document.uri.toString())
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
	const responseTag = vscode.window.createTextEditorDecorationType({
		after: {
			// todo figure out a way to position the status, perhaps after the HTTP/1.1?
			// todo ... when sending, // new vscode.ThemeColor('editorError.foreground') when error
			contentText: '⇌ 200 OK',
			color: new vscode.ThemeColor('editorCodeLens.foreground'),
			// ⇀ in progress
			margin: '0 0 0 1ex',
		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	})
	const responseTagError = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: '⇌ 500 InternalServerError',
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
		let definitionLine = editor.document.lineAt(6)
		let httpLine = editor.document.lineAt(7)
		let endLine = editor.document.lineAt(9)
		const md = createMarkdown(`
			\`GET https://fake-url/api/test\`
			\`200 OK\`: \`application/json\`

			<a href="${createHoverUrl(editor.document, definitionLine.lineNumber)}" title="show details">show details</a>
		`)

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

		definitionLine = editor.document.lineAt(12)
		httpLine = editor.document.lineAt(13)
		endLine = editor.document.lineAt(15)
		const mdError = createMarkdown(`
			\`GET https://fake-url/api/test\`
			\`500 InternalServerError\`: \`text/plain\`

			<a href="${createHoverUrl(editor.document, definitionLine.lineNumber)}" title="show details">show details</a>
		`)
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

	vscode.window.onDidChangeActiveTextEditor(runExtension, undefined, context.subscriptions)
	runExtension(vscode.window.activeTextEditor)

	channel.info('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}

function createMarkdown(md: string) {
	return md
		.split('\n')
		.map((line) => {
			const mdLine = new vscode.MarkdownString()
			mdLine.isTrusted = true
			mdLine.supportHtml = true
			mdLine.value = line.replaceAll('\t', '')
			return mdLine
		})
}
