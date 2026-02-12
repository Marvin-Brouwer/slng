import sling, { useConfig, useDotEnv } from '@slng/config'

export default sling(
	// .env.dev get's precedence over useConfig
	useDotEnv({ directory: import.meta.dirname, environments: ['dev'] }),
	useConfig({
		dev: {
			app: 'testapp',
			profile: 'dev',
		},
	}),
)
