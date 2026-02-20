import { describe, it, expect } from 'vitest'

import { createSlingParameters } from '../src/parameters.js'

describe('createSlingParameters', () => {
	it('creates empty parameters when no initial values', () => {
		const parameters = createSlingParameters()
		expect(parameters.get('missing')).toBeUndefined()
	})

	it('exposes initial values via get()', () => {
		const parameters = createSlingParameters({ TOKEN: 'abc123', PORT: 3000 })
		expect(parameters.get('TOKEN')).toBe('abc123')
		expect(parameters.get('PORT')).toBe(3000)
	})

	it('exposes initial values as own properties', () => {
		const parameters = createSlingParameters({ HOST: 'localhost' })
		expect(parameters.HOST).toBe('localhost')
	})

	it('returns undefined for missing keys', () => {
		const parameters = createSlingParameters({ A: '1' })
		expect(parameters.get('B')).toBeUndefined()
	})

	it('handles falsy values correctly (0, false, empty string)', () => {
		const parameters = createSlingParameters({
			ZERO: 0,
			FALSE: false,
			EMPTY: '',
		})

		expect(parameters.get('ZERO')).toBe(0)
		expect(parameters.get('FALSE')).toBe(false)
		expect(parameters.get('EMPTY')).toBe('')
	})

	it('getRequired returns value when present', () => {
		const parameters = createSlingParameters({ KEY: 'value' })
		expect(parameters.getRequired('KEY')).toBe('value')
	})

	it('getRequired returns falsy values without throwing', () => {
		const parameters = createSlingParameters({ ZERO: 0, FALSE: false })
		expect(parameters.getRequired('ZERO')).toBe(0)
		expect(parameters.getRequired('FALSE')).toBe(false)
	})

	it('getRequired throws for missing keys', () => {
		const parameters = createSlingParameters()
		expect(() => parameters.getRequired('MISSING')).toThrow(
			'Required parameter \'MISSING\' was not loaded.',
		)
	})

	it('getRequired throws for explicitly undefined keys', () => {
		const parameters = createSlingParameters({ KEY: undefined })
		expect(() => parameters.getRequired('KEY')).toThrow(
			'Required parameter \'KEY\' was not loaded.',
		)
	})

	it('set() stores new values accessible via get()', () => {
		const parameters = createSlingParameters()
		parameters.set('DYNAMIC', 'new-value')
		expect(parameters.get('DYNAMIC')).toBe('new-value')
	})

	it('set() overwrites existing values', () => {
		const parameters = createSlingParameters({ KEY: 'old' })
		parameters.set('KEY', 'new')
		expect(parameters.get('KEY')).toBe('new')
	})
})
