import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { isSlingDefinition } from '@slng/config'
import { glob } from 'glob'

import type { SlingDefinition } from '@slng/config'

export interface LoadedDefinition {
	name: string
	definition: SlingDefinition
	sourcePath: string
}

/**
 * Load all sling definitions from a single file.
 */
export async function loadFile(filePath: string): Promise<LoadedDefinition[]> {
	const absolutePath = path.resolve(filePath)
	const fileUrl = pathToFileURL(absolutePath).href

	const module_ = (await import(fileUrl)) as Record<string, unknown>
	const definitions: LoadedDefinition[] = []

	for (const [key, value] of Object.entries(module_)) {
		if (key === 'default') continue // Skip the config export
		if (isSlingDefinition(value)) {
			value.getInternals().name = key
			value.getInternals().sourcePath = absolutePath
			definitions.push({
				name: key,
				definition: value,
				sourcePath: absolutePath,
			})
		}
	}

	return definitions
}

/**
 * Load all sling definitions from files matching a glob pattern.
 */
export async function loadGlob(
	pattern: string,
	options?: { ignore?: string[] },
): Promise<LoadedDefinition[]> {
	const files = await glob(pattern, {
		absolute: true,
		ignore: options?.ignore,
	})
	const allDefinitions: LoadedDefinition[] = []

	for (const file of files.toSorted()) {
		const definitions = await loadFile(file)
		allDefinitions.push(...definitions)
	}

	return allDefinitions
}

/**
 * Auto-discover sling files in the current directory.
 * Excludes node_modules, config files, and dist directories.
 */
export async function autoDiscover(): Promise<LoadedDefinition[]> {
	return loadGlob('./**/*.mts', {
		ignore: ['**/node_modules/**', '**/*.config.mts', '**/dist/**'],
	})
}
