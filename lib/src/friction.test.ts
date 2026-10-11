import { createHash } from "node:crypto";
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
import { fc, checkProperty } from "../../test/property-runner.js";
import {
  FRICTION_FORMAT_VERSION,
  FRICTION_MAX_LINES,
  FRICTION_NARRATIVE_CAP,
  FRICTION_PATH_PLACEHOLDER,
  FRICTION_REDACTED_FIELD,
  FRICTION_REDACTION_MAX_SUBSTITUTIONS,
  FRICTION_SECRET_PLACEHOLDER,
  FrictionError,
  appendFrictionRecord,
  buildFrictionRecord,
  frictionFingerprint,
  frictionFingerprintMaterial,
  frictionLogPath,
  frictionMajorVersion,
  frictionReporterId,
  frictionSaltPath,
  frictionStateBase,
  frictionStateDir,
  normalizeCommandShape,
  readFrictionLog,
  readOrCreateMachineSalt,
  redactFrictionText,
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

  it("cannot be forged: a crafted component cannot shift a field boundary", () => {
    // The recorded decision (task-friction-fingerprint-separator-not-length-
    // prefixed). The first implementation joined the four stable fields with
    // U+001F. That stops the ORDINARY collision, but a separator delimits by
    // VALUE, so a commandShape that itself carries U+001F can be crafted to
    // produce the same material as a different tuple — the forge below. The
    // fix length-prefixes each component, so the boundary is carried by a
    // COUNT and neither of these two tuples can produce the other's pre-image.
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
    expect(forged).not.toBe(honest);
    // The two tuples are a genuine collision pair under the OLD separator
    // encoding — which is what makes the assertion above a property of the new
    // one rather than two arbitrary inputs.
    const separatorJoined = (cs: string, ec: string, h: string, v: string): string =>
      [cs, ec, h, v].join("\u001f");
    expect(separatorJoined("a\u001fb", "c", "d", "0")).toBe(
      separatorJoined("a", "b\u001fc", "d", "0"),
    );
  });

  it("is injective over tuples wherever the boundary moves (property)", () => {
    // The property the decision buys: the encoding delimits by count, so moving
    // a boundary across the separator NEVER produces the same digest. The two
    // tuples generated per run are exactly the pair the separator encoding let
    // collide, so a regression to any value-delimited construction fails here.
    checkProperty(
      "friction fingerprint injective",
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        (head, tail, harness, version) => {
          const injected = {
            commandShape: head,
            errorCode: `\u001f${tail}`,
            harness,
            majorVersion: version,
          };
          const shifted = {
            commandShape: `${head}\u001f`,
            errorCode: tail,
            harness,
            majorVersion: version,
          };
          // Never vacuous: the two tuples always differ (the commandShapes do).
          expect(injected.commandShape).not.toBe(shifted.commandShape);
          expect(frictionFingerprint(injected)).not.toBe(frictionFingerprint(shifted));
        },
      ),
    );
  });

  it("encodes every component unambiguously (exhaustive over the adversarial alphabet)", () => {
    // The injectivity claim checked exactly: every 4-tuple over the alphabet
    // that defeats a separator — "", "a", the separator itself, and a value that
    // CARRIES it — produces its own pre-image, and therefore its own digest.
    // 4^4 = 256 tuples, no truncation involved in the first assertion.
    const ALPHABET = ["", "a", "\u001f", "a\u001f"] as const;
    const seen = new Map<string, string>();
    const digests = new Set<string>();
    for (const commandShape of ALPHABET) {
      for (const errorCode of ALPHABET) {
        for (const harness of ALPHABET) {
          for (const majorVersion of ALPHABET) {
            const tuple = JSON.stringify([commandShape, errorCode, harness, majorVersion]);
            const material = frictionFingerprintMaterial([
              commandShape,
              errorCode,
              harness,
              majorVersion,
            ]);
            const owner = seen.get(material);
            expect(
              owner ?? tuple,
              `${owner} and ${tuple} both encode to ${JSON.stringify(material)}`,
            ).toBe(tuple);
            seen.set(material, tuple);
            digests.add(frictionFingerprint({ commandShape, errorCode, harness, majorVersion }));
          }
        }
      }
    }
    expect(digests.size).toBe(seen.size);
  });

  it("keeps the separator's ASCII neighbours from shifting a boundary", () => {
    // The realistic case the old construction also had right: a field that
    // contains a space, a dash or a digit cannot move where a component ends.
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
    // …and a length-looking component is data, never a boundary marker.
    expect(
      frictionFingerprint({
        commandShape: "3:abc",
        errorCode: "c",
        harness: "d",
        majorVersion: "0",
      }),
    ).not.toBe(
      frictionFingerprint({
        commandShape: "3",
        errorCode: "abc",
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

  it("reads a v:1 line written under the pre-amendment fingerprint formula", () => {
    // The backward-compatibility decision (task-friction-fingerprint-separator-
    // not-length-prefixed): `v` answers "can this reader parse this line", NOT
    // "does this line carry the fingerprint formula I compute now", so the
    // formula amendment does not bump the record version. Bumping it would make
    // an upgraded arggon SKIP every line the adopter already recorded — the
    // reader's documented behaviour for an unknown `v` — which destroys a
    // cache-like local history to fix a grouping ambiguity the bump does not fix
    // either. Staying at `v: 1` degrades honestly instead: the reader never
    // recomputes a fingerprint, it groups by the one each line carries, so a
    // log spanning the change shows one class as two rows (a count split, never
    // a wrong merge) and rotation ages the old-formula lines out.
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    mkdirSync(join(h.stateBase, "arggon"), { recursive: true });
    const oldFormula = (cs: string, ec: string, hh: string, v: string): string =>
      createHash("sha256")
        .update([cs, ec, hh, v].join("\u001f"), "utf8")
        .digest("hex")
        .slice(0, 16);
    const before = { commandShape: "start --worktree <arg>", errorCode: "START_FAILED" };
    const after = { ...before };
    writeFileSync(
      logPath,
      [
        JSON.stringify({
          v: FRICTION_FORMAT_VERSION,
          ts: "2026-10-01T10:00:00.000Z",
          fingerprint: oldFormula(before.commandShape, before.errorCode, "unknown", "0"),
          commandShape: before.commandShape,
          errorCode: before.errorCode,
          harness: "unknown",
          majorVersion: "0",
        }),
        JSON.stringify({
          v: FRICTION_FORMAT_VERSION,
          ts: "2026-10-12T10:00:00.000Z",
          fingerprint: frictionFingerprint({
            commandShape: after.commandShape,
            errorCode: after.errorCode,
            harness: "unknown",
            majorVersion: "0",
          }),
          commandShape: after.commandShape,
          errorCode: after.errorCode,
          harness: "unknown",
          majorVersion: "0",
        }),
      ].join("\n") + "\n",
      "utf8",
    );
    const read = readFrictionLog(logPath);
    // Both lines are understood: nothing is skipped, nothing is malformed.
    expect(read.skippedVersions).toEqual([]);
    expect(read.malformed).toBe(0);
    expect(read.records).toHaveLength(2);
    // They are two fingerprints for one class — the count split, not a loss.
    expect(read.records[0]!.fingerprint).not.toBe(read.records[1]!.fingerprint);
    expect(read.records[0]!.fingerprint).toBe(
      oldFormula(before.commandShape, before.errorCode, "unknown", "0"),
    );
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

// ---------------------------------------------------------------------------
// Redaction at write, never at render — plan T2 (spec §Redaction)
// ---------------------------------------------------------------------------

/**
 * The spec's four-step pass, applied in the capture path. Every case below
 * exercises the WRITE path: `buildFrictionRecord` is where the redacted value
 * first exists, and the persisted line is asserted, because the invariant is
 * that what lands in `<stateBase>/arggon/friction.jsonl` is already redacted —
 * redaction is not something a renderer applies.
 */
describe("redaction at write", () => {
  it("applies on the write path: the persisted line is already redacted", () => {
    const h = hermetic();
    const secret = "ghp_" + "a".repeat(30);
    const { record } = capture(
      {
        observation: `the CLI rejected ${secret} while starting the worktree twice`,
        command: "arggon start --worktree task-foo",
      },
      {},
      h,
    );
    expect(record.narrative).toBe(
      `the CLI rejected ${FRICTION_SECRET_PLACEHOLDER} while starting the worktree twice`,
    );
    // The line the log actually holds — no renderer exists between the two.
    const logPath = frictionLogPath(h.env, h.home);
    appendFrictionRecord(record, logPath);
    const raw = readFileSync(logPath, "utf8");
    expect(raw).not.toContain(secret);
    expect(raw).toContain(FRICTION_SECRET_PLACEHOLDER);
    // Persisted line and record agree byte-for-byte: the append writes exactly
    // the redacted record the builder produced.
    expect(JSON.parse(raw) as FrictionRecord).toEqual(record);
  });

  it("replaces a whole -----BEGIN … PRIVATE KEY----- block", () => {
    const block = [
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEA" + "x".repeat(40),
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");
    const out = redactFrictionText(
      `the export step dropped ${block} mid-paste while the pipeline was running, and nobody expected the key material to appear in that log at all`,
    );
    expect(out).toBe(
      `the export step dropped ${FRICTION_SECRET_PLACEHOLDER} mid-paste while the pipeline was running, and nobody expected the key material to appear in that log at all`,
    );
    expect(out).not.toContain("BEGIN");
    expect(out).not.toContain("MIIEow");
  });

  it("takes a truncated PEM header with the base64 body that follows it", () => {
    // Recorded decision: a paste cut off before its END marker would leave the
    // header AND the key material behind if only the block form matched, so a
    // bare header consumes the base64 body lines that follow it.
    const body = `-----BEGIN PRIVATE KEY-----\n${"A".repeat(40)}\n${"B".repeat(40)}`;
    expect(
      redactFrictionText(
        `the export step printed ${body} while the pipeline was running, and honestly nobody expected the key material to appear in that log at all, ever`,
      ),
    ).toBe(
      `the export step printed ${FRICTION_SECRET_PLACEHOLDER} while the pipeline was running, and honestly nobody expected the key material to appear in that log at all, ever`,
    );
    // …and the complete-block form still wins when the END is present.
    const block = `-----BEGIN PRIVATE KEY-----\n${"A".repeat(40)}\n-----END PRIVATE KEY-----`;
    expect(
      redactFrictionText(
        `the file contained ${block} and then a lot more trailing prose that is not secret at all, honestly, it just goes on and on`,
      ),
    ).toBe(
      `the file contained ${FRICTION_SECRET_PLACEHOLDER} and then a lot more trailing prose that is not secret at all, honestly, it just goes on and on`,
    );
  });

  it("replaces every secret shape the spec names", () => {
    // A long wrapper on purpose: the wrapper keeps each token a SMALL fraction
    // of the field, so the placeholder survives instead of the wholesale
    // replacement (which is covered by its own case below).
    const wrap = (token: string): string =>
      `the tool printed ${token} in its output even though I passed --quiet and expected silence from it here`;
    // Token prefixes, each in prose so the field is not wholesale-redacted.
    const prefixes: Array<[string, string]> = [
      ["ghp_", "a".repeat(30)],
      ["gho_", "b".repeat(30)],
      ["ghs_", "c".repeat(30)],
      ["ghr_", "d".repeat(30)],
      ["ghu_", "e".repeat(30)],
      // A conservative continuation of the spec's gh family: the fine-grained
      // PAT prefix, recorded on the item rather than left as a leak.
      ["github_pat_", "f".repeat(40)],
      ["npm_", "g".repeat(24)],
      ["sk-", "h".repeat(24)],
      ["AKIA", "I".repeat(16)],
    ];
    for (const [prefix, body] of prefixes) {
      expect(redactFrictionText(wrap(prefix + body))).toBe(wrap(FRICTION_SECRET_PLACEHOLDER));
    }
    // A JWT: header.payload.signature.
    expect(redactFrictionText(wrap("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefg"))).toBe(
      wrap(FRICTION_SECRET_PLACEHOLDER),
    );
    // Assignments, in their spellings: `=`, YAML/JSON quoted, every name.
    expect(redactFrictionText("sign in with password=hunthunthunt and retry the flow")).toBe(
      `sign in with ${FRICTION_SECRET_PLACEHOLDER} and retry the flow`,
    );
    expect(redactFrictionText('the envelope carried token: "abcdef1234" in its body')).toBe(
      `the envelope carried ${FRICTION_SECRET_PLACEHOLDER} in its body`,
    );
    expect(redactFrictionText("PASSWD=hunter2xx was printed by the wrapper script")).toBe(
      `${FRICTION_SECRET_PLACEHOLDER} was printed by the wrapper script`,
    );
    for (const name of ["key", "token", "secret", "password", "passwd", "credential"]) {
      expect(redactFrictionText(`the ${name}=hunter2xx option is what broke here`)).toBe(
        `the ${FRICTION_SECRET_PLACEHOLDER} option is what broke here`,
      );
    }
  });

  it("keeps an assignment value shorter than the spec's 8-char threshold", () => {
    // Recorded boundary: the spec's rule is a value of 8+ chars, so a shorter
    // value is not a secret shape by that rule and is left alone.
    expect(redactFrictionText("key=abc is short")).toBe("key=abc is short");
  });

  it("keeps the URL host and drops the query and the fragment", () => {
    expect(
      redactFrictionText(
        "open https://github.com/Arggon/ArggonManager/issues/new?title=hi&body=x#frag for me",
      ),
    ).toBe("open https://github.com/Arggon/ArggonManager/issues/new for me");
    // The host with a port and its path survive; only the query goes.
    expect(
      redactFrictionText(
        "the dev server at http://localhost:3000/logs?level=debug is not interesting",
      ),
    ).toBe("the dev server at http://localhost:3000/logs is not interesting");
  });

  it("drops URL userinfo and collapses file: URLs to the path placeholder", () => {
    // Recorded decisions, both conservative: a credential in userinfo is not
    // the host, and a file: URL is a path in disguise.
    expect(redactFrictionText("see https://user:pass@host/path/x for the details")).toBe(
      "see https://host/path/x for the details",
    );
    expect(redactFrictionText("see file:///home/u/x for the details")).toBe(
      `see ${FRICTION_PATH_PLACEHOLDER} for the details`,
    );
  });

  it("collapses every cross-OS path form to one placeholder", () => {
    const forms = [
      "C:\\Users\\a\\b",
      "c:/Users/a/b",
      "\\\\?\\C:\\Users\\a\\b",
      "/c/Users/a/b",
      "/private/var/folders/x",
    ];
    const tokens = forms.map((form) => redactFrictionText(`failed to read ${form} again`));
    for (const token of tokens) {
      expect(token).toBe(`failed to read ${FRICTION_PATH_PLACEHOLDER} again`);
    }
    // One canonical token across every form — the point of normalization.
    expect(new Set(forms.map((form) => redactFrictionText(form)))).toEqual(
      new Set([FRICTION_PATH_PLACEHOLDER]),
    );
  });

  it("leaves relative paths and prose slashes alone", () => {
    // Recorded boundary: only a rooted path leaks a home or a username; a
    // relative path and a ratio do not, and redacting them would destroy the
    // narrative's signal without removing anything sensitive.
    expect(redactFrictionText("failed to read docs/x.md again")).toBe(
      "failed to read docs/x.md again",
    );
    expect(redactFrictionText("the and/or prose 10/20 ratio survived")).toBe(
      "the and/or prose 10/20 ratio survived",
    );
  });

  it("replaces a child path before its parent so no child is orphaned", () => {
    expect(redactFrictionText("see /home/u/repo/sub/secret.txt inside /home/u/repo now")).toBe(
      `see ${FRICTION_PATH_PLACEHOLDER} inside ${FRICTION_PATH_PLACEHOLDER} now`,
    );
    // The orphaned child is the leak this ordering prevents: had the parent
    // been replaced first, `secret.txt` would survive as bare prose.
    expect(redactFrictionText("see C:\\Users\\a\\b\\secrets.txt inside C:\\Users\\a\\b now")).toBe(
      `see ${FRICTION_PATH_PLACEHOLDER} inside ${FRICTION_PATH_PLACEHOLDER} now`,
    );
    expect(
      redactFrictionText("see /home/u/repo/sub/secret.txt inside /home/u/repo now"),
    ).not.toContain("secret.txt");
  });

  it("replaces a field whose secret material exceeds 50% wholesale", () => {
    // The spec's hostile-input example: a 60%-secret field is not safe to
    // publish in any part.
    expect(redactFrictionText("secret1=abcdefgh12345678 secret2=abcdefgh12345678 x")).toBe(
      FRICTION_REDACTED_FIELD,
    );
    // Just under the threshold, the field keeps its prose and its placeholders.
    const under = "secret1=abcdefgh12345678 and a lot of harmless prose around it here";
    expect(redactFrictionText(under)).toBe(
      `${FRICTION_SECRET_PLACEHOLDER} and a lot of harmless prose around it here`,
    );
  });

  it("allows exactly the bound's substitutions and replaces the field past it", () => {
    const many = (n: number): string =>
      `${Array.from({ length: n }, () => "key=abcdefgh").join(" ")} ${"ok ".repeat(120)}`;
    // 20 is the bound itself: allowed, and the field survives.
    const at20 = redactFrictionText(many(20));
    expect(at20.split(FRICTION_SECRET_PLACEHOLDER)).toHaveLength(
      FRICTION_REDACTION_MAX_SUBSTITUTIONS + 1,
    );
    // 21 is past the bound: skipping the 21st substitution would leak it, so
    // the whole field goes.
    expect(redactFrictionText(many(21))).toBe(FRICTION_REDACTED_FIELD);
  });

  it("redacts --error values and commandShape through the same pass", () => {
    // A token can arrive in argv: the shape normalizer already collapses
    // token-SHAPED values to <arg>, and the redaction pass is what catches a
    // plain-word value the normalizer keeps (`--token=<plain word>`).
    const shape = "sync all workspaces in this repository --token=uniquepasswordvalue right now";
    const { record } = capture({
      error: "FRICTION_FAILED reason: token=abcdefgh12345678 while running",
      command: `arggon ${shape}`,
    });
    expect(record.errorCode).toBe(
      `FRICTION_FAILED reason: ${FRICTION_SECRET_PLACEHOLDER} while running`,
    );
    expect(record.commandShape).toBe(
      `sync all workspaces in this repository ${FRICTION_SECRET_PLACEHOLDER} right now`,
    );
    // The fingerprint feeds on the REDACTED stable fields: two captures whose
    // only difference is the leaked plain-word value are still one class.
    expect(record.fingerprint).toBe(
      frictionFingerprint({
        commandShape: `sync all workspaces in this repository ${FRICTION_SECRET_PLACEHOLDER} right now`,
        errorCode: `FRICTION_FAILED reason: ${FRICTION_SECRET_PLACEHOLDER} while running`,
        harness: "unknown",
        majorVersion: "0",
      }),
    );
  });

  it("redacts before capping, so a secret straddling the cap is redacted whole", () => {
    // Recorded decision: the pass runs on the UNCAPPED field. Capping first
    // would cut a secret at the boundary into a fragment no rule recognizes.
    const observation = "x".repeat(1975) + " password=hunthunthunthunt " + "y".repeat(300);
    const { record } = capture({ observation });
    expect(record.narrative).not.toContain("hunthunthunt");
    expect(record.narrative).toContain(FRICTION_SECRET_PLACEHOLDER);
    expect(record.narrative.length).toBe(FRICTION_NARRATIVE_CAP);
  });

  it("persists a redacted --evidence value end to end", () => {
    const dir = mkdtempSync(join(tmpdir(), "arggon-friction-evidence-redact-"));
    const file = join(dir, "crash.log");
    writeFileSync(
      file,
      [
        "Traceback (most recent call last):",
        '  File "app/main.py", line 10, in <module>',
        "    run()",
        '  File "app/runner.py", line 42, in run',
        "    load_config()",
        '  File "app/config.py", line 7, in load_config',
        `    open("C:\\Users\\adopter\\project\\settings.toml")`,
        "-----BEGIN PRIVATE KEY-----",
        "MIIEowIBAAKCAQEA" + "x".repeat(40),
        "-----END PRIVATE KEY-----",
        "PermissionError: [Errno 13] Permission denied",
      ].join("\n"),
      "utf8",
    );
    const h = hermetic();
    const { record } = capture({ evidencePath: file }, {}, h);
    expect(record.evidence).toContain("Traceback");
    expect(record.evidence).toContain("PermissionError");
    expect(record.evidence).toContain(FRICTION_PATH_PLACEHOLDER);
    expect(record.evidence).toContain(FRICTION_SECRET_PLACEHOLDER);
    expect(record.evidence).not.toContain("C:\\Users\\adopter");
    expect(record.evidence).not.toContain("BEGIN PRIVATE");
    expect(record.evidence).not.toContain("MIIEow");
    // …and the persisted line, not just the in-memory record.
    const logPath = frictionLogPath(h.env, h.home);
    appendFrictionRecord(record, logPath);
    const raw = readFileSync(logPath, "utf8");
    expect(raw).not.toContain("C:\\Users\\adopter");
    expect(raw).not.toContain("MIIEow");
    // The evidence file's PATH is never captured either.
    expect(raw).not.toContain(file);
  });

  it("covers a narrative crafted to defeat naive redaction, and records what it does not", () => {
    // Covered: nesting and overlap. A JWT and a path inside a URL query, a PEM
    // block, and a QUOTED multi-word passphrase in one field — the pass runs in
    // the spec's order, so each rule sees what the earlier ones left.
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefg";
    const narrative = [
      "The failure I hit is long and boring to describe in full, so here is the gist of it:",
      `pasted ${jwt} into https://example.com/callback?next=/home/u/x&sig=1 for the flow`,
      "-----BEGIN PRIVATE KEY-----",
      "MIIEowIBAAKCAQEA" + "x".repeat(40),
      "-----END PRIVATE KEY-----",
      'then the tool said: password = "correct horse battery staple"',
      "and I could not tell which of the three it was complaining about, honestly.",
    ].join("\n");
    const out = redactFrictionText(narrative);
    expect(out).not.toContain(jwt);
    expect(out).not.toContain("BEGIN");
    expect(out).not.toContain("MIIEow");
    expect(out).toContain("https://example.com/callback"); // host preserved
    expect(out).not.toContain("correct horse"); // quoted multi-word value redacted
    expect(out).toContain("The failure I hit is long"); // prose survives

    // Covered: the overlap that would orphan a block body. An assignment name
    // immediately before the header (`key: -----BEGIN …`) would, if the
    // assignment rule matched first, consume the header and leave the key body
    // behind — so the PEM shapes run as their own pass before it.
    const body = "MIIEowIBAAKCAQEA" + "x".repeat(40);
    const decoy = [
      `the export printed --- BEGIN ... actually a full key: -----BEGIN RSA PRIVATE KEY-----`,
      body,
      "-----END RSA PRIVATE KEY-----",
      "and I do not know which of the two it meant, honestly, it just goes on",
    ].join("\n");
    const decoyOut = redactFrictionText(decoy);
    expect(decoyOut).not.toContain("MIIEow");
    expect(decoyOut).not.toContain("-----END");

    // Recorded boundaries — cases the spec's rule set does not name. Each is
    // DELIBERATELY not guessed at: the pass asserts the honest current behavior
    // rather than a half-rule that would miss the neighbours anyway.
    // 1. A marker misspelled by one dash is not the PEM marker.
    expect(redactFrictionText("----BEGIN PRIVATE KEY----- x")).toBe("----BEGIN PRIVATE KEY----- x");
    // 2. A fullwidth `＝` is not the ASCII assignment separator the spec names.
    expect(redactFrictionText("password＝secret12345 x")).toBe("password＝secret12345 x");
    // 3. A token split by a zero-width space is not one token.
    const split = `ghp_\u200b${"a".repeat(30)}`;
    expect(redactFrictionText(`${split} x`)).toBe(`${split} x`);
    // 4. A name split across a newline is not one identifier.
    expect(redactFrictionText("pas\nsword=secret12345 x")).toBe("pas\nsword=secret12345 x");
  });

  it("guards the log itself: a hand-built record cannot persist an unredacted field", () => {
    // The log-level invariant is structural, not procedural: an append is where
    // bytes land on disk, so the pass runs there too — idempotently, so a
    // record from buildFrictionRecord is unchanged.
    const h = hermetic();
    const logPath = frictionLogPath(h.env, h.home);
    const handBuilt: FrictionRecord = {
      v: FRICTION_FORMAT_VERSION,
      ts: NOW.toISOString(),
      fingerprint: "handbuilt01",
      reporterId: "handbuilt02",
      commandShape: "sync",
      harness: "unknown",
      arggonVersion: VERSION,
      majorVersion: "0",
      os: "linux",
      arch: "x64",
      node: "v22.0.0",
      narrative: "leaked C:\\Users\\a\\b and password=hunthunthunthunt here",
      evidence: "-----BEGIN PRIVATE KEY-----\nMIIEabc",
    };
    appendFrictionRecord(handBuilt, logPath);
    const raw = readFileSync(logPath, "utf8");
    expect(raw).not.toContain("C:\\Users\\a");
    expect(raw).not.toContain("hunthunthunt");
    expect(raw).not.toContain("BEGIN");
    const read = readFrictionLog(logPath);
    expect(read.records).toHaveLength(1);
    expect(read.records[0]!.narrative).toBe(
      `leaked ${FRICTION_PATH_PLACEHOLDER} and ${FRICTION_SECRET_PLACEHOLDER} here`,
    );
    // A builder-produced record passes through the guard unchanged (idempotent).
    const { record } = capture({}, {}, h);
    appendFrictionRecord(record, logPath);
    expect(
      JSON.parse(
        readFileSync(logPath, "utf8")
          .split("\n")
          .filter((l) => l !== "")[1]!,
      ),
    ).toEqual(record);
  });

  it("keeps the rest of the record's fields untouched", () => {
    // Redaction covers the caller-supplied free-text surfaces; the whitelisted
    // kernel facts and derived fields ride verbatim.
    const { record } = capture({
      observation: "arggon start --worktree failed twice",
      error: "START_FAILED",
      harness: "opencode",
    });
    expect(record.errorCode).toBe("START_FAILED");
    expect(record.harness).toBe("opencode");
    expect(record.commandShape).toBe("start --worktree <arg>");
    expect(record.narrative).toBe("arggon start --worktree failed twice");
  });
});
