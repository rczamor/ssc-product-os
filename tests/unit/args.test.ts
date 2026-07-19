import { describe, expect, it } from "vitest";
import { arg, hasFlag, positionals } from "@/runner/lib/args";

describe("arg", () => {
  it("returns a flag's value", () => {
    expect(arg(["--run", "abc", "--persona", "ciso"], "--run")).toBe("abc");
  });
  it("returns undefined when the value is missing (next token is another flag)", () => {
    // The bug this guards: `--error --status failed` must not store '--status'.
    expect(arg(["--error", "--status", "failed"], "--error")).toBeUndefined();
    expect(arg(["--run"], "--run")).toBeUndefined();
  });
  it("returns undefined when the flag is absent", () => {
    expect(arg(["--persona", "vrm"], "--run")).toBeUndefined();
  });
});

describe("positionals", () => {
  it("collects tokens before the first flag", () => {
    expect(positionals(["a", "b", "--full"])).toEqual(["a", "b"]);
  });
  it("does not swallow a positional after a boolean flag", () => {
    // Old positional() had a hidden ['--full'] allowlist that broke here.
    expect(positionals(["url", "--wait", "sel"])).toEqual(["url"]);
  });
  it("supports -- to pass dash-prefixed values", () => {
    expect(positionals(["sel", "--", "--weird-value"])).toEqual(["sel", "--weird-value"]);
  });
});

describe("hasFlag", () => {
  it("detects presence", () => {
    expect(hasFlag(["--full"], "--full")).toBe(true);
    expect(hasFlag(["--other"], "--full")).toBe(false);
  });
});
