import { describe, it, expect } from 'vitest'

import { parseArguments } from '../src/arguments.js'

// TODO: re-enable when CLI is stable
describe.skip('parseArguments', () => {
	it('parses --file flag', () => {
		const arguments_ = parseArguments(['--file', './api/users.mts'])
		expect(arguments_.file).toBe('./api/users.mts')
	})

	it('parses -f shorthand', () => {
		const arguments_ = parseArguments(['-f', './api/users.mts'])
		expect(arguments_.file).toBe('./api/users.mts')
	})

	it('parses --files glob', () => {
		const arguments_ = parseArguments(['--files', './apis/*.mts'])
		expect(arguments_.files).toBe('./apis/*.mts')
	})

	it('parses positional name argument', () => {
		const arguments_ = parseArguments(['--file', './api/users.mts', 'getUser'])
		expect(arguments_.file).toBe('./api/users.mts')
		expect(arguments_.name).toBe('getUser')
	})

	it('parses --env flag', () => {
		const arguments_ = parseArguments(['--env', 'staging'])
		expect(arguments_.environment).toBe('staging')
	})

	it('parses -e shorthand', () => {
		const arguments_ = parseArguments(['-e', 'local'])
		expect(arguments_.environment).toBe('local')
	})

	it('parses --verbose flag', () => {
		const arguments_ = parseArguments(['--verbose'])
		expect(arguments_.verbose).toBe(true)
	})

	it('parses --no-mask flag', () => {
		const arguments_ = parseArguments(['--no-mask'])
		expect(arguments_.mask).toBe(false)
	})

	it('defaults to sane values', () => {
		const arguments_ = parseArguments([])
		expect(arguments_.verbose).toBe(false)
		expect(arguments_.mask).toBe(true)
		expect(arguments_.help).toBe(false)
		expect(arguments_.file).toBeUndefined()
		expect(arguments_.files).toBeUndefined()
		expect(arguments_.name).toBeUndefined()
	})

	it('parses combined flags', () => {
		const arguments_ = parseArguments([
			'--file', './api.mts',
			'-e', 'production',
			'-v',
			'--no-mask',
			'myExport',
		])

		expect(arguments_.file).toBe('./api.mts')
		expect(arguments_.environment).toBe('production')
		expect(arguments_.verbose).toBe(true)
		expect(arguments_.mask).toBe(false)
		expect(arguments_.name).toBe('myExport')
	})
})
