import { isSlingDefinition } from '@slng/definition/extension'
import { nodes } from '@slng/definition/nodes'
import * as vscode from 'vscode'

import type { ExtensionContext } from '../context.js'

const diagnosticCollection = vscode.languages.createDiagnosticCollection('sling')

export function registerDiagnostics(context: ExtensionContext): void {
	context.addSubscriptions(
		diagnosticCollection,
		vscode.workspace.onDidCloseTextDocument((document) => {
			diagnosticCollection.delete(document.uri)
		}),
	)
}

export function updateDiagnostics(
	uri: vscode.Uri,
	vscDocument: vscode.TextDocument,
	definitions: Record<string, unknown>,
): void {
	const all: vscode.Diagnostic[] = []

	for (const definition of Object.values(definitions)) {
		if (!isSlingDefinition(definition)) continue
		const { protocolAst, tsAst } = definition.getInternals()
		const fallback = babelLocToRange(tsAst.literalLocation)

		if (protocolAst.type === 'error') {
			all.push(makeDiagnostic(protocolAst as nodes.ErrorNode, fallback, vscDocument))
		}
		else if ('metadata' in protocolAst) {
			const document = protocolAst as nodes.SlingDocument
			const range = document.loc ? babelLocToRange(document.loc) : fallback
			all.push(...document.metadata.errors.map(error => makeDiagnostic(error, range, vscDocument)))
		}
	}

	diagnosticCollection.set(uri, all)
}

export function clearDiagnostics(uri: vscode.Uri): void {
	diagnosticCollection.delete(uri)
}

function babelLocToRange(loc: { start: { line: number, column: number }, end: { line: number, column: number } }): vscode.Range {
	return new vscode.Range(loc.start.line - 1, loc.start.column, loc.end.line - 1, loc.end.column)
}

/** Expand a zero-width (point) range to cover the full line content. */
function expandToLine(range: vscode.Range, document: vscode.TextDocument): vscode.Range {
	if (!range.isEmpty) return range
	return document.lineAt(range.start.line).range
}

function makeDiagnostic(
	error: nodes.ErrorNode,
	fallback: vscode.Range,
	document: vscode.TextDocument,
): vscode.Diagnostic {
	let range = error.loc ? babelLocToRange(error.loc) : fallback
	range = expandToLine(range, document)
	return new vscode.Diagnostic(range, error.reason, vscode.DiagnosticSeverity.Error)
}
