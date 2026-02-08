import sling, { useDotEnv } from '@slng/config'

export default sling(
	useDotEnv({ dir: import.meta.dirname, environments: ['local', 'staging'] }),
)
