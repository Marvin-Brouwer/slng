import { describe, it, expect } from "vitest";
import { secret } from "../src/masking/secret.js";
import { sensitive } from "../src/masking/sensitive.js";

describe("secret", () => {
  it("creates a masked value with ***** display", () => {
    const result = secret("super-secret-key");

    expect(result.__masked).toBe(true);
    expect(result.type).toBe("secret");
    expect(result.value).toBe("super-secret-key");
    expect(result.displayValue).toBe("*****");
  });

  it("works with empty strings", () => {
    const result = secret("");
    expect(result.value).toBe("");
    expect(result.displayValue).toBe("*****");
  });
});

describe("sensitive", () => {
  it("shows first 6 characters by default", () => {
    const result = sensitive("marvin.brouwer@gmail.com");

    expect(result.__masked).toBe(true);
    expect(result.type).toBe("sensitive");
    expect(result.value).toBe("marvin.brouwer@gmail.com");
    expect(result.displayValue).toBe("marvin******************");
    // "marvin" = 6 chars visible, rest = 18 stars
  });

  it("accepts custom visible character count", () => {
    const result = sensitive("marvin.brouwer@gmail.com", 3);

    expect(result.displayValue).toBe("mar*********************");
  });

  it("handles value shorter than visible count", () => {
    const result = sensitive("abc", 10);

    expect(result.displayValue).toBe("abc");
  });

  it("handles zero visible characters", () => {
    const result = sensitive("secret", 0);

    expect(result.displayValue).toBe("******");
  });
});
