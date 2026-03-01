import { defineConfig } from 'tsup'

const isDevelopment = process.env.NODE_ENV !== 'production'

export default defineConfig([
	{
		entry: {
			extension: 'src/extension.ts',
		},
		format: ['cjs'], // VS Code extensions must be CJS
		dts: true,
		clean: true,
		sourcemap: true,
		platform: 'node',
		removeNodeProtocol: false,
		external: [
			/^node:.*/,
			'vscode',
		],
		define: {
			__DEV__: JSON.stringify(isDevelopment),
		},
	},
	{
		entry: {
			'response-panel': 'src/response-panel/response-panel.ts',
		},
		format: ['iife'],
		dts: true,
		sourcemap: 'inline',
		platform: 'browser',
		removeNodeProtocol: false,
		treeshake: { moduleSideEffects: 'no-external' },
		cjsInterop: true,
		shims: true,
		publicDir: './src/response-panel/public',
		loader: {
			'.svg': 'text',
		},
	},
])
