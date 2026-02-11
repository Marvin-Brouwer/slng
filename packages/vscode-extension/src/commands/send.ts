import * as vscode from 'vscode'

import { sendRequest } from '../send'
import { ResponseViewProvider } from '../views/response'

export const sendCommand = 'slng.send'
export function registerSendCommand(subscription: vscode.Disposable[], channel: vscode.LogOutputChannel, responseViewProvider: ResponseViewProvider) {
	subscription.push(
		vscode.commands.registerCommand(
			sendCommand,
			async (fileUri: vscode.Uri, exportName: string) => {
				const result = await sendRequest(fileUri, exportName, channel)
				if (!result) {
					// TODO, maybe adding an error view if result instanceof Error and showing a different view in the responseView?
					// responseViewProvider.update('no-result')
					return
				}

				responseViewProvider.update(result)
				responseViewProvider.show()
			},
		),
	)
}
