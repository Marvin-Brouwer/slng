/**
 * @module extension
 */

// Runtime utilities (for CLI / extensions)
export { loadDefinitionFile, type AstData } from '../loader/file-loader.js'
export { parseHttpMethod, type MethodNode, type MethodErrorNode, type MethodParseResult } from '../http/http-parser/method-parser.js'
export { allowedMethods } from '../http/http.nodes.js'
export { isSlingDefinition } from '../definition.js'
export { isJsonContentType } from '../http/body-parser/body-parser.json.js'
export { isParameterReference, type ParameterReference } from '../parameter-accessor.js'

export type {
	SlingInternals,
	SlingInterpolation,
	SlingContext,
	ConfiguredSling,
	ExecuteOptions,
	CacheOptions,
	JsonOptions,
	ParsedHttpRequest,
	RequestReference,
} from '../types.js'
