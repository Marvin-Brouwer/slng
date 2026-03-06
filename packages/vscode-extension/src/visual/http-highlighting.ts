import { isSlingDefinition } from '@slng/definition/extension'
import { httpNodes, jsonNodes } from '@slng/definition/nodes'
import * as vscode from 'vscode'

import { resolveJsonTokenColors } from '../response-panel/components/body-display.json.webview.js'

// ── HTTP structure decorations ────────────────────────────────────────────────

const httpBoldDecoration = vscode.window.createTextEditorDecorationType({
	color: new vscode.ThemeColor('editor.foreground'),
	fontWeight: 'bold',
})

const httpNormalDecoration = vscode.window.createTextEditorDecorationType({
	color: new vscode.ThemeColor('editor.foreground'),
	fontStyle: 'italic'
})

const httpDefaultDecoration = vscode.window.createTextEditorDecorationType({
	color: new vscode.ThemeColor('editor.foreground'),
})

// ── JSON body decorations (theme-aware, recreated on theme change) ────────────

interface JsonDecorations {
	key: vscode.TextEditorDecorationType
	string: vscode.TextEditorDecorationType
	number: vscode.TextEditorDecorationType
	keyword: vscode.TextEditorDecorationType
	punctuation: vscode.TextEditorDecorationType
	brackets: vscode.TextEditorDecorationType[]
}

let _jsonDecorations: JsonDecorations | undefined

function getJsonDecorations(): JsonDecorations {
	if (_jsonDecorations) return _jsonDecorations
	const colors = resolveJsonTokenColors()
	const editorFg = new vscode.ThemeColor('editor.foreground')
	_jsonDecorations = {
		key: vscode.window.createTextEditorDecorationType({ color: colors.key ?? editorFg }),
		string: vscode.window.createTextEditorDecorationType({ color: colors.string ?? editorFg }),
		number: vscode.window.createTextEditorDecorationType({ color: colors.number ?? editorFg }),
		keyword: vscode.window.createTextEditorDecorationType({ color: colors.keyword ?? editorFg }),
		punctuation: vscode.window.createTextEditorDecorationType({ color: colors.punctuation ?? editorFg }),
		brackets: (colors.bracketColors ?? []).map(c =>
			vscode.window.createTextEditorDecorationType({ color: c })),
	}
	return _jsonDecorations
}

function disposeJsonDecorations(): void {
	if (!_jsonDecorations) return
	_jsonDecorations.key.dispose()
	_jsonDecorations.string.dispose()
	_jsonDecorations.number.dispose()
	_jsonDecorations.keyword.dispose()
	_jsonDecorations.punctuation.dispose()
	for (const b of _jsonDecorations.brackets) b.dispose()
	_jsonDecorations = undefined
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Loc = { start: { line: number, column: number }, end: { line: number, column: number } }

/** Converts a babel-convention loc (1-based line, 0-based column) to a vscode.Range. */
function locToRange(loc: Loc): vscode.Range {
	return new vscode.Range(loc.start.line - 1, loc.start.column, loc.end.line - 1, loc.end.column)
}

/** Returns character spans of `${...}` expressions, with depth-aware brace matching. */
function findInterpolationSpans(text: string): { start: number, end: number }[] {
	const spans: { start: number, end: number }[] = []
	let index = 0
	while (index < text.length) {
		if (text[index] === '$' && text[index + 1] === '{') {
			const start = index
			let depth = 1
			index += 2
			while (index < text.length && depth > 0) {
				if (text[index] === '{') depth++
				else if (text[index] === '}') depth--
				index++
			}
			spans.push({ start, end: index })
		}
		else {
			index++
		}
	}
	return spans
}

/** Returns vscode.Ranges covering the non-`${...}` portions of a line. */
function getLiteralRanges(lineText: string, lineNumber: number, startCol = 0): vscode.Range[] {
	const segment = lineText.slice(startCol)
	const spans = findInterpolationSpans(segment)
	const ranges: vscode.Range[] = []
	let pos = 0
	for (const span of spans) {
		if (pos < span.start) {
			ranges.push(new vscode.Range(lineNumber, startCol + pos, lineNumber, startCol + span.start))
		}
		pos = span.end
	}
	if (pos < segment.length) {
		ranges.push(new vscode.Range(lineNumber, startCol + pos, lineNumber, startCol + segment.length))
	}
	return ranges
}

// ── JSON AST walker ───────────────────────────────────────────────────────────

interface JsonRanges {
	key: vscode.Range[]
	string: vscode.Range[]
	number: vscode.Range[]
	keyword: vscode.Range[]
	punctuation: vscode.Range[]
	brackets: vscode.Range[][]
}

function walkJsonNode(node: jsonNodes.JsonAstNode, depth: number, out: JsonRanges): void {
	if (!node.loc) return

	if (node.type === 'json:string') {
		for (const part of node.parts) {
			if (part.type === 'json:punctuation' || part.type === 'json:value')
				walkJsonNode(part, depth, out)
			// json:masked:* — skip
		}
		return
	}
	if (node.type === 'json:number') {
		for (const part of node.parts) {
			if (part.type === 'json:value')
				walkJsonNode(part, depth, out)
			// json:masked:* — skip
		}
		return
	}
	if (node.type === 'json:value') {
		const r = locToRange(node.loc as Loc)
		if (node.variant === 'key') out.key.push(r)
		else out.string.push(r)
		return
	}
	if (node.type === 'json:boolean' || node.type === 'json:null') {
		out.keyword.push(locToRange(node.loc as Loc))
		return
	}
	if (node.type === 'json:punctuation') {
		const r = locToRange(node.loc as Loc)
		if (node.value === '"') {
			if (node.variant === 'key') out.key.push(r)
			else out.string.push(r)
		}
		else if (node.value === '{' || node.value === '}' || node.value === '[' || node.value === ']') {
			const bracketIndex = depth % 6
			if (!out.brackets[bracketIndex]) out.brackets[bracketIndex] = []
			out.brackets[bracketIndex].push(r)
		}
		else {
			out.punctuation.push(r)
		}
		return
	}
	if (node.type === 'json:object') {
		for (const child of node.children) {
			walkJsonNode(child, child.type === 'json:punctuation' ? depth : depth + 1, out)
		}
		return
	}
	if (node.type === 'json:array') {
		for (const item of node.items) {
			walkJsonNode(item, item.type === 'json:punctuation' ? depth : depth + 1, out)
		}
		return
	}
	// json:whitespace,
	// json:comment,
	// json:unknown,
	// json:masked:*,
	// are skipped
}

function walkJsonNodes(nodes: jsonNodes.JsonAstNode[], depth: number, out: JsonRanges): void {
	for (const node of nodes) walkJsonNode(node, depth, out)
}

// ── Main exports ──────────────────────────────────────────────────────────────

export function updateHttpHighlighting(
	editor: vscode.TextEditor,
	definitions: Record<string, unknown>,
): void {
	const boldRanges: vscode.Range[] = []
	const normalRanges: vscode.Range[] = []
	const defaultRanges: vscode.Range[] = []
	const jsonRanges: JsonRanges = { key: [], string: [], number: [], keyword: [], punctuation: [], brackets: [] }

	for (const definition of Object.values(definitions)) {
		if (!isSlingDefinition(definition)) continue
		const { protocolAst } = definition.getInternals()
		if (!protocolAst || protocolAst.type !== 'http') continue

		const document = protocolAst as httpNodes.HttpDocument
		if (!document.loc) continue

		const { startLine, headers, body } = document

		// 0. Backticks — editor default color
		if (document.loc) {
			const openLine = document.loc.start.line - 1
			const openCol = document.loc.start.column
			defaultRanges.push(new vscode.Range(openLine, openCol, openLine, openCol + 1))
			const closeLine = (document.loc.end as { line: number }).line - 1
			const closeCol = (document.loc.end as { column: number }).column - 1
			defaultRanges.push(new vscode.Range(closeLine, closeCol, closeLine, closeCol + 1))
		}

		// 1. Start line — all literal text is bold
		if (startLine.type === 'request' && startLine.loc) {
			const line = startLine.loc.start.line - 1
			const startCol = startLine.loc.start.column
			if (line >= 0 && line < editor.document.lineCount) {
				boldRanges.push(...getLiteralRanges(editor.document.lineAt(line).text, line, startCol))
			}
		}

		// 2. Headers — key is bold, value literal parts are normal
		if (headers) {
			for (const headerNode of headers) {
				if (headerNode.type === 'error' || !headerNode.loc) continue
				const line = headerNode.loc.start.line - 1
				if (line < 0 || line >= editor.document.lineCount) continue
				const lineText = editor.document.lineAt(line).text
				const colonIndex = lineText.indexOf(':')
				if (colonIndex === -1) continue
				boldRanges.push(new vscode.Range(line, headerNode.loc.start.column, line, colonIndex + 1))
				normalRanges.push(...getLiteralRanges(lineText, line, colonIndex + 1))
			}
		}

		// 3. Body highlighting by content type
		if (body && body.loc) {
			if (body.value?.type?.startsWith('json:')) {
				// JSON (and JSON-like) body: walk AST nodes with positions
				const jsonDocument = body.value as jsonNodes.JsonDocument
				if (jsonDocument.value) {
					walkJsonNodes(jsonDocument.value, 0, jsonRanges)
				}
			}
			else {
				// text/plain (or missing/unsupported content type): override all literal text to default foreground
				const bodyStart = body.loc.start.line - 1
				const documentEndLine = (document.loc.end as { line: number }).line - 1 // 0-based backtick line
				for (let line = bodyStart; line < documentEndLine; line++) {
					if (line < 0 || line >= editor.document.lineCount) continue
					normalRanges.push(...getLiteralRanges(editor.document.lineAt(line).text, line))
				}
			}
		}
	}

	editor.setDecorations(httpBoldDecoration, boldRanges)
	editor.setDecorations(httpNormalDecoration, normalRanges)
	editor.setDecorations(httpDefaultDecoration, defaultRanges)

	// Apply JSON decorations
	const jsonDecs = getJsonDecorations()
	editor.setDecorations(jsonDecs.key, jsonRanges.key)
	editor.setDecorations(jsonDecs.string, jsonRanges.string)
	editor.setDecorations(jsonDecs.number, jsonRanges.number)
	editor.setDecorations(jsonDecs.keyword, jsonRanges.keyword)
	editor.setDecorations(jsonDecs.punctuation, jsonRanges.punctuation)
	for (let index = 0; index < jsonDecs.brackets.length; index++) {
		editor.setDecorations(jsonDecs.brackets[index], jsonRanges.brackets[index] ?? [])
	}
}

export function clearHttpHighlighting(editor: vscode.TextEditor): void {
	editor.setDecorations(httpBoldDecoration, [])
	editor.setDecorations(httpNormalDecoration, [])
	editor.setDecorations(httpDefaultDecoration, [])
	if (_jsonDecorations) {
		editor.setDecorations(_jsonDecorations.key, [])
		editor.setDecorations(_jsonDecorations.string, [])
		editor.setDecorations(_jsonDecorations.number, [])
		editor.setDecorations(_jsonDecorations.keyword, [])
		editor.setDecorations(_jsonDecorations.punctuation, [])
		for (const b of _jsonDecorations.brackets) editor.setDecorations(b, [])
	}
}

/** Call when the active color theme changes so JSON decoration colors are refreshed. */
export function refreshJsonHighlighting(): void {
	disposeJsonDecorations()
}

export function disposeHttpHighlighting(): void {
	httpBoldDecoration.dispose()
	httpNormalDecoration.dispose()
	httpDefaultDecoration.dispose()
	disposeJsonDecorations()
}
