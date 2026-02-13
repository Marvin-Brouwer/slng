import * as vscode from 'vscode'

import { ExtensionContext } from '../context'
import { sendRequest } from '../send'
import { ResponseViewProvider } from '../views/response'

import { updateFile } from './update-file'

export const sendCommand = 'slng.send'
export function registerSendCommand(context: ExtensionContext, responseViewProvider: ResponseViewProvider) {
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

				// TODO fix ignores

				const reference = result.request.reference
				// TODO fix ignores

				await context.state.put(reference, result)
				// TODO fix ignores

				responseViewProvider.update(reference)
				responseViewProvider.show()

				await updateFile()
			},
		),
	)
}
