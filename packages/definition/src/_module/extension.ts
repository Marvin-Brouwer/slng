/**
 * @module extension
 */

// Runtime utilities (for CLI / extensions)
export { loadDefinitionFile, type AstData } from '../loader/file-loader.js'
export { isSlingDefinition } from '../definition.js'
export { isJsonContentType } from '../payload/payload-processor.json.js'

export { NodeError } from '../nodes/nodes.js'
export { Metadata } from '../nodes/metadata.js'
export { type Logger, createLog } from '../logger.js'

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
