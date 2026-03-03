import { createLog, Logger } from '@slng/definition/extension'
import * as vscode from 'vscode'

import { SlingResponse } from '../../definition/src/types'

export interface ExtensionContext {
	log: Logger
	responseCache: Map<string, SlingResponse>
	addSubscriptions(...subscriptions: vscode.Disposable[]): void
}

export default async function createContext(context: vscode.ExtensionContext): Promise<ExtensionContext> {
	const logChannel = vscode.window.createOutputChannel('Sling', { log: true })

	if (context.extensionMode === vscode.ExtensionMode.Development) {
		// Show the logs on screen
		logChannel.show(true)
		// TODO remove once we fixed the issue where we can't launch vscode with a log level
		logChannel.info('Current log level:', logChannel.logLevel.toString())
		await new Promise(resolve => setTimeout(resolve, 1300))
		while (logChannel.logLevel >= vscode.LogLevel.Info) {
			await vscode.commands.executeCommand('workbench.action.setLogLevel')
		}
	}

	// todo set and load selected env in and context.workspaceState
	return {
		log: createLog('sling', logChannel),
		responseCache: new Map(),
		addSubscriptions(...subscriptions: vscode.Disposable[]) {
			context.subscriptions.push(...subscriptions)
		},
	}
}
