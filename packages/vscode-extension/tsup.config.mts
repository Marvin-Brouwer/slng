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
		external: ['vscode'],
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
		treeshake: true,
		cjsInterop: true,
		shims: true,
		publicDir: './src/response-panel/public',
		loader: {
			'.svg': 'text',
		},
	},
])
