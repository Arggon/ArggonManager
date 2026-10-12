/**
 * Release-please abort backstop (bug-release-config-workflow-agreement-ungated).
 *
 * `cli/release-abort-check.mjs` turns release-please's silent abort — "There
 * are untagged, merged release PRs outstanding - aborting" logged as a warn
 * inside a job that reports success — into a red run. The predicate is
 * release-please's own: a MERGED release PR still carrying the
 * `autorelease: pending` label. These tests inject a fake `gh` on GH_BIN so
 * every path is driven offline and the two verdicts the acceptance contract
 * demands are explicitly witnessed:
 *
 *   - red:  a merged `autorelease: pending` PR exists -> exit 1 (the abort is
 *           surfaced, the run cannot read as progress);
 *   - green:  no such PR -> exit 0 — the "no-stuck-label path", proven so the
 *           gate cannot cry wolf on a legitimate no-release push.
 *
 * Plus the gh-query-failure path, which must exit 0 with a loud warning (a
 * healthy push whose GitHub query hiccups must not redden — that is the whole
 * crying-wolf defect this item is an instance of), and a config error (no
 * repository) that must fail closed.
 */
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { removeFixtureTree } from "./src/test-tmp.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkPath = join(repoRoot, "cli", "release-abort-check.mjs");

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeFixtureTree(dir);
});

/**
 * A fake `gh`: records the argv it was called with (argv.txt) so the test pins
 * the exact predicate, then prints canned stdout/stderr and exits with the
 * canned status. Hermetic — no network, no real gh.
 */
function makeGh(opts: {
  stdout?: string;
  status?: number;
  stderr?: string;
  recordArgv?: boolean;
}): string {
  const dir = mkdtempSync(join(tmpdir(), "arggon-release-abort-"));
  tmpDirs.push(dir);
  writeFileSync(join(dir, "out"), opts.stdout ?? "");
  writeFileSync(join(dir, "err"), opts.stderr ?? "");
  writeFileSync(join(dir, "code"), String(opts.status ?? 0));
  const record = opts.recordArgv ? `printf '%s\\n' "$@" > "$(dirname "$0")/argv.txt"\n` : "";
  const script = `#!/bin/sh\n${record}cat "$(dirname "$0")/out"\ncat "$(dirname "$0")/err" >&2\nexit "$(cat "$(dirname "$0")/code")"\n`;
  const ghPath = join(dir, "gh");
  writeFileSync(ghPath, script);
  chmodSync(ghPath, 0o755);
  return ghPath;
}

function runCheck(ghPath: string, extraArgs: string[] = [], extraEnv: Record<string, string> = {}) {
  return spawnSync("node", [checkPath, "--repo", "Arggon/ArggonManager", ...extraArgs], {
    encoding: "utf8",
    env: { ...process.env, GH_BIN: ghPath, ...extraEnv },
  });
}

describe("release-abort-check (bug-release-config-workflow-agreement-ungated)", () => {
  it("queries exactly release-please's abort predicate: merged PRs pending the autorelease label", () => {
    const argvDir = mkdtempSync(join(tmpdir(), "arggon-release-abort-argv-"));
    tmpDirs.push(argvDir);
    writeFileSync(join(argvDir, "out"), "[]\n");
    writeFileSync(join(argvDir, "err"), "");
    writeFileSync(join(argvDir, "code"), "0");
    const ghPath = join(argvDir, "gh");
    writeFileSync(
      ghPath,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "$(dirname "$0")/argv.txt"\ncat "$(dirname "$0")/out"\nexit 0\n`,
    );
    chmodSync(ghPath, 0o755);

    const result = runCheck(ghPath);
    expect(result.status).toBe(0);
    const argv = readFileSync(join(argvDir, "argv.txt"), "utf8").split("\n");
    // The backstop's query IS release-please's own abort predicate (manifest.ts
    // findMergedReleasePullRequests). If it drifts, the gate stops checking what
    // release-please actually aborts on.
    expect(argv).toEqual(
      expect.arrayContaining([
        "pr",
        "list",
        "--repo",
        "Arggon/ArggonManager",
        "--state",
        "merged",
        "--label",
        "autorelease: pending",
      ]),
    );
  });

  it("green path: no merged pending PR -> exit 0 (cannot cry wolf on a no-release push)", () => {
    const gh = makeGh({ stdout: "[]\n", status: 0 });
    const result = runCheck(gh);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-abort-check: OK");
    expect(result.stdout).toContain("not aborting");
  });

  it("red path: a merged PR stuck `autorelease: pending` -> exit 1 and it is surfaced", () => {
    const stuck = JSON.stringify([
      {
        number: 123,
        title: "chore(main): release 0.5.0",
        headRefName: "release-please--branches--main",
      },
    ]);
    const gh = makeGh({ stdout: `${stuck}\n`, status: 0 });
    const result = runCheck(gh);
    // The whole point: a run that reports success while dead must now fail.
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("release-abort-check: FAIL");
    expect(result.stdout).toContain("STUCK");
    expect(result.stdout).toContain("#123");
    expect(result.stdout).toContain("autorelease: pending");
    // Names the exact mechanism and the first thing to diagnose.
    expect(result.stdout).toContain("src/manifest.ts");
    expect(result.stdout).toContain("release-config-agreement.test.ts");
  });

  it("lists every stuck PR, not just the first", () => {
    const stuck = JSON.stringify([
      { number: 120, title: "release 0.4.1", headRefName: "release-please--branches--main" },
      { number: 123, title: "release 0.5.0", headRefName: "release-please--branches--main" },
    ]);
    const gh = makeGh({ stdout: `${stuck}\n`, status: 0 });
    const result = runCheck(gh);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("#120");
    expect(result.stdout).toContain("#123");
    expect(result.stdout).toContain("2 MERGED release PR(s)");
  });

  it("a gh query failure fails OPEN with a warning (exit 0), never a false red", () => {
    // The cannot-cry-wolf guarantee: a healthy push whose GitHub query hiccups
    // must not redden. The action step before this one would already be red.
    const gh = makeGh({ stdout: "", status: 1, stderr: "HTTP 503\n" });
    const result = runCheck(gh);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-abort-check: WARNING");
    expect(result.stdout).toContain("not a detected abort");
  });

  it("a gh binary that is missing fails OPEN with a warning", () => {
    const missing = join(tmpdir(), "arggon-release-abort-does-not-exist", "gh");
    const result = runCheck(missing);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-abort-check: WARNING");
  });

  it("unparseable gh output fails OPEN with a warning", () => {
    const gh = makeGh({ stdout: "not-json\n", status: 0 });
    const result = runCheck(gh);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-abort-check: WARNING");
    expect(result.stdout).toContain("not a detected abort");
  });

  it("accepts the repository from GITHUB_REPOSITORY when --repo is absent", () => {
    const gh = makeGh({ stdout: "[]\n", status: 0 });
    const result = spawnSync("node", [checkPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: gh, GITHUB_REPOSITORY: "Arggon/ArggonManager" },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("release-abort-check: OK");
  });

  it("fails closed when no repository is resolvable", () => {
    const gh = makeGh({ stdout: "[]\n", status: 0 });
    const result = spawnSync("node", [checkPath], {
      encoding: "utf8",
      env: { ...process.env, GH_BIN: gh, GITHUB_REPOSITORY: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no repository");
  });
});
