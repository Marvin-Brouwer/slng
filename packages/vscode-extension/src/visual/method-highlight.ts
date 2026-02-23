import * as vscode from 'vscode'

import { parseHttpMethod } from '@slng/definition/extension'

import type { ExtensionContext } from '../context'
import { bodyTokenProviders, resolveBodyTokenProvider, TOKEN_TYPE } from './body-tokens/body-token-provider.js'

/**
 * Semantic token legend.
 *
 * Index positions MUST match TOKEN_TYPE constants in body-token-provider.ts:
 *   0 → httpMethod  (custom, mapped to storage.type via semanticTokenScopes)
 *   1 → property    (standard — JSON keys)
 *   2 → string      (standard — JSON string values)
 *   3 → number      (standard — JSON numbers)
 *   4 → keyword     (standard — true / false / null)
 *   5 → comment     (standard — JSON comments)
 */
export const methodTokenLegend = new vscode.SemanticTokensLegend([
	'httpMethod',
	'property',
	'string',
	'number',
	'keyword',
	'comment',
])

/** Matches the start of a `sling\`` template literal. */
const SLING_TEMPLATE_RE = /\bsling\s*`/g

/**
 * Extract the body section from raw template content.
 *
 * Returns the body lines (with `${...}` replaced by spaces) and the
 * character offset within `templateContent` where the body begins.
 * Returns undefined when no blank-line separator exists.
 */
function extractBodyInfo(templateContent: string): {
	contentType: string | undefined
	bodyLines: string[]
	bodyStartOffset: number
} | undefined {
	// Find Content-Type header (literal value only — skip interpolated ones)
	const contentTypeMatch = /^[ \t]*[Cc]ontent-[Tt]ype:[ \t]*([^\n${}]+)/m.exec(templateContent)
	const contentType = contentTypeMatch?.[1]?.trim()

	// Blank line separator between headers and body
	const blankMatch = /\n[ \t]*\n/.exec(templateContent)
	if (!blankMatch) return undefined

	const bodyStartOffset = blankMatch.index + blankMatch[0].length
	const bodyText = templateContent.slice(bodyStartOffset)

	// Blank out ${...} so the body token providers never see partial expressions
	const sanitized = bodyText.replace(/\$\{[^}]*\}/g, (m) => ' '.repeat(m.length))

	return {
		contentType,
		bodyLines: sanitized.split('\n'),
		bodyStartOffset,
	}
}

class HttpTokenProvider implements vscode.DocumentSemanticTokensProvider {
	provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
		const builder = new vscode.SemanticTokensBuilder(methodTokenLegend)

		if (!document.fileName.endsWith('.mts')) return builder.build()

		const text = document.getText()
		SLING_TEMPLATE_RE.lastIndex = 0

		let match: RegExpExecArray | null
		while ((match = SLING_TEMPLATE_RE.exec(text)) !== null) {
			// Walk forward to find the closing backtick, respecting \` escapes
			const contentStart = match.index + match[0].length
			let pos = contentStart
			while (pos < text.length) {
				if (text[pos] === '\\') { pos += 2; continue }
				if (text[pos] === '`') break
				pos++
			}

			const templateContent = text.slice(contentStart, pos)

			// ── Method token ─────────────────────────────────────────────
			const result = parseHttpMethod(templateContent)
			if (result.type === 'method') {
				const absOffset = contentStart + result.offset
				const tokenPos = document.positionAt(absOffset)
				builder.push(tokenPos.line, tokenPos.character, result.length, TOKEN_TYPE.httpMethod, 0)
			}

			// ── Body tokens ───────────────────────────────────────────────
			const bodyInfo = extractBodyInfo(templateContent)
			if (!bodyInfo?.contentType) continue

			const provider = resolveBodyTokenProvider(bodyInfo.contentType)
			if (!provider) continue

			const bodyDocPos = document.positionAt(contentStart + bodyInfo.bodyStartOffset)
			provider.provideTokens(bodyInfo.bodyLines, bodyDocPos.line, builder)
		}

		return builder.build()
	}
}

export function registerMethodHighlight(context: ExtensionContext): void {
	context.addSubscriptions(
		vscode.languages.registerDocumentSemanticTokensProvider(
			{ language: 'typescript', pattern: '**/*.mts' },
			new HttpTokenProvider(),
			methodTokenLegend,
		),
	)
}

// Re-export the provider map so callers can add/replace entries
export { bodyTokenProviders }
