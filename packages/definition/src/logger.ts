
export type Logger = Pick<Console, 'trace' | 'debug' | 'info' | 'warn' | 'error'>

export function createLog<T extends Logger>(name: string, baseLogger: T): Logger {
	return new Proxy(baseLogger, {
		get(target, property, receiver) {
			switch (property) {
				case 'trace':
				case 'debug':
				case 'info':
				case 'warn':
				case 'error': {
					return (...arguments_: unknown[]) => target[property](`[${name}]`, ...sanitize(arguments_))
				}
				default: {
					return Reflect.get(target, property, receiver) as unknown
				}
			}
		},
	})
}

/** The import from 'node:util' caused issues with extensions */
const nodeInspectCustom = Symbol.for('nodejs.util.inspect.custom')

function sanitize(arguments_: unknown[]) {
	return arguments_
		.map((argument) => {
			if (argument === null) return 'null'
			if (argument === undefined) return 'undefined'

			if (argument instanceof Error)
				return argument.toString()
			if (typeof argument === 'object' && Object.hasOwn(argument, nodeInspectCustom))
				return (argument as { [nodeInspectCustom]: () => string })[nodeInspectCustom]()
			return String(argument as string | number | boolean)
		})
}

