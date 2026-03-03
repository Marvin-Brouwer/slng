import { DataAccessor, HttpError, InvalidJsonPathError, PrimitiveValue } from '../types'

const maskSymbol = Symbol.for('mask')

/** The import from 'node:util' caused issues with extensions */
const nodeInspectCustom = Symbol.for('nodejs.util.inspect.custom')

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
 * import { namedMask } from '@slng/definition'
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
	function unmaskValue(buffer: Uint8Array) {
		const original = buffer.map(byte => byte ^ key).toString()
		return JSON.parse(original) as T
	}

	return {
		[maskSymbol]: true,
		value: mask,
		unmask() {
			return unmaskValue(obfuscated)
		},

		/**
		 * Debugger Annotation: Node.js Custom Inspection
		 * This hides the internal 'obfuscated' reference if the object is logged.
		 */
		[nodeInspectCustom]() {
			return inspectMask
		},
		toJSON() {
			throw new Error('Masked values cannot be serialized')
		},
	} as Masked<T>
}

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
		[nodeInspectCustom]() {
			return `[Masked DataAccessor] ${mask}`
		},
	} as MaskedDataAccessor
}

function isAsyncMask(mask: Masked<unknown>) {
	// We don't care about binding, it's just a type check

	return mask.unmask.constructor.name === 'AsyncFunction'
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

export async function resolveAsyncMask(maskedDataAccessor: MaskedDataAccessor) {
	const maskedValueResult = await maskedDataAccessor.unmask()
	if (maskedValueResult instanceof Error) throw maskedValueResult
	return createMask(maskedValueResult, maskedDataAccessor.value, (maskedDataAccessor as unknown as Record<symbol, () => string>)[nodeInspectCustom]())
}

