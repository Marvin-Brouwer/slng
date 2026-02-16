import { defineConfig } from 'tsup'

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
	},
	{
		entry: {
			'response.webview': 'src/views/response.webview.ts',
		},
		format: ['iife'],
		dts: true,
		sourcemap: true,
		platform: 'browser',
		treeshake: true,
		cjsInterop: true,
		shims: true,
		publicDir: './src/views/public',
		loader: {
			'.svg': 'text',
		},
	},
])
