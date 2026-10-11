import {
  chmodSync,
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FRICTION_FORMAT_VERSION,
  FRICTION_MAX_LINES,
  FrictionError,
  appendFrictionRecord,
  buildFrictionRecord,
  frictionFingerprint,
  frictionLogPath,
  frictionMajorVersion,
  frictionReporterId,
  frictionSaltPath,
  frictionStateBase,
  frictionStateDir,
  normalizeCommandShape,
  readFrictionLog,
  readOrCreateMachineSalt,
  type FrictionInput,
  type FrictionOptions,
  type FrictionRecord,
} from "@arggondev/lib";

/**
 * The friction capture kernel (spec-friction-capture-020, plan task T1).
 *
 * Every case runs against a hermetic state dir: `env.ARGGON_STATE_DIR` points
 * into a per-test temp tree, so nothing writes to a real `~/.local/state` and
 * the salt/log the run creates die with the test (bug-tmp-fixture-leak).
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

const VERSION = "0.6.0";
const NOW = new Date("2026-10-11T08:00:00.000Z");

/** A hermetic state base plus the home/env that resolves to it. */
function hermetic(): { stateBase: string; env: NodeJS.ProcessEnv; home: string } {
  const stateBase = mkdtempSync(join(tmpdir(), "arggon-friction-state-"));
  return { stateBase, env: { ARGGON_STATE_DIR: stateBase }, home: join(stateBase, "home") };
}

const INPUT: FrictionInput = {
  observation: "arggon start --worktree failed twice",
  command: "arggon start --worktree task-foo",
};

function capture(
  input: Partial<FrictionInput> = {},
  opts: Partial<FrictionOptions> = {},
  hermeticEnv?: ReturnType<typeof hermetic>,
): { record: FrictionRecord; logPath: string; env: NodeJS.ProcessEnv } {
  const h = hermeticEnv ?? hermetic();
  const record = buildFrictionRecord(
    { ...INPUT, ...input },
    {
      cwd: join(h.stateBase, "repo"),
      version: VERSION,
      now: NOW,
      env: h.env,
      home: h.home,
      ...opts,
    },
  );
  return { record, logPath: frictionLogPath(h.env, h.home), env: h.env };
}

// ---------------------------------------------------------------------------
// The state base and the log path
// ---------------------------------------------------------------------------

describe("friction state base", () => {
  it("honors ARGGON_STATE_DIR when it is set", () => {
    const h = hermetic();
    expect(frictionStateBase(h.env, h.home)).toBe(h.stateBase);
  });

  it("falls back to the per-OS state base (worktreeStateBase) when it is not", () => {
    const h = hermetic();
    const parent = mkdtempSync(join(tmpdir(), "arggon-friction-base-"));
    const env = { XDG_STATE_HOME: join(parent, "xdg-state") };
    expect(frictionStateBase(env, h.home)).toBe(join(parent, "xdg-state"));
  });

  it("places the log at <stateBase>/arggon/friction.jsonl and the salt beside it", () => {
    const h = hermetic();
    expect(frictionLogPath(h.env, h.home)).toBe(join(h.stateBase, "arggon", "friction.jsonl"));
    expect(frictionStateDir(h.env, h.home)).toBe(join(h.stateBase, "arggon"));
    expect(frictionSaltPath(h.env, h.home)).toBe(join(h.stateBase, "arggon", "machine-salt"));
  });
});

// ---------------------------------------------------------------------------
// commandShape normalization
// ---------------------------------------------------------------------------

describe("normalizeCommandShape", () => {
  it("keeps the subcommand and its flags and normalizes ids", () => {
    expect(normalizeCommandShape("arggon start --worktree task-foo")).toBe(
      "start --worktree <arg>",
    );
  });

  it("keeps plain-word values that carry meaning", () => {
    expect(normalizeCommandShape("arggon report --format markdown")).toBe(
      "report --format markdown",
    );
  });

  it("normalizes paths, URLs, tokens and SHAs", () => {
    expect(normalizeCommandShape("spec analyze --baseline /a/b/c.json")).toBe(
      "spec analyze --baseline <arg>",
    );
    expect(normalizeCommandShape("board --serve --github owner/repo")).toBe(
      "board --serve --github <arg>",
    );
    expect(normalizeCommandShape("sync --repo https://github.com/a/b")).toBe("sync --repo <arg>");
    expect(normalizeCommandShape("branch main --set abc1234def")).toBe("branch main --set <arg>");
    expect(normalizeCommandShape("start task-a1b2c3d4e5f6a7b8c9d0")).toBe("start <arg>");
  });

  it("normalizes a value inside the --flag=value spelling", () => {
    expect(normalizeCommandShape("update task-foo --status=done --priority=p1")).toBe(
      "update <arg> --status=done --priority=p1",
    );
    expect(normalizeCommandShape("spec analyze --baseline=/a/b/c.json")).toBe(
      "spec analyze --baseline=<arg>",
    );
  });

  it("converges the trigger-text spelling and the pasted-argv spelling", () => {
    // The trigger text tells agents to write `--command "<argv shape>"` and the
    // spec's own example is `start --worktree <id>`: both must land on one
    // fingerprint, so the binary name is dropped and the placeholder is kept.
    expect(normalizeCommandShape("arggon start --worktree task-foo")).toBe(
      "start --worktree <arg>",
    );
    expect(normalizeCommandShape("arggon start --worktree task-bar")).toBe(
      "start --worktree <arg>",
    );
    expect(normalizeCommandShape("start --worktree <id>")).toBe("start --worktree <arg>");
  });

  it("is idempotent — an already-shaped string shapes to itself", () => {
    const shaped = normalizeCommandShape("arggon start --worktree task-foo");
    expect(shaped).toBe("start --worktree <arg>");
    expect(normalizeCommandShape(shaped)).toBe(shaped);
  });

  it("collapses a run of values into one placeholder", () => {
    expect(normalizeCommandShape("update task-a task-b --status done --assignee alice")).toBe(
      "update <arg> --status done --assignee alice",
    );
    expect(normalizeCommandShape("create task x --parent story-y --priority p1")).toBe(
      "create task x --parent <arg> --priority p1",
    );
  });

  it("treats Windows, MSYS and POSIX path forms as values", () => {
    expect(normalizeCommandShape("board --out C:\\Users\\a\\b.json")).toBe("board --out <arg>");
    expect(normalizeCommandShape("doctor --dir \\\\?\\C:\\a\\b")).toBe("doctor --dir <arg>");
    expect(normalizeCommandShape("board --out /c/Users/a/b")).toBe("board --out <arg>");
  });

  it("collapses date- and version-shaped values", () => {
    expect(normalizeCommandShape("report --trend --since 2026-10-02")).toBe(
      "report --trend --since <arg>",
    );
    expect(normalizeCommandShape("playbook refresh node 0.6.0")).toBe(
      "playbook refresh node <arg>",
    );
  });

  it("returns empty for an empty or whitespace-only shape", () => {
    expect(normalizeCommandShape("")).toBe("");
    expect(normalizeCommandShape("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// The record: caps, fingerprint, reporterId, ts
// ---------------------------------------------------------------------------

describe("buildFrictionRecord", () => {
  it("carries v: 1, an ISO-8601 UTC ts from the kernel clock and every documented field", () => {
    const { record } = capture();
    expect(record.v).toBe(FRICTION_FORMAT_VERSION);
    expect(record.ts).toBe("2026-10-11T08:00:00.000Z");
    expect(record.commandShape).toBe("start --worktree <arg>");
    expect(record.errorCode).toBeUndefined();
    expect(record.harness).toBe("unknown");
    expect(record.arggonVersion).toBe(VERSION);
    expect(record.majorVersion).toBe("0");
    expect(record.os).toBe(process.platform);
    expect(record.arch).toBe(process.arch);
    expect(record.node).toBe(process.version);
    expect(record.narrative).toBe(INPUT.observation);
  });

  it("omits errorCode and evidence when they were not supplied", () => {
    const { record } = capture();
    expect(Object.keys(record)).not.toContain("errorCode");
    expect(Object.keys(record)).not.toContain("evidence");
  });

  it("caps narrative at 2000 chars with a marker, truncated never dropped", () => {
    const { record } = capture({ observation: "x".repeat(2500) });
    expect(record.narrative.length).toBe(2000);
    expect(record.narrative.endsWith("…")).toBe(true);
    expect(record.narrative.slice(0, 1999)).toBe("x".repeat(1999));
  });

  it("caps commandShape at 200 chars", () => {
    const { record } = capture({ command: `report ${"--flag ".repeat(80)} done` });
    expect(record.commandShape.length).toBe(200);
  });

  it("caps errorCode at 64 and harness at 32", () => {
    const { record } = capture({ error: "E".repeat(90), harness: "h".repeat(90) });
    expect(record.errorCode).toBe("E".repeat(63) + "…");
    expect(record.harness).toBe("h".repeat(31) + "…");
  });

  it("caps evidence (file CONTENTS, never a path) at 4000", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-friction-evidence-"));
    const file = join(dir, "crash.log");
    writeFileSync(file, "y".repeat(6000), "utf8");
    const { record } = capture({ evidencePath: file });
    expect(record.evidence?.length).toBe(4000);
    expect(record.evidence?.endsWith("…")).toBe(true);
    // The path itself is the leak, so it must never appear in the record.
    expect(JSON.stringify(record)).not.toContain(file);
  });

  it("reads a bounded prefix of a huge evidence file rather than the whole thing", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-friction-big-"));
    const file = join(dir, "huge.log");
    writeFileSync(file, "z".repeat(4_000_000), "utf8");
    const { record } = capture({ evidencePath: file });
    expect(record.evidence?.length).toBe(4000);
  });

  it("names evidence-unreadable with the path when the file cannot be read", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-friction-evidence-"));
    const missing = join(dir, "nope.log");
    expect(() => capture({ evidencePath: missing })).toThrowError(
      expect.objectContaining({ reason: "evidence-unreadable", path: missing }),
    );
  });

  it("refuses an empty observation with reason no-observation and writes nothing", () => {
    const h = hermetic();
    const before = readFrictionLog(frictionLogPath(h.env, h.home));
    expect(before.records).toHaveLength(0);
    try {
      capture({ observation: "   \n  " }, {}, h);
      expect.unreachable("an empty observation must fail");
    } catch (err) {
      expect(err).toBeInstanceOf(FrictionError);
      expect((err as FrictionError).reason).toBe("no-observation");
    }
    const after = readFrictionLog(frictionLogPath(h.env, h.home));
    expect(after.records).toHaveLength(0);
  });

  it("refuses a missing command shape with reason no-command-shape", () => {
    try {
      capture({ command: "  " });
      expect.unreachable("a missing shape must fail");
    } catch (err) {
      expect((err as FrictionError).reason).toBe("no-command-shape");
    }
  });
});

// ---------------------------------------------------------------------------
// Fingerprint discipline
// ---------------------------------------------------------------------------

describe("friction fingerprint", () => {
  it("is the sha256 of the stable fields, hex-truncated to 16", () => {
    const fp = frictionFingerprint({
      commandShape: "start --worktree",
      errorCode: "START_FAILED",
      harness: "opencode",
      majorVersion: "0",
    });
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("treats an absent errorCode as the empty string", () => {
    expect(
      frictionFingerprint({
        commandShape: "a",
        errorCode: undefined,
        harness: "h",
        majorVersion: "0",
      }),
    ).toBe(
      frictionFingerprint({ commandShape: "a", errorCode: "", harness: "h", majorVersion: "0" }),
    );
  });

  it("groups the same class and separates different ones", () => {
    const same = frictionFingerprint({
      commandShape: "start --worktree",
      errorCode: "START_FAILED",
      harness: "opencode",
      majorVersion: "0",
    });
    expect(
      frictionFingerprint({
        commandShape: "start --worktree",
        errorCode: "START_FAILED",
        harness: "opencode",
        majorVersion: "0",
      }),
    ).toBe(same);
    // A different error code is a different class, however similar the prose.
    expect(
      frictionFingerprint({
        commandShape: "start --worktree",
        errorCode: "CLAIM_TAKEN",
        harness: "opencode",
        majorVersion: "0",
      }),
    ).not.toBe(same);
  });

  it("never derives from the narrative", () => {
    const a = capture({ observation: "totally different prose" }).record;
    const b = capture({ observation: "another entirely" }).record;
    expect(a.fingerprint).toBe(b.fingerprint);
    // …and the two narratives are, verbatim, different.
    expect(a.narrative).not.toBe(b.narrative);
  });

  it("hashes the documented separator, and the separator is not injectable-proof by construction", () => {
    // The spec mandates sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ …). The
    // separator stops the ORDINARY collision (a value that contains a space or
    // a dash cannot shift a field boundary by accident), but it is not a
    // length prefix: a commandShape that itself carries U+001F can be crafted to
    // produce the same material as a different tuple. That is a property of the
    // spec's mandated construction, not a bug in it, and it is recorded here so
    // the honest boundary is tested rather than assumed away. The payload that
    // reaches these fields is capped (200/64/32) and shape-normalized, so a
    // crafted collision requires a deliberately hostile `--command`.
    const forged = frictionFingerprint({
      commandShape: "a\u001fb",
      errorCode: "c",
      harness: "d",
      majorVersion: "0",
    });
    const honest = frictionFingerprint({
      commandShape: "a",
      errorCode: "b\u001fc",
      harness: "d",
      majorVersion: "0",
    });
    expect(forged).toBe(honest);
    // The separator still does its job for the realistic case: a field that
    // contains the separator's ASCII neighbours cannot shift a boundary.
    expect(
      frictionFingerprint({
        commandShape: "a b",
        errorCode: "c",
        harness: "d",
        majorVersion: "0",
      }),
    ).not.toBe(
      frictionFingerprint({
        commandShape: "a",
        errorCode: "b c",
        harness: "d",
        majorVersion: "0",
      }),
    );
  });

  it("derives the major version from the version string", () => {
    expect(frictionMajorVersion("0.6.0")).toBe("0");
    expect(frictionMajorVersion("1.2.3")).toBe("1");
    expect(frictionMajorVersion("v10.0.1")).toBe("10");
    expect(frictionMajorVersion("not-a-version")).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// reporterId and the machine salt
// ---------------------------------------------------------------------------

describe("reporterId and the machine salt", () => {
  it("is stable for the same machine + repo and differs across machines", () => {
    const salt = "a".repeat(64);
    const repo = "/home/u/repo";
    expect(frictionReporterId(salt, repo)).toBe(frictionReporterId(salt, repo));
    expect(frictionReporterId("b".repeat(64), repo)).not.toBe(frictionReporterId(salt, repo));
    expect(frictionReporterId(salt, repo)).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is stable across two captures in the same state dir", () => {
    const h = hermetic();
    const a = capture({}, {}, h).record;
    const b = capture({}, {}, h).record;
    expect(a.reporterId).toBe(b.reporterId);
  });

  it("generates the salt once in the state dir and reuses it", () => {
    const h = hermetic();
    const saltPath = frictionSaltPath(h.env, h.home);
    const first = readOrCreateMachineSalt(saltPath);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(statSync(saltPath).mode & 0o777).toBe(0o600);
    expect(readOrCreateMachineSalt(saltPath)).toBe(first);
    // Never leaves the state dir: the only file beside the log is the salt.
    expect(h.env.ARGGON_STATE_DIR).toBe(h.stateBase);
  });

  it("never renders the salt in a record or an error", () => {
    const h = hermetic();
    const salt = readOrCreateMachineSalt(frictionSaltPath(h.env, h.home));
    const { record } = capture({}, {}, h);
    expect(JSON.stringify(record)).not.toContain(salt);
  });

  it("fails log-unwritable with the named path when the state root cannot be created", () => {
    const parent = mkdtempSync(join(tmpdir(), "arggon-friction-ro-"));
    const blocked = join(parent, "state");
    mkdirSync(blocked);
    chmodSync(blocked, 0o500);
    try {
      const env = { ARGGON_STATE_DIR: join(blocked, "nested") };
      expect(() =>
        buildFrictionRecord(
          { ...INPUT },
          { cwd: "/repo", version: VERSION, env, home: join(blocked, "home"), now: NOW },
        ),
      ).toThrowError(expect.objectContaining({ reason: "log-unwritable" }));
    } finally {
      chmodSync(blocked, 0o700);
    }
  });
});

// ---------------------------------------------------------------------------
// The append: one write, O_APPEND, rotation
// ---------------------------------------------------------------------------

describe("appendFrictionRecord", () => {
  function recordFor(h: ReturnType<typeof hermetic>, i = 0): FrictionRecord {
    return buildFrictionRecord(
      { observation: `obs ${i}`, command: `cmd-${i}` },
      {
        cwd: join(h.stateBase, "repo"),
        version: VERSION,
        now: new Date(NOW.getTime() + i * 1000),
        env: h.env,
        home: h.home,
      },
    );
  }

  it("creates the state dir mkdir -p and appends exactly one line", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    const first = appendFrictionRecord(recordFor(h, 1), logPath);
    expect(first).toMatchObject({ path: logPath, lines: 1, dropped: 0 });
    expect(statSync(join(h.stateBase, "arggon")).isDirectory()).toBe(true);
    const second = appendFrictionRecord(recordFor(h, 2), logPath);
    expect(second.lines).toBe(2);
    const raw = readFileSync(logPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.split("\n").filter((l) => l !== "")).toHaveLength(2);
  });

  it("leaves no partial line when the append fails (named path, no torn record)", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    appendFrictionRecord(recordFor(h, 1), logPath);
    const before = readFileSync(logPath, "utf8");
    // Make the log itself unwritable so the second append fails.
    chmodSync(logPath, 0o400);
    try {
      expect(() => appendFrictionRecord(recordFor(h, 2), logPath)).toThrowError(
        expect.objectContaining({ reason: "log-unwritable", path: logPath }),
      );
    } finally {
      chmodSync(logPath, 0o600);
    }
    expect(readFileSync(logPath, "utf8")).toBe(before);
  });

  it("rotates past 5000 lines: the oldest are dropped on write", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    // Seed the bound with well-formed lines, oldest first.
    const seed: string[] = [];
    for (let i = 0; i < FRICTION_MAX_LINES; i++) {
      seed.push(JSON.stringify({ v: 1, ts: NOW.toISOString(), fingerprint: `seed${i}`, seq: i }));
    }
    mkdirSync(join(h.stateBase, "arggon"), { recursive: true });
    writeFileSync(logPath, seed.join("\n") + "\n", "utf8");
    const result = appendFrictionRecord(recordFor(h, 1), logPath);
    expect(result.lines).toBe(FRICTION_MAX_LINES);
    expect(result.dropped).toBe(1);
    const lines = readFileSync(logPath, "utf8")
      .split("\n")
      .filter((l) => l !== "");
    expect(lines).toHaveLength(FRICTION_MAX_LINES);
    // seed0 was the oldest and is gone; seed1 is now the head.
    expect(JSON.parse(lines[0]!).seq).toBe(1);
    expect(JSON.parse(lines[lines.length - 1]!).narrative).toBe("obs 1");
  });

  it("does not rotate at the bound itself (only past it)", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    mkdirSync(join(h.stateBase, "arggon"), { recursive: true });
    writeFileSync(
      logPath,
      Array.from({ length: FRICTION_MAX_LINES - 1 }, (_, i) =>
        JSON.stringify({ v: 1, seq: i }),
      ).join("\n") + "\n",
      "utf8",
    );
    const result = appendFrictionRecord(recordFor(h, 1), logPath);
    expect(result).toMatchObject({ lines: FRICTION_MAX_LINES, dropped: 0 });
  });

  it("drops a partial trailing line from a crashed writer rather than resurrecting it", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    mkdirSync(join(h.stateBase, "arggon"), { recursive: true });
    writeFileSync(logPath, '{"v":1,"ts":"x","fingerpr', "utf8");
    const result = appendFrictionRecord(recordFor(h, 1), logPath);
    expect(result.lines).toBe(2);
    const read = readFrictionLog(logPath);
    expect(read.records).toHaveLength(1);
    expect(read.malformed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The reader: skip an unknown v rather than failing the file
// ---------------------------------------------------------------------------

describe("readFrictionLog", () => {
  it("returns every v:1 record in file order", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    appendFrictionRecord(
      buildFrictionRecord(
        { observation: "one", command: "a" },
        { cwd: "/repo", version: VERSION, env: h.env, home: h.home },
      ),
      logPath,
    );
    appendFrictionRecord(
      buildFrictionRecord(
        { observation: "two", command: "b" },
        { cwd: "/repo", version: VERSION, env: h.env, home: h.home },
      ),
      logPath,
    );
    const read = readFrictionLog(logPath);
    expect(read.records.map((r) => r.narrative)).toEqual(["one", "two"]);
    expect(read.skippedVersions).toEqual([]);
    expect(read.malformed).toBe(0);
  });

  it("skips an unknown v instead of failing the file, and reports it", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    mkdirSync(join(h.stateBase, "arggon"), { recursive: true });
    writeFileSync(
      logPath,
      [
        JSON.stringify({ v: 99, ts: "2026-01-01T00:00:00.000Z", fingerprint: "future" }),
        JSON.stringify({ v: 1, ts: "2026-01-02T00:00:00.000Z", fingerprint: "known" }),
        JSON.stringify({ v: 2, ts: "2026-01-03T00:00:00.000Z", fingerprint: "alsofuture" }),
      ].join("\n") + "\n",
      "utf8",
    );
    const read = readFrictionLog(logPath);
    expect(read.records.map((r) => r.fingerprint)).toEqual(["known"]);
    expect(read.skippedVersions).toEqual([99, 2]);
  });

  it("counts a non-object or unparsable line as malformed, not a skipped version", () => {
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    mkdirSync(join(h.stateBase, "arggon"), { recursive: true });
    writeFileSync(logPath, '{"v":1}\nnot json\n"a string"\n\n', "utf8");
    const read = readFrictionLog(logPath);
    expect(read.malformed).toBe(3);
    expect(read.skippedVersions).toEqual([]);
  });

  it("reads a missing log as empty rather than throwing", () => {
    const h = hermetic();
    expect(readFrictionLog(frictionLogPath(h.env, h.home))).toEqual({
      records: [],
      skippedVersions: [],
      malformed: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Time / locale
// ---------------------------------------------------------------------------

describe("friction timestamps", () => {
  it("emits ISO-8601 UTC and never a locale string", () => {
    const { record } = capture();
    expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Round-trips through the one parser the code path uses.
    expect(new Date(record.ts).toISOString()).toBe(record.ts);
  });

  it("round-trips an RTL/CJK narrative verbatim", () => {
    const narrative =
      "العربية עברית 日本語测试 한국어 — mixed ‏RTL‎ and LTR with emoji 🎯 and combining accents é\u0301";
    const { record } = capture({ observation: narrative });
    // Verbatim: same code points, same order, no escaping, no reordering.
    expect(record.narrative).toBe(narrative);
    // And the same through the serialized line the log actually holds.
    const line = JSON.parse(JSON.stringify(record)) as FrictionRecord;
    expect(line.narrative).toBe(narrative);
  });

  it("never truncates mid-surrogate-pair", () => {
    // Put astral pairs (emoji) exactly where a 2000-char cut would land.
    const narrative = "a".repeat(1997) + "🎯🎯🎯";
    const { record } = capture({ observation: narrative });
    expect(record.narrative.length).toBe(2000);
    // The cut backed off one unit: the stored value ends with a complete pair
    // plus the marker, never a lone surrogate.
    expect(record.narrative.endsWith("🎯…")).toBe(true);
    const withoutPairs = record.narrative.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
    expect(/[\uD800-\uDFFF]/.test(withoutPairs)).toBe(false);
    // Encodes as UTF-8 and decodes back byte-identical — what would NOT happen
    // to a lone surrogate (it would come back as U+FFFD).
    expect(Buffer.from(record.narrative, "utf8").toString("utf8")).toBe(record.narrative);
  });
});
