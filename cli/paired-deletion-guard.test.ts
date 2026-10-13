/**
 * Paired-deletion guard (bug-no-gate-warns-on-paired-impl-and-test-deletion).
 *
 * THE SHAPE, and why it went green twice. `npm test` / `npm run build` fire
 * when a deletion breaks compilation or orphans a test. Deleting an
 * implementation AND its paired test in the same change leaves nothing to
 * fail, so nothing fired. PR #586 produced `D cli/src/adapters.ts` +
 * `D cli/src/adapter-selection.test.ts` and it turned out to be an artifact of
 * a two-dot diff against a stale base — but the only reason anyone could tell
 * was manual `git diff --name-status` inspection, which is the measure of how
 * invisible the shape is.
 *
 * What this suite asserts, and why each shape:
 *
 *   1. **The pair is detected.** Real git fixtures: an implementation and its
 *      test deleted together on a real branch, reported through the real
 *      script. Not a hand-written `--name-status` string — the point is that
 *      the diff arm and the pairing rule work together.
 *   2. **The single-sided deletions are NOT pairs.** Implementation alone, test
 *      alone, and a deleted doc/fixture: listed as `D` rows, never paired.
 *      Without these the pair rule would be unfalsifiable.
 *   3. **The stale-base phantom does NOT fire.** A branch that deleted
 *      nothing, where the base moved ahead and gained a module plus its test,
 *      must report no pair. The same test asserts the two-dot view DOES carry
 *      both `D` rows — that is the #586 false positive, demonstrated rather
 *      than described, and it is the reason the guard diffs merge-base -> head.
 *   4. **A run that could not look is never a quiet pass.** An unresolvable
 *      base exits 2. `bug-verification-regex-matching-nothing` is the vacuity
 *      of a check that reports nothing; the opposite failure — a check that
 *      quietly passes when it could not run — is the same defect with a green
 *      exit code.
 *   5. **The CI step is wired to it, and loudly.** The workflow runs the script
 *      by path, and the step body carries no `|| true` / `continue-on-error` —
 *      the knobs that turn a gate into a log line. The loudness decision
 *      (report-only, `--strict` as the promotion path) is asserted where it is
 *      lived: in the CI step and in the item, not only in this file.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { initFixtureRepo, removeFixtureTree } from "./src/test-tmp.js";
import {
  deletedRows,
  findPairedDeletions,
  IMPLEMENTATION_EXTENSIONS,
  isTestPath,
  pairKey,
  parseNameStatus,
  TEST_MARKERS,
} from "./paired-deletion-guard.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(repoRoot, "cli", "paired-deletion-guard.mjs");
const CI_WORKFLOW = join(repoRoot, ".github", "workflows", "ci.yml");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});
function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-paired-deletion-"));
  tmpDirs.push(dir);
  initFixtureRepo(dir);
  return dir;
}

function git(args: string[], cwd: string): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  expect(r.status, `git ${args.join(" ")}: ${r.stderr}`).toBe(0);
  return r.stdout.trim();
}

/** Write/delete `files` (null = delete) and commit them all. */
function commit(cwd: string, files: Record<string, string | null>, message: string): string {
  for (const [path, content] of Object.entries(files)) {
    const abs = join(cwd, path);
    if (content === null) {
      rmSync(abs, { force: true });
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
    git(["add", "--", path], cwd);
  }
  git(["commit", "--quiet", "-m", message], cwd);
  return git(["rev-parse", "HEAD"], cwd);
}

/** Run the guard the way CI does (`node cli/paired-deletion-guard.mjs …`). */
function runGuard(args: string[], cwd: string): { status: number | null; output: string } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const IMPL = "export const adapters = [];\n";
const TEST = 'import { adapters } from "./adapters.js";\n';

// ---------------------------------------------------------------------------
// The pairing rule
// ---------------------------------------------------------------------------

describe("paired-deletion guard: the pairing rule", () => {
  it("pins the documented implementation extensions and test markers", () => {
    expect(IMPLEMENTATION_EXTENSIONS).toEqual([".ts", ".tsx", ".mjs", ".cjs", ".js", ".jsx"]);
    expect(TEST_MARKERS).toEqual([".test", ".spec"]);
  });

  it("pairs an implementation with its test in the same directory", () => {
    expect(pairKey("cli/src/adapters.ts")).toBe("cli/src/adapters");
    expect(pairKey("cli/src/adapters.test.ts")).toBe("cli/src/adapters");
    expect(pairKey("cli/src/adapters.spec.ts")).toBe("cli/src/adapters");
    expect(isTestPath("cli/src/adapters.test.ts")).toBe(true);
    expect(isTestPath("cli/src/adapters.ts")).toBe(false);
  });

  it("covers the repo's property-test convention (`x.property.test.ts` -> `x.ts`)", () => {
    expect(pairKey("cli/src/board-serve.property.test.ts")).toBe("cli/src/board-serve");
    expect(isTestPath("cli/src/board-serve.property.test.ts")).toBe(true);
  });

  it("does NOT pair the PR #586 pair — different keys, one `D` row each", () => {
    // `cli/src/adapters.ts` and `cli/src/adapter-selection.test.ts` are two
    // unrelated files with unrelated basenames. Coarse-by-design: under-reporting
    // is the safe direction for a report that names a shape.
    const rows = parseNameStatus("D\tcli/src/adapters.ts\nD\tcli/src/adapter-selection.test.ts\n");
    expect(deletedRows(rows).map((r) => r.path)).toEqual([
      "cli/src/adapters.ts",
      "cli/src/adapter-selection.test.ts",
    ]);
    expect(findPairedDeletions(rows)).toEqual([]);
  });

  it("never pairs across directories", () => {
    expect(findPairedDeletions(parseNameStatus("D\ta/foo.ts\nD\tb/foo.test.ts\n"))).toEqual([]);
  });

  it("never pairs a code file with a non-code file of the same name", () => {
    // Docs, fixtures and workflow yaml are listed as `D` rows but cannot pair:
    // the named shape is "a module and its test".
    for (const path of ["docs/adapters.md", "ArggonManager/x/adapters.md", "adapters.json"]) {
      expect(pairKey(path)).toBeNull();
    }
    expect(
      findPairedDeletions(parseNameStatus("D\tcli/src/adapters.ts\nD\tdocs/adapters.md\n")),
    ).toEqual([]);
  });

  it("does not pair when only one side is deleted", () => {
    expect(
      findPairedDeletions(parseNameStatus("D\tcli/src/adapters.ts\nM\tcli/src/adapters.test.ts\n")),
    ).toEqual([]);
    expect(
      findPairedDeletions(parseNameStatus("D\tcli/src/adapters.test.ts\nA\tcli/src/adapters.ts\n")),
    ).toEqual([]);
  });

  it("reports the pair with both sides named and sorted, deterministically", () => {
    const rows = parseNameStatus(
      [
        "M\tcli/src/other.ts",
        "D\tcli/src/adapters.test.ts",
        "D\tcli/src/adapters.ts",
        "D\tcli/src/board-serve.ts",
        "D\tcli/src/board-serve.test.ts",
      ].join("\n"),
    );
    expect(findPairedDeletions(rows)).toEqual([
      {
        key: "cli/src/adapters",
        implementations: ["cli/src/adapters.ts"],
        tests: ["cli/src/adapters.test.ts"],
      },
      {
        key: "cli/src/board-serve",
        implementations: ["cli/src/board-serve.ts"],
        tests: ["cli/src/board-serve.test.ts"],
      },
    ]);
  });

  it("treats a rename as a rename, not as a deletion", () => {
    // `R100 old new` carries an oldPath; the module's content survived, which
    // is a different (reviewable) event from "gone".
    const rows = parseNameStatus("R100\tcli/src/adapters.ts\tcli/src/selection.ts\n");
    expect(deletedRows(rows)).toEqual([]);
    expect(findPairedDeletions(rows)).toEqual([]);
    expect(rows[0]).toEqual({
      status: "R100",
      path: "cli/src/selection.ts",
      oldPath: "cli/src/adapters.ts",
    });
  });
});

// ---------------------------------------------------------------------------
// The real thing: a real git fixture, driven through the real script
// ---------------------------------------------------------------------------

describe("paired-deletion guard: detects the paired deletion on a real branch", () => {
  it("names the implementation and its test, in report mode and under --strict", () => {
    const dir = fixtureRepo();
    commit(
      dir,
      {
        "cli/src/adapters.ts": IMPL,
        "cli/src/adapters.test.ts": TEST,
        "cli/src/keep.ts": IMPL,
        "README.md": "# fixture\n",
        "docs/old.md": "# retired\n",
      },
      "add the adapter module",
    );
    git(["checkout", "--quiet", "-b", "feature"], dir);
    commit(
      dir,
      { "cli/src/adapters.ts": null, "cli/src/adapters.test.ts": null, "docs/old.md": null },
      "drop the adapter module and its test, plus a stale doc",
    );

    const report = runGuard(["--base", "main", "--head", "HEAD"], dir);
    expect(report.status).toBe(0);
    // Every D row is listed (the reporter's first acceptance box).
    expect(report.output).toContain("D cli/src/adapters.ts");
    expect(report.output).toContain("D cli/src/adapters.test.ts");
    expect(report.output).toContain("D docs/old.md"); // …and the pair is named, with both sides and the reason.
    expect(report.output).toContain("::warning:: paired deletion");
    expect(report.output).toContain("cli/src/adapters.ts (implementation)");
    expect(report.output).toContain("cli/src/adapters.test.ts (test)");
    expect(report.output).toContain("compiles and stays green");
    // The three-dot arm is stated, not implied.
    expect(report.output).toContain("three-dot semantics");
    expect(report.output).toContain("report-only");
    // Report-only is the recorded decision: the lane is not made red by it.
    expect(report.status).toBe(0);

    const strict = runGuard(["--base", "main", "--head", "HEAD", "--strict"], dir);
    expect(strict.status).toBe(1);
    expect(strict.output).toContain("::warning:: paired deletion");
  });

  it("stays silent when only the implementation is deleted", () => {
    const dir = fixtureRepo();
    commit(dir, { "cli/src/adapters.ts": IMPL, "cli/src/adapters.test.ts": TEST }, "add");
    git(["checkout", "--quiet", "-b", "feature"], dir);
    commit(dir, { "cli/src/adapters.ts": null }, "drop the implementation only");

    const report = runGuard(["--base", "main", "--head", "HEAD"], dir);
    expect(report.status).toBe(0);
    expect(report.output).toContain("D cli/src/adapters.ts");
    expect(report.output).not.toContain("::warning:: paired deletion");
    expect(report.output).toContain("verdict: no paired deletions");
  });

  it("stays silent when only the test is deleted", () => {
    const dir = fixtureRepo();
    commit(dir, { "cli/src/adapters.ts": IMPL, "cli/src/adapters.test.ts": TEST }, "add");
    git(["checkout", "--quiet", "-b", "feature"], dir);
    commit(dir, { "cli/src/adapters.test.ts": null }, "drop the test only");

    const report = runGuard(["--base", "main", "--head", "HEAD"], dir);
    expect(report.status).toBe(0);
    expect(report.output).not.toContain("::warning:: paired deletion");
    expect(report.output).toContain("verdict: no paired deletions");
  });

  it("does NOT fire on the stale-base phantom (the #586 false positive)", () => {
    const dir = fixtureRepo();
    const branchPoint = commit(
      dir,
      { "cli/src/keep.ts": IMPL, "cli/src/keep.test.ts": TEST },
      "base",
    );
    // The base moves AHEAD of the branch point and gains a module + its test.
    commit(
      dir,
      { "cli/src/late.ts": IMPL, "cli/src/late.test.ts": TEST },
      "main gains a module after the branch point",
    );
    // The branch deletes nothing at all.
    git(["checkout", "--quiet", "-b", "feature", branchPoint], dir);
    commit(dir, { "cli/src/feature.ts": "export const feature = 1;\n" }, "add an unrelated module");

    const report = runGuard(["--base", "main", "--head", "HEAD"], dir);
    expect(report.status).toBe(0);
    expect(report.output).toContain("verdict: no deletions in this diff");
    expect(report.output).not.toContain("::warning:: paired deletion");

    // The phantom is real, and only the three-dot view avoids it: the two-dot
    // comparison of the two tips carries BOTH `D` rows — a paired deletion
    // that never happened, in exactly the shape this guard reports.
    const twoDot = git(["diff", "--name-status", "main", "HEAD"], dir);
    expect(twoDot).toContain("D\tcli/src/late.ts");
    expect(twoDot).toContain("D\tcli/src/late.test.ts");
    expect(findPairedDeletions(parseNameStatus(twoDot))).toHaveLength(1);
    // …and that is precisely what the guard's merge-base arm filters out.
    const threeDot = git(["diff", "--name-status", `main...HEAD`], dir);
    expect(threeDot).not.toContain("D\t");
  });

  it("exits 2 when the base cannot be resolved — a run that could not look is never a pass", () => {
    const dir = fixtureRepo();
    commit(dir, { "cli/src/adapters.ts": IMPL }, "add");

    const report = runGuard(["--base", "refs/heads/does-not-exist", "--head", "HEAD"], dir);
    expect(report.status).toBe(2);
    expect(report.output).toContain("no merge base");
    expect(report.output).not.toContain("verdict:");
  });

  it("reads a captured --name-status diff through --diff (the human probe)", () => {
    const dir = fixtureRepo();
    const capture = join(dir, "name-status.txt");
    writeFileSync(capture, "D\tcli/src/adapters.ts\nD\tcli/src/adapters.test.ts\n");

    const report = runGuard(["--diff", capture], repoRoot);
    expect(report.status).toBe(0);
    expect(report.output).toContain("captured --name-status diff");
    expect(report.output).toContain("::warning:: paired deletion");
    expect(report.output).toContain("verdict: 1 paired deletion(s)");

    const strict = runGuard(["--diff", capture, "--strict"], repoRoot);
    expect(strict.status).toBe(1);
  });

  it("rejects usage errors with exit 2 rather than guessing", () => {
    const dir = fixtureRepo();
    commit(dir, { "cli/src/adapters.ts": IMPL }, "add");
    for (const argv of [["--base"], ["--nope"], ["--strict", "extra"]]) {
      const report = runGuard(argv, dir);
      expect(report.status, `argv: ${argv.join(" ")}`).toBe(2);
    }
    const help = runGuard(["--help"], dir);
    expect(help.output).toContain("usage: node cli/paired-deletion-guard.mjs");
  });
});

// ---------------------------------------------------------------------------
// Wiring: the CI lane runs it, and the knobs that silence a gate stay out
// ---------------------------------------------------------------------------

describe("paired-deletion guard: wired into the cli CI job", () => {
  const workflow = readFileSync(CI_WORKFLOW, "utf8");

  it("runs in the `cli` job, beside the other structural gates", () => {
    expect(workflow).toContain("node cli/paired-deletion-guard.mjs");
    // After the ast-grep structural lanes and the spec-analyze lane, before the
    // smoke steps whose recorded rationale is "cheap and last".
    const structure = workflow.indexOf("npm run lint:structure");
    const guard = workflow.indexOf("node cli/paired-deletion-guard.mjs");
    const smoke = workflow.indexOf("npm run smoke:native-start-cold");
    expect(structure).toBeGreaterThan(-1);
    expect(structure).toBeLessThan(guard);
    expect(guard).toBeLessThan(smoke);
  });

  it("fetches the PR's own base and head by SHA before diffing them", () => {
    // A shallow checkout has no shared history to merge-base against, so both
    // sides are fetched into their own refs — FETCH_HEAD would hold two entries
    // and resolve to whichever git picked.
    expect(workflow).toContain("git fetch --no-tags --depth=250 origin");
    expect(workflow).toContain("${{ github.event.pull_request.base.sha }}:refs/remotes/pull/base");
    expect(workflow).toContain("${{ github.event.pull_request.head.sha }}:refs/remotes/pull/head");
    expect(workflow).toContain("--base refs/remotes/pull/base --head refs/remotes/pull/head");
  });

  it("carries no silencing knob — no `|| true`, no `continue-on-error`, no advisory `if:`", () => {
    // Scoped to the step's EXECUTABLE lines: the header comment names both
    // knobs on purpose (it is the history a future reader needs), so a raw scan
    // would fail on the very documentation that explains the decision.
    const step = workflow
      .slice(
        workflow.indexOf('- name: "Paired-deletion guard'),
        workflow.indexOf("npm run smoke:native-start-cold"),
      )
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    expect(step).not.toContain("|| true");
    expect(step).not.toContain("continue-on-error");
    // The only `if:` allowed is the event scoping the other PR-only step uses.
    expect(step).toContain("if: github.event_name == 'pull_request'");
  });

  it("records the loudness decision where the reviewer reads it", () => {
    expect(workflow).toContain("REPORT-ONLY on purpose");
    expect(workflow).toContain("--strict");
  });
});
