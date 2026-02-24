import * as vscode from 'vscode'

import { allowedMethods, parseHttpMethod } from '@slng/definition/extension'

import type { ExtensionContext } from '../context.js'

const DIAGNOSTIC_SOURCE = 'sling'
export const MISSING_CONTENT_TYPE_CODE = 'missing-content-type'
export const INVALID_METHOD_CODE = 'invalid-http-method'

const SLING_TEMPLATE_RE = /\bsling\s*`/g
const CONTENT_TYPE_RE = /^[ \t]*[Cc]ontent-[Tt]ype:/m
const BLANK_LINE_RE = /\n[ \t]*\n/

// Flat set of all valid HTTP methods across every supported protocol.
const VALID_METHODS = new Set<string>(
	(Object.values(allowedMethods) as ReadonlyArray<readonly string[]>).flat(),
)

interface TemplateSpan {
	contentStart: number
	contentEnd: number
	content: string
}

function findSlingTemplates(text: string): TemplateSpan[] {
	const templates: TemplateSpan[] = []
	SLING_TEMPLATE_RE.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = SLING_TEMPLATE_RE.exec(text)) !== null) {
		const contentStart = match.index + match[0].length
		let pos = contentStart
		while (pos < text.length) {
			if (text[pos] === '\\') { pos += 2; continue }
			if (text[pos] === '`') break
			pos++
		}
		templates.push({ contentStart, contentEnd: pos, content: text.slice(contentStart, pos) })
	}
	return templates
}

function diagnoseDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
	if (!document.fileName.endsWith('.mts')) return []

	const text = document.getText()
	const diagnostics: vscode.Diagnostic[] = []

	for (const { contentStart, content } of findSlingTemplates(text)) {

		// ── Invalid HTTP method ───────────────────────────────────────────
		const methodResult = parseHttpMethod(content)
		if (methodResult.type === 'method' && !VALID_METHODS.has(methodResult.value.toUpperCase())) {
			const methodOffset = contentStart + methodResult.offset
			const methodStart = document.positionAt(methodOffset)
			const methodEnd = document.positionAt(methodOffset + methodResult.length)
			const diag = new vscode.Diagnostic(
				new vscode.Range(methodStart, methodEnd),
				`"${methodResult.value}" is not a valid HTTP method. Allowed: ${[...VALID_METHODS].join(', ')}.`,
				vscode.DiagnosticSeverity.Error,
			)
			diag.source = DIAGNOSTIC_SOURCE
			diag.code = INVALID_METHOD_CODE
			diagnostics.push(diag)
		}

		// ── Missing Content-Type for JSON body ────────────────────────────
		const blankMatch = BLANK_LINE_RE.exec(content)
		if (!blankMatch) continue

		const headersSection = content.slice(0, blankMatch.index)
		if (CONTENT_TYPE_RE.test(headersSection)) continue

		const bodySection = content.slice(blankMatch.index + blankMatch[0].length)

		// Blank out ${...} so template expressions don't interfere with the check
		const sanitizedBody = bodySection.replace(/\$\{[^}]*\}/g, (m) => ' '.repeat(m.length))

		// Only warn when the first non-empty body line starts a JSON object or array
		const firstBodyTokenMatch = /^[ \t]*([{\[])/m.exec(sanitizedBody)
		if (!firstBodyTokenMatch) continue

		const tokenOffsetInBody = firstBodyTokenMatch.index + firstBodyTokenMatch[0].indexOf(firstBodyTokenMatch[1])
		const diagOffset = contentStart + blankMatch.index + blankMatch[0].length + tokenOffsetInBody
		const diagPos = document.positionAt(diagOffset)
		const diagRange = new vscode.Range(diagPos, diagPos.translate(0, 1))

		const diag = new vscode.Diagnostic(
			diagRange,
			'JSON body detected but no Content-Type header is set.',
			vscode.DiagnosticSeverity.Warning,
		)
		diag.source = DIAGNOSTIC_SOURCE
		diag.code = MISSING_CONTENT_TYPE_CODE
		diagnostics.push(diag)
	}

	return diagnostics
}

class MissingContentTypeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(
		document: vscode.TextDocument,
		_range: vscode.Range,
		context: vscode.CodeActionContext,
	): vscode.CodeAction[] {
		const relevantDiag = context.diagnostics.find(
			(d) => d.source === DIAGNOSTIC_SOURCE && d.code === MISSING_CONTENT_TYPE_CODE,
		)
		if (!relevantDiag) return []

		const text = document.getText()
		for (const { contentStart, contentEnd, content } of findSlingTemplates(text)) {
			const templateRange = new vscode.Range(
				document.positionAt(contentStart),
				document.positionAt(contentEnd),
			)
			if (!templateRange.contains(relevantDiag.range)) continue

			const blankMatch = BLANK_LINE_RE.exec(content)
			if (!blankMatch) continue

			// Detect indentation from the first indented line in the template
			const indentMatch = /\n([ \t]+)\S/.exec(content)
			const indent = indentMatch?.[1] ?? '  '

			// Insert the new header line right before the blank-line separator
			const insertOffset = contentStart + blankMatch.index
			const insertPos = document.positionAt(insertOffset)

			const action = new vscode.CodeAction(
				'Add Content-Type: application/json',
				vscode.CodeActionKind.QuickFix,
			)
			action.diagnostics = [relevantDiag]
			action.isPreferred = true
			action.edit = new vscode.WorkspaceEdit()
			action.edit.insert(document.uri, insertPos, `\n${indent}Content-Type: application/json`)
			return [action]
		}

		return []
	}
}

export function registerDiagnostics(context: ExtensionContext): void {
	const collection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE)
	context.addSubscriptions(collection)

	function refresh(document: vscode.TextDocument): void {
		if (!document.fileName.endsWith('.mts')) return
		collection.set(document.uri, diagnoseDocument(document))
	}

	// Diagnose all documents already open when the extension activates
	for (const document of vscode.workspace.textDocuments) refresh(document)

	context.addSubscriptions(
		vscode.workspace.onDidOpenTextDocument(refresh),
		vscode.workspace.onDidChangeTextDocument((e) => refresh(e.document)),
		vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
		vscode.languages.registerCodeActionsProvider(
			{ language: 'typescript', pattern: '**/*.mts' },
			new MissingContentTypeActionProvider(),
			{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
		),
	)
}
