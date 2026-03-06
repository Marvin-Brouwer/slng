import * as fs from 'node:fs'

import { parse } from '@babel/parser'
import _traverse, { Node } from '@babel/traverse'
import { assertIdentifier, isDeclaration, isIdentifier, isTaggedTemplateExpression, isVariableDeclaration, SourceLocation } from '@babel/types'

import { type ErrorNode, type SlingNode } from '../nodes/nodes.js'
import { getProtocolProcessor } from '../protocol/protocol-processor.js'
import { TemplateChunks } from '../template-chunks.js'
import { type SlingDefinition, type StringTemplate } from '../types'

import { evalModuleFile, loadModuleFile } from './require'

// https://github.com/babel/babel/issues/13855#issuecomment-945123514
const traverse = (_traverse as unknown as typeof import('@babel/traverse')).default

export type ExpressionMeta = {
	/** Source position of the first character after `}` (= quasis[i+1].loc.start). */
	end: { line: number, column: number }
	/** Identifier name if the expression is a simple reference like `${apiKey}`. */
	name?: string
}

export type AstData = {
	readonly exportName: string
	readonly sourcePath: string
	readonly exportLocation: SourceLocation
	readonly literalLocation: SourceLocation
	readonly declarationLocation: SourceLocation
	readonly astNode: Node
}

export async function loadDefinitionFile(filePath: string, content?: string) {
	try {
		const definitions = content
			? await evalModuleFile<Record<string, SlingDefinition>>(filePath, content)
			: await loadModuleFile<Record<string, SlingDefinition>>(filePath)
		const { metadata: fileAst, paramMaps } = parseDefinitionFile(filePath, Object.keys(definitions), content)

		for (const definitionName in definitions) {
			const definition = definitions[definitionName]
			const astData = Object.freeze(fileAst[definitionName])
			const internals = definition.getInternals()
			const mutable = internals as { tsAst: AstData, protocolAst: SlingNode | ErrorNode }
			mutable.tsAst = astData

			const processor = getProtocolProcessor(internals.context, internals.template)
			const chunks = flattenTemplate(internals.template, paramMaps[definitionName], astData.literalLocation.start)
			mutable.protocolAst = processor.processProtocol(internals.context, chunks, astData.literalLocation)
				?? ({ type: 'error', reason: 'Protocol processor returned no result' } satisfies ErrorNode)
		}

		return definitions
	}
	catch (error) {
		return error as Error
	}
}

function parseDefinitionFile(filePath: string, exportNames: string[], content?: string) {
	const code = content ?? fs.readFileSync(filePath, 'utf8')

	// 1. Parse the file into an AST
	const ast = parse(code, {
		sourceType: 'module',
		plugins: ['typescript'],
	})

	const metadata: Record<string, AstData> = {}
	const parameterMaps: Record<string, Map<number, ExpressionMeta>> = {}

	// 2. Traverse to find exported variables assigned to sling`...`
	traverse(ast, {
		ExportNamedDeclaration(path) {
			const declaration = path.node.declaration
			if (!isDeclaration(declaration)) return

			if (isVariableDeclaration(declaration)) {
				for (const decl of declaration.declarations) {
					const init = decl.init

					// Check if it's a Tagged Template Literal: sling`...`
					if (isTaggedTemplateExpression(init) && isIdentifier(init.tag)
						&& init.tag.name === 'sling') {
						assertIdentifier(decl.id)
						const exportName = decl.id.name

						// Double check if this is part of the exports that are loaded
						if (!exportNames.includes(exportName)) continue

						metadata[exportName] = {
							exportName,
							sourcePath: filePath,

							// The location of the variable name (e.g., 'getUsers')
							exportLocation: decl.id.loc!,
							// The location of the actual template content (inside the backticks)
							literalLocation: init.quasi.loc!,
							// The location of the entire block
							declarationLocation: {
								...decl.id.loc!,
								end: init.quasi.loc!.end,
							},
							// Keep this as reference (TODO, verify if we need this)
							astNode: declaration,
						}

						// Build a map from value index → expression metadata (end position + name)
						const parameterMap = new Map<number, ExpressionMeta>()
						for (const [index, expr] of init.quasi.expressions.entries()) {
							if (expr.loc) {
								const nextQuasi = init.quasi.quasis[index + 1]
								parameterMap.set(index, {
									end: nextQuasi?.loc
										? { line: nextQuasi.loc.start.line, column: nextQuasi.loc.start.column }
										: { line: expr.loc.end.line, column: expr.loc.end.column + 2 }, // +2 for `}`
									name: isIdentifier(expr) ? expr.name : undefined,
								})
							}
						}
						parameterMaps[exportName] = parameterMap
					}
				}
			}
		},
	})

	return { metadata, paramMaps: parameterMaps }
}

function flattenTemplate(template: StringTemplate, parameterMap: Map<number, ExpressionMeta>, startPos: { line: number, column: number }): TemplateChunks {
	const chunks = []
	let line = startPos.line
	let column = startPos.column

	for (const [index, string_] of template.strings.entries()) {
		const stringStart = { line, column }
		for (const char of string_) {
			if (char === '\n') {
				line++
				column = 0
			}
			else {
				column++
			}
		}
		chunks.push({ type: 'chunk:string' as const, value: string_, loc: { start: stringStart, end: { line, column } } })

		if (index < template.values.length) {
			const value = template.values[index]
			const meta = parameterMap.get(index)
			const referenceStart = { line, column }
			const referenceEnd = meta?.end ?? referenceStart

			chunks.push({ type: 'chunk:reference' as const, value, index: index, name: meta?.name, loc: { start: referenceStart, end: referenceEnd } })
			if (meta?.end) {
				line = meta.end.line
				column = meta.end.column
			}
		}
	}

	return new TemplateChunks(chunks)
}
