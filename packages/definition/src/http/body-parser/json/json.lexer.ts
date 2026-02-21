import { isMask, Masked } from '../../../masking/mask'
import { SlingNode } from '../../../sling-node'
import { PrimitiveValue } from '../../../types'

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

const lexerToken = {
	end: { type: 'EOF' } as LexerToken,
	punctuation(character: typeof punctuationCharacters[number]): LexerToken {
		return { type: character }
	},
	value(type: string, character: string): LexerToken {
		return { type: `json-token:${type}`, value: character }
	},
}
const isWhitespace = (character: string) => /\s/.test(character)
const isPunctuation = (character: string): character is typeof punctuationCharacters[number] =>
	punctuationCharacters.includes(character as typeof punctuationCharacters[number])

export function lexJson(parts: (PrimitiveValue | Masked<PrimitiveValue>)[]) {
	const tokens = new Array<LexerToken>()
	let stringMode = false
	let lineCommentMode = false
	let blockCommentMode = false
	let escapeCount = 0

	for (const part of parts) {
		if (isMask(part)) {
			// Masked values are always values, even inside comments/strings
			// because they are native objects injected into the template.
			tokens.push({ type: 'json-token:masked', value: part })
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
				tokens.push(lexerToken.punctuation('*/'))
				blockCommentMode = false
				index += 2
				continue
			}

			// Exit String Mode (on unescaped ")
			if (stringMode && currentCharacter === '"' && escapeCount % 2 === 0) {
				stringMode = false
				tokens.push(lexerToken.punctuation('"'))
				escapeCount = 0
				index++
				continue
			}

			// --- 2. ENTER MODES (Only if not already in a mode) ---
			if (!stringMode && !lineCommentMode && !blockCommentMode) {
				if (currentCharacter === '/' && nextCharacter === '/') {
					lineCommentMode = true
					tokens.push(lexerToken.punctuation('//'))
					index += 2
					continue
				}
				if (currentCharacter === '/' && nextCharacter === '*') {
					blockCommentMode = true
					tokens.push(lexerToken.punctuation('/*'))
					index += 2
					continue
				}
				if (currentCharacter === '"') {
					stringMode = true
					tokens.push(lexerToken.punctuation('"'))
					escapeCount = 0
					index++
					continue
				}
			}

			// --- 3. ACCUMULATE CONTENT ---

			// If we are in any mode, we swallow characters greedily
			if (stringMode || lineCommentMode || blockCommentMode) {
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
					index++
				}

				if (accumulator) {
					tokens.push(lexerToken.value(stringMode ? 'string-content' : 'comment-body', accumulator))
				}
				continue
			}

			// --- 4. STANDARD JSON (WHITESPACE & PUNCTUATION) ---
			if (isWhitespace(currentCharacter)) {
				let ws = ''
				while (index < characters.length && isWhitespace(characters[index])) {
					ws += characters[index]
					index++
				}
				tokens.push(lexerToken.value('whitespace', ws))
				continue
			}

			if (isPunctuation(currentCharacter)) {
				tokens.push(lexerToken.punctuation(currentCharacter))
				index++
				continue
			}

			// 5. LITERALS (true, false, null, numbers)
			let literal = ''
			while (index < characters.length && !isPunctuation(characters[index]) && !isWhitespace(characters[index])) {
				literal += characters[index]
				index++
			}
			if (literal) tokens.push(lexerToken.value('literal', literal))
		}
	}
	tokens.push(lexerToken.end)
	return tokens
}
