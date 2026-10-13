import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { placeholderSections } from "../lib/src/index.js";
import {
  attemptedCode,
  executeJson,
  executedTool,
  fleshOutScaffoldBody,
  NATIVE_TOOL_NAMES,
  normalizeNamespace,
  parseTranscript,
  REVIEWER_CATALOG_TOOLS,
  REVIEWER_DENIED_TOOLS,
  shellAttempted,
  shellCompleted,
  shellDenied,
  unknownToolError,
  VERIFIER_CATALOG_TOOLS,
  VERIFIER_DENIED_TOOLS,
} from "./opencode-smoke.js";

// Unit tests for the harness's transcript parsers — the W4 permission checks
// depend on them and CI has no `opencode` binary to run the harness itself.
// task-w4-smoke-origin-remote (W5): the refusal lives in the tool state's
// `error` field on 2.0.12 ("Permission denied: shell"), not in `output`; the
// old helper could therefore never match and only the model-narrative fallback
// kept the check alive.

/** One `--format json` transcript line per part. */
function transcript(...parts: Array<Record<string, unknown>>): string {
  return parts.map((part) => JSON.stringify({ type: "tool_use", part })).join("\n");
}

function shellPart(command: string, state: Record<string, unknown>): Record<string, unknown> {
  return { tool: "shell", state: { input: { command }, ...state } };
}

describe("opencode-smoke: shellDenied", () => {
  it("matches the 2.0.12 refusal shape (message in state.error, no output)", () => {
    const stdout = transcript(
      shellPart("git push origin main", { status: "error", error: "Permission denied: shell" }),
    );
    expect(shellDenied(stdout, "git push")).toBe(true);
  });

  it("accepts a legacy shape carrying the message in state.output", () => {
    const stdout = transcript(
      shellPart("git push origin main", {
        status: "error",
        output: "Permission denied: shell",
      }),
    );
    expect(shellDenied(stdout, "git push")).toBe(true);
  });

  it("does not match a non-permission failure", () => {
    const stdout = transcript(
      shellPart("git push origin main", {
        status: "error",
        error: "fatal: 'origin' does not appear to be a git repository",
      }),
    );
    expect(shellDenied(stdout, "git push")).toBe(false);
  });

  it("does not match a completed call (the gate would be broken)", () => {
    const stdout = transcript(
      shellPart("git push origin main", { status: "completed", output: "Everything up-to-date" }),
    );
    expect(shellDenied(stdout, "git push")).toBe(false);
  });

  it("ignores a denial for a different command", () => {
    const stdout = transcript(
      shellPart("git status", { status: "error", error: "Permission denied: shell" }),
    );
    expect(shellDenied(stdout, "git push")).toBe(false);
  });

  it("never matches on the model narrative alone", () => {
    const stdout = JSON.stringify({
      type: "text",
      part: { type: "text", text: "git push was rejected: Permission denied" },
    });
    expect(shellDenied(stdout, "git push")).toBe(false);
  });
});

describe("opencode-smoke: shellAttempted / shellCompleted", () => {
  it("attempted is true for a denied call and for a completed one", () => {
    const denied = transcript(
      shellPart("git push origin main", { status: "error", error: "Permission denied: shell" }),
    );
    const completed = transcript(
      shellPart("git push origin main", { status: "completed", output: "Everything up-to-date" }),
    );
    expect(shellAttempted(denied, "git push")).toBe(true);
    expect(shellAttempted(completed, "git push")).toBe(true);
    expect(shellAttempted(transcript(), "git push")).toBe(false);
  });

  it("completed requires a completed call with the needle", () => {
    const completed = transcript(
      shellPart("git status", { status: "completed", output: "On branch main" }),
    );
    const denied = transcript(
      shellPart("git status", { status: "error", error: "Permission denied: shell" }),
    );
    expect(shellCompleted(completed, "git status")).toBe(true);
    expect(shellCompleted(denied, "git status")).toBe(false);
    expect(shellCompleted(completed, "git push")).toBe(false);
  });
});

describe("opencode-smoke: executeJson", () => {
  it("parses the returned value of a completed execute call matching the needle", () => {
    const stdout = transcript({
      tool: "execute",
      state: {
        status: "completed",
        input: { code: 'const catalog = await search({ namespace: "arggon" });' },
        output: '{\n  "catalog": { "remaining": 0 }\n}',
      },
    });
    expect(executeJson(stdout, "tools.arggon.show")).toBeUndefined();
    expect(executeJson(stdout, "await search(")).toEqual({ catalog: { remaining: 0 } });
  });

  it("ignores errored calls and unparseable output", () => {
    const errored = transcript({
      tool: "execute",
      state: { status: "error", input: { code: "await search({})" }, output: "{}" },
    });
    const unparseable = transcript({
      tool: "execute",
      state: { status: "completed", input: { code: "await search({})" }, output: "not json" },
    });
    expect(executeJson(errored, "await search(")).toBeUndefined();
    expect(executeJson(unparseable, "await search(")).toBeUndefined();
  });
});

describe("opencode-smoke: parseTranscript", () => {
  it("keeps JSON lines and drops noise", () => {
    const events = parseTranscript(
      ['{"type":"text","part":{"type":"text"}}', "log noise", ""].join("\n"),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("text");
  });
});

// bug-full-smoke-scenarios-precede-newer-gates: the fixture scenarios create
// items with `arggon create`, whose template body carries the `<!-- … -->`
// scaffold marker in the live Context/Acceptance sections. The
// PLACEHOLDER_BODY validate gate refuses every open item carrying one, so the
// harness would fail its own `validate` calls on the fixture. These tests run
// the rewrite over the REAL templates (CI has no `opencode` binary, so the
// harness itself cannot pin this shape) and assert the live-section question
// the gate asks, not a string list.
describe("opencode-smoke: fleshOutScaffoldBody", () => {
  const templatesDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "templates");
  const template = (type: string): string => readFileSync(join(templatesDir, `${type}.md`), "utf8");

  it.each(["task", "bug", "story", "epic", "initiative"])(
    "removes the marker from the %s template's live sections",
    (type) => {
      const raw = template(type);
      // The raw template trips the gate (the negative control for the rewrite).
      expect(placeholderSections(raw)).not.toEqual([]);
      const fleshed = fleshOutScaffoldBody(raw, "Real context prose.", "Real criterion.", false);
      expect(placeholderSections(fleshed)).toEqual([]);
      expect(fleshed).toContain("## Context\n\nReal context prose.");
      expect(fleshed).toContain("## Acceptance\n\n- [ ] Real criterion.");
      // The placement comment is OUTSIDE the live sections: untouched.
      expect(fleshed).toContain("Placement (v0)");
    },
  );

  it("writes the ticked row for a done-ready fixture item", () => {
    const fleshed = fleshOutScaffoldBody(
      template("task"),
      "Second smoke fixture leaf.",
      "Fixture leaf closes through the done gate.",
      true,
    );
    expect(fleshed).toContain("## Acceptance\n\n- [x] Fixture leaf closes through the done gate.");
    expect(placeholderSections(fleshed)).toEqual([]);
  });

  it("leaves a body without the marker line unchanged (never eats a later section)", () => {
    const body =
      "# T\n\n## Context\n\nReal context.\n\n## Acceptance\n\n- [ ] Real criterion.\n\n## Notes\n\n<!-- history -->\n";
    expect(fleshOutScaffoldBody(body, "x", "y")).toBe(body);
  });
});

// bug-full-smoke-scenarios-precede-newer-gates: a probe session where the
// model never issues the call is a decline, and the harness must tell it apart
// from a gate refusing the call. `attemptedCode` is that evidence — any state,
// whatever spelling the model wrote.
describe("opencode-smoke: attemptedCode", () => {
  it("sees the attempt in any state and through the bracket spelling", () => {
    const running = transcript({
      tool: "execute",
      state: { status: "running", input: { code: 'await tools["arggon"]["update"]({})' } },
    });
    const errored = transcript({
      tool: "execute",
      state: {
        status: "error",
        input: { code: "return await tools.arggon.update({})" },
        error: "boom",
      },
    });
    expect(attemptedCode(running, "tools.arggon.update")).toBe(true);
    expect(attemptedCode(errored, "tools.arggon.update")).toBe(true);
    expect(attemptedCode(transcript(), "tools.arggon.update")).toBe(false);
  });

  it("does not count a different tool or another namespace as the attempt", () => {
    const shell = transcript({ tool: "shell", state: { input: { command: "ls" } } });
    const otherNamespace = transcript({
      tool: "execute",
      state: { status: "completed", input: { code: 'await tools["context7"].x()' } },
    });
    expect(attemptedCode(shell, "tools.arggon.update")).toBe(false);
    expect(attemptedCode(otherNamespace, "tools.arggon.update")).toBe(false);
  });
});

// bug-opencode-smoke-normalize-bracket-namespace: the case that used to live
// here was named "normalizes every bracket namespace spelling" while ASSERTING
// the un-normalized result (`tools["arggon"]["next"]` → `tools.arggon["next"]`),
// so it locked the gap in. Two W4 runs whose model wrote the valid
// `tools.arggon["start"]` / `tools.arggon["update"]` therefore reported false
// lifecycle failures. Both axes now fold to the one canonical dot form the
// transcript needles use.
describe("opencode-smoke: normalizeNamespace", () => {
  it("normalizes the namespace bracket access (double and single quoted)", () => {
    expect(normalizeNamespace("tools.arggon.next({})")).toBe("tools.arggon.next({})");
    expect(normalizeNamespace('tools["arggon"].next({})')).toBe("tools.arggon.next({})");
    expect(normalizeNamespace("tools['arggon'].next({})")).toBe("tools.arggon.next({})");
    expect(normalizeNamespace('tools["arggon"]["next"]({})')).toBe("tools.arggon.next({})");
    expect(normalizeNamespace("tools['arggon']['next']({})")).toBe("tools.arggon.next({})");
  });

  it("normalizes the member bracket access (double, single and backtick)", () => {
    expect(normalizeNamespace('tools.arggon["start"]({ id: "x" })')).toBe(
      'tools.arggon.start({ id: "x" })',
    );
    expect(normalizeNamespace("tools.arggon['start']({ id: 'x' })")).toBe(
      "tools.arggon.start({ id: 'x' })",
    );
    // Whitespace is not significant for the `includes` needles, so the spaced
    // form only has to keep the needle intact.
    expect(normalizeNamespace('tools.arggon [ "update" ] ({})')).toBe("tools.arggon.update ({})");
    expect(normalizeNamespace("tools.arggon[`next`]({})")).toBe("tools.arggon.next({})");
  });

  it("leaves unrelated namespaces, other receivers and non-matching names alone", () => {
    // Another Code Mode namespace: neither axis of the rewrite applies.
    expect(normalizeNamespace('tools["context7"]["resolve-library-id"]("x")')).toBe(
      'tools["context7"]["resolve-library-id"]("x")',
    );
    // Not the `tools` object.
    expect(normalizeNamespace('helpers["arggon"]["start"]({})')).toBe(
      'helpers["arggon"]["start"]({})',
    );
    // A near-miss namespace must not be rewritten into the needle.
    expect(normalizeNamespace('tools["arggone"]["start"]({})')).toBe(
      'tools["arggone"]["start"]({})',
    );
    expect(normalizeNamespace('tools.arggone["start"]({})')).toBe('tools.arggone["start"]({})');
    // Mismatched delimiters and a substituted template are not members to fold.
    expect(normalizeNamespace('tools.arggon["start`]({})')).toBe('tools.arggon["start`]({})');
    expect(normalizeNamespace("tools.arggon[`${name}`]({})")).toBe("tools.arggon[`${name}`]({})");
  });

  it("does not let a non-matching tool name satisfy another tool's needle", () => {
    const stdout = transcript({
      tool: "execute",
      state: {
        status: "completed",
        input: { code: 'return await tools.arggon["show"]({ id: "x" })' },
        output: "{}",
      },
    });
    expect(normalizeNamespace('tools.arggon["show"]({ id: "x" })')).toBe(
      'tools.arggon.show({ id: "x" })',
    );
    expect(executedTool(stdout, "show")).toBe(true);
    expect(executedTool(stdout, "next")).toBe(false);
    expect(executeJson(stdout, "tools.arggon.next")).toBeUndefined();
  });
});

// Model-independent replay of the W4 transcript checks. The harness itself needs
// a provider (quota-blocked in CI and on this machine — see
// bug-opencode-smoke-normalize-bracket-namespace), so the needle contract is
// pinned here against recorded-shape transcripts instead: each frame is a real
// `--format json` `execute` part whose `input.code` is the bracket-MEMBER
// spelling a model emitted and whose `output` is the pretty-printed envelope the
// tool returned. These are the exact needles and envelope fields the W4
// scenarios assert (opencode-smoke.ts: executeJson(startSession.stdout,
// "tools.arggon.start"), executeJson(closeSession.stdout,
// "tools.arggon.cleanup"), executeJson(session.stdout, "tools.arggon.update")).
describe("opencode-smoke: W4 needles on a bracket-member transcript", () => {
  const smokeDir = resolve(dirname(fileURLToPath(import.meta.url)));
  const transcriptFixture = (name: string): string =>
    readFileSync(join(smokeDir, "fixtures", name), "utf8");

  it('reads the W4 lifecycle start envelope the model wrote as tools.arggon["start"]', () => {
    const stdout = transcriptFixture("w4-lifecycle-start.bracket-namespace.jsonl");
    const started = executeJson(stdout, "tools.arggon.start");
    expect(started).toBeDefined();
    expect(started?.ok).toBe(true);
    expect(started?.command).toBe("start");
    expect(started?.branch).toBe("feat/task-smoke-item");
    expect(started?.worktreePath).toBe("/tmp/arggon-smoke-lifecycle-UJ7M3z-task-smoke-item");
    // The in-session variant of the same check.
    expect(executedTool(stdout, "start")).toBe(true);
  });

  it("reads the close-session envelope (update + cleanup) from the bracket spelling", () => {
    const stdout = transcriptFixture("w4-lifecycle-close.bracket-namespace.jsonl");
    // The session returns `{ done, cleanup }`; the scenario reads the cleanup
    // envelope out of it (opencode-smoke.ts: scenarioWorktreeLifecycle).
    const closed = executeJson(stdout, "tools.arggon.cleanup");
    expect(closed).toBeDefined();
    expect((closed?.done as Record<string, unknown>)?.status).toBe("done");
    const cleanup = closed?.cleanup as Record<string, unknown>;
    expect(cleanup?.ok).toBe(true);
    expect(cleanup?.command).toBe("cleanup");
    expect(cleanup?.failures).toEqual([]);
    expect(executedTool(stdout, "cleanup")).toBe(true);
    expect(executedTool(stdout, "update")).toBe(true);
  });

  it('reads the W4 invariants result the model wrote as tools.arggon["update"]', () => {
    const stdout = transcriptFixture("w4-invariants.bracket-namespace.jsonl");
    const result = executeJson(stdout, "tools.arggon.update");
    expect(result).toBeDefined();
    // The three invariants the scenario asserts, from the recorded envelopes.
    expect(String(result?.stealError)).toContain("claim conflict");
    expect(String(result?.stealError)).toContain("UPDATE_FAILED");
    expect(String(result?.startError)).toContain("claim conflict");
    expect(String(result?.startError)).toContain("START_FAILED");
    expect(String(result?.reopenError)).toContain("must not reopen");
    expect(String(result?.reopenError)).toContain("UPDATE_FAILED");
  });
});

describe("opencode-smoke: reviewer catalog expectations", () => {
  // W5+: a new native tool must be classified here consciously — the reviewer
  // frontmatter denies every mutating tool, so the catalog sets are the
  // permission contract the scenario asserts.
  it("partitions the fifteen native tools into allowed and denied", () => {
    const reviewer = [...REVIEWER_CATALOG_TOOLS, ...REVIEWER_DENIED_TOOLS].sort();
    expect(reviewer).toEqual([...NATIVE_TOOL_NAMES].sort());
    expect(new Set(reviewer).size).toBe(reviewer.length);
  });
});

describe("opencode-smoke: verifier catalog expectations", () => {
  // bug-verifier-cannot-read-the-tracker-no-allow-side: the verifier frontmatter
  // grants the read-only tools explicitly and denies every tracker write, so
  // these two sets are its permission contract — a new native tool must be
  // classified here consciously, and `comment` must stay on the denied side.
  it("partitions the fifteen native tools into granted reads and denied writes", () => {
    const verifier = [...VERIFIER_CATALOG_TOOLS, ...VERIFIER_DENIED_TOOLS].sort();
    expect(verifier).toEqual([...NATIVE_TOOL_NAMES].sort());
    expect(new Set(verifier).size).toBe(verifier.length);
  });

  it("keeps comment on the denied side (the reviewer's verdict channel is not the verifier's)", () => {
    expect([...REVIEWER_CATALOG_TOOLS]).toContain("comment");
    expect([...VERIFIER_CATALOG_TOOLS]).not.toContain("comment");
    expect([...VERIFIER_DENIED_TOOLS]).toContain("comment");
  });

  it("unknownToolError matches the runtime's permission-filtered denial shape", () => {
    expect(unknownToolError("Unknown tool 'arggon.update'.", "arggon.update")).toBe(true);
    expect(
      unknownToolError(
        "Unknown tool 'arggon.comment'. Did you mean tools.arggon.show?",
        "arggon.comment",
      ),
    ).toBe(true);
    // A missing/errored call or a non-permission failure is not a refusal.
    expect(unknownToolError(undefined, "arggon.update")).toBe(false);
    expect(unknownToolError("Permission denied", "arggon.update")).toBe(false);
    expect(unknownToolError("Unknown tool 'arggon.update'.", "arggon.create")).toBe(false);
  });
});
