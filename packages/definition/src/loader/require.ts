import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { createJiti } from 'jiti'

function findPackageJson(startPath: string): string | undefined {
	let directory = path.resolve(startPath)

	while (true) {
		const package_ = path.join(directory, 'package.json')
		if (fs.existsSync(package_)) return package_

		const parent = path.dirname(directory)
		if (parent === directory) break // reached filesystem root
		directory = parent
	}

	return void 0
}

function createJitiModule(filePath: string) {
	const fileUrl = pathToFileURL(filePath).href
	const packageDirectory = findPackageJson(filePath)

	// TODO debug only true when configured
	const debugJiti = true
	return createJiti(packageDirectory ?? fileUrl, {
		debug: debugJiti,
		moduleCache: false,
		sourceMaps: debugJiti,
	})
}

export function loadModuleFile<TModule>(filePath: string) {
	const fileUrl = pathToFileURL(filePath).href
	return createJitiModule(filePath).import<TModule>(fileUrl)
}

// TODO, not happy with the temp file, there has to be a way to load jiti evalModule with top level await
export async function evalModuleFile<TModule>(filePath: string, content: string): Promise<TModule> {
	const extension = path.extname(filePath)
	const base = path.basename(filePath, extension)
	const temporaryPath = path.join(path.dirname(filePath), `${base}.tmp${extension}`)
	const temporaryUrl = pathToFileURL(temporaryPath).href

	await fs.promises.writeFile(temporaryPath, content, 'utf8')
	try {
		return await createJitiModule(temporaryPath).import<TModule>(temporaryUrl)
	}
	finally {
		await fs.promises.unlink(temporaryPath).catch(() => { /* already deleted */ })
	}
}
