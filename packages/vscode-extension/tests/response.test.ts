/* eslint-disable unicorn/no-empty-file -- WIP */
// import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock('vscode', () => import('./mocks/vscode.js'))

// import { ResponsePanel } from '../src/panels/response.js'

// import {
// 	window,
// 	createMockExtensionContext,
// 	type WebviewPanel,
// } from './mocks/vscode.js'

// function createResult(overrides: Record<string, unknown> = {}) {
// 	return {
// 		name: 'getUsers',
// 		method: 'GET',
// 		url: 'https://api.example.com/users',
// 		status: 200,
// 		statusText: 'OK',
// 		headers: { 'content-type': 'application/json' },
// 		body: '{"users": []}',
// 		duration: 42,
// 		...overrides,
// 	}
// }

// describe('ResponsePanel', () => {
// 	let context: ReturnType<typeof createMockExtensionContext>

// 	beforeEach(() => {
// 		context = createMockExtensionContext();
// 		// Reset the singleton between tests
// 		(ResponsePanel as unknown as Record<string, unknown>).instance = undefined
// 		vi.clearAllMocks()
// 	})

// 	it('creates a webview panel with the export name in the title', () => {
// 		ResponsePanel.show(context as never, createResult() as never, true)

// 		expect(window.createWebviewPanel).toHaveBeenCalledOnce()
// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		expect(panel.title).toBe('Sling: getUsers')
// 	})

// 	it('renders the HTTP method and URL', () => {
// 		ResponsePanel.show(context as never, createResult() as never, true)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		const html = panel.webview.html

// 		expect(html).toContain('GET')
// 		expect(html).toContain('https://api.example.com/users')
// 	})

// 	it('renders the status code and duration', () => {
// 		ResponsePanel.show(context as never, createResult() as never, true)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		const html = panel.webview.html

// 		expect(html).toContain('200')
// 		expect(html).toContain('OK')
// 		expect(html).toContain('42ms')
// 	})

// 	it('renders response headers in a table', () => {
// 		ResponsePanel.show(
// 			context as never,
// 			createResult({ headers: { 'x-custom': 'value123' } }) as never,
// 			true,
// 		)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		const html = panel.webview.html

// 		expect(html).toContain('x-custom')
// 		expect(html).toContain('value123')
// 	})

// 	it('pretty-prints JSON bodies', () => {
// 		ResponsePanel.show(
// 			context as never,
// 			createResult({ body: '{"key":"value"}' }) as never,
// 			true,
// 		)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		const html = panel.webview.html

// 		// Pretty-printed JSON has indentation (quotes are HTML-escaped)
// 		expect(html).toContain('&quot;key&quot;: &quot;value&quot;')
// 	})

// 	it('renders non-JSON bodies as-is', () => {
// 		ResponsePanel.show(
// 			context as never,
// 			createResult({ body: 'plain text response' }) as never,
// 			true,
// 		)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		expect(panel.webview.html).toContain('plain text response')
// 	})

// 	it('applies success styling for 2xx status codes', () => {
// 		ResponsePanel.show(context as never, createResult({ status: 201 }) as never, true)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		expect(panel.webview.html).toContain('success')
// 	})

// 	it('applies error styling for 4xx/5xx status codes', () => {
// 		ResponsePanel.show(context as never, createResult({ status: 500 }) as never, true)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		expect(panel.webview.html).toContain('error')
// 	})

// 	it('escapes HTML in response body to prevent XSS', () => {
// 		ResponsePanel.show(
// 			context as never,
// 			createResult({ body: '<script>alert("xss")</script>' }) as never,
// 			true,
// 		)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		const html = panel.webview.html

// 		expect(html).not.toContain('<script>alert')
// 		expect(html).toContain('&lt;script&gt;')
// 	})

// 	it('reuses the existing panel on subsequent calls', () => {
// 		ResponsePanel.show(context as never, createResult() as never, true)
// 		ResponsePanel.show(
// 			context as never,
// 			createResult({ name: 'createUser', method: 'POST' }) as never,
// 			true,
// 		)

// 		// Only one panel created
// 		expect(window.createWebviewPanel).toHaveBeenCalledOnce()

// 		// But the content is updated
// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		expect(panel.title).toBe('Sling: createUser')
// 		expect(panel.reveal).toHaveBeenCalled()
// 	})

// 	it('has Body and Headers tabs', () => {
// 		ResponsePanel.show(context as never, createResult() as never, true)

// 		const panel = window.createWebviewPanel.mock.results[0].value as WebviewPanel
// 		const html = panel.webview.html

// 		expect(html).toContain('Body')
// 		expect(html).toContain('Headers')
// 		expect(html).toContain('showTab')
// 	})
// })
