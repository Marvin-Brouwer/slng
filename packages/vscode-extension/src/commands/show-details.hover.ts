import * as vscode from 'vscode'

import { ExtensionContext } from '../context'

export const showDetailsFromHover = 'sling.showDetails.fromHover'

function showDetailsFromHoverCommand(log: vscode.LogOutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(showDetailsFromHover, (commandArguments) => {
		const { line } = commandArguments as { line: number }
		log.append('openDetails called ') // <-- add this for debugging
		log.appendLine(JSON.stringify(commandArguments))
		const editor = vscode.window.activeTextEditor
		log.appendLine(editor ? 'editor' : 'no-editor')
		if (editor) {
			const range = new vscode.Range(line, 0, line, 0)
			editor.revealRange(range, vscode.TextEditorRevealType.Default)
			editor.selection = new vscode.Selection(range.start, range.end)
		}
		// do something here
		vscode.commands.executeCommand('sling.response-panel.focus')
	})
}
export function registerShowDetailsFromHoverCommand(context: ExtensionContext) {
	context.addSubscriptions(showDetailsFromHoverCommand(context.log))
}
export function createHoverUrl(document: vscode.TextDocument, lineNumber: number) {
	const detailUrl = encodeURIComponent(
		JSON.stringify({ uri: document.uri.toString(), line: lineNumber }),
	)
	return `command:${showDetailsFromHover}?${detailUrl}`
}
