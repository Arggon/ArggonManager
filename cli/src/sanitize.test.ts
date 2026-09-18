import { describe, expect, it } from "vitest";
import {
  MAX_HUMAN_ERROR_CHARS,
  MAX_HUMAN_VALUE_CHARS,
  sanitizeHumanError,
  sanitizeHumanText,
  sanitizeHumanValue,
} from "./sanitize.js";

/** Raw code points the sanitizers must never let through. */
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

describe("sanitizeHumanText", () => {
  it("renders ordinary paths/URLs byte-identical (positive case)", () => {
    const ordinary = [
      "/home/user/repo",
      "/tmp/arggon-doctor-AbC123/tasks",
      "git@github.com:example/example.git",
      "https://github.com/example/example.git",
      "working tree has changes that block start (commit or stash first)",
      "task-bad: unknown status 'bogus'",
    ];
    for (const value of ordinary) {
      expect(sanitizeHumanText(value)).toBe(value);
    }
  });

  it("escapes C0 controls (newline, ESC, tab, NUL) as inert text", () => {
    expect(sanitizeHumanText("a\nb")).toBe("a\\nb");
    expect(sanitizeHumanText("x\u001b[31m")).toBe("x\\u001b[31m");
    expect(sanitizeHumanText("a\tb")).toBe("a\\tb");
    expect(sanitizeHumanText("a\u0000b")).toBe("a\\u0000b");
    expect(sanitizeHumanText('say "hi"')).toBe('say \\"hi\\"');
  });

  it("escapes DEL/C1 and the Unicode line/paragraph separators", () => {
    expect(sanitizeHumanText("a\u007fb")).toBe("a\\u007fb");
    expect(sanitizeHumanText("a\u0085b")).toBe("a\\u0085b");
    expect(sanitizeHumanText("a\u009fb")).toBe("a\\u009fb");
    expect(sanitizeHumanText("a\u2028b")).toBe("a\\u2028b");
    expect(sanitizeHumanText("a\u2029b")).toBe("a\\u2029b");
  });

  it("keeps the F-1 repro inert: one value, no raw unsafe code points", () => {
    const hostile =
      "bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md: unknown status 'bogus'";
    const out = sanitizeHumanText(hostile);
    expect(out).not.toMatch(UNSAFE);
    expect(out.split("\n")).toHaveLength(1); // no forged line
    expect(out).toBe(
      "bad\\nspoof: fake item\\u001b[31m\\u0085\\u007f\\u2028\\u2029.md: unknown status 'bogus'",
    );
  });

  it("caps the raw value before escaping and bounds the rendered length", () => {
    const long = "a".repeat(MAX_HUMAN_VALUE_CHARS * 3);
    const out = sanitizeHumanText(long);
    expect(out).toBe(`${"a".repeat(MAX_HUMAN_VALUE_CHARS)}…`);
    expect(out).toHaveLength(MAX_HUMAN_VALUE_CHARS + 1);

    // Every escaped code point expands to 6 chars (`\uXXXX`); the raw clip is
    // cap + the ellipsis, so one rendered value stays under 6 * (cap + 1).
    const allUnsafe = sanitizeHumanText("\u001b".repeat(MAX_HUMAN_VALUE_CHARS * 3));
    expect(allUnsafe.length).toBeLessThanOrEqual(6 * (MAX_HUMAN_VALUE_CHARS + 1));
    expect(allUnsafe.endsWith("…")).toBe(true);
  });

  it("does not split a surrogate pair at the cap boundary", () => {
    const value = `${"a".repeat(MAX_HUMAN_VALUE_CHARS - 1)}😀${"b".repeat(50)}`;
    const out = sanitizeHumanText(value);
    expect(out).toBe(`${"a".repeat(MAX_HUMAN_VALUE_CHARS - 1)}…`);
    expect(out).not.toContain("\ud83d"); // no lone high surrogate
  });

  it("honors the larger error-channel cap (F1)", () => {
    expect(MAX_HUMAN_ERROR_CHARS).toBeGreaterThan(MAX_HUMAN_VALUE_CHARS);
    const long = "e".repeat(MAX_HUMAN_ERROR_CHARS + 100);
    const out = sanitizeHumanError(long);
    expect(out).toBe(`${"e".repeat(MAX_HUMAN_ERROR_CHARS)}…`);
    expect(sanitizeHumanError("ordinary error")).toBe("ordinary error");
    // The error channel escapes the same code points and stays one line.
    expect(sanitizeHumanError("bad\nspoof\u001b[31m")).toBe("bad\\nspoof\\u001b[31m");
  });
});

describe("sanitizeHumanValue", () => {
  it("leaves ordinary config-key tokens unquoted and byte-identical", () => {
    expect(sanitizeHumanValue("mcp.arggon")).toBe("mcp.arggon");
    expect(sanitizeHumanValue("maxSteps")).toBe("maxSteps");
    expect(sanitizeHumanValue("tools")).toBe("tools");
  });

  it("JSON-quotes and escapes a hostile key", () => {
    expect(sanitizeHumanValue("mcp.\u001b[31m")).toBe('"mcp.\\u001b[31m"');
    expect(sanitizeHumanValue("a\nb")).toBe('"a\\nb"');
  });

  it("caps a long key before quoting", () => {
    const long = "k".repeat(MAX_HUMAN_VALUE_CHARS * 3);
    expect(sanitizeHumanValue(long)).toBe(`"${"k".repeat(MAX_HUMAN_VALUE_CHARS)}…"`);
  });
});
