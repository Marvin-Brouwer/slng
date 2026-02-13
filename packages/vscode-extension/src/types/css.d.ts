// src/types/css.d.ts
declare module '*.css'
declare module '*.css?inline' {
	const css: string
	export default css
}
