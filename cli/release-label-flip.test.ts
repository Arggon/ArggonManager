/**
 * Release label flip (bug-autorelease-label-lifecycle-unowned).
 *
 * `cli/release-label-flip.mjs` is the piece of release-please's bookkeeping this
 * repo owes itself because it opted out of release-please's tagging path
 * (`skip-github-release: true`): after `release.yml` creates the tag, a merged
 * release PR must stop carrying `autorelease: pending`, or release-please reads
 * it as a merged-but-untagged release and aborts — the deadlock that killed
 * releases 2026-10-02 → 2026-10-07 (#556) and struck again on #664
 * (2026-10-09 → 2026-10-12).
 *
 * These tests inject a fake `gh` on GH_BIN and drive every path offline:
 *
 *   - no-op: nothing merged carries the label -> exit 0, one query, no edit —
 *     the rule-0/rule-2 path that runs on every ordinary push;
 *   - flip: a merged pending PR is moved to `autorelease: tagged` with EXACTLY
 *     the command the manual recovery documents, then verified against the
 *     abort predicate;
 *   - warn-and-continue: a failed query, a failed edit, or a label that
 *     survives the flip exits 0 with the manual recovery in the message. This
 *     step sits before the publish: it must never be able to strand a tagged
 *     release, and the release-please backstop is the detector.
 *
 * The second describe block pins the workflow contract: the flip runs in
 * `release.yml` (the workflow that tags), right after the tag↔version
 * agreement step and before anything ships, under the documented minimal
 * `pull-requests: write` permission.
 */
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { removeFixtureTree } from "./src/test-tmp.js";
import { assertOrder } from "../test/assert-order.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flipPath = join(repoRoot, "cli", "release-label-flip.mjs");

const PENDING = "autorelease: pending";
const TAGGED = "autorelease: tagged";
const MANUAL_RECOVERY = `gh pr edit <n> --add-label "${TAGGED}" --remove-label "${PENDING}"`;

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

/** One canned `gh` invocation. */
type GhCall = { stdout?: string; status?: number; stderr?: string };

/**
 * A fake `gh` serving a QUEUE of canned responses: invocation N reads out.N,
 * err.N and code.N, and records its argv one-argument-per-line in argv.N. Hermetic
 * — no network, no real gh — and a test that expects three calls but causes a
 * fourth fails loudly on the missing `out.4` instead of silently passing.
 */
function makeGh(calls: GhCall[]): { bin: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-release-label-flip-"));
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

function runFlip(bin: string, extraArgs: string[] = [], extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [flipPath, "--repo", "Arggon/ArggonManager", ...extraArgs], {
    encoding: "utf8",
    env: { ...process.env, GH_BIN: bin, ...extraEnv },
  });
}

const STUCK_664 = JSON.stringify([
  { number: 664, title: "chore: release main", headRefName: "release-please--branches--main" },
]);

describe("release-label-flip (bug-autorelease-label-lifecycle-unowned)", () => {
  it("queries release-please's abort predicate: merged PRs still pending the autorelease label", () => {
    const { bin, dir } = makeGh([{ stdout: "[]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(invocations(dir)[0]).toEqual(
      expect.arrayContaining([
        "pr",
        "list",
        "--state",
        "merged",
        "--label",
        PENDING,
        "--limit",
        "200",
      ]),
    );
  });

  it("no-op path: nothing pending -> exit 0, one query, no edit (every rule-0/rule-2 run)", () => {
    const { bin, dir } = makeGh([{ stdout: "[]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nothing to flip");
    expect(result.stdout).toContain("OK");
    // The flip is never attempted when the predicate is empty — this is what
    // makes it safe on every ordinary push.
    expect(invocations(dir).map((argv) => argv[1])).toEqual(["list"]);
  });

  it("flip path: moves the merged pending PR to `autorelease: tagged` and verifies", () => {
    const { bin, dir } = makeGh([{ stdout: `${STUCK_664}\n` }, {}, { stdout: "[]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("#664");
    expect(result.stdout).toContain(TAGGED);
    expect(result.stdout).toContain("release-please is not aborting");
    const calls = invocations(dir);
    // Call 2 IS the documented manual recovery (same command, same flags), so
    // the automation and the operator instruction cannot drift.
    expect(calls[1]).toEqual([
      "pr",
      "edit",
      "664",
      "--repo",
      "Arggon/ArggonManager",
      "--add-label",
      TAGGED,
      "--remove-label",
      PENDING,
    ]);
    // Call 3 re-runs the abort predicate as the verification.
    expect(calls[2]).toEqual(expect.arrayContaining(["pr", "list", "--label", PENDING]));
  });

  it("flips every stuck PR, not just the first", () => {
    const two = JSON.stringify([
      { number: 556, title: "chore: release 0.6.0", headRefName: "release-please--branches--main" },
      { number: 664, title: "chore: release main", headRefName: "release-please--branches--main" },
    ]);
    const { bin } = makeGh([{ stdout: `${two}\n` }, {}, {}, { stdout: "[]\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("#556");
    expect(result.stdout).toContain("#664");
    expect(result.stdout).toContain("flipped 2 merged release PR(s)");
  });

  it("a failed flip warns with the manual recovery, exits 0, and never strands the release", () => {
    // The step sits BEFORE the publish: exit 0 is the whole contract here.
    const { bin } = makeGh([
      { stdout: `${STUCK_664}\n` },
      { status: 1, stderr: "HTTP 403: Resource not accessible by integration\n" },
      { stdout: `${STUCK_664}\n` },
    ]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("release-label-flip: WARNING");
    expect(result.stderr).toContain("could not flip #664");
    expect(result.stderr).toContain("Resource not accessible by integration");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });

  it("a label that survives the flip warns that release-please WILL abort, and names the recovery", () => {
    const { bin } = makeGh([
      { stdout: `${STUCK_664}\n` },
      {},
      // The edit claimed success but the predicate still sees it — the
      // verification, not the edit's exit code, decides the verdict.
      { stdout: `${STUCK_664}\n` },
    ]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("still 'autorelease: pending' on 1 merged release PR(s)");
    expect(result.stderr).toContain("#664");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });

  it("a gh query failure warns and exits 0 without attempting an edit", () => {
    const { bin, dir } = makeGh([{ status: 1, stderr: "HTTP 503\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("release-label-flip: WARNING");
    expect(result.stderr).toContain("could not query");
    expect(invocations(dir).map((argv) => argv[1])).toEqual(["list"]);
  });

  it("unparseable query output warns and exits 0", () => {
    const { bin } = makeGh([{ stdout: "not-json\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("could not parse");
  });

  it("an unverifiable flip (re-query fails) warns instead of claiming success", () => {
    const { bin } = makeGh([{ stdout: `${STUCK_664}\n` }, {}, { status: 1, stderr: "HTTP 500\n" }]);
    const result = runFlip(bin);
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("could not re-query to verify");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });

  it("accepts the repository from GITHUB_REPOSITORY when --repo is absent", () => {
    const { bin } = makeGh([{ stdout: "[]\n" }]);
    const result = spawnSync("node", [flipPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: bin, GITHUB_REPOSITORY: "Arggon/ArggonManager" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nothing to flip");
  });

  it("a missing repository warns and exits 0 — bookkeeping must not fail the publish run", () => {
    const { bin } = makeGh([{ stdout: "[]\n" }]);
    const result = spawnSync("node", [flipPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: bin, GITHUB_REPOSITORY: "" },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("no repository");
    expect(result.stderr).toContain(MANUAL_RECOVERY);
  });
});

describe("the release.yml flip step (workflow contract)", () => {
  const workflowPath = join(repoRoot, ".github", "workflows", "release.yml");
  const workflow = readFileSync(workflowPath, "utf8");

  /** The YAML block of the step whose `name:` is given, up to the next step. */
  function stepBlock(name: string): string {
    const start = workflow.indexOf(`- name: ${name}`);
    if (start === -1) throw new Error(`release.yml has no step named "${name}"`);
    const next = workflow.indexOf("\n      - ", start + 1);
    return next === -1 ? workflow.slice(start) : workflow.slice(start, next);
  }

  it("runs in the tagging workflow, after the tag↔version agreement and before anything ships", () => {
    // The ownership decision (option (a), recorded on the item): the workflow
    // that creates the tag flips the label, in the same run, so the window
    // between the tag and the flip is as short as the run allows. A run that
    // dies before the flip is caught by the release-please backstop.
    assertOrder(
      workflow,
      `- name: Create the annotated tag v(V) at the pushed commit`,
      `- name: Assert tag-version agreement and root-lib lockstep before anything ships`,
      `node cli/release-label-flip.mjs --repo "$GITHUB_REPOSITORY"`,
      `- name: GitHub Release v(V) with the merged CHANGELOG section as notes`,
      `node cli/publish-auth-hint.mjs --package "@arggondev/lib"`,
    );
  });

  it("runs only on the release commit (guard release == true) and passes the token", () => {
    const block = stepBlock(
      "Flip the merged release PR's label (release-please bookkeeping this run owns)",
    );
    expect(block).toContain("if: steps.guard.outputs.release == 'true'");
    expect(block).toContain("GH_TOKEN: ${{ github.token }}");
    expect(block).toContain("GITHUB_REPOSITORY: ${{ github.repository }}");
  });

  it("grants the documented minimal permission for PR labels: pull-requests: write", () => {
    // GitHub's GITHUB_TOKEN permission table (docs.github.com → Workflow syntax
    // → permissions): `pull-requests: write` "permits an action to add a label
    // to a pull request". The label endpoints
    // (POST/DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels) are
    // listed under Repository permissions for "Pull requests" (write) in
    // "Permissions required for GitHub Apps". `contents: write` (tag/release)
    // and `id-token: write` (OIDC) stay as they were.
    expect(workflow).toMatch(/^permissions:\n(?:.*\n)*? {2}pull-requests: write$/m);
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("id-token: write");
  });
});
