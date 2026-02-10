import { inspect } from 'node:util'

import { DataAccessor, HttpError, InvalidJsonPathError, PrimitiveValue } from '../types'

const maskSymbol = Symbol.for('mask')

export type Masked<T> = {
	value: string
	unmask(): T
}

export type MaskedDataAccessor = Masked<Promise<string | HttpError | InvalidJsonPathError>> & {}

/**
 * Mask a value directly. It will be displayed as {@param mask}.
 *
 * The real value is only used when actually executing the HTTP request.
 *
 * @example
 * ```ts
 * import { namedMask } from '@slng/config'
 *
 * const auth_token = namedMask('TOKEN', process.env.TOKEN);
 *
 * export const myRequest = sling`
 *   POST https://api.example.com/auth
 *
 *   { "key": "${apiKey}" }
 * `
 * ```
 */
export function namedMask<T extends PrimitiveValue>(mask: string, value: T): Masked<T>
export function namedMask<T extends DataAccessor>(mask: string, value: T): MaskedDataAccessor
export function namedMask<T extends PrimitiveValue | DataAccessor>(mask: string, value: T) {
	return createMask<T>(value, `{${mask}}`, `[${mask}]`)
}

export function mask<T extends PrimitiveValue | DataAccessor>(original: T, mask: string) {
	return createMask<T>(original, mask, `[Masked] ${mask}`)
}

function isDataAccessor(value: unknown): value is DataAccessor {
	return !!value && typeof value === 'object' && Object.hasOwn(value, 'value')
}

function createMask<T extends PrimitiveValue | DataAccessor>(original: T, mask: string, inspectMask: string) {
	return isDataAccessor(original)
		? createAccessorMask(original, mask)
		: createValueMask(original, mask, inspectMask)
}

function createValueMask<T extends PrimitiveValue>(original: T, mask: string, inspectMask: string) {
	const key = 0x5F
	const data = Buffer.from(JSON.stringify(original))
	const obfuscated = data.map(byte => byte ^ key)
	data.fill(0)

	return {
		[mask]: true,
		value: mask,
		unmask() {
			const original = obfuscated.map(byte => byte ^ key).toString()
			return JSON.parse(original) as T
		},

		/**
		 * Debugger Annotation: Node.js Custom Inspection
		 * This hides the internal 'obfuscated' reference if the object is logged.
		 */
		[inspect.custom]() {
			return inspectMask
		},

		/**
		 * Hide from JSON.stringify
		 */
		toJSON() {
			return mask
		},
	} as Masked<T>
}
function createAccessorMask(original: DataAccessor, mask: string): MaskedDataAccessor {
	return {
		[mask]: true,
		value: mask,
		unmask() {
			return original.value<string>()
		},

		/**
		 * Debugger Annotation: Node.js Custom Inspection
		 * This hides the internal 'obfuscated' reference if the object is logged.
		 */
		[inspect.custom]() {
			return `[Masked DataAccessor] ${mask}`
		},

		/**
		 * Hide from JSON.stringify
		 */
		toJSON() {
			return mask
		},
	} as MaskedDataAccessor
}

export function isMask(value: unknown): value is Masked<unknown> {
	return !!value && typeof value === 'object' && Object.hasOwn(value, maskSymbol)
}
