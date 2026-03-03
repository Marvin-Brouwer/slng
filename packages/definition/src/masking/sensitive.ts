import { PrimitiveValue } from '../types.js'

import { mask, Masked } from './mask.js'

const DEFAULT_VISIBLE_CHARS = 6

/**
 * Mark a value as sensitive. The first `n` grapheme clusters are shown,
 * the rest replaced with width-preserving `□` placeholders.
 *
 * @param value  The full string value
 * @param n      Number of leading characters to keep visible (default: 6)
 *
 * @example
 * ```ts
 * import { sensitive } from '@slng/definition'
 *
 *    sensitive("marvin.brouwer@gmail.com")
 * // Displays: "marvin…"
 *
 *    sensitive("marvin.brouwer@gmail.com", 3)
 * // Displays: "mar…"
 * ```
 */
export function sensitive<T extends PrimitiveValue>(value: T, n?: number): Masked<T> {
	const visible = n ?? DEFAULT_VISIBLE_CHARS

	const prefix = String(value).slice(0, visible)
	const displayValue = prefix + '…'

	return mask(value, displayValue) as Masked<T>
}
