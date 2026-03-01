import { isMask, Masked } from '../../masking/mask'
import { SlingNode } from '../../nodes/nodes'
import { PrimitiveValue } from '../../types'

export type LexerToken = ValueToken | PunctuationToken | MaskedToken
export type PunctuationToken = SlingNode & { type: typeof punctuationCharacters[number] | 'EOF' }
export type ValueToken = SlingNode & {
	type: `json-token:${string}`
	value: string
}
export type MaskedToken = SlingNode & {
	type: `json-token:masked`
	value: Masked<PrimitiveValue>
}

const punctuationCharacters = [
	// JSON
	'{', '}', '[', ']', ':', ',', '"',
	// JSONC
	'//', '/*', '*/',
] as const

const isWhitespace = (character: string) => /\s/.test(character)
const isPunctuation = (character: string): character is typeof punctuationCharacters[number] =>
	punctuationCharacters.includes(character as typeof punctuationCharacters[number])

type Pos = { line: number, column: number }

function advance(pos: Pos, char: string): Pos {
	return char === '\n'
		? { line: pos.line + 1, column: 0 }
		: { line: pos.line, column: pos.column + 1 }
}

function loc(start: Pos, end: Pos) {
	return { start, end }
}

export function lexJson(
	parts: (PrimitiveValue | Masked<PrimitiveValue>)[],
	startLoc?: { line: number, column: number },
) {
	const tokens = new Array<LexerToken>()
	let stringMode = false
	let lineCommentMode = false
	let blockCommentMode = false
	let escapeCount = 0
	let pos: Pos = startLoc ? { ...startLoc } : { line: 1, column: 0 }

	for (const part of parts) {
		if (isMask(part)) {
			// Masked values are always values, even inside comments/strings
			// because they are native objects injected into the template.
			const start = { ...pos }
			tokens.push({ type: 'json-token:masked', value: part, loc: loc(start, start) })
			continue
		}

		const characters = String(part)
		let index = 0

		while (index < characters.length) {
			const currentCharacter = characters[index]
			const nextCharacter = characters[index + 1]

			// --- 1. EXIT MODES ---

			// Exit Line Comment (on Newline)
			if (lineCommentMode && currentCharacter === '\n') {
				lineCommentMode = false
				// Don't 'continue' yet, let whitespace logic handle the \n
			}

			// Exit Block Comment (on */)
			if (blockCommentMode && currentCharacter === '*' && nextCharacter === '/') {
				const start = { ...pos }
				pos = advance(pos, currentCharacter)
				pos = advance(pos, nextCharacter)
				tokens.push({ type: '*/', loc: loc(start, { ...pos }) })
				blockCommentMode = false
				index += 2
				continue
			}

			// Exit String Mode (on unescaped ")
			if (stringMode && currentCharacter === '"' && escapeCount % 2 === 0) {
				stringMode = false
				const start = { ...pos }
				pos = advance(pos, currentCharacter)
				tokens.push({ type: '"', loc: loc(start, { ...pos }) })
				escapeCount = 0
				index++
				continue
			}

			// --- 2. ENTER MODES (Only if not already in a mode) ---
			if (!stringMode && !lineCommentMode && !blockCommentMode) {
				if (currentCharacter === '/' && nextCharacter === '/') {
					lineCommentMode = true
					const start = { ...pos }
					pos = advance(pos, currentCharacter)
					pos = advance(pos, nextCharacter)
					tokens.push({ type: '//', loc: loc(start, { ...pos }) })
					index += 2
					continue
				}
				if (currentCharacter === '/' && nextCharacter === '*') {
					blockCommentMode = true
					const start = { ...pos }
					pos = advance(pos, currentCharacter)
					pos = advance(pos, nextCharacter)
					tokens.push({ type: '/*', loc: loc(start, { ...pos }) })
					index += 2
					continue
				}
				if (currentCharacter === '"') {
					stringMode = true
					const start = { ...pos }
					pos = advance(pos, currentCharacter)
					tokens.push({ type: '"', loc: loc(start, { ...pos }) })
					escapeCount = 0
					index++
					continue
				}
			}

			// --- 3. ACCUMULATE CONTENT ---

			// If we are in any mode, we swallow characters greedily
			if (stringMode || lineCommentMode || blockCommentMode) {
				const start = { ...pos }
				let accumulator = ''
				while (index < characters.length) {
					const accumulatorCurrentCharacter = characters[index]
					const accumulatorNextCharacter = characters[index + 1]

					// Logic for backslashes (only matters in strings)
					if (stringMode) {
						if (accumulatorCurrentCharacter === '\\') {
							escapeCount++
						}
						else if (accumulatorCurrentCharacter === '"' && escapeCount % 2 === 0) {
							break // Hit end of string
						}
						else {
							escapeCount = 0 // Reset escapes on any normal character
						}
					}

					// Comment exit checks
					if (lineCommentMode && accumulatorCurrentCharacter === '\n') break
					if (blockCommentMode && accumulatorCurrentCharacter === '*' && accumulatorNextCharacter === '/') break

					accumulator += accumulatorCurrentCharacter
					pos = advance(pos, accumulatorCurrentCharacter)
					index++
				}

				if (accumulator) {
					tokens.push({
						type: `json-token:${stringMode ? 'string-content' : 'comment-body'}`,
						value: accumulator,
						loc: loc(start, { ...pos }),
					})
				}
				continue
			}

			// --- 4. STANDARD JSON (WHITESPACE & PUNCTUATION) ---
			if (isWhitespace(currentCharacter)) {
				const start = { ...pos }
				let ws = ''
				while (index < characters.length && isWhitespace(characters[index])) {
					pos = advance(pos, characters[index])
					ws += characters[index]
					index++
				}
				tokens.push({ type: 'json-token:whitespace', value: ws, loc: loc(start, { ...pos }) })
				continue
			}

			if (isPunctuation(currentCharacter)) {
				const start = { ...pos }
				pos = advance(pos, currentCharacter)
				tokens.push({ type: currentCharacter, loc: loc(start, { ...pos }) })
				index++
				continue
			}

			// 5. LITERALS (true, false, null, numbers)
			const start = { ...pos }
			let literal = ''
			while (index < characters.length && !isPunctuation(characters[index]) && !isWhitespace(characters[index])) {
				pos = advance(pos, characters[index])
				literal += characters[index]
				index++
			}
			if (literal) tokens.push({ type: 'json-token:literal', value: literal, loc: loc(start, { ...pos }) })
		}
	}
	tokens.push({ type: 'EOF' })
	return tokens
}
