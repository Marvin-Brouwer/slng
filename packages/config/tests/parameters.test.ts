import { describe, it, expect } from "vitest";
import { createSlingParameters } from "../src/parameters.js";

describe("createSlingParameters", () => {
  it("creates empty parameters when no initial values", () => {
    const params = createSlingParameters();
    expect(params.get("missing")).toBeUndefined();
  });

  it("exposes initial values via get()", () => {
    const params = createSlingParameters({ TOKEN: "abc123", PORT: 3000 });
    expect(params.get("TOKEN")).toBe("abc123");
    expect(params.get("PORT")).toBe(3000);
  });

  it("exposes initial values as own properties", () => {
    const params = createSlingParameters({ HOST: "localhost" });
    expect(params.HOST).toBe("localhost");
  });

  it("returns undefined for missing keys", () => {
    const params = createSlingParameters({ A: "1" });
    expect(params.get("B")).toBeUndefined();
  });

  it("handles falsy values correctly (0, false, empty string)", () => {
    const params = createSlingParameters({
      ZERO: 0,
      FALSE: false,
      EMPTY: "",
    });

    expect(params.get("ZERO")).toBe(0);
    expect(params.get("FALSE")).toBe(false);
    expect(params.get("EMPTY")).toBe("");
  });

  it("getRequired returns value when present", () => {
    const params = createSlingParameters({ KEY: "value" });
    expect(params.getRequired("KEY")).toBe("value");
  });

  it("getRequired returns falsy values without throwing", () => {
    const params = createSlingParameters({ ZERO: 0, FALSE: false });
    expect(params.getRequired("ZERO")).toBe(0);
    expect(params.getRequired("FALSE")).toBe(false);
  });

  it("getRequired throws for missing keys", () => {
    const params = createSlingParameters();
    expect(() => params.getRequired("MISSING")).toThrow(
      "Required parameter 'MISSING' was not loaded.",
    );
  });

  it("getRequired throws for explicitly undefined keys", () => {
    const params = createSlingParameters({ KEY: undefined });
    expect(() => params.getRequired("KEY")).toThrow(
      "Required parameter 'KEY' was not loaded.",
    );
  });

  it("set() stores new values accessible via get()", () => {
    const params = createSlingParameters();
    params.set("DYNAMIC", "new-value");
    expect(params.get("DYNAMIC")).toBe("new-value");
  });

  it("set() overwrites existing values", () => {
    const params = createSlingParameters({ KEY: "old" });
    params.set("KEY", "new");
    expect(params.get("KEY")).toBe("new");
  });
});
