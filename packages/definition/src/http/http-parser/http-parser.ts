import { isMask, Masked } from '../../masking/mask'
import { error, ErrorNode, Metadata, reference, text, ValueNode, values, ValuesNode } from '../../nodes/nodes'
import { PrimitiveValue } from '../../types'
import { header, HeaderNode } from '../http.nodes'

export type TemplateLines = TemplateLine[]
export type TemplateLine = TemplatePart[]
export interface TemplatePart {
	part: PrimitiveValue | Masked<PrimitiveValue> | undefined
	/** When set, this part corresponds to template.values[valueIndex], pre-populated in metadata.parameters. */
	valueIndex?: number
}

export function parseHeaders(lines: TemplateLines, metadata: Metadata): (HeaderNode | ErrorNode)[] | undefined {
	const headers: (HeaderNode | ErrorNode)[] = []

	for (const lineParts of lines) {
		// Skip lines that are purely whitespace
		const isWhitespaceLine = lineParts.every(p => typeof p.part === 'string' && p.part.trim() === '')
		if (lineParts.length === 0 || isWhitespaceLine) continue

		const nameTemplatePart = lineParts[0]

		// Header name must start with a string
		if (typeof nameTemplatePart.part !== 'string') {
			headers.push(error({
				reason: 'Header name must be a literal string.',
			}))
			continue
		}

		const rawLineFragment = nameTemplatePart.part
		const colonIndex = rawLineFragment.indexOf(':')

		if (colonIndex === -1) {
			headers.push(error({
				reason: 'Header must contain a colon separator (name: value)',
				suggestions: ['sling.append-header-key'],
			}))
			continue
		}

		// Extract Name
		// TODO implement meta header support
		const rawName = rawLineFragment.slice(0, colonIndex).trim()
		if (rawName.length === 0) {
			headers.push(error({
				reason: 'Empty header name',
			}))
			continue
		}
		if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(rawName)) {
			headers.push(error({
				reason: 'Illegal header name, invalid characters',
			}))
			continue
		}
		const nameNode = text(rawName.toLowerCase())

		// Extract Value Parts
		// This logic handles the case where the value starts in the same string part as the colon
		// AND cases where the value spans multiple interpolated parts
		const valueParts: TemplatePart[] = []

		// 1. Get the rest of the first string part (after the colon)
		const valueSuffix = rawLineFragment.slice(colonIndex + 1).trimStart()
		if (valueSuffix) {
			valueParts.push({
				part: valueSuffix,
			})
		}

		// 2. Add all subsequent parts of the line (interpolations, other strings)
		for (let index = 1; index < lineParts.length; index++) {
			valueParts.push(lineParts[index])
		}

		const valueNode = resolveCompoundNode(valueParts, metadata)
		headers.push(header(nameNode, valueNode))

		if (isContentTypeHeader(nameNode.value)) {
			if (valueNode.type === 'text')
				metadata.contentType = valueNode.value
			else if (valueNode.type === 'reference') {
				const param = metadata.parameters[valueNode.reference]
				if (isMask(param)) metadata.contentType = String(param.unmask())
				else if (param !== undefined) metadata.contentType = String(param)
			}
		}
	}
	return headers.length > 0 ? headers : undefined
}

// --- Helpers ---

/**
 * Resolves a list of parts into a single Node.
 * If multiple parts exist, returns a ValueNode.
 * If single part, returns specific TextNode or ReferenceNode.
 */
export function resolveCompoundNode<T extends ValuesNode | ValueNode = ValuesNode | ValueNode>(parts: TemplatePart[], metadata: Metadata): T {
	if (parts.length === 0) {
		// Fallback for empty values
		return text('') as T
	}

	// If there's exactly one part, try to simplify it
	if (parts.length === 1) {
		return resolveSingleNode<Exclude<T, ValuesNode>>(parts[0], metadata)
	}

	// Otherwise, wrap in ValueNode
	const nodes = parts.map(p => resolveSingleNode(p, metadata))
	return values(...nodes) as T
}

/**
 * Resolves a single template part into a specific Node type.
 *
 * When `part.valueIndex` is set the parameter is already pre-populated in
 * `metadata.parameters` and a {@link ReferenceNode} is returned directly.
 * Otherwise (old path, used with ResolvedStringTemplate) masked values are
 * appended to `metadata.parameters` on first encounter.
 */
export function resolveSingleNode<T extends ValueNode = ValueNode>(part: TemplatePart, metadata: Metadata): T {
	if (part.valueIndex !== undefined) {
		// New path: pre-populated parameters, reference by template value index
		if (isMask(part.part)) return reference(part.valueIndex, 'mask', part.part.value) as T
		if (part.part === undefined) return reference(part.valueIndex, 'value', '') as T
		return text(part.part) as T
	}

	// Old path: append masked values to parameters as encountered
	if (isMask(part.part)) {
		const referenceIndex = metadata.appendParameter(part.part)
		return reference(referenceIndex, 'mask', part.part.value) as T
	}

	return text(part.part!) as T
}

function isContentTypeHeader(name: string) {
	return name === 'content-type'
}
