import sling, { useDotEnvironment } from '@slng/config'

export default sling(
	useDotEnvironment({ directory: import.meta.dirname, environments: ['local', 'staging'] }),
)
