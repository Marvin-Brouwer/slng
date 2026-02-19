import { isMaskedDataAccessor, isPrimitiveMask, Masked, MaskedDataAccessor, resolveAsyncMask } from './masking/mask'
import { DataAccessor, PrimitiveValue, ResolvedStringTemplate, SlingInterpolation } from './types'

export function readHttpTemplate(strings: TemplateStringsArray, ...values: (PrimitiveValue | Masked<PrimitiveValue>)[]): ResolvedStringTemplate {
	return {
		strings: Object.freeze(strings),
		values: Object.freeze(values),
	}
}

function isPrimitiveValue(value: SlingInterpolation): value is PrimitiveValue {
	if (typeof value === 'string') return true
	if (typeof value === 'boolean') return true
	if (typeof value === 'number') return true
	return false
}

export async function resolveTemplateDependencies(template: ResolvedStringTemplate): Promise<ResolvedStringTemplate> {
	const { strings, values } = template
	const resolvedValues = new Array<PrimitiveValue | Masked<PrimitiveValue> | undefined>()

	for (const value of values) {
		if (!value) {
			resolvedValues.push(undefined)
			continue
		}
		if (isPrimitiveValue(value)) {
			resolvedValues.push(value)
			continue
		}
		if (isPrimitiveMask(value)) {
			resolvedValues.push(value)
			continue
		}
		const resolvedValue = await resolveDependency(value)
		resolvedValues.push(resolvedValue)
	}

	return {
		strings: Object.freeze(strings),
		values: Object.freeze(resolvedValues),
	}
}

async function resolveDependency(value: DataAccessor | MaskedDataAccessor): Promise<PrimitiveValue | Masked<PrimitiveValue> | undefined> {
	if (isMaskedDataAccessor(value)) {
		const maskedValueResult = await resolveAsyncMask(value).then(value => value).catch(error => error as Error)
		if (maskedValueResult instanceof Error) throw maskedValueResult
		return maskedValueResult as Masked<PrimitiveValue>
	}

	const accessorResult = await value.tryValue().then(value => value).catch(error => error as Error)
	if (accessorResult instanceof Error) throw accessorResult
	return accessorResult
}
