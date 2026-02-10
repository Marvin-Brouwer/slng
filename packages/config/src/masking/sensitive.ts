import { PrimitiveValue } from '../types.js'

import { mask, Masked } from './mask.js'

const DEFAULT_VISIBLE_CHARS = 6

/**
 * Mark a value as sensitive. The first `n` characters are shown,
 * the rest replaced with `*`.
 *
 * @param value  The full string value
 * @param n      Number of leading characters to keep visible (default: 6)
 *
 * @example
 * ```ts
 * import { sensitive } from '@slng/config'
 *
 * sensitive("marvin.brouwer@gmail.com")
 * // Displays: "marvin.*****************"
 *
 * sensitive("marvin.brouwer@gmail.com", 3)
 * // Displays: "mar********************"
 * ```
 */

// TODO add overload that accepts a string instead of a number
// sensitive("marvin.brouwer@gmail.com", "username") should result in a named mask;
// // ?= "<username>"
export function sensitive<T extends PrimitiveValue>(value: T, n?: number): Masked<T> {
	const visible = n ?? DEFAULT_VISIBLE_CHARS
	const stringValue = value.toString()
	const prefix = stringValue.slice(0, visible)
	const maskedLength = Math.max(0, stringValue.length - visible)
	const displayValue = prefix + '*'.repeat(maskedLength)

	return mask(value, displayValue) as Masked<T>
}
