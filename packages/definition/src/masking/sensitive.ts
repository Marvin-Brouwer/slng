import { PrimitiveValue } from '../types.js'

import { mask, Masked } from './mask.js'

const DEFAULT_VISIBLE_CHARS = 6
const segmenter = new Intl.Segmenter()

function displayWidth(segment: string): 1 | 2 {
	const cp = segment.codePointAt(0) ?? 0
	return (
		(cp >= 0x11_00 && cp <= 0x11_5F) // Hangul
		|| (cp >= 0x2E_80 && cp <= 0x30_3E) // CJK Radicals
		|| (cp >= 0x30_40 && cp <= 0x33_FF) // Japanese
		|| (cp >= 0xAC_00 && cp <= 0xD7_A3) // Hangul Syllables
		|| (cp >= 0xFF_01 && cp <= 0xFF_60) // Full-width Forms
		|| (cp >= 0x4E_00 && cp <= 0x9F_FF) // CJK Unified
	)
		? 2
		: 1
}

function maskForSegment(segment: string): string {
	return '\u25A1'.repeat(displayWidth(segment)) // □ white square
}

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
 * // Displays: "marvin□□□□□□□□□□□□□□□□□□"
 *
 *    sensitive("marvin.brouwer@gmail.com", 3)
 * // Displays: "mar□□□□□□□□□□□□□□□□□□□□□"
 * ```
 */
export function sensitive<T extends PrimitiveValue>(value: T, n?: number): Masked<T> {
	const visible = n ?? DEFAULT_VISIBLE_CHARS
	const segments = [...segmenter.segment(value.toString())]

	const prefix = segments.slice(0, visible).map(s => s.segment).join('')
	const displayValue = prefix + segments
		.slice(visible)
		.map(({ segment }) => maskForSegment(segment))
		.join('')

	return mask(value, displayValue) as Masked<T>
}
