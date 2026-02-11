import * as vscode from 'vscode'

export const showDetailsFromHover = 'sling.showDetails.fromHover'

function showDetailsFromHoverCommand(channel: vscode.LogOutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(showDetailsFromHover, (commandArguments) => {
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
	})
}
export function registerShowDetailsFromHoverCommand(subscription: vscode.Disposable[], channel: vscode.LogOutputChannel) {
	subscription.push(showDetailsFromHoverCommand(channel))
}
export function createHoverUrl(document: vscode.TextDocument, lineNumber: number) {
	const detailUrl = encodeURIComponent(
		JSON.stringify({ uri: document.uri.toString(), line: lineNumber }),
	)
	return `command:${showDetailsFromHover}?${detailUrl}`
}
