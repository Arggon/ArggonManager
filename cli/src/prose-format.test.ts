import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import { describe, expect, it } from "vitest";

// bug-formatter-glues-markdown-spaces: `npm run format` (prettier -w .) runs on
// every edit in this repo and CI never runs prettier, so nothing else notices
// when the formatter silently rewrites prose. Prettier's markdown printer
// rebuilds inline-code spans from its own parse, and an invalid `\`` escape
// inside single-backtick delimiters makes that parse split the span and drop
// the whitespace around the split — `null` otherwise became `null`otherwise in
// ArggonManager/docs/json-output.md, and a code span spanning a line break lost
// the continuation line's indentation in skills/arggon-cli/references/pitfalls.md.
// The repairs (valid ``double-backtick`` delimiters, spans kept on one line)
// live in those files.
//
// Coverage limit (review finding 2, PR #387): the token diff below pins TOKEN
// MERGES only, so it cannot see the pitfalls.md repair (a whitespace-run
// replacement, not a merge). The companion "byte-stable" test pins
// `prettier --write` as a no-op on the two files repaired here — it catches a
// NEWLY introduced multi-line code span (prettier would drop the continuation
// indent and the bytes would move), but NOT a revert to the committed
// pitfalls.md base: that base is exactly the stable-but-damaged output prettier
// itself produced. A corpus-wide indentation rule has to wait for
// task-code-span-repair-sweep, because it fails today on docs outside this
// item's scope. Embedded code-fence content is out of scope too: a JS
// normalization inside a fence can merge tokens without being flagged, and
// reformatting that code is the embedded formatter's job, not prose.
//
// It formats every prose doc with the repo's prettier config and fails when a
// formatted token is the concatenation of source tokens that whitespace
// separated — a glued token. It deliberately is NOT `prettier --check`: these
// docs are not byte-clean (prettier re-pads tables) and need not become so; the
// only invariant pinned here is that formatting cannot merge prose tokens.
//
// Scope: every tracked markdown file except the tracker item tree
// (ArggonManager/<initiative>/…). Item bodies are historical records that may
// quote mangled formatter output as evidence, so they are not reformatted.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The files this item repaired: `prettier --write` must stay a no-op on them. */
const REPAIRED_FILES = [
  "ArggonManager/docs/json-output.md",
  "skills/arggon-cli/references/pitfalls.md",
];

/** Tracked prose markdown: the tracker's `docs/` plus everything outside it. */
function proseDocs(): string[] {
  return execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((path) => !path.startsWith("ArggonManager/") || path.startsWith("ArggonManager/docs/"))
    .sort();
}

function tokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Tokens the formatter merged: a formatted token that equals a run of two or
 * more source tokens that whitespace separated. A merge is reported only when
 * the merged token sits between the same neighbours as the source run, so a
 * coincidental substring elsewhere in the file cannot fire it.
 */
function gluedTokens(source: string, formatted: string): string[] {
  const src = tokens(source);
  const out = tokens(formatted);
  const srcTokens = new Set(src);
  const outTokens = new Set(out);
  const glued: string[] = [];
  for (let i = 0; i < src.length - 1; i++) {
    let merged = src[i];
    for (let end = i + 1; end < src.length && end <= i + 3; end++) {
      merged += src[end];
      // A token the source already had on its own is not evidence of a merge.
      if (!outTokens.has(merged) || srcTokens.has(merged)) {
        continue;
      }
      const before = src[i - 1];
      const after = src[end + 1];
      const sitsInPlace = out.some(
        (token, at) => token === merged && out[at - 1] === before && out[at + 1] === after,
      );
      if (sitsInPlace) {
        glued.push(`${src.slice(i, end + 1).join(" ")} → ${merged}`);
        break;
      }
    }
  }
  return glued;
}

describe("prose markdown survives the formatter", () => {
  it("prettier never glues whitespace-separated tokens together", async () => {
    const files = proseDocs();
    // A silent empty list would make this suite pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    const failures: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      const formatted = await prettier.format(source, {
        ...config,
        filepath: join(repoRoot, file),
      });
      const glued = gluedTokens(source, formatted);
      if (glued.length > 0) {
        failures.push(`${file}: ${glued.join("; ")}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("the files repaired in this item stay byte-stable under prettier", async () => {
    const config = (await prettier.resolveConfig(join(repoRoot, "package.json"))) ?? {};
    for (const file of REPAIRED_FILES) {
      const source = readFileSync(join(repoRoot, file), "utf8");
      const formatted = await prettier.format(source, {
        ...config,
        filepath: join(repoRoot, file),
      });
      expect(formatted, `${file} is no longer prettier-clean — run \`npm run format\``).toBe(
        source,
      );
    }
  });
});
