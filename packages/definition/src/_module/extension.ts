/**
 * @module extension
 */

// Runtime utilities (for CLI / extensions)
export { loadDefinitionFile, type AstData } from '../loader/file-loader.js'
export { isSlingDefinition } from '../definition.js'
export { isJsonContentType } from '../http/body-parser/body-parser.json.js'

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
