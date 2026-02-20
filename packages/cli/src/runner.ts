import { HttpError } from '@slng/config'

import type { LoadedDefinition } from './loader.js'
import type { SlingResponse, ExecuteOptions } from '@slng/config'

type AnyValueNode
	= | { type: 'text', value: string }
	| { type: 'masked', mask: string }
	| { type: 'values', values: AnyValueNode[] }
	| { type: string }

interface RunOptions {
	name?: string
	verbose: boolean
	mask: boolean
	environment?: string
}

interface RunResult {
	name: string
	sourcePath: string
	response?: SlingResponse
	error?: Error
}

/**
 * Run loaded definitions and print results to stdout.
 */
export async function runDefinitions(
	definitions: LoadedDefinition[],
	options: RunOptions,
): Promise<RunResult[]> {
	let toRun = definitions

	// Filter by name if specified
	if (options.name) {
		toRun = definitions.filter(d => d.name === options.name)
		if (toRun.length === 0) {
			const available = definitions.map(d => d.name).join(', ')
			console.error(
				`No definition found with name "${options.name}". Available: ${available || '(none)'}`,
			)
			process.exitCode = 1
			return []
		}
	}

	if (toRun.length === 0) {
		console.error('No sling definitions found.')
		process.exitCode = 1
		return []
	}

	const results: RunResult[] = []

	for (const { name, definition, sourcePath } of toRun) {
		const executeOptions: ExecuteOptions = {
			verbose: options.verbose,
			maskOutput: options.mask,
			environment: options.environment,
		}

		try {
			const result = await definition.execute(executeOptions)
			if (result instanceof HttpError) throw result
			const response = result
			const startLine = response.request.templateAst.startLine
			const method = startLine.type === 'request' && startLine.method.type === 'text' ? startLine.method.value : '?'
			const url = startLine.type === 'request' ? resolveValueNode(startLine.url) : '?'
			printHeader(name, method, url, sourcePath)
			printResponse(name, response, options.verbose)
			results.push({ name, sourcePath, response })
		}
		catch (error_) {
			const error = error_ instanceof Error ? error_ : new Error(String(error_))
			printHeader(name, '?', '?', sourcePath)
			printError(name, error)
			results.push({ name, sourcePath, error })
		}
	}

	printSummary(results)
	return results
}

function resolveValueNode(node: AnyValueNode): string {
	switch (node.type) {
		case 'text': {
			return (node as { type: 'text', value: string }).value
		}
		case 'masked': {
			return (node as { type: 'masked', mask: string }).mask
		}
		case 'values': {
			return (node as { type: 'values', values: AnyValueNode[] }).values.map(v => resolveValueNode(v)).join('')
		}
		default: {
			return '?'
		}
	}
}

function printHeader(
	name: string,
	method: string,
	url: string,
	sourcePath: string,
): void {
	console.warn('')
	console.warn(`${'─'.repeat(60)}`)
	console.warn(`▶ ${name}`)
	console.warn(`  ${method} ${url}`)
	console.warn(`  ${sourcePath}`)
	console.warn(`${'─'.repeat(60)}`)
}

function printResponse(
	_name: string,
	response: SlingResponse,
	verbose: boolean,
): void {
	const statusIcon = response.status < 400 ? '✓' : '✗'
	const duration = `${Math.round(response.duration)}ms`

	console.warn(
		`  ${statusIcon} ${response.status} ${response.statusText} (${duration})`,
	)

	if (verbose) {
		console.warn('')
		console.warn('  Response Headers:')
		for (const headerNode of response.responseAst.headers ?? []) {
			if (headerNode.type !== 'header') continue
			const name = headerNode.name.type === 'text' ? headerNode.name.value : '?'
			const value = resolveValueNode(headerNode.value)
			console.warn(`    ${name}: ${value}`)
		}
	}

	// Body always goes to stdout so it can be piped
	const bodyNode = response.responseAst.body
	if (bodyNode) {
		const bodyText = resolveValueNode(bodyNode.value as AnyValueNode)
		try {
			// Pretty-print JSON
			const parsed: unknown = JSON.parse(bodyText)
			console.log(JSON.stringify(parsed, undefined, 2))
		}
		catch {
			console.log(bodyText)
		}
	}
}

function printError(name: string, error: Error): void {
	console.error(`  ✗ ${name} failed: ${error.message}`)
	if (error.cause instanceof Error) {
		console.error(`    Caused by: ${error.cause.message}`)
	}
	else if (error.cause !== undefined) {
		console.error(`    Caused by: ${String(error.cause as string)}`)
	}
}

function printSummary(results: RunResult[]): void {
	const passed = results.filter(r => !r.error).length
	const failed = results.filter(r => r.error).length

	console.warn('')
	console.warn(
		`Done: ${passed} passed, ${failed} failed, ${results.length} total`,
	)

	if (failed > 0) {
		process.exitCode = 1
	}
}
