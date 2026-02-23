import type * as vscode from 'vscode'

import { isJsonContentType } from '@slng/definition/extension'

import type { BodyTokenProvider } from './body-token-provider.js'
import { TOKEN_TYPE } from './body-token-provider.js'

// Regex patterns for basic JSON token detection.
// These are intentionally simple — not a full JSON parser.
const STRING_RE = /"(?:[^"\\]|\\.)*"/g
const NUMBER_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g
const KEYWORD_RE = /\b(?:true|false|null)\b/g
const COMMENT_LINE_RE = /\/\/.*/g
const COMMENT_BLOCK_RE = /\/\*[\s\S]*?\*\//g

/** Emit semantic tokens for a JSON body using a lightweight regex scan. */
export const jsonBodyTokenProvider: BodyTokenProvider = {
	canProcess: (contentType) => isJsonContentType(contentType),

	provideTokens(bodyLines, startLine, builder) {
		for (let i = 0; i < bodyLines.length; i++) {
			const line = bodyLines[i]
			const docLine = startLine + i

			// Collect all token ranges so we can skip over them
			// Priority: comments > strings > keywords > numbers
			const occupied = new Set<number>()

			function addToken(start: number, length: number, type: number) {
				for (let c = start; c < start + length; c++) occupied.add(c)
				builder.push(docLine, start, length, type, 0)
			}

			// 1. Line comments
			COMMENT_LINE_RE.lastIndex = 0
			for (let m = COMMENT_LINE_RE.exec(line); m; m = COMMENT_LINE_RE.exec(line)) {
				addToken(m.index, m[0].length, TOKEN_TYPE.comment)
			}

			// 2. Block comments (only on single line for simplicity)
			COMMENT_BLOCK_RE.lastIndex = 0
			for (let m = COMMENT_BLOCK_RE.exec(line); m; m = COMMENT_BLOCK_RE.exec(line)) {
				if (!occupied.has(m.index))
					addToken(m.index, m[0].length, TOKEN_TYPE.comment)
			}

			// 3. Strings — distinguish keys (followed by optional whitespace + ':')
			STRING_RE.lastIndex = 0
			for (let m = STRING_RE.exec(line); m; m = STRING_RE.exec(line)) {
				if (occupied.has(m.index)) continue
				const afterString = line.slice(m.index + m[0].length).trimStart()
				const isKey = afterString.startsWith(':')
				addToken(m.index, m[0].length, isKey ? TOKEN_TYPE.property : TOKEN_TYPE.string)
			}

			// 4. Keywords: true / false / null
			KEYWORD_RE.lastIndex = 0
			for (let m = KEYWORD_RE.exec(line); m; m = KEYWORD_RE.exec(line)) {
				if (!occupied.has(m.index))
					addToken(m.index, m[0].length, TOKEN_TYPE.keyword)
			}

			// 5. Numbers (skip positions already covered)
			NUMBER_RE.lastIndex = 0
			for (let m = NUMBER_RE.exec(line); m; m = NUMBER_RE.exec(line)) {
				if (!occupied.has(m.index))
					addToken(m.index, m[0].length, TOKEN_TYPE.number)
			}
		}
	},
}
