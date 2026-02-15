import * as fs from 'node:fs'
import path from 'node:path'

import * as vscode from 'vscode'

// ── Types ────────────────────────────────────────────────────

export interface JsonTokenColors {
	key?: string
	string?: string
	number?: string
	keyword?: string
	punctuation?: string
}

interface ThemeTokenRule {
	scope?: string | string[]
	settings?: { foreground?: string }
}

interface ThemeData {
	include?: string
	tokenColors?: ThemeTokenRule[]
}

// ── JSON → syntax-highlighted HTML ──────────────────────────

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

export function isJsonContentType(contentType: string): boolean {
	const mime = contentType.split(';')[0].trim().toLowerCase()
	return mime === 'application/json' || mime.endsWith('+json')
}

/**
 * Recursively converts a parsed JSON value into syntax-highlighted HTML.
 * Uses CSS classes that map to VS Code's theme-aware token color variables.
 */
function jsonValueToHtml(value: unknown, indent: number): string {
	const nextIndent = indent + 1
	const pad = '  '.repeat(indent)
	const padInner = '  '.repeat(nextIndent)

	if (value === null) {
		return '<span class="json-keyword">null</span>'
	}
	if (typeof value === 'boolean') {
		return `<span class="json-keyword">${value}</span>`
	}
	if (typeof value === 'number') {
		return `<span class="json-number">${value}</span>`
	}
	if (typeof value === 'string') {
		return `<span class="json-string">${escapeHtml(JSON.stringify(value))}</span>`
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return '<span class="json-punctuation">[]</span>'
		const items = value.map(item =>
			`${padInner}${jsonValueToHtml(item, nextIndent)}`,
		).join('<span class="json-punctuation">,</span>\n')
		return `<span class="json-punctuation">[</span>\n${items}\n${pad}<span class="json-punctuation">]</span>`
	}
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
		if (entries.length === 0) return '<span class="json-punctuation">{}</span>'
		const items = entries.map(([key, property]) =>
			`${padInner}<span class="json-key">${escapeHtml(JSON.stringify(key))}</span><span class="json-punctuation">:</span> ${jsonValueToHtml(property, nextIndent)}`,
		).join('<span class="json-punctuation">,</span>\n')
		return `<span class="json-punctuation">{</span>\n${items}\n${pad}<span class="json-punctuation">}</span>`
	}
	return escapeHtml(JSON.stringify(value))
}

export function colorizeJson(body: string): string {
	try {
		const parsed: unknown = JSON.parse(body)
		return jsonValueToHtml(parsed, 0)
	}
	catch {
		return escapeHtml(body)
	}
}

// ── Theme-based JSON token color resolution ─────────────────

/** The actual TextMate scopes VS Code's JSON grammar assigns to each token type. */
const jsonTargetScopes: Record<keyof JsonTokenColors, string> = {
	key: 'support.type.property-name.json',
	string: 'string.quoted.double.json',
	number: 'constant.numeric.json',
	keyword: 'constant.language.json',
	punctuation: 'punctuation.definition.dictionary.begin.json',
}

/** Strip single-line and multi-line comments from JSONC, preserving strings. */
function stripJsonComments(text: string): string {
	return text.replaceAll(
		/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
		(match, group: string | undefined) => (group ? '' : match),
	)
}

function readThemeFile(filePath: string): ThemeData | undefined {
	try {
		const raw = fs.readFileSync(filePath, 'utf8')
		const cleaned = stripJsonComments(raw).replaceAll(/,\s*([}\]])/g, '$1')
		return JSON.parse(cleaned) as ThemeData
	}
	catch {
		return undefined
	}
}

/** Recursively collect tokenColors from a theme and its `include` chain. */
function collectTokenColors(themePath: string, depth = 0): ThemeTokenRule[] {
	if (depth > 5) return []

	const theme = readThemeFile(themePath)
	if (!theme) return []

	let baseColors: ThemeTokenRule[] = []
	if (theme.include) {
		const includePath = path.resolve(path.dirname(themePath), theme.include)
		baseColors = collectTokenColors(includePath, depth + 1)
	}

	return [...baseColors, ...(theme.tokenColors ?? [])]
}

/** Find the JSON file for the currently active VS Code color theme. */
function findActiveThemePath(): string | undefined {
	const themeName = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme')
	if (!themeName) return undefined

	for (const extension of vscode.extensions.all) {
		const packageJson = extension.packageJSON as Record<string, unknown> | undefined
		const contributes = packageJson?.contributes as Record<string, unknown> | undefined
		const themes = contributes?.themes as
			| Array<{ id?: string, label?: string, path: string }>
			| undefined
		if (!themes) continue

		for (const theme of themes) {
			if (theme.id === themeName || theme.label === themeName) {
				return path.join(extension.extensionPath, theme.path)
			}
		}
	}

	return undefined
}

/**
 * TextMate scope matching: a rule scope `"string"` matches target `"string.quoted.double.json"`
 * because `string` is a dot-prefix of the target. The most specific (longest) match wins.
 */
function resolveTokenColor(tokenColors: ThemeTokenRule[], targetScope: string): string | undefined {
	let bestMatch: string | undefined
	let bestSpecificity = -1

	for (const rule of tokenColors) {
		if (!rule.settings?.foreground) continue
		const scopes = Array.isArray(rule.scope)
			? rule.scope
			: (rule.scope ? [rule.scope] : [])

		for (const scope of scopes) {
			if (!scope) continue
			if (targetScope === scope || targetScope.startsWith(scope + '.')) {
				const specificity = scope.split('.').length
				if (specificity > bestSpecificity) {
					bestSpecificity = specificity
					bestMatch = rule.settings.foreground
				}
			}
		}
	}

	return bestMatch
}

/**
 * Read the active VS Code theme and resolve the actual JSON syntax colors.
 * Falls back gracefully — returns an empty object if the theme can't be read.
 */
export function resolveJsonTokenColors(): JsonTokenColors {
	const result: JsonTokenColors = {}

	try {
		const themePath = findActiveThemePath()
		if (!themePath) return result

		const tokenColors = collectTokenColors(themePath)
		if (tokenColors.length === 0) return result

		// Layer user-level tokenColor overrides on top
		const customizations = vscode.workspace
			.getConfiguration('editor')
			.get<{ textMateRules?: ThemeTokenRule[] }>('tokenColorCustomizations')
		if (customizations?.textMateRules) {
			tokenColors.push(...customizations.textMateRules)
		}

		for (const [key, targetScope] of Object.entries(jsonTargetScopes)) {
			const color = resolveTokenColor(tokenColors, targetScope)
			if (color) {
				result[key as keyof JsonTokenColors] = color
			}
		}
	}
	catch {
		// Fall through — CSS fallback variables will be used
	}

	return result
}
