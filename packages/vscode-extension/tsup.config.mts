import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/extension.ts'],
	format: ['cjs'], // VS Code extensions must be CJS
	dts: true,
	clean: true,
	sourcemap: true,
	external: ['vscode'],
})
