import * as fs from 'node:fs'
import path from 'node:path'

import { SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

import { ExtensionContext } from '../context'

// TODO figure out a way to add time and bytes https://github.com/rhaldkhein/vscode-xrest-client/tree/master
export class ResponseViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'sling.responseDetails'

	private view!: vscode.WebviewView
	private scriptUri!: vscode.Uri
	private styleUri!: vscode.Uri
	private readonly nonces: Record<string, string> = {}

	private config: vscode.WorkspaceConfiguration
	private readonly extensionUri: vscode.Uri
	private readonly distPath: vscode.Uri
	private readonly scriptPath: vscode.Uri
	private readonly stylePath: vscode.Uri

	private jsonColors: JsonTokenColors = {}
	private currentReference: string | undefined

	constructor(
		private readonly context: ExtensionContext,
		extensionUri: vscode.Uri,
	) {
		this.config = vscode.workspace.getConfiguration('slng')
		this.extensionUri = extensionUri
		this.distPath = vscode.Uri.joinPath(extensionUri, 'dist')
		this.scriptPath = vscode.Uri.joinPath(this.distPath, 'response.webview.global.js')
		this.stylePath = vscode.Uri.joinPath(this.distPath, 'response.webview.css')

		this.jsonColors = resolveJsonTokenColors()

		context.addSubscriptions(
			vscode.window.onDidChangeActiveColorTheme(() => {
				this.jsonColors = resolveJsonTokenColors()
				if (this.currentReference && this.view) {
					this.update(this.currentReference)
				}
			}),
		)
	}

	resolveWebviewView(view: vscode.WebviewView) {
		this.context.log.debug('resolveWebviewView')
		this.view = view

		this.scriptUri = view.webview.asWebviewUri(this.scriptPath)!
		this.styleUri = view.webview.asWebviewUri(this.stylePath)!
		this.nonces.js = getNonce()
		this.nonces.css = getNonce()

		view.webview.options = {
			enableScripts: true,
			enableCommandUris: true,
			localResourceRoots: [
				this.extensionUri,
				vscode.Uri.file(this.styleUri.fsPath),
				vscode.Uri.file(this.scriptPath.fsPath),
			],
		}
		view.webview.html = this.noSelectionView()
	}

	public hide() {
		this.context.log.warn('TODO', 'Figure out if closing is possible')
	}

	public show() {
		const maskSecrets = this.config.get<boolean>('maskSecrets', true)
		this.context.log.info('shouldmask', maskSecrets)
		this.view.show(false)
	}

	// TODO do we want to show more information when no response? Maybe a send button?
	public update(reference: string | undefined) {
		this.context.log.info('update', reference)
		this.currentReference = reference
		if (!this.view) return this.context.log.warn('ResponseView not resolved!')

		if (!reference) return this.noSelectionView()
		if (!this.context.state.includesKey(reference)) return this.noSelectionView()

		const referencedResponse = this.context.state.get<SlingResponse>(reference)
		this.view.webview.html = this.responseView(referencedResponse)
	}

	private buildJsonColorOverrides(): string {
		const properties = Object.entries(this.jsonColors)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => `--json-${key}-color: ${value};`)
		if (properties.length === 0) return ''
		return `<style nonce="${this.nonces.css}">:root { ${properties.join(' ')} }</style>`
	}

	private wrapHtml(html: string) {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
			-->
			<meta http-equiv="Content-Security-Policy" content="
				default-src 'none';
				style-src ${this.view.webview.cspSource} 'nonce-${this.nonces.css}' 'unsafe-inline';
				img-src ${this.view.webview.cspSource} https:;
				script-src 'nonce-${this.nonces.js}';
			">
			<link nonce="${this.nonces.css}" rel="stylesheet" href="${this.styleUri.toString()}" />
			${this.buildJsonColorOverrides()}
			<script nonce="${this.nonces.js}" src="${this.scriptUri.toString()}"></script>
		</head>
		<body id="response-view">${html}</body>
		</html>`
	}

	private noSelectionView() {
		const view = `
		<h2>No request selected</h2>
		<vscode-divider></vscode-divider>
		<p>Please execute a request, or select <vscode-tag>show details</vscode-tag> to load infromation in this panel.</p>
	`

		return this.wrapHtml(view)
	}

	private responseView(response: SlingResponse) {
		const { request } = response
		const view = `
			<h2>${response.request.name}</h2>
			<vscode-divider></vscode-divider>
			<!-- TODO solve with css -->
			<p></p>

			<!-- TODO make RESPONSE regular case and fix with css -->
			<!-- TODO make REQUEST regular case and fix with css -->
			<vscode-panels aria-label="Request information">
				<vscode-panel-tab id="tab-response">
					RESPONSE
					<vscode-badge appearance="secondary">${response.status}</vscode-badge>
				</vscode-panel-tab>
				<vscode-panel-tab id="tab-request">REQUEST</vscode-panel-tab>
				<vscode-panel-view id="view-response">
					<div>
						<div style="position: absolute; right: 1px;"><copy-button></copy-button></div>
						<div class="response-data">${buildResponseDisplay(response)}</div>
					</div>
				</vscode-panel-view>
				<vscode-panel-view id="view-request">
					<pre>${JSON.stringify(request.parsed, undefined, 2)}</pre>
				</vscode-panel-view>
			</vscode-panels>
		`

		return this.wrapHtml(view)
	}
}

/** https://en.wikipedia.org/wiki/HTTP#Example */
function buildResponseDisplay(response: SlingResponse) {
	const startLine = `${response.request.parsed.httpVersion} ${response.status} ${response.statusText}`
	// TODO this may later contain masked values too
	const headers = Object.entries(response.headers)
		.map(([key, value]) => {
			return `<tr>
				<td class="header-key">${key}:&nbsp;</td>
				<td class="header-value">${value}</td>
			</tr>`
		})
		.join('\n').replaceAll('\t', '')

	// TODO this may later contain masked values too
	const contentType = response.headers['content-type'] ?? ''
	const body = isJsonContentType(contentType)
		? colorizeJson(response.body)
		: escapeHtml(response.body)

	return [
		`<pre class="start-line">${startLine}</pre>`,
		`<div class="headers"><table>${headers}</table></div>`,
		`<br />`,
		`<pre class="body">${body}</pre>`,
	].join('')
}

// /** https://en.wikipedia.org/wiki/HTTP#Example */
// function buildRequestDisplay(request: RequestReference) {
// 	const startLine = `${request.parsed.method} ${request.parsed.url} ${request.parsed.httpVersion}`
// 	// TODO this may later contain masked values too
// 	const headers = Object.entries(request.template.values)
// 		.map(([key, value]) => {
// 			return `<tr>
// 				<td class="header-key">${key}:&nbsp;</td>
// 				<td class="header-value">${value}</td>
// 			</tr>`
// 		})
// 		.join('\n').replaceAll('\t', '')

// 	// TODO this may later contain masked values too
// 	// TODO color format when JSON or XML/HTML
// 	const body = response.body

// 	return [
// 		`<pre class="start-line">${startLine}</pre>`,
// 		`<div class="headers"><table>${headers}</table></div>`,
// 		`<br />`,
// 		`<pre class="body">${body}</pre>`,
// 	].join('')
// }

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

function isJsonContentType(contentType: string): boolean {
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

function colorizeJson(body: string): string {
	try {
		const parsed: unknown = JSON.parse(body)
		return jsonValueToHtml(parsed, 0)
	}
	catch {
		return escapeHtml(body)
	}
}

// ── Theme-based JSON token color resolution ──────────────────

interface JsonTokenColors {
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
function resolveJsonTokenColors(): JsonTokenColors {
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

function getNonce() {
	let text = ''
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	for (let index = 0; index < 32; index++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}

export function registerResponseView(
	context: ExtensionContext,
	extensionUri: vscode.Uri,
) {
	const responseViewProvider = new ResponseViewProvider(context, extensionUri)
	context.addSubscriptions(
		vscode.window.registerWebviewViewProvider(
			ResponseViewProvider.viewType,
			responseViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			},
		),
	)
	return responseViewProvider
}
