/**
 * Force-push discriminator gate
 * (bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use).
 *
 * Incident: the W4 workflow gate `git push --force*` matched
 * `git push --force-with-lease` — the lease-checked, *recommended* spelling —
 * so the delivery lead could not push a rebased item branch and the wave
 * stopped at the merge step. The pattern's intent is "no history destruction";
 * a glob cannot tell `--force` from `--force-with-lease` (its `*` matches the
 * `-`), so this gate pins the discriminator: the lease-checked spellings are
 * permitted, the blind ones stay refused.
 *
 * The matcher below is a faithful port of the runtime's own, extracted from
 * the installed OpenCode V2 binary (`opencode` 1.18.27; the embedded pair
 * `Q_(resource, pattern)` for pattern matching and `yC(action, resource, …)`
 * for rule selection):
 *
 *   1. `\` → `/` in both the command and the pattern;
 *   2. regex metacharacters escaped — INCLUDING `[` and `]`, so character
 *      classes are literals and `*` / `?` are the only wildcards a rule has;
 *   3. `*` → `.*` (any run of characters, `-` included — the defect),
 *      `?` → `.` (exactly one character);
 *   4. a trailing `" .*"` relaxed to `"( .*)?"`, so `git push --force *` also
 *      matches a bare `git push --force`;
 *   5. anchored `^…$` with the `s` flag;
 *   6. rules evaluated with `findLast` over the flattened list (an agent's own
 *      rules first, then the project `permissions` array, which the runtime
 *      appends to EVERY agent) — the LAST matching rule wins, and no match
 *      means allow (the base policy stays allow-all).
 *
 * That last point is what makes the fix expressible at all: the broad
 * `git push --force*` deny stays byte-identical (so nothing it refuses today
 * starts passing, `;`/`&&`/quoted forms included) and the lease-checked
 * spellings are re-allowed *after* it. The alternative — narrowing the deny to
 * `--force` + a delimiter — cannot be written with `*`/`?` alone (no character
 * classes) and would drop the separator forms with it.
 *
 * Dependency-free JSONC reading, same trade as the sibling
 * `opencode-permissions.test.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Every carrier of the shipped rule list: this repo's own config + the template. */
const CONFIGS = ["opencode.jsonc", "templates/docs/opencode.jsonc"] as const;

type PermissionRule = { action?: unknown; resource?: unknown; effect?: unknown };

/** Remove `//` comments outside string literals (string-aware). */
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

/** Drop trailing commas before `]` / `}` (string-aware). */
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
      if (/^\s*([\]}])/.test(rest)) continue;
    }
    out += ch;
  }
  return out;
}

function readRules(rel: string): PermissionRule[] {
  const raw = readFileSync(join(root, ...rel.split("/")), "utf8");
  const parsed = JSON.parse(stripTrailingCommas(stripLineComments(raw))) as {
    permissions?: PermissionRule[];
  };
  return parsed.permissions ?? [];
}

/** The runtime's `Q_`: a rule `resource` pattern as the RegExp it compiles to. */
function patternToRegExp(pattern: string): RegExp {
  let source = pattern
    .replaceAll("\\", "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  if (source.endsWith(" .*")) source = `${source.slice(0, -3)}( .*)?`;
  return new RegExp(`^${source}$`, "s");
}

/** The runtime's `yC` + the shell tool's deny check: last match wins, default allow. */
function commandEffect(command: string, rules: PermissionRule[]): "allow" | "deny" {
  // The runtime uses `findLast` over the flattened rule list; the manual scan
  // keeps the same last-match-wins semantics on the project's ES lib target.
  let effect: "allow" | "deny" = "allow";
  for (const rule of rules) {
    const actionMatches = patternToRegExp(String(rule.action)).test("shell");
    const resourceMatches = patternToRegExp(String(rule.resource)).test(command);
    if (actionMatches && resourceMatches) effect = rule.effect === "deny" ? "deny" : "allow";
  }
  return effect;
}

/**
 * The destructive spellings the seam refuses. The first three are the
 * acceptance's negative control; the rest are the forms the incident's rule
 * already refused and that must not start passing.
 */
const DENIED = [
  "git push --force origin main",
  "git push --force",
  "git push -f",
  "git push -f origin main",
  "git push --force -u origin fix/bug-x",
  "git push origin +main",
  "git push origin +fix/bug-x:fix/bug-x",
  // Separator forms: the broad deny is kept precisely so these stay refused.
  "git push --force; git status",
  "git push --force&& git status",
  "git commit --no-verify -m probe",
];

/**
 * The lease-checked spellings — the rebase path the lead must be able to take.
 *
 * `git push --force-with-lease origin main:other` (a lease-checked push of a
 * ref the caller named) is judged SAFE here, not refused: the lease, not the
 * refname, is the discriminator. A refspec colon buys no protection — the
 * colon-free `git push --force-with-lease origin main` is permitted too, so a
 * deny on the colon form would refuse a spelling (`HEAD:<branch>`) without
 * refusing anything it means to refuse, which is this bug's own defect class.
 */
const ALLOWED = [
  "git push --force-with-lease origin fix/bug-x",
  "git push --force-with-lease -u origin fix/bug-x",
  "git push --force-with-lease",
  "git push --force-with-lease=origin/main:abc123 origin fix/bug-x",
  "git push --force-with-lease=origin/main:abc123 -u origin fix/bug-x",
  "git push --force-if-includes origin fix/bug-x",
  "git push --force-if-includes --force-with-lease origin fix/bug-x",
  // The rest of the loop this gate sits on: never blocked.
  "git push -u origin fix/bug-x",
  "git push origin main",
  "git rebase origin/main",
];

describe.each(CONFIGS)("force-push discriminator in %s", (rel) => {
  const rules = readRules(rel);

  it("refuses the blind force spellings (negative control)", () => {
    for (const command of DENIED) {
      expect(commandEffect(command, rules), `must be denied: ${command}`).toBe("deny");
    }
  });

  it("permits the lease-checked spellings the rebase path needs", () => {
    for (const command of ALLOWED) {
      expect(commandEffect(command, rules), `must be allowed: ${command}`).toBe("allow");
    }
  });

  it("keeps the project-wide non-negotiables refused", () => {
    expect(commandEffect("git commit --no-verify -m probe", rules)).toBe("deny");
    expect(commandEffect("git commit -m probe", rules)).toBe("allow");
  });

  it("scopes every relaxation to the lease spellings (no allow matches a denied command)", () => {
    for (const rule of rules.filter((candidate) => candidate.effect !== "deny")) {
      const pattern = patternToRegExp(String(rule.resource));
      for (const command of DENIED) {
        expect(
          pattern.test(command),
          `non-deny rule ${String(rule.resource)} matches denied command: ${command}`,
        ).toBe(false);
      }
    }
  });
});
