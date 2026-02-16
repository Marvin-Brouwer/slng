// Janky workaround to wait for vscode commands to finish asynchronously
export function asyncDependency() {
	let resolve: () => void
	const isResolved = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise
	})
	return {
		async wait() { await isResolved },
		resolve() { resolve() },
	}
}

export function nonces<T extends string>(...names: T[]) {
	const nonces = Object.fromEntries(names.map(name => ([name, createNonce()])))
	return (name: T) => {
		const nonce = nonces[name]
		if (!nonce) throw new Error(`Nonce with key ${name} not registered`)
		return nonce
	}
}

function createNonce() {
	let text = ''
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	for (let index = 0; index < 32; index++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}
