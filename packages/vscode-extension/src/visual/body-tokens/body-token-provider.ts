import type * as vscode from 'vscode'

import { isJsonContentType } from '@slng/definition/extension'

import { jsonBodyTokenProvider } from './body-tokens.json.js'
import { textBodyTokenProvider } from './body-tokens.text.js'

/**
 * Indices into the semantic token legend declared in method-highlight.ts.
 * Must stay in sync with the legend array order.
 */
export const TOKEN_TYPE = {
	httpMethod: 0,
	property: 1,
	string: 2,
	number: 3,
	keyword: 4,
	comment: 5,
} as const

export type TokenTypeIndex = typeof TOKEN_TYPE[keyof typeof TOKEN_TYPE]

/**
 * A pluggable body syntax token provider. The map key is the provider name,
 * making entries overridable by downstream code.
 *
 * @example Replacing the default JSON provider:
 * ```ts
 * import { bodyTokenProviders } from './body-token-provider'
 * bodyTokenProviders['json'] = myJsonProvider
 * ```
 */
export interface BodyTokenProvider {
	/** Returns true when this provider handles the given content type. */
	canProcess(contentType: string): boolean
	/**
	 * Emit semantic tokens for the body section.
	 *
	 * @param bodyLines  Lines of body text, with `${...}` already blanked out.
	 * @param startLine  Document line number of the first body line.
	 * @param builder    Token builder to push into.
	 */
	provideTokens(
		bodyLines: string[],
		startLine: number,
		builder: vscode.SemanticTokensBuilder,
	): void
}

/**
 * Default body token providers keyed by name.
 * Providers are tried in insertion order — first match wins.
 */
export const bodyTokenProviders: Record<string, BodyTokenProvider> = {
	json: jsonBodyTokenProvider,
	text: textBodyTokenProvider,
}

/** Find the first provider that can handle the given content type. */
export function resolveBodyTokenProvider(
	contentType: string,
): BodyTokenProvider | undefined {
	for (const provider of Object.values(bodyTokenProviders)) {
		if (provider.canProcess(contentType)) return provider
	}
	return undefined
}

export { isJsonContentType }
