import { SlingContext } from '../types'

export type EnvironmentContext = Pick<SlingContext, 'envSets' |  'environments'>
export type ProcessorContext = Pick<SlingContext, 'payloadProcessors'>

/**
 * A plugin that hooks into the sling configuration.
 */
export interface SlingPlugin {
	readonly name: string
	setupEnvironment(context: EnvironmentContext): void | Promise<void>
	setupProcessors(context: ProcessorContext): void | Promise<void>
}

export type PluginOptionsNoConfig = Partial<Omit<SlingPlugin, 'name'>>
export type PluginOptions<TConfig extends object> = PluginOptionsNoConfig & {
	config: TConfig
}

export function plugin(name: `${string}:${string}`, options: PluginOptionsNoConfig): SlingPlugin
export function plugin<TConfig extends object>(name: `${string}:${string}`, options: PluginOptions<TConfig>): SlingPlugin
export function plugin<TConfig extends object | never>(name: `${string}:${string}`, options: PluginOptions<TConfig> | PluginOptionsNoConfig): SlingPlugin{

	function noop() {}

	return {
		name,
		...options,
		setupEnvironment: options.setupEnvironment ?? noop,
		setupProcessors: options.setupProcessors ?? noop,
	}
}