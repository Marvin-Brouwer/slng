import { SlingResponse } from '@slng/config'
import * as vscode from 'vscode'

import { ExtensionContext } from '../context'

import { buildJsonColorOverrides } from './components/body-display.json.webview'
import { asyncDependency, nonces } from './webview-helper'

// TODO figure out a way to add time and bytes https://github.com/rhaldkhein/vscode-xrest-client/tree/master
export class ResponsePanel implements vscode.WebviewViewProvider {
	public static readonly viewType = 'sling.response-panel'

	private view!: vscode.WebviewView
	private scriptUri!: vscode.Uri
	private styleUri!: vscode.Uri
	private copyButtonStyleUri!: vscode.Uri
	private readonly nonces = nonces('js', 'css', 'copy-button-css', 'json-display-css')

	private config: vscode.WorkspaceConfiguration
	private readonly extensionUri: vscode.Uri
	private readonly distPath: vscode.Uri
	private readonly scriptPath: vscode.Uri
	private readonly stylePath: vscode.Uri
	private readonly copyButtonStylePath: vscode.Uri

	private currentReference: string | undefined

	private initialized = asyncDependency()

	constructor(
		private readonly context: ExtensionContext,
		extensionUri: vscode.Uri,
	) {
		this.config = vscode.workspace.getConfiguration('slng')
		this.extensionUri = extensionUri
		this.distPath = vscode.Uri.joinPath(extensionUri, 'dist')
		this.scriptPath = vscode.Uri.joinPath(this.distPath, 'response-panel.global.js')
		this.stylePath = vscode.Uri.joinPath(this.distPath, 'response-panel.css')
		this.copyButtonStylePath = vscode.Uri.joinPath(this.distPath, 'copy-button.css')

		context.addSubscriptions(
			vscode.window.onDidChangeActiveColorTheme(async () => {
				if (this.currentReference && this.view) {
					await this.show(this.currentReference)
				}
			}),
		)
	}

	resolveWebviewView(view: vscode.WebviewView) {
		this.context.log.debug('resolveWebviewView')
		this.view = view

		this.scriptUri = view.webview.asWebviewUri(this.scriptPath)!
		this.styleUri = view.webview.asWebviewUri(this.stylePath)!
		this.copyButtonStyleUri = view.webview.asWebviewUri(this.copyButtonStylePath)!

		view.webview.options = {
			enableScripts: true,
			enableCommandUris: true,
			localResourceRoots: [
				this.extensionUri,
				vscode.Uri.file(this.styleUri.fsPath),
				vscode.Uri.file(this.scriptPath.fsPath),
			],
		}
		view.webview.html = this.noSelectionView()
		this.initialized.resolve()
	}

	public hide() {
		this.context.log.warn('TODO', 'Figure out if closing is possible')
	}

	// TODO do we want to show more information when no response? Maybe a send button?
	public async show(reference: string | undefined) {
		this.context.log.info('update', reference)
		const maskSecrets = this.config.get<boolean>('maskSecrets', true)
		this.context.log.info('shouldmask', maskSecrets)
		// Focus the window to make vscode initialize it
		await vscode.commands.executeCommand('sling.response-panel.focus')
		// Wait for the resolveWebviewView to be called
		await this.initialized.wait()

		this.currentReference = reference
		if (!this.view) return this.context.log.warn('ResponseView not resolved!')

		if (!reference) {
			this.view.webview.html = this.noSelectionView()
			return
		}
		if (!this.context.state.includesKey(reference)) {
			this.view.webview.html = this.noSelectionView()
			return
		}

		const referencedResponse = this.context.state.get<SlingResponse>(reference)
		this.view.webview.html = this.responseView(referencedResponse)
	}

	private wrapHtml(html: string) {
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
			-->
			<meta http-equiv="Content-Security-Policy" content="
				default-src 'none';
				font-src ${this.view.webview.cspSource};
				style-src-elem ${this.view.webview.cspSource}
					'nonce-${this.nonces('css')}'
					'nonce-${this.nonces('copy-button-css')}'
					'nonce-${this.nonces('json-display-css')}';
				img-src ${this.view.webview.cspSource} https:;
				script-src 'nonce-${this.nonces('js')}';
			">
			<link nonce="${this.nonces('css')}" rel="stylesheet" href="${this.styleUri.toString()}" />
			${buildJsonColorOverrides(this.nonces('json-display-css'))}
			<script nonce="${this.nonces('js')}" src="${this.scriptUri.toString()}"></script>
		</head>
		<body id="response-view">${html}</body>
		</html>`
	}

	private noSelectionView() {
		const view = `
		<h2>No request selected</h2>
		<vscode-divider></vscode-divider>
		<p>Please execute a request, or select <vscode-tag>show details</vscode-tag> to load infromation in this panel.</p>
	`

		return this.wrapHtml(view)
	}

	private responseView(response: SlingResponse) {
		const { request } = response
		const view = `
			<h2>${response.request.name}</h2>
			<vscode-divider></vscode-divider>
			<!-- TODO solve with css -->
			<p></p>

			<!-- TODO make RESPONSE regular case and fix with css -->
			<!-- TODO make REQUEST regular case and fix with css -->
			<vscode-panels aria-label="Request information">
				<vscode-panel-tab id="tab-response">
					RESPONSE
					<vscode-badge appearance="secondary">${response.status}</vscode-badge>
				</vscode-panel-tab>
				<vscode-panel-tab id="tab-request">REQUEST</vscode-panel-tab>
				<vscode-panel-view id="view-response">
					<div>
						<div class="copy-panel">
							<copy-button
								for="#response-data"
								type="response"
								style-src="${this.copyButtonStyleUri.toString()}"
								style-nonce="${this.nonces('copy-button-css')}"
							/>
						</div>
						<div id="response-data">${buildResponseDisplay(response)}</div>
					</div>
				</vscode-panel-view>
				<vscode-panel-view id="view-request">
					<pre>${JSON.stringify(request.parsed, undefined, 2)}</pre>
				</vscode-panel-view>
			</vscode-panels>
		`

		return this.wrapHtml(view)
	}
}

/** https://en.wikipedia.org/wiki/HTTP#Example */
function buildResponseDisplay(response: SlingResponse) {
	const startLine = `${response.request.parsed.httpVersion} ${response.status} ${response.statusText}`
	// TODO this may later contain masked values too
	const headers = Object.entries(response.headers)
		.map(([key, value]) => {
			return `<tr>
				<td class="header-key">${key}:&nbsp;</td>
				<td class="header-value">${value}</td>
			</tr>`
		})
		.join('\n').replaceAll('\t', '')

	// TODO this may later contain masked values too
	const contentType = response.headers['content-type']?.split(';')[0] ?? ''

	return [
		`<pre class="start-line">${startLine}</pre>`,
		`<div class="headers"><table>${headers}</table></div>`,
		`<br />`,
		`<body-display content-type=${contentType}>${response.body}</body-display>`,
	].join('')
}

export function registerResponsePanel(
	context: ExtensionContext,
	extensionUri: vscode.Uri,
) {
	const responsePanel = new ResponsePanel(context, extensionUri)
	context.addSubscriptions(
		vscode.window.registerWebviewViewProvider(
			ResponsePanel.viewType,
			responsePanel,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			},
		),
	)
	return responsePanel
}
