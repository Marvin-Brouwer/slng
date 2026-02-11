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

export function loadModuleFile<TModule>(filePath: string) {
	const fileUrl = pathToFileURL(filePath).href
	const packagedir = findPackageJson(filePath)

	// TODO debug only true when configured
	const jitiModule = createJiti(packagedir ?? fileUrl, { debug: true })

	return jitiModule.import<TModule>(fileUrl)
}
