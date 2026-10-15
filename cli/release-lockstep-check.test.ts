/**
 * Release lockstep + exact kernel pin checks
 * (bug-release-proposal-non-lockstep-undetected, bug-kernel-pin-never-exact).
 *
 * `cli/release-lockstep-check.mjs` turns a broken OPEN release PR — the #764
 * shape (release-please auto-proposed root 0.8.0 while lib stayed 0.7.1) or a
 * non-exact/stale kernel pin — into a red maintenance run. It reads both
 * `package.json` versions AND the root's `dependencies["@arggondev/lib"]` AT
 * the PR's head ref via `gh api ?ref=<branch>`. These tests inject a fake `gh`
 * on GH_BIN so every path is driven offline and the verdicts the acceptance
 * contract demands are explicitly witnessed:
 *
 *   - green: a lockstep proposal with the bare pin -> exit 0, silent (no
 *     failure, no noise);
 *   - red:   root != lib -> exit 1, the message carrying both versions and the
 *           empty `Release-As: X.Y.Z` remedy — and the EXPECTED READING that
 *           makes the ordinary between-releases accumulation legible: the red
 *           run means "do not merge this PR yet — a Release-As decision is
 *           pending", not "the pipeline is broken" (decided 2026-10-13,
 *           task-nonlockstep-red-state-expectations: the run KEEPS failing —
 *           an open non-lockstep proposal must not merge whatever the reason —
 *           and the wording is pinned by a test below so it cannot drop);
 *   - red:   a pin that is not the bare released version (a range operator, a
 *           stale exact version, or missing) -> exit 1, naming the value and
 *           the fix (edit package.json, then re-run so the lockfile sync
 *           runs).
 *
 * Plus the quiet path (no open release PR — the ordinary push), the
 * cannot-cry-wolf paths (a gh query/read failure warns and exits 0: the pre-tag
 * gate in release.yml still refuses a broken release commit), the config error
 * (no repository) that fails closed, a pure predicate corpus for `pinProblem`/
 * `pinFix`, and a main-side test that keeps the repo's own pin exact between
 * releases (spec A3 enforced continuously, not verified once).
 *
 * The last describe block pins the workflow contract: the check runs in
 * `release-please.yml` on EVERY push, after the abort check and BEFORE the
 * lockfile sync mutates the PR branch.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { pinFix, pinProblem } from "./release-lockstep-check.mjs";
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

/** One package.json body — the fields the check reads. */
function manifest(name: string, version: string, pin?: string): string {
  return `${JSON.stringify(
    pin === undefined
      ? { name, version }
      : { name, version, dependencies: { "@arggondev/lib": pin } },
    null,
    2,
  )}\n`;
}

describe("release-lockstep-check (bug-release-proposal-non-lockstep-undetected)", () => {
  it("checks the open release PR on the manifest branch, reading both manifests at its head ref", () => {
    const { bin, dir } = makeGh([
      { stdout: prList({ number: 770, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.8.0", "0.8.0") },
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

  it("green path: a lockstep proposal with the bare pin exits 0 silently", () => {
    const { bin, dir } = makeGh([
      { stdout: prList({ number: 770, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.9.0", "0.9.0") },
      { stdout: manifest("@arggondev/lib", "0.9.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(0);
    // Silent: a healthy maintenance run says nothing — the only outputs this
    // check ever writes are a WARNING (cannot check) or a FAIL block.
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    // The pin is read from the SAME root fetch as the version: three gh calls,
    // no extra traffic for the A3 concern.
    expect(invocations(dir)).toHaveLength(3);
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
      { stdout: manifest("arggon-manager", "0.8.0", "0.8.0") },
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
    // The lockstep concern alone: an exact pin does not add the pin block.
    expect(result.stdout).not.toContain("NON-EXACT or STALE kernel pin");
    expect(result.stdout).not.toContain("release-lockstep-check: OK");
  });

  it("red path: the ordinary accumulation carries the expected reading, pinned", () => {
    // #786's shape: after v0.9.0 shipped, tracker `chore` commits left the
    // proposal root-only (0.9.1 / 0.9.0) — the ORDINARY between-releases
    // state, red on every push until the version is decided. The decision
    // (task-nonlockstep-red-state-expectations) KEEPS that red — an open
    // non-lockstep proposal must not merge whatever the reason — so what is
    // pinned here is the reading: the red means a Release-As decision is
    // pending, not that the pipeline is broken.
    const { bin } = makeGh([
      { stdout: prList({ number: 786, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.9.1", "0.9.1") },
      { stdout: manifest("@arggondev/lib", "0.9.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    // Flatten the wrap: the pinned phrases are logical sentences, not lines.
    const message = result.stdout.replace(/\s+/g, " ");
    expect(message).toContain(
      "EXPECTED READING — between releases a root-only accumulating proposal is the NORMAL " +
        "non-lockstep state, not a pipeline failure.",
    );
    expect(message).toContain(
      'The red run means "do not merge this PR yet — a Release-As decision is pending", ' +
        'not "the pipeline is broken" and not "release-please is down";',
    );
    expect(message).toContain(
      "A fresh proposal nobody has sized yet (#770) and expected accumulation after a release " +
        "(#786) are the same red — both must clear this way.",
    );
    // The ordinary case still prints the concrete remedy — the higher of the
    // two proposals — and stays non-zero.
    expect(message).toContain(
      'git commit --allow-empty -m "chore(release): 0.9.1" -m "Release-As: 0.9.1" && git push origin main',
    );
  });

  it("red path: the remedy forces the higher proposal when lib is ahead", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 771, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.7.1", "0.7.1") },
      { stdout: manifest("@arggondev/lib", "0.8.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"Release-As: 0.8.0"');
  });

  it("red path: a caret pin exits non-zero, naming the value and the fix", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 786, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.10.0", "^0.10.0") },
      { stdout: manifest("@arggondev/lib", "0.10.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("release-lockstep-check: FAIL");
    expect(result.stdout).toContain("#786");
    expect(result.stdout).toContain("NON-EXACT or STALE kernel pin");
    expect(result.stdout).toContain('dependencies["@arggondev/lib"] carries a range operator');
    expect(result.stdout).toContain('"^0.10.0"');
    // The fix names the bare version AND the lockfile-sync re-run that a pin
    // edit needs (npm ci compares the lockfile against the changed spec).
    expect(result.stdout).toContain('set dependencies["@arggondev/lib"] to "0.10.0"');
    expect(result.stdout).toContain("Re-run all jobs");
    // Versions are lockstep here: the pin is the only broken concern, and a
    // pin defect is never the expected window — no EXPECTED READING block.
    expect(result.stdout).not.toContain("NON-LOCKSTEP");
    expect(result.stdout).not.toContain("EXPECTED READING");
  });

  it("red path: a stale exact pin (not the released version) exits non-zero", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 787, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.10.0", "0.9.0") },
      { stdout: manifest("@arggondev/lib", "0.10.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("NON-EXACT or STALE kernel pin");
    expect(result.stdout).toContain("does not name the version being released");
    expect(result.stdout).toContain('set dependencies["@arggondev/lib"] to "0.10.0"');
    expect(result.stdout).toContain('(currently "0.9.0")');
  });

  it("red path: a missing kernel dependency exits non-zero", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 788, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.10.0") },
      { stdout: manifest("@arggondev/lib", "0.10.0") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("NON-EXACT or STALE kernel pin");
    expect(result.stdout).toContain(
      'dependencies["@arggondev/lib"] is missing or not a version string',
    );
    expect(result.stdout).toContain('restore dependencies["@arggondev/lib"] = "0.10.0"');
  });

  it("red path: a non-lockstep proposal with a caret pin reports BOTH concerns", () => {
    const { bin } = makeGh([
      { stdout: prList({ number: 789, headRefName: HEAD }) },
      { stdout: manifest("arggon-manager", "0.8.0", "^0.8.0") },
      { stdout: manifest("@arggondev/lib", "0.7.1") },
    ]);

    const result = runCheck(bin);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("NON-LOCKSTEP");
    expect(result.stdout).toContain("NON-EXACT or STALE kernel pin");
    expect(result.stdout).toContain("Release-As: 0.8.0");
    expect(result.stdout).toContain('set dependencies["@arggondev/lib"] to "0.8.0"');
  });

  it("the pin predicate accepts only the bare released version", () => {
    // Green shapes.
    expect(pinProblem("0.9.0", "0.9.0")).toBeNull();
    expect(pinProblem("0.9.0-beta.1+build.2", "0.9.0-beta.1+build.2")).toBeNull();
    // Range shapes: every operator npm accepts as a range.
    for (const range of [
      "^0.9.0",
      "~0.9.0",
      ">=0.9.0",
      ">0.9.0",
      "<=0.9.0",
      "<0.9.0",
      "=0.9.0",
      "0.9",
      "0.9.x",
      "*",
      "latest",
      "0.9.0 || 0.10.0",
      " >=0.9.0",
    ]) {
      expect(pinProblem(range, "0.9.0"), range).toEqual({ kind: "range", pin: range });
    }
    // Exact but not the version this release proposes.
    expect(pinProblem("0.8.0", "0.9.0")).toEqual({ kind: "stale", pin: "0.8.0" });
    // Missing / non-string shapes.
    expect(pinProblem(undefined, "0.9.0")).toEqual({ kind: "missing" });
    expect(pinProblem("", "0.9.0")).toEqual({ kind: "missing" });
    expect(pinProblem({ version: "0.9.0" }, "0.9.0")).toEqual({ kind: "missing" });
  });

  it("the fix text names the released version for every problem kind", () => {
    const missing = pinProblem(undefined, "0.10.0");
    const range = pinProblem("^0.10.0", "0.10.0");
    const stale = pinProblem("0.9.0", "0.10.0");
    expect(pinFix(missing, "0.10.0")).toContain('"0.10.0"');
    expect(pinFix(range, "0.10.0")).toContain('"0.10.0"');
    expect(pinFix(range, "0.10.0")).toContain('"^0.10.0"');
    expect(pinFix(stale, "0.10.0")).toContain('"0.10.0"');
    expect(pinFix(stale, "0.10.0")).toContain('"0.9.0"');
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
      { stdout: manifest("arggon-manager", "0.8.0", "0.8.0") },
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

describe("the release-please.yml lockstep + pin step (workflow contract)", () => {
  const workflowPath = join(repoRoot, ".github", "workflows", "release-please.yml");
  const workflow = readFileSync(workflowPath, "utf8");
  const STEP = "Surface a broken release PR (non-lockstep versions or a non-exact kernel pin)";

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

describe("the root kernel pin on main (spec A3 — ADR 0018 §2)", () => {
  // The release-PR guard above catches a broken proposal while it is open; this
  // keeps the OTHER end exact: main's own pin must stay the bare released
  // version, so every release-please regeneration starts from an exact pin
  // (GenericJson preserves the absence of an operator). See the item's decision
  // record: no normalization step is needed, the guard is the durable fix.
  const rootManifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    version?: string;
    dependencies?: Record<string, unknown>;
  };
  const released = rootManifest.version ?? "";
  const pin = rootManifest.dependencies?.["@arggondev/lib"];

  it("is the bare released version — no range operator, no stale pin", () => {
    const problem = pinProblem(pin, released);
    expect(
      problem,
      "main's root package.json must pin @arggondev/lib to the bare released version " +
        `(ADR 0018 §2 / spec-release-pipeline-015 A3). ${
          problem ? pinFix(problem, released) + ". " : ""
        }Fix it in a PR; the release-PR guard and this test are the enforcement.`,
    ).toBeNull();
  });
});
