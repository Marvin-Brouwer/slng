import { SlingContext } from '../types'

import { useJson } from './built-in/payload/json'
import { useText } from './built-in/payload/text'
import { SlingPlugin } from './plugin'

export async function loadPlugins(context: SlingContext, plugins: SlingPlugin[]) {
	const setupEnvironments = plugins.map(p => p.setupEnvironment(context))
	await Promise.all(setupEnvironments.filter(Boolean) as Promise<void>[])

	// First environment is the default active one
	if (context.environments.length > 0 && context.activeEnvironment === undefined) {
		context.activeEnvironment = context.environments[0]
	}

	// Append built-in processors
	await useText().setupProcessors(context)
	await useJson({}).setupProcessors(context)

	const setupProcessors = plugins.map(p => p.setupProcessors(context))
	await Promise.all(setupProcessors.filter(Boolean) as Promise<void>[])
}
