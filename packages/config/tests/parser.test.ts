import { describe, it, expect } from "vitest";
import {
  parseHttpText,
  resolveInterpolation,
  resolveInterpolationDisplay,
  assembleTemplate,
  SlingParseError,
} from "../src/parser.js";
import { secret } from "../src/masking/secret.js";
import { sensitive } from "../src/masking/sensitive.js";

describe("parseHttpText", () => {
  it("parses a simple GET request", () => {
    const result = parseHttpText(`
      GET https://api.example.com/users HTTP/1.1
    `);

    expect(result.method).toBe("GET");
    expect(result.url).toBe("https://api.example.com/users");
    expect(result.httpVersion).toBe("HTTP/1.1");
    expect(result.headers).toEqual({});
    expect(result.body).toBeUndefined();
  });

  it("parses request with headers", () => {
    const result = parseHttpText(`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer token123
      Content-Type: application/json
    `);

    expect(result.headers).toEqual({
      Authorization: "Bearer token123",
      "Content-Type": "application/json",
    });
  });

  it("parses request with headers and body", () => {
    const result = parseHttpText(`
      POST https://api.example.com/users HTTP/1.1

      Content-Type: application/json

      {"name": "test"}
    `);

    expect(result.method).toBe("POST");
    expect(result.headers["Content-Type"]).toBe("application/json");
    expect(result.body).toBe('{"name": "test"}');
  });

  it("defaults to HTTP/1.1 when version is omitted", () => {
    const result = parseHttpText(`GET https://api.example.com/users`);
    expect(result.httpVersion).toBe("HTTP/1.1");
  });

  it("throws on empty template", () => {
    expect(() => parseHttpText("")).toThrow(SlingParseError);
    expect(() => parseHttpText("   \n   \n   ")).toThrow(SlingParseError);
  });

  it("throws on invalid request line", () => {
    expect(() => parseHttpText("INVALID")).toThrow(SlingParseError);
  });

  it("supports all HTTP methods", () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    for (const method of methods) {
      const result = parseHttpText(`${method} https://example.com`);
      expect(result.method).toBe(method);
    }
  });

  it("parses multiline body", () => {
    const result = parseHttpText(`
      POST https://example.com HTTP/1.1

      Content-Type: application/json

      {
        "name": "test",
        "value": 42
      }
    `);

    expect(result.body).toContain('"name": "test"');
    expect(result.body).toContain('"value": 42');
  });
});

describe("resolveInterpolation", () => {
  it("resolves strings as-is", async () => {
    expect(await resolveInterpolation("hello")).toBe("hello");
  });

  it("resolves numbers to strings", async () => {
    expect(await resolveInterpolation(42)).toBe("42");
  });

  it("resolves secret values to their real value", async () => {
    const s = secret("my-secret");
    expect(await resolveInterpolation(s)).toBe("my-secret");
  });

  it("resolves sensitive values to their real value", async () => {
    const s = sensitive("marvin@example.com");
    expect(await resolveInterpolation(s)).toBe("marvin@example.com");
  });

  it("resolves ResponseDataAccessor (Promise<DataAccessor>)", async () => {
    const accessor = Promise.resolve({
      async value() { return "computed"; },
      async validate() { return true; },
      async tryValue() { return "computed"; },
    });
    expect(await resolveInterpolation(accessor)).toBe("computed");
  });

  it("resolves ResponseDataAccessor with non-string values", async () => {
    const accessor = Promise.resolve({
      async value() { return 42; },
      async validate() { return true; },
      async tryValue() { return 42; },
    });
    expect(await resolveInterpolation(accessor)).toBe("42");
  });
});

describe("resolveInterpolationDisplay", () => {
  it("shows ***** for secrets", () => {
    expect(resolveInterpolationDisplay(secret("hidden"))).toBe("*****");
  });

  it("shows partial value for sensitive", () => {
    expect(resolveInterpolationDisplay(sensitive("marvin@example.com"))).toBe(
      "marvin************",
    );
  });

  it("shows <deferred> for ResponseDataAccessor (Promise)", () => {
    const accessor = Promise.resolve({
      async value() { return "test"; },
      async validate() { return true; },
      async tryValue() { return "test"; },
    });
    expect(resolveInterpolationDisplay(accessor)).toBe("<deferred>");
  });

  it("shows strings as-is", () => {
    expect(resolveInterpolationDisplay("visible")).toBe("visible");
  });
});

describe("assembleTemplate", () => {
  it("assembles strings and values", () => {
    const strings = ["GET https://", "/api/", ""];
    const values = ["example.com", "users"];
    expect(assembleTemplate(strings, values)).toBe(
      "GET https://example.com/api/users",
    );
  });
});
