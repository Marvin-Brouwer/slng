import { describe, it, expect } from 'vitest'

import { isMask } from '../src/masking/mask.js'
import { secret } from '../src/masking/secret.js'
import { sensitive } from '../src/masking/sensitive.js'

describe('secret', () => {
	it('creates a masked value with ●●●●● display', () => {
		const result = secret('super-secret-key')

		expect(isMask(result)).toBe(true)
		expect(result.unmask()).toBe('super-secret-key')
		expect(result.value).toBe('●●●●●')
	})

	it('works with empty strings', () => {
		const result = secret('')
		expect(result.unmask()).toBe('')
		expect(result.value).toBe('●●●●●')
	})
})

describe('sensitive', () => {
	it('shows first 6 characters by default', () => {
		const result = sensitive('marvin.brouwer@gmail.com')

		expect(isMask(result)).toBe(true)
		expect(result.unmask()).toBe('marvin.brouwer@gmail.com')
		expect(result.value).toBe('marvin******************')
		// "marvin" = 6 chars visible, rest = 18 stars
	})

	it('accepts custom visible character count', () => {
		const result = sensitive('marvin.brouwer@gmail.com', 3)

		expect(result.value).toBe('mar*********************')
	})

	it('handles value shorter than visible count', () => {
		const result = sensitive('abc', 10)

		expect(result.value).toBe('abc')
	})

	it('handles zero visible characters', () => {
		const result = sensitive('secret', 0)

		expect(result.value).toBe('******')
	})
})
