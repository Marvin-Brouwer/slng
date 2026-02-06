import * as vscode from "vscode";

interface ResponseData {
  name: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  maskedValues?: Array<{ value: string; displayValue: string }>;
}

export class ResponsePanel {
  private static instance: ResponsePanel | undefined;
  private panel: vscode.WebviewPanel;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      ResponsePanel.instance = undefined;
    });
  }

  static show(
    context: vscode.ExtensionContext,
    data: ResponseData,
    maskSecrets: boolean,
  ): void {
    if (ResponsePanel.instance) {
      ResponsePanel.instance.update(data, maskSecrets);
      ResponsePanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "slng.response",
      `Sling: ${data.name}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    ResponsePanel.instance = new ResponsePanel(panel);
    ResponsePanel.instance.update(data, maskSecrets);
  }

  private update(data: ResponseData, maskSecrets: boolean): void {
    this.panel.title = `Sling: ${data.name}`;
    this.panel.webview.html = this.buildHtml(data, maskSecrets);
  }

  private buildHtml(data: ResponseData, maskSecrets: boolean): string {
    const statusClass = data.status < 400 ? "success" : "error";
    let body = data.body;

    // Mask sensitive values in the response body for the viewer
    if (maskSecrets && data.maskedValues) {
      for (const mv of data.maskedValues) {
        const uiDisplay = mv.displayValue.replace(/\*/g, "●");
        body = body.replaceAll(mv.value, uiDisplay);
      }
    }

    // Try to pretty-print JSON
    let formattedBody = body;
    try {
      formattedBody = JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      // Not JSON, keep as-is
    }

    const headersHtml = Object.entries(data.headers)
      .map(([k, v]) => `<tr><td class="key">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join("\n");

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --success: #4caf50;
      --error: #f44336;
    }
    body { font-family: var(--vscode-font-family); color: var(--fg); padding: 16px; }
    .status { font-size: 1.2em; font-weight: bold; margin-bottom: 12px; }
    .status.success { color: var(--success); }
    .status.error { color: var(--error); }
    .meta { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin-bottom: 16px; }
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
    .tab {
      padding: 8px 16px; cursor: pointer; border: none; background: none;
      color: var(--fg); opacity: 0.6; border-bottom: 2px solid transparent;
    }
    .tab.active { opacity: 1; border-bottom-color: var(--vscode-focusBorder); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px; border-radius: 4px; overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 8px; border-bottom: 1px solid var(--border); font-size: 0.9em; }
    td.key { font-weight: bold; white-space: nowrap; width: 1%; }
  </style>
</head>
<body>
  <div class="status ${statusClass}">
    ${data.method} ${escapeHtml(data.url)}
  </div>
  <div class="meta">
    ${data.status} ${escapeHtml(data.statusText)} &middot; ${Math.round(data.duration)}ms
  </div>

  <div class="tabs">
    <button class="tab active" onclick="showTab('body')">Body</button>
    <button class="tab" onclick="showTab('headers')">Headers</button>
  </div>

  <div id="body" class="tab-content active">
    <pre>${escapeHtml(formattedBody)}</pre>
  </div>

  <div id="headers" class="tab-content">
    <table>${headersHtml}</table>
  </div>

  <script>
    function showTab(id) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
