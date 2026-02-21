import sling, { useDotEnv } from '@slng/definition/config'

export default sling(
	useDotEnv({ directory: import.meta.dirname, environments: ['local', 'staging'] }),
)
