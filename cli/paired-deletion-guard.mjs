#!/usr/bin/env node
/**
 * Paired-deletion guard (bug-no-gate-warns-on-paired-impl-and-test-deletion).
 *
 * THE SHAPE. `npm test` / `npm run build` catch a deletion that breaks
 * compilation or orphans a test. A deletion that removes an implementation file
 * AND its paired test in the same change leaves nothing to fail: it compiles,
 * the suite is green, and the module is simply gone. PR #586 hit exactly this
 * — `D cli/src/adapters.ts` + `D cli/src/adapter-selection.test.ts` — and it
 * turned out to be an artifact of a two-dot diff against a stale base, but the
 * only reason anyone could tell was manual `git diff --name-status` inspection.
 * A reviewer running the three-dot view, or trusting a summary, would have
 * merged the deletion of a module and its test.
 *
 * WHAT THIS REPORTS. Every `D` row of a PR's diff, and a loud warning when a
 * `D` row removes an implementation file whose paired test is deleted in the
 * same change (same directory, same basename, one of them carrying a test
 * marker). The pairing is deliberately coarse and errs toward UNDER-reporting:
 * it only fires when both sides are deleted, so a file without a test — or a
 * test without an implementation, e.g. `cli/src/adapter-selection.test.ts`
 * against `cli/src/adapters.ts` — is listed and never paired.
 *
 * REPORT-ONLY BY DEFAULT. The loudness decision, recorded in the work item and
 * in the CI step: a paired deletion is a legitimate, reviewed refactor step as
 * often as it is an accident (measured: 0 paired deletions across the last 500
 * commits of this repo, out of 40 `D` rows total), so the CI step annotates and
 * exits 0 — no behaviour change to the lane, no `continue-on-error`, no
 * `continue-on-error`-shaped knob to rot. `--strict` turns a finding into exit
 * 1; it is the promotion path and it is exercised on every `npm test` by
 * `cli/paired-deletion-guard.test.ts`, which is what keeps this from being the
 * report-nothing vacuity of bug-verification-regex-matching-nothing.
 *
 * WHY THREE-DOT, NOT TWO-DOT — the incident's actual root cause. `A...B` diffs
 * from the MERGE BASE, so it is the PR's own change set. `A B` (two-dot)
 * compares the two tips: when the base has moved ahead of the branch point,
 * every file the base gained in the meantime shows up as `D` on the branch
 * side — a deletion that never happened, in exactly the shape this guard
 * reports. So the stale base MANUFACTURES paired deletions here. This script
 * always diffs merge-base -> head, prints which base and which merge base it
 * used, and the test suite pins the phantom case (a branch that deleted
 * nothing must report no pair) so a future edit to the diff arm cannot quietly
 * reintroduce the #586 false positive.
 *
 * Usage:
 *   node cli/paired-deletion-guard.mjs [--base <rev>] [--head <rev>]
 *                                      [--diff <file|->] [--strict]
 *     --base <rev>     merge-base rev, default `origin/main`
 *     --head <rev>     head rev, default `HEAD`
 *     --diff <file|->  read a captured `git diff --name-status` instead of
 *                      running git (the human probe: no git state needed)
 *     --strict         exit 1 when at least one pair is found (default: exit 0)
 *
 * Exit codes: 0 — no pair found, or a pair found in report-only mode;
 * 1 — pair(s) found under `--strict`; 2 — usage error, an unresolvable
 * `--base`/`--head`, a missing merge base (shallow clone), or a failed git
 * invocation. A run that COULD NOT look is never a quiet pass: exit 2 is the
 * vacuity guard, and it is why the CI step must not be wrapped in `|| true`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Extensions treated as implementation (or test) code. A deleted `.md`,
 * `.json`, `.yml` or fixture is listed as a `D` row but can never pair: the
 * shape this guard names is "a module and its test", not "two files of the
 * same name". Documented as a closed set so extending it is a deliberate edit.
 */
export const IMPLEMENTATION_EXTENSIONS = [".ts", ".tsx", ".mjs", ".cjs", ".js", ".jsx"];

/** Test-file markers this repo actually writes: `x.test.ts`, `x.spec.ts`. */
export const TEST_MARKERS = [".test", ".spec"];

/** The repo's property-test convention: `x.property.test.ts` pairs with `x.ts`. */
const PROPERTY_MARKER = ".property";

/** Implementation stem of a path, or null when it cannot carry code. */
function stemOf(path) {
  const ext = extname(path);
  if (!IMPLEMENTATION_EXTENSIONS.includes(ext)) return null;
  const stem = basename(path).slice(0, -ext.length);
  return stem === "" ? null : stem;
}

/** True when the path looks like a test file (`x.test.ts`, `x.spec.ts`). */
export function isTestPath(path) {
  const stem = stemOf(path);
  return stem !== null && TEST_MARKERS.some((marker) => stem.endsWith(marker));
}

/**
 * Pair key: the directory plus the implementation stem a file is the partner
 * of. `a/b/foo.test.ts` and `a/b/foo.ts` share `a/b/foo`; `board-serve.property.test.ts`
 * shares `cli/src/board-serve` with `board-serve.ts`. Returns null for
 * anything that cannot carry code, so non-code deletions are never paired.
 */
export function pairKey(path) {
  const stem = stemOf(path);
  if (stem === null) return null;
  let base = stem;
  for (const marker of TEST_MARKERS) {
    if (!stem.endsWith(marker)) continue;
    base = stem.slice(0, -marker.length);
    if (base.endsWith(PROPERTY_MARKER)) base = base.slice(0, -PROPERTY_MARKER.length);
    break;
  }
  if (base === "") return null;
  const dir = dirname(path);
  return dir === "." ? base : `${dir}/${base}`;
}

/**
 * Parse `git diff --name-status` output into rows. `R100 old new` / `C75 src
 * dst` keep their second path; a rename or copy is NOT a deletion, which is
 * why the old path is recorded separately instead of collapsing into `path`.
 */
export function parseNameStatus(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const fields = line.split("\t");
    const status = fields[0].trim();
    if (status === "") continue;
    if (/^[RC]/.test(status) && fields.length >= 3) {
      rows.push({ status, path: fields[2], oldPath: fields[1] });
      continue;
    }
    rows.push({ status, path: fields[1] ?? "" });
  }
  return rows;
}

/**
 * Deleted rows of a `--name-status` diff. Only a bare `D` counts: a `R`/`C`
 * row has an `oldPath`, and "renamed away" is a different (reviewable,
 * content-preserving) event from "gone".
 */
export function deletedRows(rows) {
  return rows.filter((row) => row.status === "D" && row.path !== "");
}

/**
 * Keys whose deleted set holds both an implementation and a test — the shape
 * that compiles and stays green. Sorted by key so output is deterministic.
 */
export function findPairedDeletions(rows) {
  const buckets = new Map();
  for (const row of deletedRows(rows)) {
    const key = pairKey(row.path);
    if (key === null) continue;
    const bucket = buckets.get(key) ?? { implementations: [], tests: [] };
    bucket[isTestPath(row.path) ? "tests" : "implementations"].push(row.path);
    buckets.set(key, bucket);
  }
  const pairs = [];
  for (const key of [...buckets.keys()].sort()) {
    const bucket = buckets.get(key);
    if (bucket.implementations.length === 0 || bucket.tests.length === 0) continue;
    pairs.push({
      key,
      implementations: [...bucket.implementations].sort(),
      tests: [...bucket.tests].sort(),
    });
  }
  return pairs;
}

function git(args, cwd) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd, encoding: "utf8" });
}

/**
 * SHAs at this repository's shallow boundary, or empty when it is not shallow.
 * A merge base sitting ON that boundary means the base's history is truncated
 * at the answer: the diff below it may include changes already on the base, so
 * any reported pair must be read as unverified. That is the #586 phantom's
 * mechanism, so it is reported rather than assumed away.
 */
function shallowBoundary(cwd) {
  const gitShallow = git(["rev-parse", "--git-path", "shallow"], cwd).trim();
  if (gitShallow === "") return new Set();
  const path = isAbsolute(gitShallow) ? gitShallow : join(cwd, gitShallow);
  try {
    return new Set(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== ""),
    );
  } catch {
    return new Set();
  }
}

function revCount(from, to, cwd) {
  try {
    return Number.parseInt(git(["rev-list", "--count", `${from}..${to}`], cwd).trim(), 10);
  } catch {
    return null;
  }
}

function readDiff(path) {
  return path === "-" ? readFileSync(0, "utf8") : readFileSync(path, "utf8");
}

function usage() {
  process.stdout.write(
    "paired-deletion guard (bug-no-gate-warns-on-paired-impl-and-test-deletion)\n" +
      "usage: node cli/paired-deletion-guard.mjs [--base <rev>] [--head <rev>] " +
      "[--diff <file|->] [--strict]\n" +
      "  --base <rev>     merge-base rev, default origin/main\n" +
      "  --head <rev>     head rev, default HEAD\n" +
      "  --diff <file|->  read a captured git diff --name-status instead of running git\n" +
      "  --strict         exit 1 when at least one pair is found (default: report-only, exit 0)\n",
  );
}

function usageError(message) {
  process.stderr.write(`paired-deletion-guard: ${message}\n`);
  usage();
  process.exitCode = 2;
}

/**
 * The report surface. Returns the verdict fields so the caller (and the tests)
 * can assert on the same numbers the human reads.
 */
export function run(argv) {
  const options = { base: "origin/main", head: "HEAD", diff: undefined, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--strict") options.strict = true;
    else if (flag === "--base" || flag === "--head" || flag === "--diff") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        usageError(`${flag} needs a value`);
        return { ok: false, reason: "usage" };
      }
      options[flag.slice(2)] = value;
      i += 1;
    } else if (flag === "--help" || flag === "-h") {
      usage();
      return { ok: false, reason: "help" };
    } else {
      usageError(`unknown argument '${flag}'`);
      return { ok: false, reason: "usage" };
    }
  }

  const cwd = process.cwd();
  let rows;
  let description;
  let baseLabel = options.base;
  let mergeBase = undefined;
  let ahead = null;
  let behind = null;
  let shallow = false;

  if (options.diff !== undefined) {
    // Captured diff (`--diff`): the three-dot/merge-base discipline is the
    // CALLER's, and the report says so instead of claiming a base it never read.
    rows = parseNameStatus(readDiff(options.diff));
    description = `captured --name-status diff from ${options.diff}`;
  } else {
    try {
      mergeBase = git(["merge-base", options.base, options.head], cwd).trim();
    } catch {
      process.stderr.write(
        `paired-deletion-guard: no merge base between '${options.base}' and '${options.head}' ` +
          "(shallow clone? fetch the base: git fetch --depth=250 origin <base-sha>) — `continue-on-error` is not a fix\n",
      );
      process.exitCode = 2;
      return { ok: false, reason: "no-merge-base" };
    }
    if (mergeBase === "") {
      process.stderr.write(`paired-deletion-guard: empty merge base for '${options.base}'\n`);
      process.exitCode = 2;
      return { ok: false, reason: "no-merge-base" };
    }
    rows = parseNameStatus(git(["diff", "--name-status", mergeBase, options.head], cwd));
    description = `git diff --name-status ${mergeBase} ${options.head} (merge-base -> head, three-dot semantics)`;
    baseLabel = `${options.base} (merge base ${mergeBase})`;
    ahead = revCount(options.base, options.head, cwd);
    behind = revCount(options.head, options.base, cwd);
    shallow = shallowBoundary(cwd).has(mergeBase);
  }

  const deleted = deletedRows(rows);
  const pairs = findPairedDeletions(rows);

  console.log(
    "paired-deletion guard (bug-no-gate-warns-on-paired-impl-and-test-deletion) — report of the diff's D rows",
  );
  console.log(`  base:      ${baseLabel}`);
  console.log(`  diff:      ${description}`);
  if (ahead !== null && behind !== null) {
    console.log(
      `  ahead/behind: ${ahead} commit(s) on head, ${behind} on base — a large 'behind' is a stale base in the making`,
    );
  }
  console.log(`  files changed: ${rows.length}, deleted: ${deleted.length}`);
  for (const row of deleted) console.log(`    D ${row.path}`);
  if (shallow) {
    // Not a pair claim: a caveat on every pair this run may report.
    console.log(
      `  ::warning:: merge base ${mergeBase} is at this repository's shallow boundary — ` +
        "the base's history is truncated here, so the diff may include changes ALREADY on the base " +
        "(the #586 phantom). Deepen the fetch before trusting any pair below.",
    );
  }
  for (const pair of pairs) {
    console.log(
      `  ::warning:: paired deletion — ${pair.implementations.join(", ")} (implementation) and ` +
        `${pair.tests.join(", ")} (test) are both deleted by this diff, the shape that compiles and stays green. ` +
        "If deliberate, say so in the PR body; if not, compare against a THREE-dot view " +
        "(`git diff --name-status origin/main...HEAD`) — a two-dot view against a stale base manufactures this pair.",
    );
  }

  if (pairs.length === 0) {
    console.log(
      deleted.length === 0
        ? "verdict: no deletions in this diff"
        : `verdict: no paired deletions (${deleted.length} deleted row(s) listed above)`,
    );
  } else {
    console.log(
      `verdict: ${pairs.length} paired deletion(s) — report-only, this does not fail the build ` +
        "(--strict makes it exit 1; promoting this to a blocking gate is its own call)",
    );
  }
  if (options.strict && pairs.length > 0) process.exitCode = 1;
  return { ok: true, deleted, pairs, strict: options.strict, mergeBase };
}

// Direct-run guard: the test suite imports the pure parts above.
const invokedDirectly = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) run(process.argv.slice(2));
