import { SENTINEL_RE } from './display-parser.sentinel.js'

import type { Masked } from './masking/mask.js'
import type { PlainTextAstNode } from './types.js'

export function buildPlainTextBodyAst(
	body: string,
	maskedValues: ReadonlyArray<Masked<unknown>>,
): PlainTextAstNode[] {
	const nodes: PlainTextAstNode[] = []
	let lastIndex = 0

	for (const match of body.matchAll(SENTINEL_RE)) {
		const before = body.slice(lastIndex, match.index)
		if (before.length > 0) {
			nodes.push({ type: 'text', value: before })
		}
		const index = Number(match[1])
		nodes.push({ type: 'masked', index, mask: maskedValues[index].value })
		lastIndex = match.index + match[0].length
	}

	const remaining = body.slice(lastIndex)
	if (remaining.length > 0) {
		nodes.push({ type: 'text', value: remaining })
	}

	return nodes
}
