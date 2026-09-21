import { describe, expect, it } from "vitest";
import {
  executeJson,
  NATIVE_TOOL_NAMES,
  normalizeNamespace,
  parseTranscript,
  REVIEWER_CATALOG_TOOLS,
  REVIEWER_DENIED_TOOLS,
  shellAttempted,
  shellCompleted,
  shellDenied,
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

describe("opencode-smoke: parseTranscript / normalizeNamespace", () => {
  it("keeps JSON lines and drops noise", () => {
    const events = parseTranscript(
      ['{"type":"text","part":{"type":"text"}}', "log noise", ""].join("\n"),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("text");
  });

  it("normalizes every bracket namespace spelling", () => {
    expect(normalizeNamespace('tools["arggon"]["next"]({})')).toBe('tools.arggon["next"]({})');
    expect(normalizeNamespace("tools['arggon'].show({})")).toBe("tools.arggon.show({})");
    expect(normalizeNamespace("tools.arggon.next({})")).toBe("tools.arggon.next({})");
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
