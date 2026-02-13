import { maskTransformer } from '@slng/config'
import * as vscode from 'vscode'

export interface State {
	includesKey(key: string): boolean
	get<T>(key: string): T | undefined
	put<T>(key: string, value: T): Promise<void>
}

export interface ExtensionContext {
	log: vscode.LogOutputChannel
	addSubscriptions(...subscriptions: vscode.Disposable[]): void
	state: State
}

function createState(workspaceState: vscode.Memento): State {
	return {
		includesKey(key: string): boolean {
			return workspaceState.keys().includes(key)
		},
		get<T>(key: string): T | undefined {
			const raw = workspaceState.get<string>(key)
			if (raw === undefined) return undefined
			return JSON.parse(raw, (k, v: unknown) => maskTransformer.reviver(k, v)) as T
		},
		async put<T>(key: string, value: T) {
			await workspaceState.update(key, JSON.stringify(value, undefined, 2))
		},
	}
}

export default function createContext(context: vscode.ExtensionContext): ExtensionContext {
	const logChannel = vscode.window.createOutputChannel('Sling', { log: true })

	return {
		log: createLog(logChannel),
		addSubscriptions(...subscriptions: vscode.Disposable[]) {
			context.subscriptions.push(...subscriptions)
		},
		state: createState(context.workspaceState),
	}
}

function sanitize(arguments_: unknown[]): string {
	return arguments_
		.map(argument => typeof argument === 'object'
			? JSON.stringify(argument, (k: string, v: unknown) => maskTransformer.displayReplacer(k, v), 2)
			: String(argument as string | number | boolean))
		.join(' ')
}

export function createLog(channel: vscode.LogOutputChannel): vscode.LogOutputChannel {
	return new Proxy(channel, {
		get(target, property, receiver) {
			switch (property) {
				case 'trace':
				case 'debug':
				case 'info':
				case 'warn':
				case 'error': {
					return (...arguments_: unknown[]) => target[property](sanitize(arguments_))
				}
				default: {
					return Reflect.get(target, property, receiver) as unknown
				}
			}
		},
	})
}
