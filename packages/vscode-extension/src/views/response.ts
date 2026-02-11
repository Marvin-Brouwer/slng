import { SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

// TODO implement
export class ResponseViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'sling.responseDetails'

	private _view?: vscode.WebviewView
	private config: vscode.WorkspaceConfiguration

	constructor(
		private readonly channel: vscode.LogOutputChannel,
	) {
		this.config = vscode.workspace.getConfiguration('slng')
	}

	resolveWebviewView(view: vscode.WebviewView) {
		this.channel.appendLine('resolveWebviewView')
		this._view = view

		view.webview.options = { enableScripts: true }
		view.webview.html = this.getHtml({ result: 'Not run yet' })
	}

	public hide() {
		this.channel.warn('TODO', 'move to panel and dispose', 'https://code.visualstudio.com/api/extension-guides/webview#lifecycle')
	}

	public show() {
		const maskSecrets = this.config.get<boolean>('maskSecrets', true)
		this.channel.info('shouldmask', maskSecrets)
		this._view?.show(false)
	}

	public update(content: SlingResponse) {
		this.channel.info('update', content)
		if (this._view) {
			this._view.webview.html = this.getHtml(content)
		}
	}

	private getHtml(content: object) {
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

export function registerResponseView(subscription: vscode.Disposable[], channel: vscode.LogOutputChannel) {
	const responseViewProvider = new ResponseViewProvider(channel)
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
