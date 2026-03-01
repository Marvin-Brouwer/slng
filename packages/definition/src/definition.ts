import { createHash } from 'node:crypto'

import { buildHttpResponse } from './http/http-builder/http-builder.js'
import { parseHttpTemplate } from './http/http-parser/http-parser.request.js'
import { body, document, HttpDocument, response } from './http/http.nodes'
import { AstData } from './loader/file-loader.js'
import { isMask } from './masking/mask.js'
import { Metadata } from './nodes/nodes.js'
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
import { error, NodeError, text, type ValueNode, type ValuesNode } from './nodes/nodes.js'

interface CachedResponse {
	response: SlingResponse
	timestamp: number
}

/**
 * Create a SlingDefinition from a tagged template invocation.
 */
export function createDefinition(
	template: StringTemplate,
	context: SlingContext,
): SlingDefinition {
	// Response cache (shared across execute/json calls)
	let cached: CachedResponse | undefined

	const internals: SlingInternals = {
		version: 'v1',
		tsAst: undefined!, // added by the runtime
		template,
		resolvedTemplate: undefined!, // added on request
		protocolAst: undefined,
	}

	const definition: SlingDefinition = {
		getInternals: () => internals,
		buildProtocolAst(tsAst: AstData) {
			internals.protocolAst = parseHttpTemplate(context, template, tsAst.literalLocation) ?? undefined
		},
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
			const response = await executeRequest(context, this, options)
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

/**
 * Recursively patch `'value'` variant ReferenceNodes with their resolved
 * parameter value so the display AST is self-contained (no metadata lookup
 * needed in renderers).
 */
function patchValueNode(node: ValueNode | ValuesNode, params: Metadata['parameters']): ValueNode | ValuesNode {
	if (node.type === 'reference' && node.variant === 'value') {
		const param = params[node.reference]
		if (param !== undefined && param !== null && !isMask(param))
			return { ...node, value: String(param) }
	}
	if (node.type === 'values')
		return { ...node, values: node.values.map(v => patchValueNode(v, params) as ValueNode) }
	return node
}

/**
 * Return a new {@link HttpDocument} with all `'value'` variant ReferenceNodes
 * patched to carry their resolved display value, so renderers need not
 * consult `metadata.parameters`.
 */
function fillDocumentValueRefs(doc: HttpDocument): HttpDocument {
	let { startLine } = doc
	if (startLine.type === 'request' && startLine.url.type !== 'error') {
		startLine = { ...startLine, url: patchValueNode(startLine.url, doc.metadata.parameters) }
	}

	const headers = doc.headers?.map(h => {
		if (h.type === 'error' || h.value.type === 'error') return h
		return { ...h, value: patchValueNode(h.value as ValueNode | ValuesNode, doc.metadata.parameters) }
	})

	let { body } = doc
	if (body) {
		const v = body.value
		if (v.type === 'text' || v.type === 'reference' || v.type === 'values') {
			body = { ...body, value: patchValueNode(v as ValueNode | ValuesNode, doc.metadata.parameters) }
		}
	}

	return { ...doc, startLine, headers, body }
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
	context: SlingContext,
	definition: SlingDefinition,
	options?: ExecuteOptions,
): Promise<SlingResponse | Error> {
	const startTime = performance.now()

	const internals = definition.getInternals()

	// Ensure protocolAst is available (may be absent when used without a file loader)
	if (!internals.protocolAst) definition.buildProtocolAst(internals.tsAst)
	const protocolAst = internals.protocolAst!
	if (protocolAst.type === 'error') return new NodeError(protocolAst)

	// Fill DataAccessor slots in metadata.parameters with the resolved values.
	// We work on a shallow-cloned metadata so the cached protocolAst stays pristine.
	const execMetadata = new Metadata()
	execMetadata.parameters = [...protocolAst.metadata.parameters]
	execMetadata.contentType = protocolAst.metadata.contentType
	execMetadata.errors = protocolAst.metadata.errors

	const resolved = internals.resolvedTemplate!
	for (let i = 0; i < resolved.values.length; i++) {
		if (execMetadata.parameters[i] === undefined && resolved.values[i] !== undefined) {
			execMetadata.parameters[i] = resolved.values[i]
		}
	}

	const templateAst = fillDocumentValueRefs({ ...protocolAst, metadata: execMetadata })
	const fetchRequest = buildRequest(templateAst, internals.resolvedTemplate)
	if (fetchRequest instanceof Error) throw fetchRequest

	const request: RequestReference = {
		reference: definition.id(),
		name: internals.tsAst.exportName,
		templateAst,
	}
	const fetchResponse = await performFetch(fetchRequest, options)

	if (fetchResponse instanceof Error) {
		const fetchError = fetchResponse as FetchError
		let fetchErrorMessage = fetchError.message
		if (fetchError.code === 'ENOTFOUND') fetchErrorMessage = `Hostname '${fetchError.hostname}' could not be found!`

		const metadata = new Metadata()
		metadata.errors = [error({ reason: fetchErrorMessage })]
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
		}
	}

	const duration = performance.now() - startTime

	const responseAst = await buildHttpResponse(context, fetchResponse)

	// TODO, we don't want the console to expand the headers or body, however,
	// using toJSON will also fail in the vscode extensionState object, since it's apparently serialized.
	// Maybe create a custom formatter for the loggers and tag the values somehow?
	const slingResponse: SlingResponse = {
		status: fetchResponse.status,
		statusText: fetchResponse.statusText,
		duration,
		request,

		responseAst,
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
