// Main factory
export { sling } from './sling.js'
export { sling as default } from './sling.js'

// Plugins
export { useDotEnv } from './plugins/dotenv.js'
export type { DotEnvOptions } from './plugins/dotenv.js'
export { useConfig } from './plugins/static-config.js'

// Runtime utilities (for CLI / extensions)
export { loadDefinitionFile, type AstData } from './loader/file-loader.js'
export * from './serializable.js'
export * from './masking/mask.js'
export { secret } from './masking/secret.js'
export { sensitive } from './masking/sensitive.js'
export { isSlingDefinition } from './definition.js'
export {
	parseHttpText,
	resolveInterpolation,
	resolveInterpolationDisplay,
	assembleTemplate,
	SlingParseError,
} from './parser.js'

// Error types
export { HttpError, InvalidJsonPathError } from './types.js'

// Types
export type {
	ResponseJsonAccessor,
	PrimitiveValue,
	SlingDefinition,
	SlingInternals,
	SlingResponse,
	SlingInterpolation,
	SlingContext,
	SlingPlugin,
	ConfiguredSling,
	MaskedValue,
	ExecuteOptions,
	CacheOptions,
	JsonOptions,
	ParsedHttpRequest,
	RequestReference,
} from './types.js'
