import * as vscode from 'vscode'

import { sendCommand } from '../commands/send'
import { ExtensionContext } from '../context'

// Matches the default import identifier from a slng.config file.
// e.g. `import s from '../slng.config.ts'` → captures `s`
const SLNG_CONFIG_IMPORT_RE = /import\s+(\w+)\s+from\s+['"][^'"]*slng\.config[^'"]*['"]/

function buildExportRe(identifier: string): RegExp {
	return new RegExp(
		`export\\s+(?:const|let|var)\\s+(\\w+)\\s*=\\s*${identifier}\\.\\w+\\s*\``,
		'g',
	)
}

export class SlingCodeLensProvider implements vscode.CodeLensProvider {
	private readonly _onDidChange = new vscode.EventEmitter<void>()
	readonly onDidChangeCodeLenses = this._onDidChange.event

	provideCodeLenses(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken,
	): vscode.CodeLens[] {
		// Only apply to .mts and .ts files
		if (!document.fileName.endsWith('.mts') && !document.fileName.endsWith('.ts')) {
			return []
		}

		const text = document.getText()

		const importMatch = SLNG_CONFIG_IMPORT_RE.exec(text)
		if (!importMatch) return []

		const exportRe = buildExportRe(importMatch[1])
		const lenses: vscode.CodeLens[] = []

		let match: RegExpExecArray | null

		while ((match = exportRe.exec(text)) !== null) {
			const exportName = match[1]
			const position = document.positionAt(match.index)
			const range = new vscode.Range(position, position)

			lenses.push(
				// "Send" lens
				new vscode.CodeLens(range, {
					title: 'Send',
					command: sendCommand,
					arguments: [document.uri, exportName],
					tooltip: `Send the "${exportName}" request`,
				}),
				// "Debug" lens
				new vscode.CodeLens(range, {
					title: '🐛 Debug',
					command: 'slng.debug',
					arguments: [document.uri, exportName, position.line],
					tooltip: `Debug the "${exportName}" request (attaches debugger)`,
				}),
			)
		}

		return lenses
	}

	refresh(): void {
		this._onDidChange.fire()
	}
}

export function registerCodeLens(context: ExtensionContext) {
	const codeLensProvider = new SlingCodeLensProvider()

	context.addSubscriptions(
		vscode.languages.registerCodeLensProvider(
			{ language: 'typescript', pattern: '**/*.{ts,mts}' },
			codeLensProvider,
		),
		// Refresh CodeLens on file save
		vscode.workspace.onDidSaveTextDocument(() => {
			codeLensProvider.refresh()
		}),
	)
}
