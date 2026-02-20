import { createHash } from 'node:crypto'

import { buildHttpResponse } from './http/http-builder/http-builder.js'
import { parseHttpRequest } from './http/http-parser/http-parser.request.js'
import { Metadata, body, document, error, NodeError, response, text } from './http/http.nodes'
import { buildRequest } from './request/request-builder.js'
import { resolveTemplateDependencies } from './template-reader.js'
import {
	HttpError,
	InvalidJsonPathError,
	type DataAccessor,
	dataAccessorSymbol,
	RequestReference,
	type ResponseJsonAccessor,
	type SlingDefinition,
	type SlingInternals,
	type SlingResponse,
	type SlingContext,
	type ExecuteOptions,
	type JsonOptions,
	type ParsedHttpRequest,
	StringTemplate,
} from './types.js'

interface CachedResponse {
	response: SlingResponse
	timestamp: number
}

/**
 * Create a SlingDefinition from a tagged template invocation.
 */
export function createDefinition(
	template: StringTemplate,
	_context: SlingContext,
): SlingDefinition {
	// Response cache (shared across execute/json calls)
	let cached: CachedResponse | undefined

	const internals: SlingInternals = {
		version: 'v1',
		tsAst: undefined!, // added by the runtime
		template,
		resolvedTemplate: undefined!, // added on request
	}

	const definition: SlingDefinition = {
		getInternals: () => internals,
		id() {
			// This SHOULD never happen
			if (!internals.tsAst) return '<unknown>'
			if (!internals.resolvedTemplate) return '<unknown>'

			return createHash('sha256')
				.update(internals.tsAst.sourcePath).update('\0')
				.update(internals.tsAst.exportName).update('\0')
				.update(internals.template.strings.join('$_'))
				.digest('hex')
		},

		async execute(options?: ExecuteOptions): Promise<SlingResponse | HttpError> {
			const readFromCache = options?.readFromCache !== false
			const cacheTime = options?.cacheTime
			const cachingDisabled = cacheTime === false || cacheTime === 0

			// Check cache
			if (readFromCache && cached && !cachingDisabled) {
				const effectiveCacheTime = cacheTime ?? Infinity
				const age = Date.now() - cached.timestamp
				if (effectiveCacheTime === Infinity || age < effectiveCacheTime) {
					return cached.response
				}
			}

			internals.resolvedTemplate = await resolveTemplateDependencies(template)
			const response = await executeRequest(this, options)
			if (response instanceof Error && !(response instanceof HttpError)) throw response
			// Store in cache (unless caching is explicitly disabled)
			if (!cachingDisabled && !(response instanceof HttpError)) {
				cached = { response, timestamp: Date.now() }
			}

			return response
		},

		json(jsonPath: string, options?: JsonOptions): ResponseJsonAccessor {
			// TODO extract jsonPath logic to separate file, parse the path and fail early
			// it should return a jsonPath(jsonObject) function when valid so we can just call that after
			// the request has been parsed to JSON.
			return createDataAccessor(this, jsonPath, options)
		},
	}

	return definition
}

/**
 * Resolve a value from a parsed JSON object using a simple path expression.
 *
 * Supports dot-notation (`user.name`) and bracket indexing (`users[0]`).
 * Returns `undefined` when the path cannot be fully traversed.
 */
function resolveJsonPath(object: unknown, path: string): unknown {
	if (!path) return object

	// Parse "data.users[0].name" → ["data", "users", "0", "name"]
	const segments = path
		.split('.')
		.flatMap((part) => {
			if (!part.includes('[')) return [part]
			// "users[0]" → ["users", "0"]
			return part.split('[').map(s => s.replace(']', ''))
		})
		.filter(Boolean)

	let current: unknown = object

	for (const segment of segments) {
		if (current === null || current === undefined) return undefined
		if (typeof current !== 'object') return undefined

		if (Array.isArray(current)) {
			const index = Number(segment)
			if (Number.isNaN(index) || index < 0 || index >= current.length) {
				return undefined
			}
			current = current[index]
		}
		else {
			current = (current as Record<string, unknown>)[segment]
		}
	}

	return current
}

/**
 * Create a {@link DataAccessor} for a JSON path on a definition.
 *
 * The accessor's methods lazily trigger the HTTP request via
 * `definition.execute()` and extract the value at the given path.
 * Errors are returned as values ({@link HttpError}, {@link InvalidJsonPathError})
 * rather than thrown.
 */
function createDataAccessor(
	definition: SlingDefinition,
	jsonPath: string,
	options?: JsonOptions,
) {
	const validCodes = options?.validResponseCodes

	/** Shared extraction logic: execute, validate status, parse, traverse. */
	async function extract(): Promise<
		{ value: unknown, found: boolean } | HttpError
	> {
		let response: SlingResponse | HttpError
		try {
			response = await definition.execute(options)
			if (response instanceof HttpError) return response
		}
		catch (error) {
			return new HttpError(
				0,
				'Request failed',
				error instanceof Error ? { cause: error } : undefined,
			)
		}

		// Validate response status
		if (validCodes && validCodes.length > 0) {
			if (!validCodes.includes(response.status)) {
				return new HttpError(
					response.status,
					`Request failed with status ${response.status} ${response.statusText}. `
					+ `Expected one of: ${validCodes.join(', ')}`,
				)
			}
		}
		else if (response.status < 200 || response.status >= 300) {
			return new HttpError(
				response.status,
				`Request failed with status ${response.status} ${response.statusText}`,
			)
		}

		try {
			const body: unknown = 'JSON.parse(response.body)'
			const value = resolveJsonPath(body, jsonPath)
			return { value, found: value !== undefined }
		}
		catch {
			return new HttpError(
				response.status,
				'Response body is not valid JSON',
			)
		}
	}

	return {
		[dataAccessorSymbol]: true,
		async value<T = string>(): Promise<T | HttpError | InvalidJsonPathError> {
			const result = await extract()
			if (result instanceof HttpError) return result
			if (!result.found) return new InvalidJsonPathError(jsonPath)
			return result.value as T
		},

		async validate(): Promise<boolean> {
			const result = await extract()
			if (result instanceof HttpError) return false
			return result.found
		},

		async tryValue<T = string>(): Promise<T | HttpError | undefined> {
			const result = await extract()
			if (result instanceof HttpError) return result
			return result.found ? (result.value as T) : undefined
		},
	} as DataAccessor
}

type FetchError = Error & {
	code: string
	errno: number
	syscall: string
} & {
	code: 'ENOTFOUND'
	hostname: string
}
/**
 * Execute the HTTP request defined by a sling template.
 */
async function executeRequest(
	definition: SlingDefinition,
	options?: ExecuteOptions,
): Promise<SlingResponse | Error> {
	const startTime = performance.now()

	const internals = definition.getInternals()
	const templateAst = parseHttpRequest(internals.resolvedTemplate!)
	if (!templateAst) return new Error('Unreachable code detected, empty http request')
	if (templateAst.type === 'error') return new NodeError(templateAst)

	const fetchRequest = buildRequest(templateAst, internals.resolvedTemplate)
	if (fetchRequest instanceof Error) throw fetchRequest

	const request: RequestReference = {
		reference: definition.id(),
		name: internals.tsAst.exportName,
		fetchRequest: () => fetchRequest,
		templateAst,
	}
	const fetchResponse = await performFetch(fetchRequest, options)

	if (fetchResponse instanceof Error) {
		const fetchError = fetchResponse as FetchError
		let fetchErrorMessage = fetchError.message
		if (fetchError.code === 'ENOTFOUND') fetchErrorMessage = `Hostname '${fetchError.hostname}' could not be found!`

		const metadata = new Metadata()
		metadata.errors?.push(error({
			reason: fetchErrorMessage,
		}))
		return {
			status: fetchError.errno,
			statusText: fetchError.code,
			duration: 0,
			request,

			responseAst: document({
				startLine: response('HTTP', '1.1', text(fetchError.errno), text(fetchError.code)),
				body: body('text/error', text(fetchError.toString())),
				metadata,
			}),

			fetchResponse: () => fetchResponse,
		}
	}

	const duration = performance.now() - startTime

	const responseAst = await buildHttpResponse(fetchResponse)

	// TODO, we don't want the console to expand the headers or body, however,
	// using toJSON will also fail in the vscode extensionState object, since it's apparently serialized.
	// Maybe create a custom formatter for the loggers and tag the values somehow?
	const slingResponse: SlingResponse = {
		status: fetchResponse.status,
		statusText: fetchResponse.statusText,
		duration,
		request,

		responseAst,

		fetchResponse: () => fetchResponse,
	}

	if (options?.verbose) {
		// TODO add a logger to the context, let the runner resolve the level
		// logRequest(strings, values, resolved, slingResponse, options.maskOutput)
		// context.log.verbose(request url + status + statusmessage)
	}

	return slingResponse
}

async function performFetch(
	parsed: ParsedHttpRequest,
	options?: ExecuteOptions,
): Promise<Response | Error> {
	const init: RequestInit = {
		method: parsed.method,
		headers: parsed.headers,
		signal: options?.signal,
	}

	// Only attach body for methods that support it
	if (parsed.body && !['GET', 'HEAD'].includes(parsed.method)) {
		init.body = parsed.body
	}

	try {
		return await fetch(parsed.url, init)
	}
	catch (error) {
		if (error instanceof TypeError && error.cause && Object.hasOwn(error.cause, 'code')) {
			return error.cause as FetchError
		}
		throw error
	}
}

/**
 * Check if an unknown value is a SlingDefinition.
 */
export function isSlingDefinition(value: unknown): value is SlingDefinition {
	if (
		typeof value !== 'object'
		|| value === null
		|| typeof (value as Record<string, unknown>).getInternals !== 'function'
	) {
		return false
	}
	try {
		return (value as SlingDefinition).getInternals().version === 'v1'
	}
	catch {
		return false
	}
}
