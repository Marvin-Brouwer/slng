import sling, { useConfig, useDotEnvironment } from '@slng/config'

export default sling(
	// .env.dev get's precedence over useConfig
	useDotEnvironment('dev'),
	useConfig({
		dev: {
			app: 'testapp',
			profile: 'dev',
		},
	}),
)
