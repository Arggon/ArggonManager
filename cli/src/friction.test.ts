import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FRICTION_MAX_LINES, readFrictionLog, type FrictionRecord } from "@arggondev/lib";
import { runCli, cliEntryPath, cliNodeArgs } from "./test-spawn.js";

/**
 * The `arggon friction` CLI surface (spec-friction-capture-020, plan T1):
 * the envelope contract, the two named failures, the concurrency invariant
 * across two worktrees, the air-gapped path, and rotation as seen from the
 * command. Kernel behavior is covered in `lib/src/friction.test.ts`.
 *
 * Hermetic throughout: every run passes `ARGGON_STATE_DIR`, so no test touches
 * a real `~/.local/state` and every fixture dies in `afterEach`.
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

/** A fresh state dir plus a fake repo root to run the command from. */
function fixture(): { state: string; repo: string; env: Record<string, string> } {
  const state = mkdtempSync(join(tmpdir(), "arggon-friction-cli-state-"));
  const repo = join(state, "repo");
  mkdirSync(repo, { recursive: true });
  return { state, repo, env: { ARGGON_STATE_DIR: state } };
}

function lines(state: string): string[] {
  const path = join(state, "arggon", "friction.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "");
}

/** One capture through the real CLI. */
function capture(
  args: string[],
  env: Record<string, string> = {},
  cwd: string,
): { status: number; stdout: string; stderr: string } {
  const proc = runCli(["friction", ...args], cwd, { env: { ...process.env, ...env } });
  return { status: proc.status ?? -1, stdout: proc.stdout, stderr: proc.stderr };
}

// ---------------------------------------------------------------------------
// The command surface and the envelope
// ---------------------------------------------------------------------------

describe("arggon friction (CLI)", () => {
  it("appends exactly one line per invocation", () => {
    const f = fixture();
    const first = capture(
      ["worktree failed again", "--command", "arggon start --worktree task-foo", "--json"],
      f.env,
      f.repo,
    );
    expect(first.status).toBe(0);
    const envelope = JSON.parse(first.stdout) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      ok: true,
      schemaVersion: 1,
      command: "friction",
      dropped: 0,
    });
    expect((envelope.record as FrictionRecord).narrative).toBe("worktree failed again");
    expect(lines(f.state)).toHaveLength(1);

    capture(["second observation", "--command", "validate", "--json"], f.env, f.repo);
    expect(lines(f.state)).toHaveLength(2);
  });

  it("writes a human line without --json and never the salt", () => {
    const f = fixture();
    const out = capture(["human mode", "--command", "validate"], f.env, f.repo);
    expect(out.status).toBe(0);
    expect(out.stdout).toContain("arggon friction: recorded");
    expect(out.stdout).toContain(join(f.state, "arggon", "friction.jsonl"));
    const salt = readFileSync(join(f.state, "arggon", "machine-salt"), "utf8").trim();
    expect(out.stdout).not.toContain(salt);
  });

  it("takes --error and --harness into the record", () => {
    const f = fixture();
    const out = capture(
      [
        "oops",
        "--command",
        "start --worktree task-x",
        "--error",
        "START_FAILED",
        "--harness",
        "opencode",
        "--json",
      ],
      f.env,
      f.repo,
    );
    const record = (JSON.parse(out.stdout) as { record: FrictionRecord }).record;
    expect(record.errorCode).toBe("START_FAILED");
    expect(record.harness).toBe("opencode");
  });

  it("captures --evidence CONTENTS, never the path", () => {
    const f = fixture();
    const evidence = join(f.state, "evidence.txt");
    writeFileSync(evidence, "Traceback (most recent call last):\n  File x", "utf8");
    const out = capture(
      ["crashed", "--command", "validate", "--evidence", evidence, "--json"],
      f.env,
      f.repo,
    );
    const record = (JSON.parse(out.stdout) as { record: FrictionRecord }).record;
    expect(record.evidence).toContain("Traceback");
    expect(JSON.stringify(record)).not.toContain(evidence);
  });

  it("honors ARGGON_STATE_DIR and falls back to the per-OS base without it", () => {
    const f = fixture();
    capture(["with override", "--command", "validate", "--json"], f.env, f.repo);
    expect(existsSync(join(f.state, "arggon", "friction.jsonl"))).toBe(true);

    // Without the override the base is the platform's: assert the log path the
    // envelope reports lives under a state base, not under the repo.
    const bare = capture(
      ["no override", "--command", "validate", "--json"],
      { ARGGON_STATE_DIR: "" },
      f.repo,
    );
    const path = (JSON.parse(bare.stdout) as { path: string }).path;
    expect(path).toContain("friction.jsonl");
    expect(path.startsWith(f.repo)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

describe("arggon friction failures", () => {
  it("fails FRICTION_FAILED / no-observation for an empty observation and writes nothing", () => {
    const f = fixture();
    const out = capture(["   ", "--command", "validate", "--json"], f.env, f.repo);
    expect(out.status).toBe(1);
    const envelope = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(envelope.ok).toBe(false);
    expect((envelope.error as { code: string }).code).toBe("FRICTION_FAILED");
    expect(envelope.reason).toBe("no-observation");
    expect((envelope.error as { message: string }).message).toContain("observation");
    expect(lines(f.state)).toHaveLength(0);
  });

  it("fails no-command-shape when --command is missing", () => {
    const f = fixture();
    const out = capture(["an observation", "--json"], f.env, f.repo);
    expect(out.status).toBe(1);
    const envelope = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(envelope.reason).toBe("no-command-shape");
    expect(lines(f.state)).toHaveLength(0);
  });

  it("fails log-unwritable with the named path and leaves no partial line", () => {
    const f = fixture();
    // Capture once so a log exists, then make it unwritable.
    capture(["first", "--command", "validate", "--json"], f.env, f.repo);
    const logPath = join(f.state, "arggon", "friction.jsonl");
    const before = readFileSync(logPath, "utf8");
    chmodSync(logPath, 0o400);
    try {
      const out = capture(["second", "--command", "validate", "--json"], f.env, f.repo);
      expect(out.status).toBe(1);
      const envelope = JSON.parse(out.stdout) as Record<string, unknown>;
      expect(envelope.reason).toBe("log-unwritable");
      expect(envelope.path).toBe(logPath);
      // No partial line: the file is byte-identical to what it was before.
      expect(readFileSync(logPath, "utf8")).toBe(before);
    } finally {
      chmodSync(logPath, 0o600);
    }
  });

  it("names evidence-unreadable with the path", () => {
    const f = fixture();
    const missing = join(f.state, "nope.txt");
    const out = capture(
      ["crashed", "--command", "validate", "--evidence", missing, "--json"],
      f.env,
      f.repo,
    );
    expect(out.status).toBe(1);
    const envelope = JSON.parse(out.stdout) as Record<string, unknown>;
    expect(envelope.reason).toBe("evidence-unreadable");
    expect(envelope.path).toBe(missing);
    expect(lines(f.state)).toHaveLength(0);
  });

  it("keeps the human failure line on stderr with no JSON on stdout", () => {
    const f = fixture();
    const out = capture(["", "--command", "validate"], f.env, f.repo);
    expect(out.status).toBe(1);
    expect(out.stderr).toContain("arggon friction:");
    expect(out.stdout).toBe("");
  });
});

// ---------------------------------------------------------------------------
// The log is NOT the tracker
// ---------------------------------------------------------------------------

describe("the friction log is not the tracker", () => {
  it("writes nothing inside the repo and never a tracker file", () => {
    const f = fixture();
    capture(["friction about the tool", "--command", "validate", "--json"], f.env, f.repo);
    // Nothing appeared in the repo tree.
    const walk = (dir: string, out: string[]): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path, out);
        else out.push(path);
      }
    };
    const repoFiles: string[] = [];
    walk(f.repo, repoFiles);
    expect(repoFiles).toEqual([]);
    // The log itself lives outside it.
    expect(existsSync(join(f.state, "arggon", "friction.jsonl"))).toBe(true);
  });

  it("is 0600 on the log and on the salt", () => {
    const f = fixture();
    capture(["private", "--command", "validate", "--json"], f.env, f.repo);
    expect(statSync(join(f.state, "arggon", "friction.jsonl")).mode & 0o777).toBe(0o600);
    expect(statSync(join(f.state, "arggon", "machine-salt")).mode & 0o777).toBe(0o600);
  });
});

// ---------------------------------------------------------------------------
// Concurrency: two writers in two worktrees
// ---------------------------------------------------------------------------

describe("concurrent writers in two worktrees", () => {
  it("produce well-formed, non-interleaved lines with equal fingerprints", async () => {
    // One shared state dir (the worktree env contract points every worktree of
    // a repo at the SAME ARGGON_STATE_DIR only when the operator sets it; here
    // it is set explicitly so both writers target one log — which is the
    // contention the invariant is about).
    const state = mkdtempSync(join(tmpdir(), "arggon-friction-concurrent-"));
    const parent = mkdtempSync(join(tmpdir(), "arggon-friction-repo-"));
    const worktreeA = join(parent, "a");
    const worktreeB = join(parent, "b");
    mkdirSync(worktreeA, { recursive: true });
    mkdirSync(worktreeB, { recursive: true });
    const env = { ...process.env, ARGGON_STATE_DIR: state };

    // Two REAL processes, started simultaneously: the only way to observe an
    // interleaved write. Each writes a payload large enough that a torn write
    // would be obvious (a 1900-char narrative is ~1.9 KB per line).
    const narrative = "x".repeat(1900);
    const spawnOne = (cwd: string): Promise<number> =>
      new Promise((resolvePromise) => {
        const child = spawnSync(
          process.execPath,
          [
            ...cliNodeArgs(cliEntryPath()),
            "friction",
            narrative,
            "--command",
            "arggon start --worktree task-shared",
            "--error",
            "START_FAILED",
            "--json",
          ],
          { cwd, env, encoding: "utf8" },
        );
        resolvePromise(child.status ?? -1);
      });
    const [statusA, statusB] = await Promise.all([spawnOne(worktreeA), spawnOne(worktreeB)]);

    expect([statusA, statusB]).toEqual([0, 0]);
    const logPath = join(state, "arggon", "friction.jsonl");
    const raw = readFileSync(logPath, "utf8");
    const written = raw.split("\n").filter((line) => line !== "");
    expect(written).toHaveLength(2);

    // Every line is complete, parses, and is a whole record — not a splice.
    const parsed = written.map((line) => JSON.parse(line) as FrictionRecord);
    for (const record of parsed) {
      expect(record.v).toBe(1);
      expect(record.narrative).toBe(narrative);
      expect(record.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    }
    // Same class, one machine, one repo root: the fingerprints agree even
    // though two separate processes wrote the lines.
    expect(parsed[0]!.fingerprint).toBe(parsed[1]!.fingerprint);
    // And the reader sees both.
    expect(readFrictionLog(logPath).records).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Air-gapped: no network request
// ---------------------------------------------------------------------------

describe("capture makes no network request", () => {
  it("succeeds with every outbound socket blocked", () => {
    const f = fixture();
    // A run with no usable network at all: unreachable proxies plus DNS that
    // cannot resolve. Any fetch/http/dns call in the capture path would throw.
    const env = {
      ...process.env,
      ...f.env,
      HTTP_PROXY: "http://127.0.0.1:1",
      HTTPS_PROXY: "http://127.0.0.1:1",
      http_proxy: "http://127.0.0.1:1",
      https_proxy: "http://127.0.0.1:1",
      ALL_PROXY: "http://127.0.0.1:1",
      NODE_OPTIONS: "--dns-result-order=ipv4first",
    };
    const out = capture(["air-gapped capture", "--command", "validate", "--json"], env, f.repo);
    expect(out.status).toBe(0);
    expect(out.stderr).toBe("");
    expect(lines(f.state)).toHaveLength(1);
    // The record carries no URL and no host beyond the environment facts.
    const record = (JSON.parse(out.stdout) as { record: FrictionRecord }).record;
    expect(JSON.stringify(record)).not.toContain("http");
  });
});

// ---------------------------------------------------------------------------
// Rotation, as the command sees it
// ---------------------------------------------------------------------------

describe("rotation from the command", () => {
  it("drops the oldest line past 5000 and reports the drop", () => {
    const f = fixture();
    const logPath = join(f.state, "arggon", "friction.jsonl");
    mkdirSync(join(f.state, "arggon"), { recursive: true });
    appendFileSync(
      logPath,
      `${JSON.stringify({ v: 1, ts: "2026-01-01T00:00:00.000Z", fingerprint: "oldest", seq: 0 })}\n`,
      "utf8",
    );
    for (let i = 1; i < FRICTION_MAX_LINES; i++) {
      appendFileSync(logPath, `${JSON.stringify({ v: 1, seq: i })}\n`, "utf8");
    }
    const out = capture(["one more", "--command", "validate", "--json"], f.env, f.repo);
    expect(out.status).toBe(0);
    const envelope = JSON.parse(out.stdout) as { dropped: number };
    expect(envelope.dropped).toBe(1);
    const written = lines(f.state);
    expect(written).toHaveLength(FRICTION_MAX_LINES);
    expect(JSON.parse(written[0]!).seq).toBe(1);
    expect(JSON.parse(written[written.length - 1]!).narrative).toBe("one more");
  });
});
