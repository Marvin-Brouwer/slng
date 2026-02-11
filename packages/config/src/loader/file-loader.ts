import * as fs from 'node:fs'

import { parse } from '@babel/parser'
import _traverse, { Node } from '@babel/traverse'
import { assertIdentifier, isDeclaration, isIdentifier, isTaggedTemplateExpression, isVariableDeclaration, SourceLocation } from '@babel/types'

import { SlingDefinition } from '../types'

import { loadModuleFile } from './require'

// https://github.com/babel/babel/issues/13855#issuecomment-945123514
const traverse = (_traverse as unknown as typeof import('@babel/traverse')).default

export type AstData = {
	readonly exportName: string
	readonly sourcePath: string
	readonly exportLocation: SourceLocation
	readonly literalLocation: SourceLocation
	readonly astNode: Node
}

export async function loadDefinitionFile(filePath: string) {
	const definitions = await loadModuleFile<Record<string, SlingDefinition>>(filePath)
	// TODO parse the HTTP syntax inside of the template too
	const fileAst = parseDefinitionFile(filePath, Object.keys(definitions))

	for (const definitionName in definitions) {
		(definitions[definitionName].getInternals() as { tsAst: AstData }).tsAst = Object.freeze(fileAst[definitionName])
	}

	return definitions
}

function parseDefinitionFile(filePath: string, exportNames: string[]) {
	const code = fs.readFileSync(filePath, 'utf8')

	// 1. Parse the file into an AST
	const ast = parse(code, {
		sourceType: 'module',
		plugins: ['typescript'],
	})

	const metadata: Record<string, AstData> = {}

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
						// todo do we want to be name strict?
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
							// Keep this as reference (TODO, verify if we need this)
							astNode: declaration,
						}
					}
				}
			}
		},
	})

	return metadata
}
