import { SlingResponse } from '@slng/definition'
import { isSlingDefinition, loadDefinitionFile } from '@slng/definition/extension'
import * as vscode from 'vscode'

import { ExtensionContext } from '../context'

const updateFileCid = 'sling.update-file'

const responseTag = vscode.window.createTextEditorDecorationType({
	after: {
		margin: '0 0 0 1ex',
	},
	rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
})
const hoverHelperTag = vscode.window.createTextEditorDecorationType({
	rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
})

function updateFileCommand(context: ExtensionContext): vscode.Disposable {
	return vscode.commands.registerCommand(updateFileCid, async () => {
		const activeEditor = vscode.window.activeTextEditor
		if (!activeEditor) {
			context.log.error('updateFile was called without an active Editor')
			return // Should never happen
		}
		context.log.debug('updateFile')

		const definitions = await loadDefinitionFile(activeEditor.document.uri.fsPath)

		if (definitions instanceof Error) {
			context.log.error('Error while parsing definition', definitions)
			return
		}
		if (!definitions) return

		const decorations = Object
			.values(definitions)
			.map((definition) => {
				if (!isSlingDefinition(definition)) return {
					responseTag: undefined,
					hoverHelper: undefined,
				}

				const response = context.state.get<SlingResponse>(definition.id())
				if (!response) return {
					responseTag: undefined,
					hoverHelper: undefined,
				}

				const ast = definition.getInternals().tsAst

				const responseTagText = `⇌ ${response.status} ${response.statusText}`
				// Todo, issuccess from the Response object?
				const statusColor = response.status >= 0 && Math.round(response.status / 100) === 2
					? 'editorCodeLens.foreground'
					: 'editorError.foreground'

				const responseTagOptions: vscode.DecorationInstanceRenderOptions = {
					after: {
						contentText: responseTagText,
						color: new vscode.ThemeColor(statusColor),
					},
				}

				// TODO build from AST
				// const mdRequestLine = mdCode([
				// 	response.request.fetchInformation.method.toUpperCase(),
				// 	response.request.fetchInformation.url,
				// 	response.request.fetchInformation.httpVersion,
				// ].join(' '))
				// const mdResponseLine = mdCode(`${response.status} ${response.statusText}`)
				// 	+ (response.responseAst.metadata.contentType ? ': ' + mdCode(response.responseAst.metadata.contentType) : '')
				// const detailUrl = createHoverUrl(activeEditor.document, ast.exportLocation.start.line)
				// const mdDetailLinkLine = `<a href="${detailUrl}" title="show details">show details</a>`
				// const md = createMarkdown(
				// 	mdRequestLine,
				// 	mdResponseLine,
				// 	'',
				// 	mdDetailLinkLine,
				// )
				// One line down, lineAt is always one to low so +1 is not needed, TODO search text for HTTP/
				const httpLine = activeEditor.document.lineAt(ast.literalLocation.start.line)
				return {
					responseTag: {
						renderOptions: responseTagOptions,
						range: new vscode.Range(
							httpLine.lineNumber, httpLine.range.end.character + 1,
							httpLine.lineNumber, httpLine.range.end.character + 1 + responseTagText.length,
						),
					},
					hoverHelper:
					{
						range: new vscode.Range(
							ast.literalLocation.start.line, ast.literalLocation.start.column,
							ast.literalLocation.end.line, ast.literalLocation.end.column,
						), // After the sling text
						// hoverMessage: md,
					},
				}
			})

		activeEditor.setDecorations(responseTag, decorations.map(d => d.responseTag).filter(x => x != undefined))
		activeEditor.setDecorations(hoverHelperTag, decorations.map(d => d.hoverHelper).filter(x => x != undefined))
	})
}
export function registerUpdateFileCommand(context: ExtensionContext) {
	context.addSubscriptions(updateFileCommand(context), responseTag, hoverHelperTag)
}

export async function updateFile() {
	await vscode.commands.executeCommand(updateFileCid)
}

// const codeTag = '`'
// const mdCode = (text: string) => codeTag + text + codeTag
// function createMarkdown(...md: string[]) {
// 	return md
// 		.map((line) => {
// 			const mdLine = new vscode.MarkdownString()
// 			mdLine.isTrusted = true
// 			mdLine.supportHtml = true
// 			mdLine.value = line.replaceAll('\n', '').replaceAll('\t', '')
// 			return mdLine
// 		})
// }
