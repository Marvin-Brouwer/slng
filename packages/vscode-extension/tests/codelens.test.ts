import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("vscode", () => import("./mocks/vscode.js"));

import { CancellationToken, createMockDocument } from "./mocks/vscode.js";
import { SlingCodeLensProvider } from "../src/providers/codelens.js";

describe("SlingCodeLensProvider", () => {
  let provider: SlingCodeLensProvider;

  beforeEach(() => {
    provider = new SlingCodeLensProvider();
  });

  it("finds a single exported sling definition", () => {
    const doc = createMockDocument(
      `import sling from '../slng.config.mjs'\n\nexport const getUsers = sling\`\n  GET https://api.example.com/users HTTP/1.1\n\`\n`,
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    // Two lenses per export: Send + Debug
    expect(lenses).toHaveLength(2);
    expect(lenses[0]!.command!.title).toBe("▶ Send");
    expect(lenses[0]!.command!.command).toBe("slng.send");
    expect(lenses[0]!.command!.arguments![1]).toBe("getUsers");
    expect(lenses[1]!.command!.title).toBe("🐛 Debug");
    expect(lenses[1]!.command!.command).toBe("slng.debug");
  });

  it("finds multiple exports in one file", () => {
    const doc = createMockDocument(
      [
        "import sling from '../slng.config.mjs'",
        "",
        "export const getUsers = sling`",
        "  GET https://api.example.com/users HTTP/1.1",
        "`",
        "",
        "export const createUser = sling`",
        "  POST https://api.example.com/users HTTP/1.1",
        "`",
      ].join("\n"),
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    expect(lenses).toHaveLength(4); // 2 per export
    expect(lenses[0]!.command!.arguments![1]).toBe("getUsers");
    expect(lenses[2]!.command!.arguments![1]).toBe("createUser");
  });

  it("handles let and var exports", () => {
    const doc = createMockDocument(
      [
        "export let foo = sling`GET https://a.com`",
        "export var bar = sling`GET https://b.com`",
      ].join("\n"),
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    expect(lenses).toHaveLength(4);
    expect(lenses[0]!.command!.arguments![1]).toBe("foo");
    expect(lenses[2]!.command!.arguments![1]).toBe("bar");
  });

  it("ignores non-.mts files", () => {
    const doc = createMockDocument(
      "export const getUsers = sling`GET https://api.example.com/users`",
      "test.ts",
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    expect(lenses).toHaveLength(0);
  });

  it("ignores non-sling exports", () => {
    const doc = createMockDocument(
      [
        "export const config = { host: 'example.com' }",
        "export function helper() {}",
        "const internal = sling`GET https://a.com`", // not exported
      ].join("\n"),
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    expect(lenses).toHaveLength(0);
  });

  it("returns empty for empty documents", () => {
    const doc = createMockDocument("", "empty.mts");

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    expect(lenses).toHaveLength(0);
  });

  it("passes the document URI as the first argument", () => {
    const doc = createMockDocument(
      "export const req = sling`GET https://a.com`",
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);

    expect(lenses[0]!.command!.arguments![0]).toBe(doc.uri);
  });

  it("passes the line number as third argument to debug command", () => {
    const doc = createMockDocument(
      [
        "import sling from '../slng.config.mjs'",
        "",
        "export const req = sling`",
        "  GET https://a.com",
        "`",
      ].join("\n"),
    );

    const lenses = provider.provideCodeLenses(doc, CancellationToken.None as never);
    const debugLens = lenses[1]!;

    expect(debugLens.command!.command).toBe("slng.debug");
    // Third argument is the line number
    expect(debugLens.command!.arguments![2]).toBe(2); // 0-indexed line
  });

  it("fires onDidChangeCodeLenses when refresh is called", () => {
    const listener = vi.fn();
    provider.onDidChangeCodeLenses(listener);

    provider.refresh();

    expect(listener).toHaveBeenCalledOnce();
  });
});
