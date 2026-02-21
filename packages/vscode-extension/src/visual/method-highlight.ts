import * as vscode from 'vscode'

import { parseHttpMethod } from '@slng/definition/extension'

import type { ExtensionContext } from '../context'

/**
 * Semantic token legend for HTTP method highlighting.
 *
 * We declare a custom token type — `httpMethod` — mapped to the `storage.type`
 * TextMate scope (the same scope `const` uses in TypeScript). Themes therefore
 * apply the same color without VS Code treating the token as a keyword.
 */
export const methodTokenLegend = new vscode.SemanticTokensLegend(['httpMethod'])

/** Matches the start of a `sling\`` template literal. */
const SLING_TEMPLATE_RE = /\bsling\s*`/g

class HttpMethodTokenProvider implements vscode.DocumentSemanticTokensProvider {
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
			const result = parseHttpMethod(templateContent)
			if (result.type !== 'method') continue

			const absOffset = contentStart + result.offset
			const tokenPos = document.positionAt(absOffset)
			// 0 = index of 'httpMethod' in the legend
			builder.push(tokenPos.line, tokenPos.character, result.length, 0, 0)
		}

		return builder.build()
	}
}

export function registerMethodHighlight(context: ExtensionContext): void {
	context.addSubscriptions(
		vscode.languages.registerDocumentSemanticTokensProvider(
			{ language: 'typescript', pattern: '**/*.mts' },
			new HttpMethodTokenProvider(),
			methodTokenLegend,
		),
	)
}
