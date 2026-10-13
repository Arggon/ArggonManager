/**
 * Release lockstep check (bug-release-proposal-non-lockstep-undetected).
 *
 * `cli/release-lockstep-check.mjs` turns a non-lockstep OPEN release PR — the
 * #764 shape: release-please auto-proposed root 0.8.0 while lib stayed 0.7.1,
 * and the only red surface was the PR's approval-gated CI — into a red
 * maintenance run. It reads both `package.json` versions AT the PR's head ref
 * via `gh api ?ref=<branch>` and compares them. These tests inject a fake `gh`
 * on GH_BIN so every path is driven offline and the two verdicts the acceptance
 * contract demands are explicitly witnessed:
 *
 *   - green: a lockstep proposal -> exit 0, silent (no failure, no noise);
 *   - red:   root != lib -> exit 1, the message carrying both versions and the
 *           empty `Release-As: X.Y.Z` remedy.
 *
 * Plus the quiet path (no open release PR — the ordinary push), the
 * cannot-cry-wolf paths (a gh query/read failure warns and exits 0: the pre-tag
 * gate in release.yml still refuses a broken release commit), and the config
 * error (no repository) that fails closed.
 *
 * The second describe block pins the workflow contract: the check runs in
 * `release-please.yml` on EVERY push, after the abort check and BEFORE the
 * lockfile sync mutates the PR branch.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { removeFixtureTree } from "./src/test-tmp.js";
import { assertOrder } from "../test/assert-order.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkPath = join(repoRoot, "cli", "release-lockstep-check.mjs");

const HEAD = "release-please--branches--main";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

/** One canned `gh` invocation. */
type GhCall = { stdout?: string; status?: number; stderr?: string };

/**
 * A fake `gh` serving a QUEUE of canned responses: invocation N reads out.N,
 * err.N and code.N, and records its argv one-argument-per-line in argv.N.
 * Hermetic — no network, no real gh — and a test that expects three calls but
 * causes a fourth fails loudly on the missing `out.4` instead of silently
 * passing.
 */
function makeGh(calls: GhCall[]): { bin: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-release-lockstep-"));
  tmpDirs.push(dir);
  calls.forEach((call, index) => {
    const n = index + 1;
    writeFileSync(join(dir, `out.${n}`), call.stdout ?? "");
    writeFileSync(join(dir, `err.${n}`), call.stderr ?? "");
    writeFileSync(join(dir, `code.${n}`), String(call.status ?? 0));
  });
  const script = [
    "#!/bin/sh",
    'dir="$(dirname "$0")"',
    'n=$(( $(cat "$dir/count" 2>/dev/null || echo 0) + 1 ))',
    `printf '%s' "$n" > "$dir/count"`,
    `printf '%s\\n' "$@" > "$dir/argv.$n"`,
    `cat "$dir/out.$n"`,
    `cat "$dir/err.$n" >&2`,
    `exit "$(cat "$dir/code.$n")"`,
    "",
  ].join("\n");
  const bin = join(dir, "gh");
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return { bin, dir };
}

/** The argv of each recorded invocation, in order. */
function invocations(dir: string): string[][] {
  let count = 0;
  try {
    count = Number(readFileSync(join(dir, "count"), "utf8"));
  } catch {
    return [];
  }
  return Array.from({ length: count }, (_, index) =>
    readFileSync(join(dir, `argv.${index + 1}`), "utf8")
      .split("\n")
      .filter((line) => line !== ""),
  );
}

function runCheck(bin: string, extraArgs: string[] = [], extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [checkPath, "--repo", "Arggon/ArggonManager", ...extraArgs], {
    encoding: "utf8",
    env: { ...process.env, GH_BIN: bin, ...extraEnv },
  });
}

/** What `gh pr list --json number,headRefName` prints for the given PRs. */
function prList(...prs: Array<{ number: number; headRefName: string }>): string {
  return `${JSON.stringify(prs)}\n`;
}

/** One package.json body — only the fields the check reads. */
function manifest(name: string, version: string): string {
  return `${JSON.stringify({ name, version }, null, 2)}\n`;
}

describe("release-lockstep-check (bug-release-proposal-non-lockstep-undetected)", () => {
  it("checks the open release PR on the manifest branch, reading both manifests at its head ref", () => {
    const { bin, dir } = makeGh([
      { stdout: prList({ number: 770, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.8.0") },
      { stdout: manifest("@arggondev/lib", "0.8.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    const calls = invocations(dir);
    // The PR query is the open release PR on the manifest-mode branch name —
    // the same lookup release-please.yml's lockfile sync uses.
    expect(calls[0]).toEqual(
      expect.arrayContaining([
        "pr",
        "list",
        "--repo",
        "Arggon/ArggonManager",
        "--state",
        "open",
        "--head",
        HEAD,
      ]),
    );
    // Both reads are pinned to the PR's head ref: main's versions say nothing
    // about what the PR proposes.
    expect(calls[1]).toEqual([
      "api",
      `repos/Arggon/ArggonManager/contents/package.json?ref=${HEAD}`,
      "-H",
      "Accept: application/vnd.github.raw+json",
    ]);
    expect(calls[2]).toEqual([
      "api",
      `repos/Arggon/ArggonManager/contents/lib/package.json?ref=${HEAD}`,
      "-H",
      "Accept: application/vnd.github.raw+json",
    ]);
  });

  it("green path: a lockstep proposal exits 0 silently", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 770, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.9.0") },
      { stdout: manifest("@arggondev/lib", "0.9.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    // Silent: a healthy maintenance run says nothing — the only outputs this
    // check ever writes are a WARNING (cannot check) or a FAIL block.
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("quiet path: no open release PR exits 0 silently, after a single query", () => {
    const { bin, dir } = makeGh([{ stdout: "[]\n" }]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(invocations(dir)).toHaveLength(1);
  });

  it("red path: root != lib exits non-zero, naming both versions and the Release-As remedy", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 764, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.8.0") },
      { stdout: manifest("@arggondev/lib", "0.7.1") },
    ]);

    const result = runCheck(bin);
    // The whole point: a proposal that must not merge reddens the run.
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("release-lockstep-check: FAIL");
    expect(result.stdout).toContain("#764");
    expect(result.stdout).toContain("NON-LOCKSTEP");
    expect(result.stdout).toContain("root (arggon-manager) 0.8.0");
    expect(result.stdout).toContain("lib (@arggondev/lib) 0.7.1");
    // The remedy: an EMPTY commit with the Release-As trailer, to main — the
    // one mechanism verified against the pinned release-please (an empty commit
    // is applied to every component path, forcing both packages).
    expect(result.stdout).toContain(
      'git commit --allow-empty -m "chore(release): 0.8.0" -m "Release-As: 0.8.0" && git push origin main',
    );
    expect(result.stdout).toContain("includeEmpty");
    expect(result.stdout).not.toContain("release-lockstep-check: OK");
  });

  it("red path: the remedy forces the higher proposal when lib is ahead", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 771, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.7.1") },
      { stdout: manifest("@arggondev/lib", "0.8.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"Release-As: 0.8.0"');
  });

  it("a gh list failure warns and exits 0 (a hiccup must not redden a healthy push)", () => {
    const { bin } = makeGh([{ stdout: "", status: 1, stderr: "HTTP 503\n" }]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-lockstep-check: WARNING");
    expect(result.stdout).toContain("not a detected mismatch");
  });

  it("a manifest read failure warns and exits 0 (that proposal was not checked)", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 770, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.8.0") },
      { stdout: "", status: 1, stderr: "HTTP 404\n" },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-lockstep-check: WARNING");
    expect(result.stdout).toContain("not a detected mismatch");
  });

  it("a gh binary that is missing warns and exits 0", () => {
    const missing = join(tmpdir(), "arggon-release-lockstep-does-not-exist", "gh");

    const result = runCheck(missing);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-lockstep-check: WARNING");
  });

  it("unparseable gh output warns and exits 0", () => {
    const { bin } = makeGh([{ stdout: "not-json\n", status: 0 }]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-lockstep-check: WARNING");
    expect(result.stdout).toContain("not a detected mismatch");
  });

  it("accepts the repository from GITHUB_REPOSITORY when --repo is absent", () => {
    const { bin } = makeGh([{ stdout: "[]\n" }]);

    const result = spawnSync("node", [checkPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: bin, GITHUB_REPOSITORY: "Arggon/ArggonManager" },
    });
    expect(result.status).toBe(0);
  });

  it("fails closed when no repository is resolvable", () => {
    const { bin } = makeGh([{ stdout: "[]\n" }]);

    const result = spawnSync("node", [checkPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: bin, GITHUB_REPOSITORY: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no repository");
  });
});

describe("the release-please.yml lockstep step (workflow contract)", () => {
  const workflowPath = join(repoRoot, ".github", "workflows", "release-please.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  const STEP = "Surface a non-lockstep release PR (root and lib versions must move together)";

  /** The YAML block of the step whose `name:` is given, up to the next step. */
  function stepBlock(name: string): string {
    const start = workflow.indexOf(`- name: ${name}`);
    if (start === -1) throw new Error(`release-please.yml has no step named "${name}"`);
    const next = workflow.indexOf("\n      - ", start + 1);
    return next === -1 ? workflow.slice(start) : workflow.slice(start, next);
  }

  it("runs on EVERY push, after the abort check and before the lockfile sync mutates the branch", () => {
    expect(existsSync(workflowPath)).toBe(true);
    expect(workflow).toContain(`node cli/release-lockstep-check.mjs --repo "$GITHUB_REPOSITORY"`);
    assertOrder(
      workflow,
      `node cli/release-abort-check.mjs --repo "$GITHUB_REPOSITORY"`,
      `- name: ${STEP}`,
      `- name: Sync package-lock.json onto the release PR branch`,
    );
  });

  it("is ungated and carries the token the gh reads need", () => {
    const block = stepBlock(STEP);
    // No `if:`: the check must run on every push, like the abort backstop — a
    // gated step would leave the non-lockstep proposal to the approval-gated CI
    // again, which is the blindness this item exists to close.
    expect(block).not.toMatch(/^ {8}if:/m);
    expect(block).toContain("GH_TOKEN: ${{ github.token }}");
    expect(block).toContain("GITHUB_REPOSITORY: ${{ github.repository }}");
    expect(block).toContain(`node cli/release-lockstep-check.mjs --repo "$GITHUB_REPOSITORY"`);
  });
});
