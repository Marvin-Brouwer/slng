import { defineConfig } from 'eslint/config'
import importPlugin from 'eslint-plugin-import'
import unusedImports from 'eslint-plugin-unused-imports'

export const lintImports = defineConfig([
	importPlugin.flatConfigs.recommended,
	importPlugin.flatConfigs.typescript,
	{
		plugins: {
			['unused-imports']: unusedImports,
		},
		rules: {
			// auto-remove unused imports
			'unused-imports/no-unused-imports': 'error',
			// optionally warn about unused vars but allow _ prefix
			'unused-imports/no-unused-vars': [
				'warn',
				{ vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
			],
		},
	},
	{
		settings: {
			'import/parsers': {
				'@typescript-eslint/parser': ['.ts', '.tsx', '.mts', '.cts', '.d.ts'],
			},
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
				},
				node: {
					extensions: ['.js', '.jsx'],
					moduleDirectory: ['node_modules', 'src/', 'tests/'],
				},
			},
			'import/extensions': ['.js', '.jsx', '.ts', '.tsx', '.mts', '.cts'],

		},
		rules: {
			'import/order': [
				'error',
				{
					'groups': [
						'builtin', // Node.js builtins
						'external', // npm libs
						'internal', // alias paths, tsconfig paths
						'parent', // ../
						'sibling', // ./same-folder
						'index', // index imports
						'object', // import a namespace
						'type', // import type {...}
					],
					'newlines-between': 'always',
					'alphabetize': {
						order: 'asc',
						caseInsensitive: true,
					},
				},
			],

			// Disable conflicting built-in sorting
			'sort-imports': 'off',
		},
	},
])
