import { describe, it, expect } from "vitest";
import { sling } from "../src/sling.js";
import { secret, sensitive } from "../src/index.js";
import { isSlingDefinition } from "../src/definition.js";

describe("sling", () => {
  it("creates a tagged template function", () => {
    const s = sling();
    expect(typeof s).toBe("function");
    expect(s.context).toBeDefined();
  });

  it("returns a SlingDefinition from tagged template", () => {
    const s = sling();
    const def = s`
      GET https://api.example.com/users HTTP/1.1
    `;

    expect(def.__sling).toBe(true);
    expect(def.parsed.method).toBe("GET");
    expect(def.parsed.url).toBe("https://api.example.com/users");
  });

  it("handles string interpolations", () => {
    const s = sling();
    const host = "api.example.com";
    const def = s`
      GET https://${host}/users HTTP/1.1
    `;

    expect(def.parsed.url).toBe("https://api.example.com/users");
  });

  it("handles secret interpolations", () => {
    const s = sling();
    const token = secret("my-secret-token");
    const def = s`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer ${token}
    `;

    expect(def.maskedValues).toHaveLength(1);
    expect(def.maskedValues[0]!.type).toBe("secret");
    // Preview shows masked value
    expect(def.parsed.headers["Authorization"]).toBe("Bearer *****");
  });

  it("handles sensitive interpolations", () => {
    const s = sling();
    const email = sensitive("marvin@example.com");
    const def = s`
      POST https://api.example.com/users HTTP/1.1

      Content-Type: application/json

      {"email": "${email}"}
    `;

    expect(def.maskedValues).toHaveLength(1);
    expect(def.maskedValues[0]!.type).toBe("sensitive");
  });

  it("handles function interpolations as <deferred> in preview", () => {
    const s = sling();
    const getToken = () => "dynamic-token";
    const def = s`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer ${getToken}
    `;

    expect(def.parsed.headers["Authorization"]).toBe("Bearer <deferred>");
  });

  it("collects template parts for later re-rendering", () => {
    const s = sling();
    const host = "example.com";
    const def = s`GET https://${host}/api`;

    expect(def.template.strings).toHaveLength(2);
    expect(def.template.values).toHaveLength(1);
    expect(def.template.values[0]).toBe("example.com");
  });
});

describe("isSlingDefinition", () => {
  it("returns true for sling definitions", () => {
    const s = sling();
    const def = s`GET https://example.com`;
    expect(isSlingDefinition(def)).toBe(true);
  });

  it("returns false for other objects", () => {
    expect(isSlingDefinition({})).toBe(false);
    expect(isSlingDefinition(null)).toBe(false);
    expect(isSlingDefinition("string")).toBe(false);
    expect(isSlingDefinition(42)).toBe(false);
    expect(isSlingDefinition({ __sling: false })).toBe(false);
  });
});
