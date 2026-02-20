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
				const result = await sendRequest(fileUri, exportName, context.log)
				if (!result) {
					// TODO, maybe adding an error view if result instanceof Error and showing a different view in the responseView?
					// responseViewProvider.update('no-result')
					return
				}

				const reference = result.request.reference
				await context.state.put(reference, result)
				await responsePanel.show(reference)

				await updateFile()
			},
		),
	)
}
