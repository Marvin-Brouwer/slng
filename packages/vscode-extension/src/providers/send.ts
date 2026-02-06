import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { readFile, unlink } from "node:fs/promises";

interface SendResult {
  name: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

/**
 * Execute a sling request by spawning a child process.
 *
 * Uses tsx to import the user's .mts file and run the named export.
 * The result is written to a temp JSON file and read back.
 * This keeps execution transparent and identical to CLI usage.
 */
export async function sendRequest(
  fileUri: vscode.Uri,
  exportName: string,
): Promise<SendResult | undefined> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  if (!workspaceFolder) {
    vscode.window.showErrorMessage(
      "Cannot send: file is not in a workspace folder.",
    );
    return;
  }

  const filePath = fileUri.fsPath;
  const cwd = workspaceFolder.uri.fsPath;
  const resultFile = resolve(cwd, `.slng-result-${Date.now()}.json`);

  const script = `
    import { pathToFileURL } from 'node:url';
    import { writeFileSync } from 'node:fs';

    const exportName = ${JSON.stringify(exportName)};
    const fileUrl = pathToFileURL(${JSON.stringify(filePath)}).href;
    const mod = await import(fileUrl);
    const definition = mod[exportName];

    if (!definition || !definition.__sling) {
      process.stderr.write('Export "' + exportName + '" is not a sling definition\\n');
      process.exit(1);
    }

    const response = await definition.execute({ maskOutput: true });
    const result = {
      name: exportName,
      method: definition.parsed.method,
      url: definition.parsed.url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      duration: response.duration,
    };
    writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify(result));
  `.trim();

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Sling: sending ${exportName}...`,
      cancellable: true,
    },
    async (_progress, token) => {
      return new Promise<SendResult | undefined>((resolvePromise, reject) => {
        const child = execFile(
          "npx",
          ["tsx", "--eval", script],
          { cwd, timeout: 30_000 },
          async (error, _stdout, stderr) => {
            if (token.isCancellationRequested) {
              resolvePromise(undefined);
              return;
            }

            if (error) {
              vscode.window.showErrorMessage(
                `Sling: ${exportName} failed — ${stderr || error.message}`,
              );
              reject(error);
              return;
            }

            try {
              const raw = await readFile(resultFile, "utf-8");
              const result = JSON.parse(raw) as SendResult;
              await unlink(resultFile).catch(() => {});
              resolvePromise(result);
            } catch (err) {
              reject(err);
            }
          },
        );

        token.onCancellationRequested(() => {
          child.kill("SIGTERM");
        });
      });
    },
  );
}
