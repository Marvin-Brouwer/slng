export const serializableSymbol = Symbol.for('serializable')
export const SERIALIZABLE_TAG = '__s' as const

export interface Serializable {
	readonly [serializableSymbol]: string
	serialize(): object
}

export interface TaggedSerialized {
	[SERIALIZABLE_TAG]: string
	data: object
}

export function isSerializable(value: unknown): value is Serializable {
	return !!value
		&& typeof value === 'object'
		&& serializableSymbol in value
		&& typeof value[serializableSymbol] === 'string'
}

export function isTaggedSerialized(value: unknown, id: string): value is TaggedSerialized {
	return !!value
		&& typeof value === 'object'
		&& SERIALIZABLE_TAG in value
		&& value[SERIALIZABLE_TAG] === id
}
