import { SlingContext } from '../types'
import { SlingPlugin } from './plugin'

export async function loadPlugins(context: SlingContext, plugins: SlingPlugin[]) {


	const setupEnvironments = plugins.map(p => p.setupEnvironment(context))
	await Promise.all(setupEnvironments.filter(Boolean) as Promise<void>[])

	// First environment is the default active one
	if (context.environments.length > 0 && context.activeEnvironment === undefined) {
		context.activeEnvironment = context.environments[0]
	}
}