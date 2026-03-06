import { isSlingDefinition } from '@slng/definition/extension'
import { nodes } from '@slng/definition/nodes'
import * as vscode from 'vscode'

import { ExtensionContext } from '../context'
import { ResponsePanel } from '../response-panel/response-panel.webview'
import { sendRequest } from '../send'

import { updateFile } from './update-file'

export const sendCommand = 'slng.send'
export function registerSendCommand(context: ExtensionContext, responsePanel: ResponsePanel) {
	context.addSubscriptions(
		vscode.commands.registerCommand(
			sendCommand,
			async (fileUri: vscode.Uri, exportName: string) => {
				const cached = context.activeDefinitions.get(fileUri.fsPath)
				if (!cached) {
					vscode.window.showErrorMessage(`Sling: file ${fileUri} was not loaded correctly`)
					return
				}

				const def = cached[exportName]
				if (isSlingDefinition(def)) {
					const { protocolAst } = def.getInternals()
					const errors = 'metadata' in protocolAst ? (protocolAst as nodes.SlingDocument).metadata.errors : []
					if (errors.length > 0) {
						const reasons = errors.map((e: nodes.ErrorNode) => e.reason).join(', ')
						vscode.window.showErrorMessage(`Sling: ${exportName} has errors: ${reasons}`)
						return
					}
				}

				const result = await sendRequest(fileUri, exportName, context.log)
				if (!result) {
					// TODO, maybe adding an error view if result instanceof Error and showing a different view in the responseView?
					// responseViewProvider.update('no-result')
					return
				}

				const reference = result.request.reference
				context.responseCache.set(reference, result)
				await responsePanel.show(reference)

				await updateFile()
			},
		),
	)
}
