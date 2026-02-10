import { DataAccessor, PrimitiveValue } from '../types'

import { mask } from './mask'

/**
 * Mark a value as secret. It will be displayed as `●●●●●`.
 *
 * The real value is only used when actually executing the HTTP request.
 *
 * @example
 * ```ts
 * import { secret } from '@slng/config'
 *
 * const apiKey = secret(process.env.API_KEY);
 *
 * export const myRequest = sling`
 *   POST https://api.example.com/auth
 *
 *   { "key": "${apiKey}" }
 * `
 * ```
 */
export function secret<T extends PrimitiveValue | DataAccessor>(value: T) {
	return mask(value, '●●●●●')
}
