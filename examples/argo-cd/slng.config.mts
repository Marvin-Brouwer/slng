import sling, { useConfig, useDotEnv } from '@slng/definition/config'

export default await sling(
	// .env.dev get's precedence over useConfig
	useDotEnv({
		directory: import.meta.dirname,
		environments: ['dev']
	}),
	useConfig({
		dev: {
			app: 'testapp',
			profile: 'dev',
		},
	}),
)
