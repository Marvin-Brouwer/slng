import type { MaskedValue } from '../types.js'

/**
 * Mark a value as secret. It will be displayed as `*****` in logs
 * and `●●●●●` in the VS Code response viewer panel.
 *
 * The real value is only used when actually executing the HTTP request.
 *
 * @example
 * ```ts
 * import { secret } from '@slng/config'
 *
 * const apiKey = process.env.API_KEY;
 *
 * export const myRequest = sling`
 *   POST https://api.example.com/auth
 *
 *   { "key": "${secret(apiKey)}" }
 * `
 * ```
 */
export function secret(value: string): MaskedValue {
	return {
		__masked: true,
		type: 'secret',
		value,
		displayValue: '*****',
	}
}
