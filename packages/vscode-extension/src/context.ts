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

	if (__DEV__ && context.extensionMode === vscode.ExtensionMode.Development) {
		// Show the logs on screen
		logChannel.show(true)
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
