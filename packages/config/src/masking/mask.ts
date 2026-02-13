import { inspect, types } from 'node:util'

import { isTaggedSerialized, SERIALIZABLE_TAG, serializableSymbol } from '../serializable'
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
import { isAsyncFunction } from 'node:util/types';
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

const serializeId = '@slng/mask'
function createValueMask<T extends PrimitiveValue>(original: T, mask: string, inspectMask: string) {
	const key = 0x5F
	const data = Buffer.from(JSON.stringify(original))
	const obfuscated = data.map(byte => byte ^ key)
	data.fill(0)
	function unmaskValue(buffer: Uint8Array) {
		const original = buffer.map(byte => byte ^ key).toString()
		return JSON.parse(original) as T
	}

	return {
		[maskSymbol]: true,
		[serializableSymbol]: serializeId,
		value: mask,
		unmask() {
			return unmaskValue(obfuscated)
		},

		/**
		 * Debugger Annotation: Node.js Custom Inspection
		 * This hides the internal 'obfuscated' reference if the object is logged.
		 */
		[inspect.custom]() {
			return inspectMask
		},
		/** Needs to be serializable for the vscode extension state */
		toJSON() {
			return {
				[SERIALIZABLE_TAG]: serializeId,
				data: [mask, Buffer.from(obfuscated).toString('base64'), inspectMask],
			}
		},
	} as Masked<T>
}
type SerializedMask = [mask: string, maskedValue: string, inspectMask: string]

function createAccessorMask(original: DataAccessor, mask: string): MaskedDataAccessor {
	return {
		[maskSymbol]: true,
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
	} as MaskedDataAccessor
}

function isAsyncMask(mask: Masked<unknown>) {
	// We don't care about binding, it's just a type check
	// eslint-disable-next-line @typescript-eslint/unbound-method
	return types.isAsyncFunction(mask.unmask)
}

export function isMask(value: unknown): value is Masked<unknown> {
	return !!value && typeof value === 'object' && (value as Record<symbol, boolean>)[maskSymbol] === true
}

export function isPrimitiveMask(value: unknown): value is Masked<PrimitiveValue> {
	return isMask(value) && !isAsyncMask(value)
}

export function isMaskedDataAccessor(value: unknown): value is MaskedDataAccessor {
	return isMask(value) && isAsyncMask(value)
}

export const maskTransformer = {
	displayReplacer(_key: string, value: unknown): unknown {
		if (isTaggedSerialized(value, serializeId)) {
			const [mask] = value.data as SerializedMask
			return mask
		}
		return value
	},
	reviver(_key: string, value: unknown): unknown {
		if (isTaggedSerialized(value, serializeId)) {
			const [mask, obfuscated, inspectMask] = value.data as SerializedMask
			const key = 0x5F
			const buffer = Buffer.from(obfuscated, 'base64')
			const original = buffer.map(byte => byte ^ key).toString()
			buffer.fill(0)
			return createValueMask(JSON.parse(original), mask, inspectMask)
		}
		return value
	},
}
