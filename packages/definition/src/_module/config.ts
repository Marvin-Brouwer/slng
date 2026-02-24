/**
 * @module config
 */

// Augment ImportMeta with Node.js properties so consumers don't need @types/node
declare global {
	interface ImportMeta {
		// @ts-expect-error All declarations of 'dirname' must have identical modifiers.
		readonly dirname: string
		// @ts-expect-error All declarations of 'dirname' must have identical modifiers.
		readonly filename: string
	}
}

// Main factory
export { sling } from '../sling.js'
export { sling as default } from '../sling.js'

// Plugins
export { useDotEnv } from '../plugins/pre-packed/dotenv.js'
export type { DotEnvOptions } from '../plugins/pre-packed/dotenv.js'
export { useConfig } from '../plugins/pre-packed/static-config.js'
