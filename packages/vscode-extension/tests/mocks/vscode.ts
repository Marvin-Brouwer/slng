/**
 * Minimal mock of the `vscode` module for unit-testing the extension
 * outside of a real VS Code host.
 *
 * Only the types and classes actually used by the extension source
 * are implemented here. Add more as needed.
 */
import { vi } from "vitest";

// ── Core value types ─────────────────────────────────────────

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class Location {
  constructor(
    public readonly uri: Uri,
    public readonly rangeOrPosition: Range | Position,
  ) {}
}

export class CodeLens {
  constructor(
    public readonly range: Range,
    public readonly command?: Command,
  ) {}
}

export interface Command {
  title: string;
  command: string;
  tooltip?: string;
  arguments?: unknown[];
}

// ── Uri ──────────────────────────────────────────────────────

export class Uri {
  private constructor(
    public readonly scheme: string,
    public readonly fsPath: string,
  ) {}

  static file(path: string): Uri {
    return new Uri("file", path);
  }

  toString(): string {
    return `${this.scheme}://${this.fsPath}`;
  }
}

// ── EventEmitter ─────────────────────────────────────────────

export class EventEmitter<T = void> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
  };

  fire(data: T): void {
    for (const l of this.listeners) l(data);
  }

  dispose(): void {
    this.listeners = [];
  }
}

// ── CancellationToken ────────────────────────────────────────

export const CancellationToken = {
  None: {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  },
};

// ── TextDocument ─────────────────────────────────────────────

export function createMockDocument(content: string, fileName = "test.mts"): TextDocument {
  const lines = content.split("\n");
  return {
    getText: () => content,
    fileName,
    uri: Uri.file(fileName),
    languageId: "typescript",
    version: 1,
    lineCount: lines.length,
    positionAt(offset: number): Position {
      let remaining = offset;
      for (let line = 0; line < lines.length; line++) {
        const lineLen = lines[line]!.length + 1; // +1 for \n
        if (remaining < lineLen) {
          return new Position(line, remaining);
        }
        remaining -= lineLen;
      }
      return new Position(lines.length - 1, 0);
    },
    lineAt(_line: number) {
      return { text: lines[_line] ?? "", range: new Range(new Position(_line, 0), new Position(_line, 0)) };
    },
    offsetAt(position: Position): number {
      let offset = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) {
        offset += lines[i]!.length + 1;
      }
      return offset + position.character;
    },
  } as unknown as TextDocument;
}

export interface TextDocument {
  getText(): string;
  fileName: string;
  uri: Uri;
  languageId: string;
  version: number;
  lineCount: number;
  positionAt(offset: number): Position;
  lineAt(line: number): { text: string; range: Range };
  offsetAt(position: Position): number;
}

// ── Webview / panels ─────────────────────────────────────────

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
}

export interface WebviewPanel {
  webview: { html: string };
  title: string;
  reveal: ReturnType<typeof vi.fn>;
  onDidDispose: (listener: () => void) => { dispose: () => void };
  dispose: ReturnType<typeof vi.fn>;
}

export function createMockWebviewPanel(): WebviewPanel {
  let disposeListener: (() => void) | undefined;
  return {
    webview: { html: "" },
    title: "",
    reveal: vi.fn(),
    onDidDispose: (listener: () => void) => {
      disposeListener = listener;
      return { dispose: () => { disposeListener = undefined; } };
    },
    dispose: vi.fn(() => disposeListener?.()),
  };
}

// ── Namespaces (window, workspace, languages, etc.) ──────────

export const window = {
  createWebviewPanel: vi.fn((_viewType: string, title: string) => {
    const panel = createMockWebviewPanel();
    panel.title = title;
    return panel;
  }),
  showErrorMessage: vi.fn(),
  showInformationMessage: vi.fn(),
  withProgress: vi.fn(),
};

export const workspace = {
  getWorkspaceFolder: vi.fn(),
  onDidSaveTextDocument: vi.fn(() => ({ dispose: () => {} })),
  getConfiguration: vi.fn(() => ({
    get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
  })),
};

export const languages = {
  registerCodeLensProvider: vi.fn(() => ({ dispose: () => {} })),
};

export const commands = {
  registerCommand: vi.fn(() => ({ dispose: () => {} })),
};

export const debug = {
  addBreakpoints: vi.fn(),
  startDebugging: vi.fn(),
};

// ── Enums ────────────────────────────────────────────────────

export enum ProgressLocation {
  Notification = 15,
  SourceControl = 1,
  Window = 10,
}

// ── Extension context ────────────────────────────────────────

export function createMockExtensionContext(): ExtensionContext {
  return {
    subscriptions: [],
    extensionPath: "/mock/extension",
    extensionUri: Uri.file("/mock/extension"),
  } as unknown as ExtensionContext;
}

export interface ExtensionContext {
  subscriptions: { dispose: () => void }[];
  extensionPath: string;
  extensionUri: Uri;
}

// ── Source breakpoints ───────────────────────────────────────

export class SourceBreakpoint {
  constructor(
    public readonly location: Location,
    public readonly enabled: boolean = true,
  ) {}
}

export interface DebugConfiguration {
  type: string;
  request: string;
  name: string;
  [key: string]: unknown;
}
