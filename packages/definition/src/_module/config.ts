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
