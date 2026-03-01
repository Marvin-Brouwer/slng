import { isSlingDefinition } from '@slng/definition/extension'
import { httpNodes, nodes } from '@slng/definition/nodes'
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
		else if (protocolAst.type === 'http') {
			all.push(...walkHttpDocument(protocolAst as httpNodes.HttpDocument, fallback, vscDocument))
		}
	}

	diagnosticCollection.set(uri, all)
}

export function clearDiagnostics(uri: vscode.Uri): void {
	diagnosticCollection.delete(uri)
}

function walkHttpDocument(
	document: httpNodes.HttpDocument,
	fallback: vscode.Range,
	vscDocument: vscode.TextDocument,
): vscode.Diagnostic[] {
	const diagnostics: vscode.Diagnostic[] = []
	const documentRange = document.loc ? babelLocToRange(document.loc) : fallback

	// Request line
	const sl = document.startLine
	if (sl.type === 'error') {
		diagnostics.push(makeDiagnostic(sl, documentRange, vscDocument))
	}
	else if (sl.type === 'request') {
		const slRange = sl.loc ? expandToLine(babelLocToRange(sl.loc), vscDocument) : documentRange
		if (sl.method.type === 'error') diagnostics.push(makeDiagnostic(sl.method, slRange, vscDocument))
		if (sl.url.type === 'error') diagnostics.push(makeDiagnostic(sl.url, slRange, vscDocument))
		if (sl.protocol.type === 'error') diagnostics.push(makeDiagnostic(sl.protocol, slRange, vscDocument))
	}

	// Headers
	for (const h of document.headers ?? []) {
		if (h.type === 'error') {
			diagnostics.push(makeDiagnostic(h, documentRange, vscDocument))
		}
		else {
			const hRange = h.loc ? expandToLine(babelLocToRange(h.loc), vscDocument) : documentRange
			if (h.name.type === 'error') diagnostics.push(makeDiagnostic(h.name, hRange, vscDocument))
			if (h.value.type === 'error') diagnostics.push(makeDiagnostic(h.value, hRange, vscDocument))
		}
	}

	// Metadata errors (e.g. missing leading/trailing newline)
	for (const error of document.metadata.errors ?? []) {
		diagnostics.push(makeDiagnostic(error, documentRange, vscDocument))
	}

	return diagnostics
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
