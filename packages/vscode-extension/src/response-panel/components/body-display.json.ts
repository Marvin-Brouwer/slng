import { SimpleElement } from '../element-helper'

const MAX_BRACKET_PAIR_COLORS = 6

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

function bracketClass(depth: number): string {
	return `json-bracket json-bracket-${(Math.max(0, depth) % MAX_BRACKET_PAIR_COLORS) + 1}`
}

/**
 * Tokenizes a JSONC string and returns syntax-highlighted HTML.
 * Supports single-line (//) and block comments.
 * On failure, returns the raw input string.
 */
export function buildJson(input: string): string {
	try {
		return colorizeJsonc(input)
	}
	catch {
		return input
	}
}

function colorizeJsonc(input: string): string {
	const html: string[] = []
	let index = 0
	let depth = 0
	const contextStack: ('object' | 'array')[] = []
	let expectingKey = false

	while (index < input.length) {
		const ch = input[index]

		// Whitespace
		if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
			html.push(ch)
			index++
			continue
		}

		// Line comment
		if (ch === '/' && input[index + 1] === '/') {
			const end = input.indexOf('\n', index)
			const comment = end === -1 ? input.slice(index) : input.slice(index, end)
			html.push(`<span class="json-comment">${escapeHtml(comment)}</span>`)
			index += comment.length
			continue
		}

		// Block comment
		if (ch === '/' && input[index + 1] === '*') {
			const end = input.indexOf('*/', index + 2)
			const comment = end === -1 ? input.slice(index) : input.slice(index, end + 2)
			html.push(`<span class="json-comment">${escapeHtml(comment)}</span>`)
			index += comment.length
			continue
		}

		// Open brace
		if (ch === '{') {
			html.push(`<span class="${bracketClass(depth)}">{</span>`)
			depth++
			contextStack.push('object')
			expectingKey = true
			index++
			continue
		}

		// Close brace
		if (ch === '}') {
			depth--
			contextStack.pop()
			html.push(`<span class="${bracketClass(depth)}">}</span>`)
			index++
			continue
		}

		// Open bracket
		if (ch === '[') {
			html.push(`<span class="${bracketClass(depth)}">[</span>`)
			depth++
			contextStack.push('array')
			index++
			continue
		}

		// Close bracket
		if (ch === ']') {
			depth--
			contextStack.pop()
			html.push(`<span class="${bracketClass(depth)}">]</span>`)
			index++
			continue
		}

		// Colon
		if (ch === ':') {
			html.push('<span class="json-punctuation">:</span>')
			expectingKey = false
			index++
			continue
		}

		// Comma
		if (ch === ',') {
			html.push('<span class="json-punctuation">,</span>')
			if (contextStack.at(-1) === 'object') {
				expectingKey = true
			}
			index++
			continue
		}

		// String
		if (ch === '"') {
			let stringEnd = index + 1
			while (stringEnd < input.length) {
				if (input[stringEnd] === '\\') {
					stringEnd += 2
					continue
				}
				if (input[stringEnd] === '"') {
					stringEnd++
					break
				}
				stringEnd++
			}
			const raw = input.slice(index, stringEnd)
			const cssClass = expectingKey ? 'json-key' : 'json-string'
			html.push(`<span class="${cssClass}">${escapeHtml(raw)}</span>`)
			if (expectingKey) expectingKey = false
			index = stringEnd
			continue
		}

		// Number
		if (ch === '-' || (ch >= '0' && ch <= '9')) {
			let numberEnd = index + 1
			while (numberEnd < input.length && /[\d.eE+-]/.test(input[numberEnd])) numberEnd++
			html.push(`<span class="json-number">${input.slice(index, numberEnd)}</span>`)
			index = numberEnd
			continue
		}

		// Keywords
		if (input.startsWith('true', index)) {
			html.push('<span class="json-keyword">true</span>')
			index += 4
			continue
		}
		if (input.startsWith('false', index)) {
			html.push('<span class="json-keyword">false</span>')
			index += 5
			continue
		}
		if (input.startsWith('null', index)) {
			html.push('<span class="json-keyword">null</span>')
			index += 4
			continue
		}

		// Anything else
		html.push(escapeHtml(ch))
		index++
	}

	return html.join('')
}

export class HttpJsonBody extends SimpleElement {
	static tagName = 'json-body-display'
	static canProcess(mimeType: string) {
		return mimeType === 'application/json' || mimeType.endsWith('+json')
	}

	protected onMount() {
		this.innerHTML = this.createHtml('pre', {
			innerHTML: colorizeJsonc(this.textContent),
		})
	}
}

SimpleElement.register(HttpJsonBody)
