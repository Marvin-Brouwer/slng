import { describe, it, expect } from "vitest";
import { sling as slingFactory } from "../src/sling.js";
import type { DataAccessor, SlingInterpolation } from "../src/types.js";
import { secret, sensitive } from "../src/index.js";
import { isSlingDefinition } from "../src/definition.js";

describe("sling", () => {
  it("creates a tagged template function", () => {
    const s = slingFactory();
    expect(typeof s).toBe("function");
    expect(s.context).toBeDefined();
  });

  it("returns a SlingDefinition from tagged template", () => {
    const s = slingFactory();
    const def = s`
      GET https://api.example.com/users HTTP/1.1
    `;

    expect(def.getInternals().version).toBe("v1");
    expect(def.getInternals().parsed.method).toBe("GET");
    expect(def.getInternals().parsed.url).toBe("https://api.example.com/users");
  });

  it("handles string interpolations", () => {
    const s = slingFactory();
    const host = "api.example.com";
    const def = s`
      GET https://${host}/users HTTP/1.1
    `;

    expect(def.getInternals().parsed.url).toBe("https://api.example.com/users");
  });

  it("handles secret interpolations", () => {
    const s = slingFactory();
    const token = secret("my-secret-token");
    const def = s`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer ${token}
    `;

    expect(def.getInternals().maskedValues).toHaveLength(1);
    expect(def.getInternals().maskedValues[0]!.type).toBe("secret");
    // Preview shows masked value
    expect(def.getInternals().parsed.headers["Authorization"]).toBe("Bearer *****");
  });

  it("handles sensitive interpolations", () => {
    const s = slingFactory();
    const email = sensitive("marvin@example.com");
    const def = s`
      POST https://api.example.com/users HTTP/1.1

      Content-Type: application/json

      {"email": "${email}"}
    `;

    expect(def.getInternals().maskedValues).toHaveLength(1);
    expect(def.getInternals().maskedValues[0]!.type).toBe("sensitive");
  });

  it("handles ResponseDataAccessor interpolations as <deferred> in preview", () => {
    const s = slingFactory();
    const getToken: SlingInterpolation = Promise.resolve({
      async value() { return "dynamic-token"; },
      async validate() { return true; },
      async tryValue() { return "dynamic-token"; },
    } satisfies DataAccessor);
    const def = s`
      GET https://api.example.com/users HTTP/1.1

      Authorization: Bearer ${getToken}
    `;

    expect(def.getInternals().parsed.headers["Authorization"]).toBe("Bearer <deferred>");
  });

  it("collects template parts for later re-rendering", () => {
    const s = slingFactory();
    const host = "example.com";
    const def = s`GET https://${host}/api`;

    expect(def.getInternals().template.strings).toHaveLength(2);
    expect(def.getInternals().template.values).toHaveLength(1);
    expect(def.getInternals().template.values[0]).toBe("example.com");
  });
});

describe("isSlingDefinition", () => {
  it("returns true for sling definitions", () => {
    const s = slingFactory();
    const def = s`GET https://example.com`;
    expect(isSlingDefinition(def)).toBe(true);
  });

  it("returns false for other objects", () => {
    expect(isSlingDefinition({})).toBe(false);
    expect(isSlingDefinition(null)).toBe(false);
    expect(isSlingDefinition("string")).toBe(false);
    expect(isSlingDefinition(42)).toBe(false);
  });
});
