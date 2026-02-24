import sling, { useDotEnv } from '@slng/definition/config'

export default await sling(
	useDotEnv({
		directory: import.meta.dirname,
		environments: ['local', 'staging']
	}),
)
