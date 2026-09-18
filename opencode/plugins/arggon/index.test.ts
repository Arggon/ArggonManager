import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CACHE_MAX_ENTRIES,
  ITEM_BLOCK_MAX_BYTES,
  boundText,
  buildItemBlock,
  isArggonItemId,
  itemCacheKey,
  itemIdFromBranch,
  looksLikeCommitCommand,
  onToolAfter,
  parseArggonItemFromCode,
  parseArggonItemFromCommand,
  parseArggonItemFromTool,
  parseValidateFailure,
  setBounded,
} from "./index.js";

// plan-opencode2-009 W3 (T9-T10): the plugin's correlation/formatting logic is
// pure and lives in the single plugin source (opencode/plugins/arggon/index.ts),
// which is copied verbatim into adopter trees. These tests exercise it without
// an OpenCode runtime; the hook plumbing and injected bytes are covered by
// `npm run smoke:opencode` (real headless sessions).
//
// The test lives next to the plugin source, OUTSIDE cli/src: `tsc -p
// tsconfig.json` has rootDir cli/src and must not compile a file imported from
// outside it (TS6059), and the plugin deliberately imports no types from
// @opencode/plugin. vitest.config.ts includes `opencode/**/*.test.ts` so the
// suite still runs it; eslint covers the whole tree.

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

describe("plugin-context: arggon invocation parsing", () => {
  it("parses CLI subcommands that reference one item", () => {
    expect(parseArggonItemFromCommand("arggon show task-smoke-item --json")).toBe("task-smoke-item");
    expect(parseArggonItemFromCommand("npm run arggon -- update task-x --status in_progress")).toBe("task-x");
    expect(parseArggonItemFromCommand("cd repo && /usr/local/bin/arggon comment bug-login-500 'note'")).toBe(
      "bug-login-500",
    );
    expect(parseArggonItemFromCommand('arggon handoff "task-x" --next "go"')).toBe("task-x");
    expect(parseArggonItemFromCommand("arggon -q start task-x --worktree")).toBe("task-x");
  });

  it("ignores commands without an item reference", () => {
    expect(parseArggonItemFromCommand("arggon next --json")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon validate --json")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon create task 'New' --parent story-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("arggon show --json")).toBeUndefined();
    expect(parseArggonItemFromCommand("argonite show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("node cli/src/cli.ts show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand(undefined)).toBeUndefined();
  });

  it("anchors item correlation to command position (F2)", () => {
    expect(parseArggonItemFromCommand('grep -rn "arggon show task-x" .')).toBeUndefined();
    expect(parseArggonItemFromCommand('echo "arggon update task-fake"')).toBeUndefined();
    expect(parseArggonItemFromCommand('git commit -m "arggon handoff task-x"')).toBeUndefined();
    expect(parseArggonItemFromCommand("echo arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCommand("cd repo && grep arggon show task-x")).toBeUndefined();
    expect(parseArggonItemFromCode('const cmd = "grep -rn \'arggon show task-x\' ."')).toBeUndefined();
    expect(
      parseArggonItemFromCode('await tools.shell({ command: \'echo "arggon update task-fake"\' })'),
    ).toBeUndefined();
  });

  it("still correlates command-position invocations (F2)", () => {
    expect(parseArggonItemFromCommand("ARGON_QUIET=1 arggon show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("git status && arggon comment task-x 'note'")).toBe("task-x");
    expect(parseArggonItemFromCommand("pnpm run arggon -- show task-x")).toBe("task-x");
    expect(parseArggonItemFromCommand("yarn run arggon start task-x")).toBe("task-x");
    expect(
      parseArggonItemFromCode('await tools.shell({ command: "cd repo && arggon show task-x" })'),
    ).toBe("task-x");
  });

  it("parses Code Mode MCP calls and embedded shell commands", () => {
    expect(
      parseArggonItemFromCode('return await tools.arggon.arggon_update({ id: "task-x", status: "in_progress" })'),
    ).toBe("task-x");
    expect(parseArggonItemFromCode("return await tools.arggon.arggon_show({ id: 'bug-y' })")).toBe("bug-y");
    expect(parseArggonItemFromCode("await tools.arggon.arggon_comment({id: `task-z`, text: 'hi'})")).toBe("task-z");
    expect(parseArggonItemFromCode('return await tools.shell({ command: "arggon show task-cli" })')).toBe(
      "task-cli",
    );
  });

  it("does not invent an item for unrelated Code Mode calls", () => {
    expect(parseArggonItemFromCode("return await tools.arggon.arggon_next({})")).toBeUndefined();
    expect(parseArggonItemFromCode('return await tools.arggon.arggon_update({ status: "in_progress" })')).toBeUndefined();
    expect(parseArggonItemFromCode("return await tools.read({ path: 'README.md' })")).toBeUndefined();
  });

  it("parses observed tool executions by tool name", () => {
    expect(parseArggonItemFromTool("shell", { command: "arggon show task-x --json" })).toBe("task-x");
    expect(parseArggonItemFromTool("arggon_update", { id: "task-x", status: "in_progress" })).toBe("task-x");
    expect(parseArggonItemFromTool("arggon.arggon_handoff", { id: "task-x" })).toBe("task-x");
    expect(parseArggonItemFromTool("execute", { code: 'await tools.arggon.arggon_start({ id: "task-x" })' })).toBe(
      "task-x",
    );
    expect(parseArggonItemFromTool("read", { path: "tasks/task-x.md" })).toBeUndefined();
    expect(parseArggonItemFromTool(undefined, { id: "task-x" })).toBeUndefined();
  });

  it("accepts path-safe ids only", () => {
    expect(isArggonItemId("task-x")).toBe(true);
    expect(isArggonItemId("bug-login-500")).toBe(true);
    expect(isArggonItemId("--json")).toBe(false);
    expect(isArggonItemId("-q")).toBe(false);
    expect(isArggonItemId("")).toBe(false);
    expect(isArggonItemId("../etc/passwd")).toBe(false);
    expect(isArggonItemId(42)).toBe(false);
  });
});

describe("plugin-context: branch fallback", () => {
  it("maps feat/<id> and fix/<id> only", () => {
    expect(itemIdFromBranch("feat/task-x")).toBe("task-x");
    expect(itemIdFromBranch("fix/bug-login-500")).toBe("bug-login-500");
    expect(itemIdFromBranch("master")).toBeUndefined();
    expect(itemIdFromBranch("feature/task-x")).toBeUndefined();
    expect(itemIdFromBranch("docs/task-x")).toBeUndefined();
    expect(itemIdFromBranch("feat/")).toBeUndefined();
    expect(itemIdFromBranch(undefined)).toBeUndefined();
  });
});

describe("plugin-context: commit hygiene detection", () => {
  it("detects git commit invocations", () => {
    expect(looksLikeCommitCommand('git commit -m "x"')).toBe(true);
    expect(looksLikeCommitCommand("git add -A && git commit --amend --no-edit")).toBe(true);
    expect(looksLikeCommitCommand("git -c user.name=x commit -m y")).toBe(true);
    expect(looksLikeCommitCommand("cd repo; /usr/bin/git commit")).toBe(true);
    expect(looksLikeCommitCommand("git status")).toBe(false);
    expect(looksLikeCommitCommand("npm test")).toBe(false);
    expect(looksLikeCommitCommand(undefined)).toBe(false);
  });

  it("formats validate failures without inventing success", () => {
    expect(parseValidateFailure('{"ok":true,"errors":[]}')).toBeUndefined();
    expect(parseValidateFailure("not json")).toBeUndefined();
    expect(
      parseValidateFailure(
        '{"ok":false,"errors":[{"message":"unknown status \'nope\'"},{"message":"second"}]}',
      ),
    ).toBe("2 error(s); first: unknown status 'nope'");
    expect(parseValidateFailure('{"ok":false}')).toBe("0 error(s)");
  });
});

describe("plugin-context: bounded item block", () => {
  const item = {
    id: "task-smoke-item",
    type: "task",
    status: "in_progress",
    title: "Smoke item",
    parent: "smoke-story",
    branch: "feat/task-smoke-item",
    assignee: "smoke",
    priority: "p3",
    labels: ["smoke"],
    worktree_path: "/tmp/worktrees/task-smoke-item",
  };

  it("renders the compact show shape as an advisory block", () => {
    const block = buildItemBlock(item, { currentDirectory: "/tmp/elsewhere" });
    expect(block.text.startsWith("<arggon-item>\n")).toBe(true);
    expect(block.text).toContain("id: task-smoke-item");
    expect(block.text).toContain("status: in_progress");
    expect(block.text).toContain("title: Smoke item");
    expect(block.text).toContain("parent: smoke-story");
    expect(block.text).toContain("branch: feat/task-smoke-item");
    expect(block.text).toContain("worktree: /tmp/worktrees/task-smoke-item (session_move available)");
    expect(block.text.trimEnd().endsWith("</arggon-item>")).toBe(true);
    expect(block.bytes).toBe(byteLength(block.text));
    expect(block.truncated).toBe(false);
    expect(block.bytes).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
  });

  it("omits the worktree hint when the session is already there", () => {
    const block = buildItemBlock(item, { currentDirectory: "/tmp/worktrees/task-smoke-item" });
    expect(block.text).not.toContain("worktree:");
    expect(block.text).not.toContain("session_move");
  });

  it("clips per-field values and stays within the byte bound for a long title", () => {
    const clipped = buildItemBlock({ ...item, title: "x".repeat(5000), labels: Array.from({ length: 50 }, (_, i) => `label-${i}`) });
    expect(clipped.truncated).toBe(false);
    expect(clipped.bytes).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
    expect(clipped.text).toContain("…");
    expect(clipped.text.length).toBeLessThan(5000);
  });

  it("truncates a block built from many long fields", () => {
    const long = "y".repeat(400);
    const huge = {
      id: long,
      type: long,
      status: long,
      title: long,
      parent: long,
      branch: long,
      assignee: long,
      priority: long,
      labels: [long],
      worktree_path: long,
    };
    const block = buildItemBlock(huge);
    expect(block.truncated).toBe(true);
    expect(block.bytes).toBeLessThanOrEqual(ITEM_BLOCK_MAX_BYTES);
  });

  it("bounds arbitrary text on a line boundary", () => {
    const bounded = boundText(["<arggon-item>", "a".repeat(2000), "</arggon-item>"].join("\n"), 128);
    expect(bounded.truncated).toBe(true);
    expect(bounded.bytes).toBeLessThanOrEqual(128);
    expect(bounded.text.endsWith("… (truncated)")).toBe(true);
    expect(boundText("short", 128).truncated).toBe(false);
  });

  it("never overshoots the byte bound when cutting a multibyte line (F3)", () => {
    const bounded = boundText("あ".repeat(100), 20);
    expect(bounded.truncated).toBe(true);
    expect(bounded.bytes).toBe(byteLength(bounded.text));
    expect(bounded.bytes).toBeLessThanOrEqual(20);
    expect(bounded.text.startsWith("あ")).toBe(true);
    expect(bounded.text.endsWith("… (truncated)")).toBe(true);
  });

  it("returns an empty truncated block when the bound cannot fit the marker (F3)", () => {
    const bounded = boundText("anything", 4);
    expect(bounded.truncated).toBe(true);
    expect(bounded.bytes).toBe(0);
    expect(bounded.text).toBe("");
  });
});

describe("plugin-context: bounded caches", () => {
  it("keys cached item views by project directory and id (F5)", () => {
    expect(itemCacheKey("/p/a", "task-x")).not.toBe(itemCacheKey("/p/b", "task-x"));
    expect(itemCacheKey("/p/a", "task-x")).toBe(itemCacheKey("/p/a", "task-x"));
  });

  it("evicts the oldest entries beyond the bound (F5)", () => {
    const map = new Map<string, number>();
    setBounded(map, "a", 1, 2);
    setBounded(map, "b", 2, 2);
    setBounded(map, "c", 3, 2);
    expect([...map.keys()]).toEqual(["b", "c"]);
    setBounded(map, "b", 22, 2); // re-insert refreshes recency
    setBounded(map, "d", 4, 2);
    expect([...map.entries()]).toEqual([
      ["b", 22],
      ["d", 4],
    ]);
  });

  it("keeps the default bound finite for long-lived servers (F5)", () => {
    const map = new Map<string, number>();
    for (let i = 0; i < CACHE_MAX_ENTRIES + 10; i += 1) setBounded(map, `k${i}`, i);
    expect(map.size).toBe(CACHE_MAX_ENTRIES);
    expect(map.has("k0")).toBe(false);
  });
});

describe("plugin-context: storage guard order", () => {
  function fakeContext(directory: string): {
    writes: Array<[string, unknown]>;
    ctx: Parameters<typeof onToolAfter>[0];
  } {
    const writes: Array<[string, unknown]> = [];
    const ctx: Parameters<typeof onToolAfter>[0] = {
      location: { directory },
      storage: {
        get: async () => undefined,
        set: async (key, value) => {
          writes.push([key, value]);
        },
        remove: async () => undefined,
      },
    };
    return { writes, ctx };
  }

  it("writes nothing when the tree has no tasks/ directory (F4)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-guard-outside-"));
    try {
      const { writes, ctx } = fakeContext(directory);
      await onToolAfter(ctx, {
        status: "completed",
        sessionID: "ses-guard",
        tool: "shell",
        input: { command: "arggon show task-x" },
      });
      expect(writes).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("correlates an observed invocation once tasks/ exists (F4)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "arggon-guard-inside-"));
    try {
      mkdirSync(join(directory, "tasks"));
      const { writes, ctx } = fakeContext(directory);
      await onToolAfter(ctx, {
        status: "completed",
        sessionID: "ses-guard",
        tool: "shell",
        input: { command: "arggon show task-x" },
      });
      expect(writes).toEqual([["arggon/session/ses-guard", "task-x"]]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
