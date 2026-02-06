import * as vscode from "vscode";

/**
 * Regex to find exported sling template definitions.
 *
 * Matches patterns like:
 * - `export const foo = sling\``
 * - `export let foo = sling\``
 * - `export var foo = sling\``
 *
 * Captures the export name.
 */
const SLING_EXPORT_RE =
  /export\s+(?:const|let|var)\s+(\w+)\s*=\s*sling\s*`/g;

export class SlingCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens[] {
    // Only apply to .mts files
    if (!document.fileName.endsWith(".mts")) {
      return [];
    }

    const text = document.getText();
    const lenses: vscode.CodeLens[] = [];

    let match: RegExpExecArray | null;
    SLING_EXPORT_RE.lastIndex = 0;

    while ((match = SLING_EXPORT_RE.exec(text)) !== null) {
      const exportName = match[1]!;
      const position = document.positionAt(match.index);
      const range = new vscode.Range(position, position);

      // "Send" lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: "▶ Send",
          command: "slng.send",
          arguments: [document.uri, exportName],
          tooltip: `Send the "${exportName}" request`,
        }),
      );

      // "Debug" lens
      lenses.push(
        new vscode.CodeLens(range, {
          title: "🐛 Debug",
          command: "slng.debug",
          arguments: [document.uri, exportName, position.line],
          tooltip: `Debug the "${exportName}" request (attaches debugger)`,
        }),
      );
    }

    return lenses;
  }

  refresh(): void {
    this._onDidChange.fire();
  }
}
