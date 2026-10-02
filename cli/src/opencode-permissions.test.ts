/**
 * Structural gate for the repo's own `opencode.jsonc` permissions block
 * (bug-opencode-jsonc-malformed-permissions).
 *
 * Incident: the `permissions` array closed after its third rule and a stray
 * rule (plus a dangling `]` / `}`) followed it, so the file did not parse as
 * JSONC at all — the W4 workflow gates were silently unenforced while the
 * file's own comment claimed they were in force (observed as worker sessions
 * getting "Permission denied: shell" for ordinary `git commit` / `rebase`).
 * Nothing in CI parsed the file, so a malformed edit merged green.
 *
 * This gate parses it on every run and pins the shape the methodology relies
 * on. Dependency-free by hand (the same trade `ci-seam-pin.test.ts` makes for
 * YAML): a string-aware scanner strips `//` comments, then trailing commas
 * (both JSONC features OpenCode's parser accepts), then `JSON.parse` runs.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG = join(root, "opencode.jsonc");

/**
 * Remove `//` comments that live outside string literals. Tracks string state
 * so a `//` inside a value (a URL, a glob) is preserved byte for byte.
 */
function stripLineComments(source: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Drop trailing commas before `]` / `}` (string-aware, like the stripper). */
function stripTrailingCommas(source: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      const rest = source.slice(i + 1);
      const next = /^\s*([\]}])/.exec(rest);
      if (next !== null) continue;
    }
    out += ch;
  }
  return out;
}

/** The parse every editor's JSONC loader effectively performs. */
function parseJsonc(source: string): unknown {
  return JSON.parse(stripTrailingCommas(stripLineComments(source)));
}

type PermissionRule = { action?: unknown; resource?: unknown; effect?: unknown };

describe("opencode.jsonc permissions block (bug-opencode-jsonc-malformed-permissions)", () => {
  const config = parseJsonc(readFileSync(CONFIG, "utf8")) as {
    permissions?: PermissionRule[];
  };

  it("parses as JSONC (comments + trailing commas tolerated)", () => {
    expect(() => parseJsonc(readFileSync(CONFIG, "utf8"))).not.toThrow();
  });

  it("keeps every permission rule inside the permissions array", () => {
    // A rule object after the array's `]` cannot parse at all — the incident
    // shape. Parseability is the assertion; keep it explicit for the reader.
    expect(Array.isArray(config.permissions)).toBe(true);
    expect(config.permissions?.length ?? 0).toBeGreaterThan(0);
  });

  it("every rule is a well-formed shell deny with a resource pattern", () => {
    const rules = config.permissions ?? [];
    for (const rule of rules) {
      expect(rule.action, JSON.stringify(rule)).toBe("shell");
      expect(typeof rule.resource, JSON.stringify(rule)).toBe("string");
      expect(rule.effect, JSON.stringify(rule)).toBe("deny");
      expect(String(rule.resource).length).toBeGreaterThan(0);
    }
  });

  it("keeps the workflow's non-negotiable denies (no --no-verify, no force push)", () => {
    const resources = (config.permissions ?? []).map((rule) => String(rule.resource));
    for (const required of [
      "git commit --no-verify*",
      "git push --force*",
      "git push -f*",
      "git push *+*",
    ]) {
      expect(resources, `missing deny for ${required}`).toContain(required);
    }
    expect(new Set(resources).size, "duplicate permission resource patterns").toBe(
      resources.length,
    );
  });

  it("negative control: a rule stranded outside the array fails this gate", () => {
    // The exact incident shape, so a recurrence is a red test and not a
    // silently unenforced permissions block.
    const malformed = `{
  // comment
  "permissions": [
    { "action": "shell", "resource": "git push --force*", "effect": "deny" },
  ],
    { "action": "shell", "resource": "git push *+*", "effect": "deny" }
  ]
}`;
    expect(() => parseJsonc(malformed)).toThrow();
  });
});
