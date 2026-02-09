import path from 'node:path'

import * as vscode from 'vscode'

import { launchDebugSession } from './debug/launcher.js'
import { ResponsePanel } from './panels/response.js'
import { SlingCodeLensProvider } from './providers/codelens.js'
import { sendRequest } from './providers/send.js'

export function activate(context: vscode.ExtensionContext): void {
	// Register CodeLens provider for .mts files
	const codeLensProvider = new SlingCodeLensProvider()
	const channel = vscode.window.createOutputChannel('Sling')
	channel.show(true)
	channel.appendLine('testing views')
	const provider = new DetailsViewProvider(channel)

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
			DetailsViewProvider.viewType,
			provider,
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
			contentText: ': OK (200)',
			color: new vscode.ThemeColor('editorCodeLens.foreground'),

			margin: '0 0 0 1ex',

		},
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	})
	const hoverHelper = vscode.window.createTextEditorDecorationType({
		rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
	})
	const editor = vscode.window.activeTextEditor
	if (editor) {
		const definitionLine = editor.document.lineAt(8)
		const httpLine = editor.document.lineAt(9)
		const endLine = editor.document.lineAt(11)
		const md = [new vscode.MarkdownString(
			'`OK (200)`',
		), new vscode.MarkdownString(
			`[details](command:sling.showDetails?${encodeURIComponent(
				JSON.stringify({ uri: editor.document.uri.toString(), line: definitionLine.lineNumber }),
			)})`,
		)]
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

		provider.update('test')
	}
	console.log('Sling extension activated')
}

export function deactivate(): void {
	// Cleanup handled by disposables
}

// TODO, this is nice for history view perhaps
class DetailsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'sling.responseDetails'

	private _view?: vscode.WebviewView

	constructor(private readonly channel: vscode.OutputChannel) {}

	resolveWebviewView(view: vscode.WebviewView) {
		this.channel.appendLine('resolveWebviewView')
		this._view = view
		// view.show(true)
		view.webview.options = { enableScripts: true }
		view.webview.html = this.getHtml('No selection yet')
	}

	public update(content: string) {
		this.channel.appendLine('update')
		this.channel.appendLine(content)
		if (this._view) {
			this._view.webview.html = this.getHtml(content)
		}
	}

	private getHtml(content: string) {
		this.channel.appendLine('getHtml')
		this.channel.appendLine(content)
		return `
      <html>
        <body>
          <h2>Details</h2>
          <div>${content}</div>
          <button onclick="alert('Real button!')">Click me</button>
        </body>
      </html>
    `
	}
}
