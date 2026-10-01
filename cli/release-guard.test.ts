/**
 * Release guard fixtures (task-release-workflow, spec-release-pipeline-015
 * AC A5): the C3 ordered predicate of `cli/release-guard.mjs` exercised
 * against real git fixture repos, in predicate order, fully offline — the
 * fixture clone's `origin` is a local bare repo, so `git ls-remote` resolves
 * without a network.
 *
 *   rule 0  version unchanged from the parent -> exit 0, release=false
 *           (the tag pointing at the PARENT — the post-release steady state —
 *           must not read as "re-shipping"; this is the permanent-green rule)
 *   rule 1  version-changing push, tag v(V) absent -> exit 0, release=true
 *   rule 2  tag v(V) at HEAD (annotated) -> exit 0, release=true, tag_exists=true
 *   rule 3  version-changing push, tag v(V) elsewhere -> exit 1, loudly
 *
 * Also pins the workflow contract: `GITHUB_OUTPUT` receives machine-readable
 * `key=value` lines, and an unclassifiable commit exits 2 (fail closed — a
 * guard that cannot classify never starts a release).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { initFixtureRepo, removeFixtureTree } from "./src/test-tmp.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const guardPath = join(repoRoot, "cli", "release-guard.mjs");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

function git(dir: string, args: string[]): string {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" }).stdout ?? "";
}

/** A fixture clone whose `origin` is a local bare repo (offline ls-remote). */
function fixture(): { origin: string; work: string } {
  const base = mkdtempSync(join(tmpdir(), "arggon-release-guard-"));
  tmpDirs.push(base);
  const origin = join(base, "origin.git");
  const work = join(base, "work");
  mkdirSync(origin); // bare init into an existing dir (test-tmp.test.ts pattern)
  initFixtureRepo(origin, { bare: true });
  mkdirSync(work); // initFixtureRepo runs `git init` with cwd: dir
  initFixtureRepo(work);
  git(work, ["remote", "add", "origin", origin]);
  return { origin, work };
}

/** Commit a package.json with the given version; return the commit sha. */
function commitVersion(work: string, version: string): string {
  writeFileSync(join(work, "package.json"), `${JSON.stringify({ name: "fixture", version }, null, 2)}\n`);
  git(work, ["add", "package.json"]);
  git(work, ["commit", "--quiet", "-m", `chore(release): ${version}`]);
  return git(work, ["rev-parse", "HEAD"]).trim();
}

function guard(sha: string, work: string, origin: string, env: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    "node",
    [guardPath, "--sha", sha, "--cwd", work, "--remote", origin],
    { encoding: "utf8", env: { ...process.env, ...env } },
  );
}

function outputOf(result: ReturnType<typeof guard>): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of result.stdout.split("\n")) {
    // stdout lines carry the script's "release-guard: " prefix; the
    // GITHUB_OUTPUT file does not (see the guard's finish()).
    const match = line.match(/^(?:release-guard: )?(rule|release|tag_exists|version)=(.+)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

describe("release-guard: the C3 ordered predicate on fixture clones", () => {
  it("rule 1: version-changing push, tag absent -> this is the release", () => {
    const { origin, work } = fixture();
    commitVersion(work, "0.4.0");
    git(work, ["push", "--quiet", "origin", "main"]);
    const releaseSha = commitVersion(work, "0.4.2");
    git(work, ["push", "--quiet", "origin", "main"]);

    const result = guard(releaseSha, work, origin);
    expect(result.status).toBe(0);
    expect(outputOf(result)).toEqual({
      rule: "1",
      release: "true",
      tag_exists: "false",
      version: "0.4.2",
    });
    expect(result.stdout).toContain("this is the release");
  });

  it("rule 2: tag v(V) at HEAD -> idempotent complete", () => {
    const { origin, work } = fixture();
    commitVersion(work, "0.4.0");
    const releaseSha = commitVersion(work, "0.4.2");
    git(work, ["push", "--quiet", "origin", "main"]);
    git(work, ["tag", "-a", "v0.4.2", "-m", "release"]);
    git(work, ["push", "--quiet", "origin", "v0.4.2"]);

    const result = guard(releaseSha, work, origin);
    expect(result.status).toBe(0);
    expect(outputOf(result)).toEqual({
      rule: "2",
      release: "true",
      tag_exists: "true",
      version: "0.4.2",
    });
    expect(result.stdout).toContain("idempotent re-run");
  });

  it("rule 0 FIRST: post-release push with the tag on the parent -> exit 0, no publication", () => {
    const { origin, work } = fixture();
    commitVersion(work, "0.4.0");
    commitVersion(work, "0.4.2"); // the tag lands on this commit implicitly (HEAD)
    git(work, ["push", "--quiet", "origin", "main"]);
    git(work, ["tag", "-a", "v0.4.2", "-m", "release"]);
    git(work, ["push", "--quiet", "origin", "v0.4.2"]);
    // The steady-state push: a tracker flip on top of the tagged release.
    git(work, ["commit", "--quiet", "--allow-empty", "-m", "chore(tasks): flip"]);
    const flipSha = git(work, ["rev-parse", "HEAD"]).trim();
    git(work, ["push", "--quiet", "origin", "main"]);

    const result = guard(flipSha, work, origin);
    expect(result.status).toBe(0);
    const parsed = outputOf(result);
    expect(parsed.rule).toBe("0");
    expect(parsed.release).toBe("false");
    // Rule 0 exits before the tag is consulted: consulting it first would
    // make every post-release push read as "re-shipping" (permanent red).
    expect(parsed.tag_exists).toBe("unverified");
    expect(parsed.version).toBe("0.4.2");
  });

  it("rule 3: version-changing push onto an already-tagged number -> loud failure", () => {
    const { origin, work } = fixture();
    const parent = commitVersion(work, "0.4.5");
    git(work, ["push", "--quiet", "origin", "main"]);
    // The tag exists, but points at the PARENT commit: re-shipping a released
    // version from a hand-pushed bump must fail the run.
    git(work, ["tag", "-a", "v0.4.6", "-m", "release", parent]);
    git(work, ["push", "--quiet", "origin", "v0.4.6"]);
    const head = commitVersion(work, "0.4.6");
    git(work, ["push", "--quiet", "origin", "main"]);
    expect(head).not.toBe(parent);

    const result = guard(head, work, origin);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FAILING LOUDLY");
    expect(result.stderr).toContain("re-shipped");
  });

  it("writes key=value outputs to GITHUB_OUTPUT for the workflow's if: gates", () => {
    const { origin, work } = fixture();
    const base = mkdtempSync(join(tmpdir(), "arggon-release-guard-out-"));
    tmpDirs.push(base);
    const ghOutput = join(base, "github-output.txt");
    commitVersion(work, "0.4.0");
    const releaseSha = commitVersion(work, "0.4.2");
    git(work, ["push", "--quiet", "origin", "main"]);

    const result = guard(releaseSha, work, origin, { GITHUB_OUTPUT: ghOutput });
    expect(result.status).toBe(0);
    const written = readFileSync(ghOutput, "utf8");
    expect(written).toContain("rule=1\n");
    expect(written).toContain("release=true\n");
    expect(written).toContain("tag_exists=false\n");
    expect(written).toContain("version=0.4.2\n");
  });

  it("fails closed (exit 2) when the commit cannot be classified", () => {
    const { origin, work } = fixture();
    const result = guard("0".repeat(40), work, origin);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("cannot classify");
    expect(result.stderr).toContain("refusing to start a release");
  });
});
