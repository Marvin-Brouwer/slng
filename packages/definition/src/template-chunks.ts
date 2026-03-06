import { type StringChunk, type TemplateChunk } from './types.js'

import type { Position } from 'estree'

function advancePos(pos: Position, text: string): Position {
	let line = pos.line
	let column = pos.column
	for (const char of text) {
		if (char === '\n') {
			line++
			column = 0
		}
		else {
			column++
		}
	}
	return { line, column }
}

/**
 * A wrapper around a `TemplateChunk[]` array that supports safe segmentation.
 *
 * Since structural boundaries in templates (e.g. the blank line separating
 * HTTP headers from the body) always fall inside string chunks — never inside
 * reference chunks — `splitAtStringPattern` can reliably split the collection
 * by text pattern without risking splitting across a reference.
 */
export class TemplateChunks {
	constructor(readonly chunks: ReadonlyArray<TemplateChunk>) {}

	get length(): number { return this.chunks.length }

	/** Sub-range by chunk index, equivalent to `Array.slice`. */
	slice(start: number, end?: number): TemplateChunks {
		return new TemplateChunks(this.chunks.slice(start, end))
	}

	/**
	 * Finds the first occurrence of `pattern` inside a string chunk and splits
	 * the collection there. The matching string chunk is split into two
	 * `StringChunk`s at the match boundary; the match itself is consumed.
	 *
	 * Returns `[before, after]` where `before` ends just before the match and
	 * `after` starts just after the match. Returns `undefined` if not found.
	 */
	splitAtStringPattern(pattern: RegExp): [TemplateChunks, TemplateChunks] | undefined {
		for (const [index, chunk] of this.chunks.entries()) {
			if (chunk.type !== 'chunk:string') continue

			const match = pattern.exec(chunk.value)
			if (!match) continue

			const beforeText = chunk.value.slice(0, match.index)
			const afterText = chunk.value.slice(match.index + match[0].length)

			const chunkStart = chunk.loc?.start ?? { line: 1, column: 0 }
			const beforeEnd = advancePos(chunkStart, beforeText)
			const afterStart = advancePos(beforeEnd, match[0])
			const chunkEnd = chunk.loc?.end

			const beforeChunk: StringChunk = {
				type: 'chunk:string',
				value: beforeText,
				loc: { start: chunkStart, end: beforeEnd },
			}
			const afterChunk: StringChunk = {
				type: 'chunk:string',
				value: afterText,
				loc: { start: afterStart, end: chunkEnd ?? advancePos(afterStart, afterText) },
			}

			const left = new TemplateChunks([...this.chunks.slice(0, index), beforeChunk])
			const right = new TemplateChunks([afterChunk, ...this.chunks.slice(index + 1)])
			return [left, right]
		}
		return undefined
	}

	[Symbol.iterator](): Iterator<TemplateChunk> {
		return this.chunks[Symbol.iterator]()
	}
}
