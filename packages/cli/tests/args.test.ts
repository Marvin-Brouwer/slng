import { describe, it, expect } from "vitest";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("parses --file flag", () => {
    const args = parseArgs(["--file", "./api/users.mts"]);
    expect(args.file).toBe("./api/users.mts");
  });

  it("parses -f shorthand", () => {
    const args = parseArgs(["-f", "./api/users.mts"]);
    expect(args.file).toBe("./api/users.mts");
  });

  it("parses --files glob", () => {
    const args = parseArgs(["--files", "./apis/*.mts"]);
    expect(args.files).toBe("./apis/*.mts");
  });

  it("parses positional name argument", () => {
    const args = parseArgs(["--file", "./api/users.mts", "getUser"]);
    expect(args.file).toBe("./api/users.mts");
    expect(args.name).toBe("getUser");
  });

  it("parses --env flag", () => {
    const args = parseArgs(["--env", "staging"]);
    expect(args.environment).toBe("staging");
  });

  it("parses -e shorthand", () => {
    const args = parseArgs(["-e", "local"]);
    expect(args.environment).toBe("local");
  });

  it("parses --verbose flag", () => {
    const args = parseArgs(["--verbose"]);
    expect(args.verbose).toBe(true);
  });

  it("parses --no-mask flag", () => {
    const args = parseArgs(["--no-mask"]);
    expect(args.mask).toBe(false);
  });

  it("defaults to sane values", () => {
    const args = parseArgs([]);
    expect(args.verbose).toBe(false);
    expect(args.mask).toBe(true);
    expect(args.help).toBe(false);
    expect(args.file).toBeUndefined();
    expect(args.files).toBeUndefined();
    expect(args.name).toBeUndefined();
  });

  it("parses combined flags", () => {
    const args = parseArgs([
      "--file", "./api.mts",
      "-e", "production",
      "-v",
      "--no-mask",
      "myExport",
    ]);

    expect(args.file).toBe("./api.mts");
    expect(args.environment).toBe("production");
    expect(args.verbose).toBe(true);
    expect(args.mask).toBe(false);
    expect(args.name).toBe("myExport");
  });
});
