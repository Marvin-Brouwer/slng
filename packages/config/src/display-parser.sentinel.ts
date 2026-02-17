// Sentinels use characters that are valid in JSON strings but unlikely in real data
const SENTINEL_PREFIX = '\uFDD0MASK:'
const SENTINEL_SUFFIX = '\uFDD1'

export function makeSentinel(index: number): string {
	return `${SENTINEL_PREFIX}${index}${SENTINEL_SUFFIX}`
}

export const SENTINEL_RE = /\uFDD0MASK:(\d+)\uFDD1/g
