import { chmodSync, mkdtempSync as _mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { runComment, runCreate, runUpdate, runValidate } from "@arggondev/lib";

import { runInit } from "./init.js";
import { satisfyAcceptance } from "../../test/acceptance.js";
import { runMcpServer } from "./mcp-server.js";
import { runCli } from "./test-spawn.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test.
const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

const NOW = new Date("2026-09-11T12:00:00Z");
const LATER = new Date("2026-09-12T12:00:00Z");

function primedTask(): { dir: string; id: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-comment-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({
    cwd: dir,
    type: "story",
    title: "Login",
    parent: "auth",
    id: "story-login",
    now: NOW,
  });
  const task = runCreate({
    cwd: dir,
    type: "task",
    title: "Add rate limiting",
    parent: "story-login",
    id: "rate-limit",
    now: NOW,
  });
  return { dir, id: task.id, path: task.path };
}

function raw(path: string): string {
  return readFileSync(path, "utf8");
}

function frontmatterOf(file: string): string {
  return file.slice(0, file.indexOf("\n---\n") + 5);
}

describe("comment", () => {
  it("appends a timestamped, author-attributed section to the body", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    const result = runComment({
      cwd: dir,
      id,
      text: "Blocked on credentials",
      author: "arggon",
      now: NOW,
    });
    expect(result.comment).toEqual({
      author: "arggon",
      date: "2026-09-11",
      lines: ["Blocked on credentials"],
    });
    expect(result.path).toBe(path);
    // Full file unchanged except the appended body section.
    expect(raw(path)).toBe(`${before}\n### 2026-09-11 @arggon\nBlocked on credentials\n`);
  });

  it("supports multiline text (one body line per input line)", () => {
    const { dir, id, path } = primedTask();
    const result = runComment({
      cwd: dir,
      id,
      text: "why blocked:\n- waiting on ops\n- next agent: ping #ops",
      author: "arggon",
      now: NOW,
    });
    expect(result.comment.lines).toEqual([
      "why blocked:",
      "- waiting on ops",
      "- next agent: ping #ops",
    ]);
    expect(raw(path)).toContain(
      "\n### 2026-09-11 @arggon\nwhy blocked:\n- waiting on ops\n- next agent: ping #ops\n",
    );
  });

  it("appends in order and separates sections with a blank line", () => {
    const { dir, id, path } = primedTask();
    runComment({ cwd: dir, id, text: "first", author: "alice", now: NOW });
    runComment({ cwd: dir, id, text: "second", author: "bob", now: LATER });
    expect(raw(path)).toContain("### 2026-09-11 @alice\nfirst\n\n### 2026-09-12 @bob\nsecond\n");
  });

  it("never touches frontmatter (no `updated` bump; body-only append)", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    // Advance the clock well past the item's `updated` date.
    runComment({
      cwd: dir,
      id,
      text: "history note on a stale item",
      author: "arggon",
      now: LATER,
    });
    const after = raw(path);
    expect(frontmatterOf(after)).toBe(frontmatterOf(before));
    expect(after).toContain('updated: "2026-09-11"');
    // The body before the comment is untouched too.
    expect(after).toBe(`${before}\n### 2026-09-12 @arggon\nhistory note on a stale item\n`);
  });

  it("works on done/cancelled items (history, not a reopen)", () => {
    const { dir, id, path } = primedTask();
    runUpdate({ cwd: dir, id, status: "in_progress", assignee: "arggon", now: NOW });
    satisfyAcceptance(dir, id);
    runUpdate({ cwd: dir, id, status: "done", now: LATER });
    const before = raw(path);
    const result = runComment({
      cwd: dir,
      id,
      text: "post-merge context for the next agent",
      author: "arggon",
      now: LATER,
    });
    expect(result.comment.date).toBe("2026-09-12");
    expect(raw(path)).toBe(
      `${before}\n### 2026-09-12 @arggon\npost-merge context for the next agent\n`,
    );
    expect(raw(path)).toContain("status: done");
  });

  it("resolves the author via GITHUB_USER when --author is omitted", () => {
    const { dir, id, path } = primedTask();
    const result = runComment({
      cwd: dir,
      id,
      text: "env-resolved",
      env: { GITHUB_USER: "octocat" },
      now: NOW,
    });
    expect(result.comment.author).toBe("octocat");
    expect(raw(path)).toContain("### 2026-09-11 @octocat\nenv-resolved\n");
  });

  it("fails with an actionable error when the author cannot be resolved", () => {
    const { dir, id } = primedTask();
    // resolveMe override simulates GITHUB_USER/GITHUB_ACTOR unset and gh unauthenticated.
    expect(() =>
      runComment({ cwd: dir, id, text: "x", resolveMe: () => undefined, now: NOW }),
    ).toThrow(/could not resolve comment author/);
    expect(() =>
      runComment({
        cwd: dir,
        id,
        text: "x",
        resolveMe: () => undefined,
        author: "  ",
        now: NOW,
      }),
    ).toThrow(/could not resolve comment author/);
  });

  // task-spawned-tests-gh-path: the error must name the ACTUAL missing
  // dependency ('gh'), and a missing author source must never mask an
  // item-id error. Each layer is exercised hermetically through a PATH
  // scoped to fake bin scripts — no host gh/git is ever consulted.
  describe("author resolution without gh (task-spawned-tests-gh-path)", () => {
    function fakeBin(name: string, script: string): string {
      const dir = mkdtempSync(join(tmpdir(), "arggon-comment-bins-"));
      const file = join(dir, name);
      writeFileSync(file, `#!/bin/sh\n${script}\n`, "utf8");
      chmodSync(file, 0o755);
      return dir;
    }

    it("names 'gh' as the missing dependency when it is not on PATH", () => {
      const { dir, id } = primedTask();
      const empty = mkdtempSync(join(tmpdir(), "arggon-comment-empty-path-"));
      expect(() => runComment({ cwd: dir, id, text: "x", env: { PATH: empty }, now: NOW })).toThrow(
        /could not resolve comment author: 'gh' not found on PATH/,
      );
    });

    it("degrades gracefully to the local git identity (documented fallback)", () => {
      const { dir, id, path } = primedTask();
      const bins = fakeBin("git", "echo local-git");
      const result = runComment({ cwd: dir, id, text: "x", env: { PATH: bins }, now: NOW });
      expect(result.comment.author).toBe("local-git");
      expect(readFileSync(path, "utf8")).toContain("### 2026-09-11 @local-git\nx\n");
    });

    it("reports the item-id error before author resolution (deterministic precedence)", () => {
      const { dir } = primedTask();
      const empty = mkdtempSync(join(tmpdir(), "arggon-comment-empty-path-"));
      expect(() =>
        runComment({ cwd: dir, id: "ghost", text: "x", env: { PATH: empty }, now: NOW }),
      ).toThrow(/id 'ghost' not found under the tracker/);
    });
  });

  it("prefers the explicit --author over env resolution", () => {
    const { dir, id, path } = primedTask();
    const result = runComment({
      cwd: dir,
      id,
      text: "explicit wins",
      author: "alice",
      env: { GITHUB_USER: "octocat" },
      now: NOW,
    });
    expect(result.comment.author).toBe("alice");
    expect(raw(path)).toContain("@alice\nexplicit wins\n");
  });

  it("rejects empty comment text", () => {
    const { dir, id } = primedTask();
    expect(() => runComment({ cwd: dir, id, text: "   \n  ", author: "a", now: NOW })).toThrow(
      /comment text must not be empty/,
    );
  });

  it("fails clearly on unknown id", () => {
    const { dir } = primedTask();
    expect(() => runComment({ cwd: dir, id: "nope", text: "x", author: "a", now: NOW })).toThrow(
      /id 'nope' not found under the tracker/,
    );
  });

  it("leaves the tree valid (validate passes on a commented tree)", () => {
    const { dir, id } = primedTask();
    runComment({ cwd: dir, id, text: "note one", author: "arggon", now: NOW });
    runComment({ cwd: dir, id, text: "note two\nmore detail", author: "octocat", now: LATER });
    const result = runValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
  });
});

describe("comment --file/stdin (task-comment-stdin-file)", () => {
  // Backticks, double quotes, $ and newlines: exactly the characters shell
  // quoting used to mangle before the text could travel outside the shell.
  const SHELLY = 'deploy `npm test` — "quoted" and $HOME and\nsecond line\n';

  it("reads comment text from a file, byte-identical (backticks, quotes, $, newlines)", () => {
    const { dir, id, path } = primedTask();
    const file = join(dir, "note.md");
    writeFileSync(file, SHELLY, "utf8");
    const before = raw(path);
    const result = runComment({ cwd: dir, id, text: "", file, author: "arggon", now: NOW });
    // Trailing file newline is trimmed by the same normalization as positional text.
    expect(result.comment.lines).toEqual([
      'deploy `npm test` — "quoted" and $HOME and',
      "second line",
    ]);
    expect(raw(path)).toBe(
      `${before}\n### 2026-09-11 @arggon\ndeploy \`npm test\` — "quoted" and $HOME and\nsecond line\n`,
    );
  });

  it("reads comment text from stdin with --file - (spawn with piped input)", () => {
    const { dir, path } = primedTask();
    const piped = 'run `npm run lint` — output was $?, "exit 1"';
    const proc = runCli(
      ["--json", "comment", "task-rate-limit", "--file", "-", "--author", "arggon"],
      dir,
      { input: piped },
    );
    expect(proc.status, proc.stderr).toBe(0);
    const envelope = JSON.parse(proc.stdout) as {
      ok: boolean;
      command: string;
      id: string;
      path: string;
    };
    expect(envelope).toMatchObject({ ok: true, command: "comment", id: "task-rate-limit" });
    // Top-level path: the absolute path of the commented item file (bug-create-path-envelope).
    expect(envelope.path).toBe(path);
    expect(
      raw(join(dir, "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md")),
    ).toContain(`@arggon\n${piped}\n`);
  });

  it("rejects passing both positional text and --file", () => {
    const { dir, id } = primedTask();
    const file = join(dir, "note.md");
    writeFileSync(file, SHELLY, "utf8");
    expect(() =>
      runComment({ cwd: dir, id, text: "positional", file, author: "a", now: NOW }),
    ).toThrow(/pass either the comment text or --file/);
  });

  it("fails with an actionable error when --file does not exist", () => {
    const { dir, id } = primedTask();
    expect(() =>
      runComment({ cwd: dir, id, text: "", file: join(dir, "missing.md"), author: "a", now: NOW }),
    ).toThrow(/--file '.*missing\.md': file not found/);
  });

  it("rejects an empty file like empty positional text", () => {
    const { dir, id } = primedTask();
    const empty = join(dir, "empty.md");
    writeFileSync(empty, "", "utf8");
    expect(() =>
      runComment({ cwd: dir, id, text: "", file: empty, author: "a", now: NOW }),
    ).toThrow(/comment text must not be empty/);
    const blank = join(dir, "blank.md");
    writeFileSync(blank, "  \n \n", "utf8");
    expect(() =>
      runComment({ cwd: dir, id, text: "", file: blank, author: "a", now: NOW }),
    ).toThrow(/comment text must not be empty/);
  });

  it("surfaces --file errors as COMMENT_FAILED through the CLI envelope", () => {
    const { dir } = primedTask();
    const both = runCli(
      ["--json", "comment", "task-rate-limit", "positional", "--file", "-", "--author", "a"],
      dir,
    );
    expect(both.status).not.toBe(0);
    expect(JSON.parse(both.stdout)).toMatchObject({
      ok: false,
      command: "comment",
      error: {
        code: "COMMENT_FAILED",
        message: expect.stringMatching(/pass either the comment text or --file/),
      },
    });

    const missing = runCli(
      ["--json", "comment", "task-rate-limit", "--file", "no-such-file.md", "--author", "a"],
      dir,
    );
    expect(missing.status).not.toBe(0);
    expect(JSON.parse(missing.stdout)).toMatchObject({
      ok: false,
      command: "comment",
      error: {
        code: "COMMENT_FAILED",
        message: expect.stringMatching(/no-such-file\.md.*file not found/),
      },
    });
  });
});

describe("mcp arggon_comment tool", () => {
  /** Minimal in-process MCP client: one server, one request at a time. */
  class Client {
    private input = new PassThrough();
    private output = new PassThrough();
    private buffer = "";
    private waiters: Array<(value: Record<string, unknown>) => void> = [];
    private nextId = 1;

    constructor(repoDir: string) {
      runMcpServer({ cwd: repoDir, input: this.input, output: this.output });
      this.output.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        let index = this.buffer.indexOf("\n");
        while (index >= 0) {
          const line = this.buffer.slice(0, index).trim();
          this.buffer = this.buffer.slice(index + 1);
          index = this.buffer.indexOf("\n");
          if (!line) continue;
          const message = JSON.parse(line) as { result?: Record<string, unknown> };
          this.waiters.shift()?.(message.result ?? {});
        }
      });
    }

    call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
      const id = this.nextId++;
      return new Promise((resolve) => {
        this.waiters.push(resolve);
        this.input.write(
          `${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })}\n`,
        );
      });
    }
  }

  function envelopeOf(result: Record<string, unknown>): Record<string, unknown> {
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.type).toBe("text");
    return JSON.parse(content[0]!.text) as Record<string, unknown>;
  }

  it("appends a comment through the arggon_comment tool (CLI envelope shape)", async () => {
    const { dir } = primedTask();
    const client = new Client(dir);
    const result = await client.call("arggon_comment", {
      id: "task-rate-limit",
      text: "handoff note",
      author: "agent-x",
    });
    expect(result.isError).toBeUndefined();
    expect(envelopeOf(result)).toMatchObject({
      ok: true,
      schemaVersion: 1,
      command: "comment",
      id: "task-rate-limit",
      comment: { author: "agent-x", date: expect.any(String), lines: ["handoff note"] },
    });
    expect(
      readFileSync(
        join(dir, "ArggonManager/launch-mvp/auth/story-login/task-rate-limit.md"),
        "utf8",
      ),
    ).toContain("@agent-x\nhandoff note\n");
  });

  it("surfaces kernel errors as COMMENT_FAILED tool errors", async () => {
    const { dir } = primedTask();
    const client = new Client(dir);
    const result = await client.call("arggon_comment", { id: "nope", text: "x" });
    expect(result.isError).toBe(true);
    expect(envelopeOf(result)).toMatchObject({
      ok: false,
      schemaVersion: 1,
      command: "comment",
      error: { message: "id 'nope' not found under the tracker", code: "COMMENT_FAILED" },
    });
  });

  it("resolves the author from the environment like the CLI", async () => {
    const { dir } = primedTask();
    const client = new Client(dir);
    const prev = process.env.GITHUB_USER;
    process.env.GITHUB_USER = "env-agent";
    try {
      const result = await client.call("arggon_comment", { id: "task-rate-limit", text: "env" });
      expect(result.isError).toBeUndefined();
      expect(envelopeOf(result).comment).toMatchObject({ author: "env-agent" });
    } finally {
      if (prev === undefined) delete process.env.GITHUB_USER;
      else process.env.GITHUB_USER = prev;
    }
  });
});
