/**
 * @module config
 */

// Main factory
export { sling } from '../sling.js'
export { sling as default } from '../sling.js'

// Plugins
export { useDotEnv } from '../plugins/dotenv.js'
export type { DotEnvOptions } from '../plugins/dotenv.js'
export { useConfig } from '../plugins/static-config.js'

// Body parser registry — exported so custom parsers can extend defaultBodyParsers
export { defaultBodyParsers, resolveBodyParser, type BodyContentParser } from '../http/body-parser/body-parser.registry.js'

// Parameter reference type (the value returned by sling.param())
export type { ParameterReference } from '../parameter-accessor.js'
