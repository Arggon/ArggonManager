import {
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FRICTION_PUBLISH_TITLE_PREFIX } from "@arggondev/lib";
import { runCli } from "./test-spawn.js";

/**
 * The tier-B / opt-out / clear CLI surface — plan task T4 of
 * spec-friction-capture-020, the load-bearing half of ADR 0024.
 *
 * The whole item turns on one proposition: the channel can exist WITHOUT
 * `docs/agents.md` §0 ("Do not open new GitHub issues") being violated, because
 * the agent's job ENDS at emitting a prefilled URL and a HUMAN opens it. Every
 * test below is evidence for one half of that sentence:
 *
 *  - `--tier a` (default) is the report only, with no `gh` on PATH, no token and
 *    no network — proven by stripping PATH and blackholing the proxies.
 *  - `--tier b` additionally prints one URL, and the command still works with
 *    nothing on PATH: constructing a URL needs no credential to build.
 *  - No tier submits. There is no submit call, no `gh`, and no network — the
 *    source-level guard plus the stripped-PATH runs are the proof.
 *  - The opt-out gates CAPTURE, never DISCOVERY (ADR 0024 §3): with the key set,
 *    nothing is written, `--report` still renders (empty, `optedOut: true`,
 *    exit 0), the agent-file carrier is byte-identical, and the command is still
 *    on `--help`.
 *
 * Hermetic throughout: every run passes `ARGGON_STATE_DIR`, so no test touches a
 * real `~/.local/state`, and every fixture dies in `afterEach`.
 */

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

/** A fresh state dir plus a repo root to run the command from. */
function fixture(): { state: string; repo: string; env: Record<string, string> } {
  const state = mkdtempSync(join(tmpdir(), "arggon-friction-tier-b-state-"));
  const repo = join(state, "repo");
  mkdirSync(repo, { recursive: true });
  return { state, repo, env: { ARGGON_STATE_DIR: state } };
}

/** Write the tracker `.convention.yml` (the v5 layout this repo itself uses). */
function seedConvention(repo: string, text: string): void {
  mkdirSync(join(repo, "ArggonManager"), { recursive: true });
  writeFileSync(join(repo, "ArggonManager", ".convention.yml"), text, "utf8");
}

/** Seed `<state>/arggon/friction.jsonl` with already-shaped records. */
function seedLog(state: string, records: Array<Record<string, unknown>>): void {
  const dir = join(state, "arggon");
  mkdirSync(dir, { recursive: true });
  const lines = records.map((r) =>
    JSON.stringify({
      v: 1,
      reporterId: "a1b2c3d4e5f6",
      harness: "opencode",
      arggonVersion: "0.6.0",
      majorVersion: "0",
      os: "linux",
      arch: "x64",
      node: "v22.12.0",
      commandShape: "start --worktree <arg>",
      ...r,
    }),
  );
  writeFileSync(join(dir, "friction.jsonl"), `${lines.join("\n")}\n`, "utf8");
}

function linesIn(state: string): string[] {
  const path = join(state, "arggon", "friction.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "");
}

/** Every file under `dir`, recursively. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** An environment with no `gh` anywhere, no token, and no usable network. */
function strippedEnv(f: { state: string }, repo: string): Record<string, string> {
  return {
    PATH: "",
    ARGGON_STATE_DIR: f.state,
    HOME: repo,
    // No credential of any kind, plus every outbound socket blackholed.
    GH_TOKEN: "",
    GITHUB_TOKEN: "",
    HTTP_PROXY: "http://127.0.0.1:1",
    HTTPS_PROXY: "http://127.0.0.1:1",
    http_proxy: "http://127.0.0.1:1",
    https_proxy: "http://127.0.0.1:1",
    ALL_PROXY: "http://127.0.0.1:1",
  };
}

function friction(
  args: string[],
  repo: string,
  env: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const proc = runCli(["friction", ...args], repo, { env });
  return { status: proc.status ?? -1, stdout: proc.stdout, stderr: proc.stderr };
}

/** The tier-B URL line out of a human stdout (the only line that starts with it). */
function urlFrom(stdout: string): string {
  const line = stdout.split("\n").find((l) => l.startsWith("https://github.com/"));
  expect(line, `no URL line in:\n${stdout}`).toBeDefined();
  return line!;
}

/** Parse a query string the way GitHub's prefill reads it. */
function paramsOf(url: string): Record<string, string> {
  const query = url.slice(url.indexOf("?") + 1);
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    out[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tier A is the default: the report only, and it needs nothing at all
// ---------------------------------------------------------------------------

describe("tier a (default)", () => {
  it("prints the report and NO URL, with PATH stripped, no token and no network", () => {
    const f = fixture();
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
    ]);
    const out = friction(["--report"], f.repo, strippedEnv(f, f.repo));
    expect(out.status).toBe(0);
    expect(out.stderr).toBe("");
    expect(out.stdout).toContain("arggon friction report");
    expect(out.stdout).not.toContain("issues/new");
    expect(out.stdout).not.toContain("tier b");
  });

  it("is what an explicit --tier a gives too", () => {
    const f = fixture();
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
    ]);
    const out = friction(["--report", "--tier", "a"], f.repo, strippedEnv(f, f.repo));
    expect(out.status).toBe(0);
    expect(out.stdout).not.toContain("issues/new");
  });

  it("captures with PATH stripped too (git is absent, and that is degradation, not failure)", () => {
    const f = fixture();
    const out = friction(
      ["no git here", "--command", "arggon validate", "--json"],
      f.repo,
      strippedEnv(f, f.repo),
    );
    expect(out.status).toBe(0);
    const envelope = JSON.parse(out.stdout) as { record: { fingerprint: string } };
    // The fingerprint is stable without git: the shape is what groups.
    expect(envelope.record.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(linesIn(f.state)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tier B: the prefilled URL a HUMAN opens
// ---------------------------------------------------------------------------

describe("tier b", () => {
  it("prints the prefilled issues/new URL after the report, with nothing on PATH", () => {
    const f = fixture();
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
      { ts: "2026-10-05T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n2" },
    ]);
    const out = friction(["--report", "--tier", "b"], f.repo, strippedEnv(f, f.repo));
    expect(out.status).toBe(0);
    expect(out.stderr).toBe("");
    const url = urlFrom(out.stdout);
    // The report still came first — the URL is an addition, not a replacement.
    expect(out.stdout.indexOf("arggon friction report")).toBeLessThan(out.stdout.indexOf(url));
    const params = paramsOf(url);
    expect(url.startsWith("https://github.com/Arggon/ArggonManager/issues/new?")).toBe(true);
    expect(params.labels).toBe("adopter-friction");
    // The title carries the stable prefix, bounded after it.
    expect(params.title.startsWith(FRICTION_PUBLISH_TITLE_PREFIX)).toBe(true);
    expect(params.title.length - FRICTION_PUBLISH_TITLE_PREFIX.length).toBeLessThanOrEqual(120);
    // The body is the human-readable report plus the machine-readable fence.
    expect(params.body).toContain("records: 2");
    expect(params.body).toContain("fingerprint: aaa");
    expect(params.body).toContain("```arggon-fingerprint");
    expect(params.body.trimEnd().endsWith("```")).toBe(true);
    // And it carries NO YAML front matter.
    expect(params.body.startsWith("---")).toBe(false);
    expect(params.body.split("\n").some((line) => line.trim() === "---")).toBe(false);
  });

  it("carries the same document on the --json channel as an additive publish block", () => {
    const f = fixture();
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
    ]);
    const out = friction(["--report", "--tier", "b", "--json"], f.repo, f.env);
    expect(out.status).toBe(0);
    const envelope = JSON.parse(out.stdout) as {
      report: boolean;
      publish?: { tier: string; url: string; title: string; body: string };
    };
    expect(envelope.report).toBe(true);
    expect(envelope.publish?.tier).toBe("b");
    expect(envelope.publish?.url).toBe(
      urlFrom(friction(["--report", "--tier", "b"], f.repo, f.env).stdout),
    );
    expect(envelope.publish?.title.startsWith(FRICTION_PUBLISH_TITLE_PREFIX)).toBe(true);
    expect(envelope.publish?.body).toContain("```arggon-fingerprint");
  });

  it("leaves a tier-a --json envelope WITHOUT a publish block", () => {
    const f = fixture();
    const out = friction(["--report", "--json"], f.repo, f.env);
    expect(JSON.parse(out.stdout)).not.toHaveProperty("publish");
  });

  it("still emits a well-formed URL on an empty log (and exits 0)", () => {
    const f = fixture();
    const out = friction(["--report", "--tier", "b"], f.repo, f.env);
    expect(out.status).toBe(0);
    const params = paramsOf(urlFrom(out.stdout));
    expect(params.title).toContain("no friction recorded");
    expect(params.body).toContain("```arggon-fingerprint");
  });

  it("never auto-submits: no gh, no token, no network, and nothing opened", () => {
    const f = fixture();
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
    ]);
    const out = friction(["--report", "--tier", "b", "--json"], f.repo, strippedEnv(f, f.repo));
    expect(out.status).toBe(0);
    // The envelope carries a URL to OPEN, and nothing that submits anything:
    // no GitHub-side identifier, no API field — only the four parts of the
    // prefilled document.
    const envelope = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(JSON.stringify(envelope)).toContain("issues/new");
    expect(Object.keys(envelope.publish as object).sort()).toEqual([
      "body",
      "tier",
      "title",
      "url",
    ]);
    expect(JSON.stringify(envelope)).not.toMatch(
      /"issue"|"number"|"html_url"|"created_at"|api\.github/,
    );
    // The report is not the tracker either: nothing appeared in the repo.
    expect(walk(f.repo)).toEqual([]);
  });

  it("has NO code path that can write to GitHub (source-level guard on the non-goal)", () => {
    // The ADR 0024 §4 non-goal is structural, so it is pinned structurally: the
    // four friction modules must not import an HTTP client, call fetch, spawn
    // `gh`, or name a GitHub API host. (friction.ts does spawn `git`, for the
    // reporter path only — that is a local spawn, not a publish.)
    const root = join(__dirname, "..", "..", "lib", "src");
    for (const file of [
      "friction.ts",
      "friction-report.ts",
      "friction-optout.ts",
      "friction-publish.ts",
    ]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source, `${file} imports an HTTP client`).not.toMatch(/node:http|undici|node-fetch/);
      expect(source, `${file} calls fetch`).not.toMatch(/\bfetch\s*\(/);
      expect(source, `${file} spawns gh`).not.toMatch(/["']gh["']/);
      expect(source, `${file} names a GitHub API host`).not.toMatch(/api\.github|graphql/i);
    }
  });
});

// ---------------------------------------------------------------------------
// --tier is only meaningful with --report, and only a or b
// ---------------------------------------------------------------------------

describe("--tier validation", () => {
  it("refuses --tier c and any unknown value with the named reason", () => {
    const f = fixture();
    const out = friction(["--report", "--tier", "c", "--json"], f.repo, f.env);
    expect(out.status).toBe(1);
    const envelope = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(envelope.ok).toBe(false);
    expect((envelope.error as { code: string }).code).toBe("FRICTION_FAILED");
    // An UNKNOWN tier names itself as such — a machine must be able to tell
    // "you typed a tier this spec does not define" from "you forgot --report".
    expect(envelope.reason).toBe("unknown-tier");
    expect(envelope.report).toBe(true);
    expect((envelope.error as { message: string }).message).toContain('must be "a" or "b"');
  });

  it("refuses --tier without --report with tier-without-report", () => {
    const f = fixture();
    const out = friction(
      ["an observation", "--command", "validate", "--tier", "b", "--json"],
      f.repo,
      f.env,
    );
    expect(out.status).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({ reason: "tier-without-report" });
  });

  it("refuses --tier beside a capture rather than dropping it silently", () => {
    const f = fixture();
    const out = friction(["an observation", "--command", "validate", "--tier", "b"], f.repo, f.env);
    expect(out.status).toBe(1);
    expect(out.stderr).toContain("arggon friction:");
    expect(out.stderr).toContain("--tier requires --report");
    expect(out.stdout).toBe("");
    expect(linesIn(f.state)).toHaveLength(0);
  });

  it("refuses --tier beside --clear too", () => {
    const f = fixture();
    const out = friction(["--clear", "--tier", "b"], f.repo, f.env);
    expect(out.status).toBe(1);
    expect(out.stderr).toContain("--tier requires --report");
  });
});

// ---------------------------------------------------------------------------
// The opt-out: capture off, discoverability untouched (ADR 0024 §3)
// ---------------------------------------------------------------------------

/** The marked trigger block the carrier task will land, verbatim from the spec. */
const TRIGGER_BLOCK = [
  "<!-- arggon:friction-trigger begin triggerVersion=0.6.0 -->",
  "",
  "Friction in ArggonManager itself is not adoptable work — do not work around it",
  "and do not file it in this repo's tracker. Record it instead:",
  '`arggon friction "<one line>" --command "<argv shape>" --error <code>`',
  "<!-- arggon:friction-trigger end -->",
  "",
].join("\n");

describe("the opt-out gates capture, never discoverability", () => {
  it("x-friction: false writes no record and --report renders empty with optedOut: true, exit 0", () => {
    const f = fixture();
    seedConvention(f.repo, "version: 5\nx-friction: false\n");
    const capture = friction(["opted out", "--command", "validate", "--json"], f.repo, f.env);
    expect(capture.status).toBe(0);
    const envelope = JSON.parse(capture.stdout) as Record<string, unknown>;
    expect(envelope.optedOut).toBe(true);
    expect(envelope.record).toBeUndefined();
    expect(linesIn(f.state)).toHaveLength(0);
    // The state dir was never even created.
    expect(existsSync(join(f.state, "arggon"))).toBe(false);

    const report = friction(["--report"], f.repo, f.env);
    expect(report.status).toBe(0);
    expect(report.stderr).toBe("");
    expect(report.stdout).toContain("optedOut: true");
    expect(report.stdout).toContain("No friction recorded (count: 0)");
    const json = JSON.parse(friction(["--report", "--json"], f.repo, f.env).stdout) as {
      optedOut: boolean;
      count: number;
      rows: unknown[];
    };
    expect(json).toMatchObject({ optedOut: true, count: 0, rows: [] });
  });

  it("ARGGON_NO_FRICTION=1 does the same", () => {
    const f = fixture();
    const env = { ...f.env, ARGGON_NO_FRICTION: "1" };
    const capture = friction(["opted out", "--command", "validate", "--json"], f.repo, env);
    expect(capture.status).toBe(0);
    expect(JSON.parse(capture.stdout)).toMatchObject({ optedOut: true });
    expect(linesIn(f.state)).toHaveLength(0);
    const report = friction(["--report"], f.repo, env);
    expect(report.status).toBe(0);
    expect(report.stdout).toContain("optedOut: true");
  });

  it("the mapping spelling x-friction.capture: false is the same opt-out", () => {
    const f = fixture();
    seedConvention(f.repo, "version: 5\nx-friction:\n  capture: false\n");
    const out = friction(["x", "--command", "validate", "--json"], f.repo, f.env);
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ optedOut: true });
    expect(linesIn(f.state)).toHaveLength(0);
  });

  it("the per-invocation key WINS over a tree-wide x-friction: true", () => {
    const f = fixture();
    seedConvention(f.repo, "version: 5\nx-friction: true\n");
    const out = friction(["x", "--command", "validate", "--json"], f.repo, {
      ...f.env,
      ARGGON_NO_FRICTION: "1",
    });
    expect(JSON.parse(out.stdout)).toMatchObject({ optedOut: true });
    expect(linesIn(f.state)).toHaveLength(0);
  });

  it("an EMPTY ARGGON_NO_FRICTION reads as unset, so capture still happens", () => {
    const f = fixture();
    const out = friction(["x", "--command", "validate", "--json"], f.repo, {
      ...f.env,
      ARGGON_NO_FRICTION: "",
    });
    expect(JSON.parse(out.stdout)).toMatchObject({ optedOut: false });
    expect(linesIn(f.state)).toHaveLength(1);
  });

  it("does NOT strip the trigger from a generated agent file, and leaves the command discoverable", () => {
    const f = fixture();
    seedConvention(f.repo, "version: 5\nx-friction: false\n");
    // The agent-file carrier, exactly as the trigger task will write it.
    const carrier = join(f.repo, ".opencode", "agents");
    mkdirSync(carrier, { recursive: true });
    const carrierPath = join(carrier, "arggon-maker.md");
    writeFileSync(carrierPath, `# Maker\n\n${TRIGGER_BLOCK}`, "utf8");
    const before = readFileSync(carrierPath, "utf8");
    const beforeFiles = walk(f.repo).sort();

    // Capture, report, clear: none of them may touch the carrier.
    friction(["one", "--command", "validate"], f.repo, f.env);
    friction(["--report"], f.repo, f.env);
    expect(readFileSync(carrierPath, "utf8")).toBe(before);
    expect(readFileSync(carrierPath, "utf8")).toContain("arggon:friction-trigger begin");
    expect(walk(f.repo).sort()).toEqual(beforeFiles);

    // And the command is still on --help: an adopter who opted out must be able
    // to find the channel again (ADR 0024 §3).
    const help = runCli(["friction", "--help"], f.repo, { env: { ...process.env, ...f.env } });
    expect(help.status ?? -1).toBe(0);
    expect(help.stdout).toContain("friction");
    expect(help.stdout).toContain("--report");
  });

  it("tier b on an opted-out tree still exits 0 and states the opt-out in the body", () => {
    const f = fixture();
    seedConvention(f.repo, "version: 5\nx-friction: false\n");
    const out = friction(["--report", "--tier", "b"], f.repo, f.env);
    expect(out.status).toBe(0);
    const params = paramsOf(urlFrom(out.stdout));
    expect(params.body).toContain("optedOut: true");
    expect(params.title).toContain("opted out");
  });
});

// ---------------------------------------------------------------------------
// --clear: the complete local rollback, idempotent
// ---------------------------------------------------------------------------

describe("--clear", () => {
  it("removes the whole log and reports how many records left", () => {
    const f = fixture();
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
      { ts: "2026-10-03T10:00:00.000Z", fingerprint: "bbb", errorCode: "E", narrative: "m" },
    ]);
    const out = friction(["--clear", "--json"], f.repo, f.env);
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ clear: true, cleared: 2 });
    expect(existsSync(join(f.state, "arggon", "friction.jsonl"))).toBe(false);
    // The cumulative drop counter goes with it — a cleared log starts fresh.
    expect(existsSync(join(f.state, "arggon", "friction.dropped"))).toBe(false);
  });

  it("is idempotent on a missing file and on an empty file, reporting cleared: 0", () => {
    const f = fixture();
    const missing = friction(["--clear", "--json"], f.repo, f.env);
    expect(missing.status).toBe(0);
    expect(JSON.parse(missing.stdout)).toMatchObject({ cleared: 0 });
    // The state dir is NOT created just to clear it.
    expect(existsSync(join(f.state, "arggon"))).toBe(false);

    mkdirSync(join(f.state, "arggon"), { recursive: true });
    writeFileSync(join(f.state, "arggon", "friction.jsonl"), "", "utf8");
    const empty = friction(["--clear"], f.repo, f.env);
    expect(empty.status).toBe(0);
    expect(empty.stdout).toContain("cleared 0");
  });

  it("keeps the machine salt (the log's history goes, the machine identity stays)", () => {
    const f = fixture();
    friction(["x", "--command", "validate", "--json"], f.repo, f.env);
    const salt = readFileSync(join(f.state, "arggon", "machine-salt"), "utf8");
    friction(["--clear"], f.repo, f.env);
    expect(readFileSync(join(f.state, "arggon", "machine-salt"), "utf8")).toBe(salt);
  });

  it("is NOT gated by the opt-out (a rollback the operator asked for is not capture)", () => {
    const f = fixture();
    seedConvention(f.repo, "version: 5\nx-friction: false\n");
    seedLog(f.state, [
      { ts: "2026-10-02T10:00:00.000Z", fingerprint: "aaa", errorCode: "E", narrative: "n" },
    ]);
    const out = friction(["--clear", "--json"], f.repo, f.env);
    expect(out.status).toBe(0);
    expect(JSON.parse(out.stdout)).toMatchObject({ cleared: 1 });
    expect(existsSync(join(f.state, "arggon", "friction.jsonl"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The mode conflicts, each a NAMED error
// ---------------------------------------------------------------------------

describe("the mode conflicts are named", () => {
  it("--report plus a capture is report-and-capture-mutually-exclusive", () => {
    const f = fixture();
    const out = friction(["--report", "--command", "validate", "--json"], f.repo, f.env);
    expect(out.status).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({
      reason: "report-and-capture-mutually-exclusive",
    });
  });

  it("--clear plus a capture is clear-and-capture-mutually-exclusive", () => {
    const f = fixture();
    const out = friction(["--clear", "an observation", "--json"], f.repo, f.env);
    expect(out.status).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({
      reason: "clear-and-capture-mutually-exclusive",
    });
    expect(linesIn(f.state)).toHaveLength(0);
  });

  it("--report plus --clear is report-and-clear-mutually-exclusive", () => {
    const f = fixture();
    const out = friction(["--report", "--clear", "--json"], f.repo, f.env);
    expect(out.status).toBe(1);
    expect(JSON.parse(out.stdout)).toMatchObject({ reason: "report-and-clear-mutually-exclusive" });
    // Neither mode ran.
    expect(linesIn(f.state)).toHaveLength(0);
    const human = friction(["--report", "--clear"], f.repo, f.env);
    expect(human.status).toBe(1);
    expect(human.stderr).toContain("mutually exclusive");
    expect(human.stdout).toBe("");
  });
});
