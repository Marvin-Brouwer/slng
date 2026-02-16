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
	bracketColors?: string[]
}

interface ThemeTokenRule {
	scope?: string | string[]
	settings?: { foreground?: string }
}

interface ThemeData {
	include?: string
	tokenColors?: ThemeTokenRule[]
	colors?: Record<string, string>
}

interface CollectedThemeData {
	tokenColors: ThemeTokenRule[]
	colors: Record<string, string>
}

const MAX_BRACKET_PAIR_COLORS = 6

const bracketColorKeys = Array.from(
	{ length: MAX_BRACKET_PAIR_COLORS },
	(_, index) => `editorBracketHighlight.foreground${index + 1}`,
)

/**
 * VS Code's hardcoded bracket pair color defaults.
 * These are built into the editor and not present in theme JSON files.
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/core/editorColorRegistry.ts
 */
const defaultBracketColors: Record<'dark' | 'light', string[]> = {
	dark: ['#FFD700', '#DA70D6', '#179FFF'],
	light: ['#0431FA', '#319331', '#7B3814'],
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

/** Bracket class for the given nesting depth, cycling through 1–6. */
function bracketClass(depth: number): string {
	return `json-bracket json-bracket-${(depth % MAX_BRACKET_PAIR_COLORS) + 1}`
}

/**
 * Recursively converts a parsed JSON value into syntax-highlighted HTML.
 * Uses CSS classes that map to VS Code's theme-aware token color variables.
 * Brackets/braces get depth-based classes for bracket pair colorization.
 */
function jsonValueToHtml(value: unknown, indent: number): string {
	const nextIndent = indent + 1
	const pad = '  '.repeat(indent)
	const padInner = '  '.repeat(nextIndent)
	const bc = bracketClass(indent)

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
		if (value.length === 0) return `<span class="${bc}">[]</span>`
		const items = value.map(item =>
			`${padInner}${jsonValueToHtml(item, nextIndent)}`,
		).join('<span class="json-punctuation">,</span>\n')
		return `<span class="${bc}">[</span>\n${items}\n${pad}<span class="${bc}">]</span>`
	}
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
		if (entries.length === 0) return `<span class="${bc}">{}</span>`
		const items = entries.map(([key, property]) =>
			`${padInner}<span class="json-key">${escapeHtml(JSON.stringify(key))}</span><span class="json-punctuation">:</span> ${jsonValueToHtml(property, nextIndent)}`,
		).join('<span class="json-punctuation">,</span>\n')
		return `<span class="${bc}">{</span>\n${items}\n${pad}<span class="${bc}">}</span>`
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
type TokenColorKey = Exclude<keyof JsonTokenColors, 'bracketColors'>
const jsonTargetScopes: Record<TokenColorKey, string> = {
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

/** Recursively collect tokenColors and workbench colors from a theme and its `include` chain. */
function collectThemeData(themePath: string, depth = 0): CollectedThemeData {
	if (depth > 5) return { tokenColors: [], colors: {} }

	const theme = readThemeFile(themePath)
	if (!theme) return { tokenColors: [], colors: {} }

	let base: CollectedThemeData = { tokenColors: [], colors: {} }
	if (theme.include) {
		const includePath = path.resolve(path.dirname(themePath), theme.include)
		base = collectThemeData(includePath, depth + 1)
	}

	return {
		tokenColors: [...base.tokenColors, ...(theme.tokenColors ?? [])],
		colors: theme.colors ? { ...base.colors, ...theme.colors } : base.colors,
	}
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
 * Builds a `<style>` tag with CSS custom property overrides for JSON syntax colors,
 * resolved from the active VS Code theme. Returns an empty string if no colors are found.
 */
export function buildJsonColorOverrides(nonce: string): string {
	const colors = resolveJsonTokenColors()
	const properties: string[] = []

	for (const [key, value] of Object.entries(colors)) {
		if (key === 'bracketColors' || value === undefined) continue
		properties.push(`--json-${key}-color: ${value as string};`)
	}

	// Cycle bracket colors to fill all 6 slots (matching VS Code's cycling behavior)
	const { bracketColors } = colors
	if (bracketColors && bracketColors.length > 0) {
		for (let index = 0; index < MAX_BRACKET_PAIR_COLORS; index++) {
			properties.push(`--json-bracket-${index + 1}-color: ${bracketColors[index % bracketColors.length]};`)
		}
	}

	if (properties.length === 0) return ''
	return `<style nonce="${nonce}">:root { ${properties.join(' ')} }</style>`
}

/**
 * Read the active VS Code theme and resolve the actual JSON syntax colors.
 * Falls back gracefully — returns an empty object if the theme can't be read.
 */
function resolveJsonTokenColors(): JsonTokenColors {
	const result: JsonTokenColors = {}

	try {
		const themePath = findActiveThemePath()
		if (!themePath) return result

		const themeData = collectThemeData(themePath)

		// ── Token colors (TextMate scopes) ──
		const { tokenColors } = themeData
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
				result[key as TokenColorKey] = color
			}
		}

		// ── Bracket pair colors (workbench colors) ──
		const bracketColorization = vscode.workspace
			.getConfiguration('editor')
			.get<boolean>('bracketPairColorization.enabled', true)

		if (bracketColorization) {
			const userColorOverrides = vscode.workspace
				.getConfiguration('workbench')
				.get<Record<string, string>>('colorCustomizations') ?? {}

			const bracketColors: string[] = []
			for (const key of bracketColorKeys) {
				const color = userColorOverrides[key] ?? themeData.colors[key]
				if (color) bracketColors.push(color)
			}

			if (bracketColors.length > 0) {
				result.bracketColors = bracketColors
			}
			else {
				// Built-in themes don't define these in their JSON — use VS Code's hardcoded defaults
				const themeKind = vscode.window.activeColorTheme.kind
				const isLight = themeKind === vscode.ColorThemeKind.Light
					|| themeKind === vscode.ColorThemeKind.HighContrastLight
				result.bracketColors = isLight ? defaultBracketColors.light : defaultBracketColors.dark
			}
		}
	}
	catch {
		// Fall through — CSS fallback variables will be used
	}

	return result
}
