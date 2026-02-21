import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/_module/*.ts'],
	format: ['esm'],
	dts: true,
	clean: true,
	sourcemap: true,
})
