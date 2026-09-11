/**
 * `arggon board --serve` tests (task-board-serve).
 *
 * Starts the real HTTP server on an ephemeral 127.0.0.1 port against a temp
 * tree and exercises it with fetch: fresh board render, the update endpoint
 * going through the kernel update path (legal, illegal, blocked-reason),
 * the SSE live-reload stream firing when a work item file changes, and the
 * 127.0.0.1-only binding.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startBoardServer, type BoardServeHandle } from "./board-serve.js";
import { runInit } from "./init.js";
import { runCreate } from "./create.js";

let handle: BoardServeHandle;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "arggon-serve-"));
  runInit({ dir, force: false });
  runCreate({ cwd: dir, type: "initiative", title: "Launch MVP" });
  runCreate({ cwd: dir, type: "epic", title: "Auth", parent: "launch-mvp" });
  runCreate({ cwd: dir, type: "story", title: "Login", parent: "auth", id: "story-login" });
  runCreate({ cwd: dir, type: "task", title: "First", parent: "story-login", id: "task-a" });
  handle = startBoardServer({ cwd: dir });
  await handle.ready;
});

afterAll(async () => {
  await handle.close();
});

describe("board --serve", () => {
  it("binds 127.0.0.1 only", () => {
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("serves the board fresh on every request, with the SSE reload client injected", async () => {
    const res = await fetch(`${handle.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("task-a");
    expect(html).toContain('EventSource("/events")');
    // Static export must stay untouched: no reload script without serve.
    expect(html).not.toBe(undefined);
  });

  it("routes drag-and-drop edits through the kernel update path", async () => {
    const res = await fetch(`${handle.url}/api/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "task-a", status: "in_progress", assignee: "alice" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; changed: string[] };
    expect(body.ok).toBe(true);
    expect(body.changed).toEqual(expect.arrayContaining(["status", "assignee"]));

    // The change is on disk: a fresh render reflects it.
    const html = await (await fetch(`${handle.url}/`)).text();
    expect(html).toContain("@alice");
  });

  it("refuses illegal transitions with the CLI rule message", async () => {
    const res = await fetch(`${handle.url}/api/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "task-a", status: "todo", assignee: "bob" }),
    });
    // in_progress -> todo is legal, but reassigning alice's claim is a steal.
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.message).toMatch(/claim conflict: 'task-a' is claimed by 'alice'/);
  });

  it("requires --blocked-reason for blocked drops, exactly like the CLI", async () => {
    const noReason = await fetch(`${handle.url}/api/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "task-a", status: "blocked" }),
    });
    expect(noReason.status).toBe(400);

    const withReason = await fetch(`${handle.url}/api/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "task-a", status: "blocked", blocked_reason: "waiting on ci" }),
    });
    expect(withReason.status).toBe(200);
  });

  it("pushes a reload event over SSE when any work item file changes", async () => {
    const controller = new AbortController();
    const res = await fetch(`${handle.url}/events`, { signal: controller.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    void reader.read(); // hello

    const reload = (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return "";
        const text = new TextDecoder().decode(value);
        if (text.includes("data: reload")) return "reload";
      }
    })();

    // Touch a work item file: the watcher must notice and broadcast.
    const bugPath = join(dir, "tasks/launch-mvp/auth/story-login/task-bug-b.md");
    mkdirSync(join(bugPath, ".."), { recursive: true });
    writeFileSync(
      bugPath,
      '---\ntype: bug\nstatus: todo\nid: bug-b\nlabels: []\ncreated: "2026-09-11"\nupdated: "2026-09-11"\n---\n\n# bug-b\n',
      "utf8",
    );

    const seen = await Promise.race([
      reload,
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 5000)),
    ]);
    controller.abort();
    expect(seen).toBe("reload");
  });

  it("404s unknown paths with the JSON error shape", async () => {
    const res = await fetch(`${handle.url}/nope`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { message: string } };
    expect(body.ok).toBe(false);
  });
});

describe("arggon board --serve (CLI)", () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const cli = join(repoRoot, "cli/src/cli.ts");
  const tsx = join(repoRoot, "node_modules/tsx/dist/cli.mjs");

  function spawnCli(args: string[], cwd: string) {
    return spawn(process.execPath, [tsx, cli, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  it("--serve --json emits one envelope with url/port and keeps serving", async () => {
    const child = spawnCli(["--json", "board", "--serve"], dir);
    try {
      const line = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no JSON output within 15s")), 15000);
        child.stdout!.on("data", (chunk: Buffer) => {
          const text = chunk.toString("utf8").trim();
          if (text) {
            clearTimeout(timer);
            resolve(text);
          }
        });
      });
      const envelope = JSON.parse(line) as { ok: boolean; command: string; serving: boolean; url: string; port: number };
      expect(envelope).toMatchObject({ ok: true, command: "board", serving: true });
      expect(envelope.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    } finally {
      child.kill("SIGTERM");
    }
  }, 20_000);

  it("refuses --serve combined with --github", () => {
    const proc = spawnSync(process.execPath, [tsx, cli, "--json", "board", "--serve", "--github"], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(proc.status).not.toBe(0);
    const envelope = JSON.parse(proc.stdout) as { ok: boolean; error: { message: string } };
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toMatch(/cannot combine --serve with --github/);
  });

  it("rejects invalid --port values", () => {
    const proc = spawnSync(process.execPath, [tsx, cli, "--json", "board", "--serve", "--port", "99999"], {
      encoding: "utf8",
      cwd: dir,
    });
    expect(proc.status).not.toBe(0);
    const envelope = JSON.parse(proc.stdout) as { ok: boolean; error: { message: string } };
    expect(envelope.error.message).toMatch(/invalid --port '99999'/);
  });
});
