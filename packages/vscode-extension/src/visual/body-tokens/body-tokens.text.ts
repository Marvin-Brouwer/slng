import type { BodyTokenProvider } from './body-token-provider.js'

/** Plain-text bodies carry no semantic token information. */
export const textBodyTokenProvider: BodyTokenProvider = {
	canProcess: (contentType) => contentType.startsWith('text/'),
	// No tokens emitted for plain text — the default editor appearance is sufficient.
	provideTokens: () => { /* intentionally empty */ },
}
