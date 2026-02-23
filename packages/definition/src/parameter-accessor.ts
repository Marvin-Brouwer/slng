import { createSlingParameters } from './parameters.js'
import { dataAccessorSymbol, type DataAccessor, type SlingContext } from './types.js'

const parameterReferenceSymbol = Symbol.for('sling.parameterReference')

/**
 * A lazy reference to a named parameter in the active sling environment.
 *
 * Unlike accessing `sling.parameters.TOKEN` at template-definition time,
 * a `ParameterReference` is resolved at **execute time**, so it always
 * reflects the environment that is active when `execute()` is called.
 *
 * Create one with `sling.param('TOKEN')` inside a template literal.
 *
 * @example
 * ```ts
 * export const getUser = sling`
 *   GET https://api.example.com/users HTTP/1.1
 *   Authorization: Bearer ${sling.param('TOKEN')}
 * `
 * ```
 */
export interface ParameterReference extends DataAccessor {
	readonly [parameterReferenceSymbol]: true
	/** The parameter name that will be looked up at execute time. */
	readonly parameterName: string
}

export function isParameterReference(value: unknown): value is ParameterReference {
	return (
		!!value
		&& typeof value === 'object'
		&& (value as Record<symbol, unknown>)[parameterReferenceSymbol] === true
	)
}

/**
 * Create a {@link ParameterReference} that resolves `name` from
 * `context.parameters` each time it is awaited.
 */
export function createParameterReference(name: string, context: SlingContext): ParameterReference {
	function getParams() {
		const env = context.envSets.get(context.activeEnvironment ?? '')
		return createSlingParameters(env)
	}

	// Cast is necessary because DataAccessor's interface doesn't declare the
	// symbol properties that are required at runtime for isDataAccessor() checks.
	return {
		[dataAccessorSymbol]: true,
		[parameterReferenceSymbol]: true,
		parameterName: name,

		async value<T = string>() {
			return getParams().getRequired(name) as T
		},
		async validate() {
			return getParams().get(name) !== undefined
		},
		async tryValue<T = string>() {
			return getParams().get(name) as T | undefined
		},
	} as unknown as ParameterReference
}
