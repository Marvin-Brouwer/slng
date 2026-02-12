import { SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

// TODO implement
export class ResponseViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'sling.responseDetails'

	private _view?: vscode.WebviewView
	private config: vscode.WorkspaceConfiguration

	constructor(
		private readonly channel: vscode.LogOutputChannel,
		private readonly state: vscode.Memento,
	) {
		this.config = vscode.workspace.getConfiguration('slng')
	}

	resolveWebviewView(view: vscode.WebviewView) {
		this.channel.appendLine('resolveWebviewView')
		this._view = view

		view.webview.options = { enableScripts: true }
		view.webview.html = this.getHtml('No request selected')
	}

	public hide() {
		this.channel.warn('TODO', 'move to panel and dispose', 'https://code.visualstudio.com/api/extension-guides/webview#lifecycle')
	}

	public show() {
		const maskSecrets = this.config.get<boolean>('maskSecrets', true)
		this.channel.info('shouldmask', maskSecrets)
		this._view?.show(false)
	}

	// TODO do we want to show more information when no response? Maybe a send button?
	public update(reference: string | undefined) {
		this.channel.info('update', reference)
		if (!this._view) return this.channel.warn('ResponseView not resolved!')

		if (!reference) return this.getHtml('No request selected')
		if (!this.state.keys().includes(reference)) return this.getHtml('Request not executed')

		const referencedResponse = this.state.get(reference) as SlingResponse
		this._view.webview.html = this.getHtml(referencedResponse)
	}

	private getHtml(content: SlingResponse | string) {
		this.channel.info('getHtml', content)
		return `
      <html>
        <body>
          <h2>Details</h2>
          <pre>${JSON.stringify(content, undefined, 2)}</pre>
        </body>
      </html>
    `
	}
}

export function registerResponseView(subscription: vscode.Disposable[], state: vscode.Memento, channel: vscode.LogOutputChannel) {
	const responseViewProvider = new ResponseViewProvider(channel, state)
	subscription.push(
		vscode.window.registerWebviewViewProvider(
			ResponseViewProvider.viewType,
			responseViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			},
		),
	)
	return responseViewProvider
}
