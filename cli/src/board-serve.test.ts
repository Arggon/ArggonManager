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
import { mkdirSync, mkdtempSync as _mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startBoardServer, type BoardServeHandle } from "./board-serve.js";
import type { BoardGithub, PrInfo } from "./board.js";
import { runInit } from "./init.js";
import { runCreate } from "./create.js";
import { removeFixtureTree } from "./test-tmp.js";

// bug-tmp-fixture-leak: track mkdtemp dirs and remove them after each test
// through the shared bounded-retry helper (test-tmp.ts) — the CLI `board
// --serve` child is only SIGTERM'd (never awaited) and servers close on
// teardown, so a still-settling fs entry must never trip the one-shot
// ENOTEMPTY race in plain recursive rmSync.
const tmpDirs: string[] = [];
function mkdtempSync(prefix: string, options?: { encoding?: "utf8" }): string {
  const dir = _mkdtempSync(prefix, options);
  tmpDirs.push(dir);
  return dir;
}

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
  for (const d of tmpDirs.splice(0)) removeFixtureTree(d);
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
    const bugPath = join(dir, "ArggonManager/launch-mvp/auth/story-login/task-bug-b.md");
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

describe("board --serve review surface (task-board-review-surface)", () => {
  function ghFake(response: PrInfo[] | Error): BoardGithub {
    return {
      listPrs: () => {
        if (response instanceof Error) throw response;
        return response;
      },
    };
  }

  function writeBranchedTask(dir: string): void {
    const taskMd = join(dir, "ArggonManager/launch-mvp/auth/story-login/task-br.md");
    mkdirSync(join(taskMd, ".."), { recursive: true });
    writeFileSync(
      taskMd,
      '---\ntype: task\nstatus: in_progress\nid: task-br\nparent: story-login\nbranch: feat/task-br\nlabels: []\ncreated: "2026-09-15"\nupdated: "2026-09-15"\n---\n\n# task-br\n',
      "utf8",
    );
  }

  it("renders PR state, checks and a diff link from the gh read path, and reloads on PR change", async () => {
    const ghDir = mkdtempSync(join(tmpdir(), "arggon-serve-gh-"));
    runInit({ dir: ghDir, force: false });
    writeBranchedTask(ghDir);
    let checks: PrInfo["checks"] = "pending";
    const gh: BoardGithub = {
      listPrs: () => [
        {
          branch: "feat/task-br",
          number: 9,
          url: "https://github.com/o/r/pull/9",
          state: "OPEN",
          isDraft: false,
          checks,
        },
      ],
    };
    const ghHandle = startBoardServer({ cwd: ghDir, gh, pollMs: 50 });
    await ghHandle.ready;
    try {
      const html = await (await fetch(`${ghHandle.url}/`)).text();
      expect(html).toContain("#9 · open · …");
      expect(html).toContain('href="https://github.com/o/r/pull/9/files"');
      expect(html).toContain("live GitHub overlay (1 PR(s))");

      // Poll picks up a checks transition and pushes a reload to SSE clients.
      const controller = new AbortController();
      const res = await fetch(`${ghHandle.url}/events`, { signal: controller.signal });
      const reader = res.body!.getReader();
      void reader.read(); // hello
      const reload = (async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) return "";
          if (new TextDecoder().decode(value).includes("data: reload")) return "reload";
        }
      })();
      checks = "passing";
      const seen = await Promise.race([
        reload,
        new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 5000)),
      ]);
      controller.abort();
      expect(seen).toBe("reload");
      const refreshed = await (await fetch(`${ghHandle.url}/`)).text();
      expect(refreshed).toContain("#9 · open · ✓");
    } finally {
      await ghHandle.close();
      removeFixtureTree(ghDir);
    }
  }, 15_000);

  it("degrades cleanly without gh (neutral badges, server keeps serving)", async () => {
    const noGhDir = mkdtempSync(join(tmpdir(), "arggon-serve-nogh-"));
    runInit({ dir: noGhDir, force: false });
    writeBranchedTask(noGhDir);
    const gh = ghFake(new Error("gh not found (install gh and run `gh auth login`)"));
    const noGhHandle = startBoardServer({ cwd: noGhDir, gh, pollMs: 50 });
    await noGhHandle.ready;
    try {
      const html = await (await fetch(`${noGhHandle.url}/`)).text();
      expect(html).toContain("○ no PR");
      expect(html).not.toContain("/files");
      expect(html).not.toContain('class="diff"');
      // Degradation never takes the server down.
      expect((await fetch(`${noGhHandle.url}/`)).status).toBe(200);
    } finally {
      await noGhHandle.close();
      removeFixtureTree(noGhDir);
    }
  }, 15_000);
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
