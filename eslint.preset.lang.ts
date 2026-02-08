import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export const lintJs = defineConfig([
	{
		plugins: {
			js,
		},
	},
	js.configs.recommended,
])

export const lintTs = defineConfig([
	// eslint-disable-next-line import/no-named-as-default-member
	tseslint.configs.recommendedTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
])
