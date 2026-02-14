import {
	provideVSCodeDesignSystem,
	vsCodeBadge,
	vsCodeButton,
	vsCodeDivider,
	vsCodePanels,
	vsCodePanelTab,
	vsCodePanelView,
	vsCodeTag,
} from '@vscode/webview-ui-toolkit'

provideVSCodeDesignSystem()
	.register(vsCodeButton())
	.register(vsCodeTag())
	.register(vsCodeBadge())
	.register(vsCodeDivider())
	.register(vsCodePanels(), vsCodePanelTab(), vsCodePanelView())

console.log('Webview components registered!')
