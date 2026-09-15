import { mkdtempSync as _mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runCreate } from "./create.js";
import { HANDOFF_FIELD_CAP, HANDOFF_SESSION_CAP, runHandoff } from "./handoff.js";
import { runInit } from "./init.js";
import { runMcpServer } from "./mcp-server.js";
import { runValidate } from "./validate.js";

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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = join(repoRoot, "cli/src/cli.ts");
const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

const NOW = new Date("2026-09-15T12:00:00Z");

function primedTask(): { dir: string; id: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "arggon-handoff-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP", now: NOW });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp", now: NOW });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login", now: NOW });
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

describe("handoff", () => {
  it("renders the full structured section (heading + branch + open questions) on the body", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    const result = runHandoff({
      cwd: dir,
      id,
      next: "write the cascade tests",
      branch: "feat/task-handoff-command",
      openQuestions: "does the lease survive rebase?; who owns the lock file?",
      author: "arggon",
      now: NOW,
    });
    expect(result.handoff).toEqual({
      branch: "feat/task-handoff-command",
      next: "write the cascade tests",
      openQuestions: "does the lease survive rebase?; who owns the lock file?",
    });
    expect(result.comment).toEqual({
      author: "arggon",
      date: "2026-09-15",
      lines: [
        "- branch: feat/task-handoff-command",
        "- open questions: does the lease survive rebase?; who owns the lock file?",
      ],
    });
    expect(raw(path)).toBe(
      `${before}\n### handoff 2026-09-15 @arggon — next: write the cascade tests\n` +
        `- branch: feat/task-handoff-command\n` +
        `- open questions: does the lease survive rebase?; who owns the lock file?\n`,
    );
  });

  it("omits the open-questions line when not provided", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    const result = runHandoff({
      cwd: dir,
      id,
      next: "ship it",
      branch: "main",
      author: "arggon",
      now: NOW,
    });
    expect(result.handoff).toEqual({ branch: "main", next: "ship it" });
    expect(raw(path)).toBe(`${before}\n### handoff 2026-09-15 @arggon — next: ship it\n- branch: main\n`);
  });

  it("auto-detects the branch from git (falls back to 'unknown' outside git)", () => {
    const { dir, id, path } = primedTask();
    // The fixture tree is not a git repo: detection degrades to 'unknown'.
    const result = runHandoff({ cwd: dir, id, next: "step", author: "a", now: NOW });
    expect(result.handoff.branch).toBe("unknown");
    expect(raw(path)).toContain("### handoff 2026-09-15 @a — next: step\n- branch: unknown\n");
  });

  it("caps each field at HANDOFF_FIELD_CAP characters (over-long next step truncates)", () => {
    const { dir, id, path } = primedTask();
    const long = "x".repeat(HANDOFF_FIELD_CAP + 500);
    const result = runHandoff({
      cwd: dir,
      id,
      next: long,
      branch: `b`.repeat(HANDOFF_FIELD_CAP + 10),
      author: "a",
      now: NOW,
    });
    expect(result.handoff.next.length).toBe(HANDOFF_FIELD_CAP);
    expect(result.handoff.next.endsWith("…")).toBe(true);
    expect(result.handoff.branch.length).toBe(HANDOFF_FIELD_CAP);
    const body = raw(path);
    expect(body).toContain(`next: ${"x".repeat(HANDOFF_FIELD_CAP - 1)}…`);
    expect(body).not.toContain("x".repeat(HANDOFF_FIELD_CAP + 1));
  });

  it("renders the session identifier in the heading when provided (provenance)", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    const result = runHandoff({
      cwd: dir,
      id,
      next: "resume the review",
      branch: "feat/x",
      session: "sess_abc123",
      author: "arggon",
      now: NOW,
    });
    expect(result.handoff).toEqual({
      branch: "feat/x",
      next: "resume the review",
      session: "sess_abc123",
    });
    expect(raw(path)).toBe(
      `${before}\n### handoff 2026-09-15 @arggon (session: sess_abc123) — next: resume the review\n- branch: feat/x\n`,
    );
  });

  it("caps the session identifier at HANDOFF_SESSION_CAP characters", () => {
    const { dir, id, path } = primedTask();
    const long = "s".repeat(HANDOFF_SESSION_CAP + 100);
    const result = runHandoff({
      cwd: dir,
      id,
      next: "step",
      session: long,
      author: "a",
      now: NOW,
    });
    expect(result.handoff.session!.length).toBe(HANDOFF_SESSION_CAP);
    expect(result.handoff.session!.endsWith("…")).toBe(true);
    expect(raw(path)).toContain(`(session: ${"s".repeat(HANDOFF_SESSION_CAP - 1)}…)`);
  });

  it("omits the session cleanly when absent (no empty placeholder)", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    const result = runHandoff({
      cwd: dir,
      id,
      next: "ship it",
      branch: "main",
      session: "   ",
      author: "arggon",
      now: NOW,
    });
    expect(result.handoff).toEqual({ branch: "main", next: "ship it" });
    expect("session" in result.handoff).toBe(false);
    expect(raw(path)).toBe(`${before}\n### handoff 2026-09-15 @arggon — next: ship it\n- branch: main\n`);
  });

  it("fails cleanly without --next (kernel: the documented error text)", () => {
    const { dir, id } = primedTask();
    expect(() => runHandoff({ cwd: dir, id, next: "  ", author: "a", now: NOW })).toThrow(
      /handoff requires --next/,
    );
    expect(() => runHandoff({ cwd: dir, id, next: "", author: "a", now: NOW })).toThrow(
      /handoff requires --next/,
    );
  });

  it("never touches frontmatter (body-only append, no `updated` bump)", () => {
    const { dir, id, path } = primedTask();
    const before = raw(path);
    runHandoff({ cwd: dir, id, next: "resume here", branch: "feat/x", author: "a", now: NOW });
    const after = raw(path);
    expect(frontmatterOf(after)).toBe(frontmatterOf(before));
    expect(after).toBe(
      `${before}\n### handoff 2026-09-15 @a — next: resume here\n- branch: feat/x\n`,
    );
  });

  it("appends through the comment machinery: multiple handoffs stack in order", () => {
    const { dir, id, path } = primedTask();
    runHandoff({ cwd: dir, id, next: "first", branch: "b1", author: "a", now: NOW });
    runHandoff({
      cwd: dir,
      id,
      next: "second",
      openQuestions: "q?",
      author: "b",
      now: NOW,
    });
    const body = raw(path);
    expect(body).toContain("### handoff 2026-09-15 @a — next: first\n- branch: b1\n\n### handoff 2026-09-15 @b — next: second\n- branch: unknown\n- open questions: q?\n");
  });

  it("leaves the tree valid (validate passes on a handed-off tree)", () => {
    const { dir, id } = primedTask();
    runHandoff({ cwd: dir, id, next: "step", author: "a", now: NOW });
    const result = runValidate({ cwd: dir });
    expect(result.errors).toEqual([]);
  });
});

describe("handoff CLI", () => {
  it("emits the v1 envelope with handoff fields and commits via --json", () => {
    const { dir } = primedTask();
    const proc = spawnSync(
      process.execPath,
      [
        tsx,
        cli,
        "--json",
        "handoff",
        "task-rate-limit",
        "--next",
        "write the tests",
        "--branch",
        "feat/x",
        "--open-questions",
        "q1; q2",
        "--author",
        "arggon",
        "--no-commit",
      ],
      { encoding: "utf8", cwd: dir },
    );
    expect(proc.status, proc.stderr).toBe(0);
    const envelope = JSON.parse(proc.stdout) as {
      ok: boolean;
      schemaVersion: number;
      command: string;
      id: string;
      handoff: { branch: string; next: string; openQuestions?: string };
      comment: { lines: string[] };
    };
    expect(envelope).toMatchObject({
      ok: true,
      schemaVersion: 1,
      command: "handoff",
      id: "task-rate-limit",
      handoff: {
        branch: "feat/x",
        next: "write the tests",
        openQuestions: "q1; q2",
      },
    });
    expect(envelope.comment.lines).toEqual([
      "- branch: feat/x",
      "- open questions: q1; q2",
    ]);
  });

  it("passes --session through the CLI flag into the heading (provenance)", () => {
    const { dir } = primedTask();
    const proc = spawnSync(
      process.execPath,
      [
        tsx,
        cli,
        "--json",
        "handoff",
        "task-rate-limit",
        "--next",
        "resume here",
        "--branch",
        "feat/x",
        "--session",
        "sess_cli_42",
        "--author",
        "arggon",
        "--no-commit",
      ],
      { encoding: "utf8", cwd: dir },
    );
    expect(proc.status, proc.stderr).toBe(0);
    const envelope = JSON.parse(proc.stdout) as {
      handoff: { session?: string };
    };
    expect(envelope.handoff.session).toBe("sess_cli_42");
  });

  it("surfaces a missing --next as ok:false with COMMENT_FAILED (reused comment code, by design)", () => {
    const { dir } = primedTask();
    const proc = spawnSync(
      process.execPath,
      [tsx, cli, "--json", "handoff", "task-rate-limit", "--author", "a"],
      { encoding: "utf8", cwd: dir },
    );
    expect(proc.status).not.toBe(0);
    expect(JSON.parse(proc.stdout)).toMatchObject({
      ok: false,
      command: "handoff",
      error: { code: "COMMENT_FAILED", message: expect.stringMatching(/handoff requires --next/) },
    });
  });
});

describe("mcp arggon_handoff tool", () => {
  /** Minimal in-process MCP client: one server, one request at a time. */
  class Client {
    private input = new PassThrough();
    private output = new PassThrough();
    private buffer = "";
    private waiters: Array<(value: Record<string, unknown>) => void> = [];

    constructor(repoDir: string) {
      runMcpServer({ cwd: repoDir, input: this.input, output: this.output });
      this.output.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const index = this.buffer.indexOf("\n");
        if (index >= 0) {
          const line = this.buffer.slice(0, index).trim();
          this.buffer = this.buffer.slice(index + 1);
          if (!line) return;
          const message = JSON.parse(line) as { result?: Record<string, unknown> };
          this.waiters.shift()?.(message.result ?? {});
        }
      });
    }

    call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
      return new Promise((resolvePromise) => {
        this.waiters.push(resolvePromise);
        this.input.write(
          `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })}\n`,
        );
      });
    }
  }

  function envelopeOf(result: Record<string, unknown>): Record<string, unknown> {
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.type).toBe("text");
    return JSON.parse(content[0]!.text) as Record<string, unknown>;
  }

  it("appends a handoff through the arggon_handoff tool (CLI envelope shape)", async () => {
    const { dir, path } = primedTask();
    const client = new Client(dir);
    const result = await client.call("arggon_handoff", {
      id: "task-rate-limit",
      next: "resume with the cascade tests",
      branch: "feat/x",
      author: "agent-x",
    });
    expect(result.isError).toBeUndefined();
    expect(envelopeOf(result)).toMatchObject({
      ok: true,
      schemaVersion: 1,
      command: "handoff",
      id: "task-rate-limit",
      handoff: { branch: "feat/x", next: "resume with the cascade tests" },
      comment: { author: "agent-x", lines: ["- branch: feat/x"] },
    });
    expect(raw(path)).toContain(
      "### handoff 2026-09-15 @agent-x — next: resume with the cascade tests\n- branch: feat/x\n",
    );
  });

  it("renders the session identifier through the arggon_handoff tool", async () => {
    const { dir, path } = primedTask();
    const client = new Client(dir);
    const result = await client.call("arggon_handoff", {
      id: "task-rate-limit",
      next: "resume with the cascade tests",
      session: "sess_mcp_7",
      author: "agent-x",
    });
    expect(result.isError).toBeUndefined();
    expect(envelopeOf(result)).toMatchObject({
      ok: true,
      handoff: { next: "resume with the cascade tests", session: "sess_mcp_7" },
    });
    expect(raw(path)).toContain(
      "### handoff 2026-09-15 @agent-x (session: sess_mcp_7) — next: resume with the cascade tests\n",
    );
  });

  it("surfaces a missing next as a COMMENT_FAILED tool error", async () => {
    const { dir } = primedTask();
    const client = new Client(dir);
    const result = await client.call("arggon_handoff", { id: "task-rate-limit" });
    expect(result.isError).toBe(true);
    expect(envelopeOf(result)).toMatchObject({
      ok: false,
      command: "handoff",
      error: { code: "COMMENT_FAILED", message: expect.stringMatching(/handoff requires --next/) },
    });
  });
});
