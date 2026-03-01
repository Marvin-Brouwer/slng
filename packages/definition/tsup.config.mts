import { defineConfig } from 'tsup'

export default defineConfig({
	entry: ['src/_module/*.ts'],
	format: ['esm'],
	platform: 'node',
	treeshake: { moduleSideEffects: 'no-external' },
	external: [
		/^node:.*/,
	],
	dts: true,
	clean: true,
	sourcemap: true,
	removeNodeProtocol: false,
	shims: true,
	cjsInterop: true,
})
