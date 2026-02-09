import sling, { useDotEnv } from '@slng/config'

export default sling(
	useDotEnv({ directory: import.meta.dirname, environments: ['local', 'staging'] }),
)
