/**
 * Minimal HTTP AST — only extracts the request method.
 *
 * This is intentionally separate from the full HTTP parser.
 * It is useful for early validation and editor tooling where you only
 * need to know the method without parsing headers, body, etc.
 */

/** AST node representing just the HTTP method token in a request template. */
export interface MethodNode {
	type: 'method'
	/** The raw method string, e.g. `"GET"` or `"POST"`. */
	value: string
	/** Character offset of the method within the raw template string. */
	offset: number
	/** Character length of the method token. */
	length: number
}

export interface MethodErrorNode {
	type: 'method-error'
	reason: string
}

export type MethodParseResult = MethodNode | MethodErrorNode

/**
 * Parse only the HTTP method from a raw sling template literal string.
 *
 * Accepts the text between the backticks (including the leading newline that
 * sling templates require) and returns the position of the first non-whitespace
 * token, which is the HTTP method.
 *
 * @example
 * ```ts
 * parseHttpMethod('\n  GET https://example.com HTTP/1.1\n')
 * // → { type: 'method', value: 'GET', offset: 3, length: 3 }
 * ```
 */
export function parseHttpMethod(templateText: string): MethodParseResult {
	const newlineIdx = templateText.indexOf('\n')
	if (newlineIdx === -1) {
		return { type: 'method-error', reason: 'Template must start with a newline' }
	}

	const afterNewline = templateText.slice(newlineIdx + 1)
	const methodMatch = /\S+/.exec(afterNewline)
	if (!methodMatch) {
		return { type: 'method-error', reason: 'No HTTP method found' }
	}

	return {
		type: 'method',
		value: methodMatch[0],
		offset: newlineIdx + 1 + methodMatch.index,
		length: methodMatch[0].length,
	}
}
