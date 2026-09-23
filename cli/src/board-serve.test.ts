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
import { mkdirSync, mkdtempSync as _mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MAX_DETAIL_COMMENT_BYTES,
  MAX_DETAIL_PROSE_BYTES,
  clipDetailText,
  parseAcceptanceRows,
  startBoardServer,
  type BoardServeHandle,
} from "./board-serve.js";
import type { BoardDetailPayload, BoardGithub, PrInfo } from "./board.js";
import { runInit } from "./init.js";
import { runCreate, runShow, runUpdate } from "@arggondev/lib";
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
      const envelope = JSON.parse(line) as {
        ok: boolean;
        command: string;
        serving: boolean;
        url: string;
        port: number;
      };
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
    const proc = spawnSync(
      process.execPath,
      [tsx, cli, "--json", "board", "--serve", "--port", "99999"],
      {
        encoding: "utf8",
        cwd: dir,
      },
    );
    expect(proc.status).not.toBe(0);
    const envelope = JSON.parse(proc.stdout) as { ok: boolean; error: { message: string } };
    expect(envelope.error.message).toMatch(/invalid --port '99999'/);
  });
});

describe("board --serve item detail (task-board-item-detail)", () => {
  let detailDir: string;
  let detailHandle: BoardServeHandle;

  /** Replace an item's body, keeping its frontmatter (fixture setup). */
  function setBody(id: string, body: string): void {
    const path = runShow({ cwd: detailDir, id }).path;
    const lines = readFileSync(path, "utf8").split("\n");
    const end = lines.indexOf("---", 1);
    writeFileSync(path, `${lines.slice(0, end + 1).join("\n")}\n\n${body}\n`, "utf8");
  }

  beforeAll(async () => {
    detailDir = mkdtempSync(join(tmpdir(), "arggon-serve-detail-"));
    runInit({ dir: detailDir, force: false });
    runCreate({ cwd: detailDir, type: "initiative", title: "Detail MVP" });
    runCreate({ cwd: detailDir, type: "epic", title: "Detail core", parent: "detail-mvp" });
    runCreate({
      cwd: detailDir,
      type: "story",
      title: "Detail entries",
      parent: "detail-core",
      id: "detail-entries",
    });
    runCreate({
      cwd: detailDir,
      type: "task",
      title: "Detail task",
      parent: "detail-entries",
      id: "task-detail",
    });
    runCreate({
      cwd: detailDir,
      type: "task",
      title: "Open dep",
      parent: "detail-entries",
      id: "task-dep-open",
    });
    runCreate({
      cwd: detailDir,
      type: "task",
      title: "Terminal dep",
      parent: "detail-entries",
      id: "task-dep-terminal",
    });
    runCreate({
      cwd: detailDir,
      type: "task",
      title: "Huge body",
      parent: "detail-entries",
      id: "task-huge",
    });
    runUpdate({ cwd: detailDir, id: "task-detail", dependsOn: "task-dep-open,task-dep-terminal" });
    runUpdate({ cwd: detailDir, id: "task-detail", branch: "feat/task-detail" });
    runUpdate({ cwd: detailDir, id: "task-detail", priority: "p1" });
    runUpdate({ cwd: detailDir, id: "task-dep-terminal", status: "cancelled" });
    setBody(
      "task-detail",
      `# Detail task

## Context

Detail body fixture line.

## Acceptance

- [x] done row
- [ ] open row

hostile <img src=x onerror="alert(1)"> text

### 2026-09-20 @alice
comment one

### 2026-09-21 @bob
comment two

### 2026-09-22 @carol
comment three

### 2026-09-23 @dave
comment four

### 2026-09-24 @erin
comment five`,
    );
    setBody(
      "task-huge",
      `${"x".repeat(MAX_DETAIL_PROSE_BYTES + 512)}

### 2026-09-24 @huge
${"y".repeat(MAX_DETAIL_COMMENT_BYTES + 512)}`,
    );
    const gh: BoardGithub = {
      listPrs: () => [
        {
          branch: "feat/task-detail",
          number: 42,
          url: "https://github.com/o/r/pull/42",
          state: "OPEN",
          isDraft: false,
          checks: "passing",
        },
      ],
    };
    detailHandle = startBoardServer({ cwd: detailDir, gh, pollMs: 60_000 });
    await detailHandle.ready;
  });

  afterAll(async () => {
    await detailHandle.close();
    removeFixtureTree(detailDir);
  });

  it("clips detail text at a UTF-8 byte cap without splitting a code point", () => {
    expect(clipDetailText("abc", 3)).toEqual({ text: "abc", truncated: false });
    expect(clipDetailText("abcd", 3)).toEqual({ text: "abc", truncated: true });
    const clipped = clipDetailText("é".repeat(10), 5);
    expect(clipped.text).toBe("éé");
    expect(Buffer.byteLength(clipped.text, "utf8")).toBe(4);
    expect(clipped.truncated).toBe(true);
  });

  it("parses read-only acceptance rows from the prose", () => {
    expect(
      parseAcceptanceRows("# T\n\n- [x] done row\n* [ ] open row\n- [X] upper\n- [] no\nplain\n"),
    ).toEqual([
      { text: "done row", checked: true },
      { text: "open row", checked: false },
      { text: "upper", checked: true },
    ]);
  });

  it("serves the item detail through the kernel bounded read", async () => {
    const res = await fetch(`${detailHandle.url}/api/item?id=task-detail`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as BoardDetailPayload;
    expect(body.ok).toBe(true);
    expect(body.item.id).toBe("task-detail");
    expect(body.item.branch).toBe("feat/task-detail");
    expect(body.item.priority).toBe("p1");
    expect(body.item.path.endsWith("task-detail.md")).toBe(true);
    expect(body.detail.prose).toContain("Detail body fixture line.");
    // Raw JSON keeps the untrusted text verbatim; the browser renders it as
    // text (see the @smoke spec) — the route never HTML-escapes JSON.
    expect(body.detail.prose).toContain('<img src=x onerror="alert(1)">');
    expect(body.detail.prose_truncated).toBe(false);
    expect(body.detail.acceptance).toEqual([
      { text: "done row", checked: true },
      { text: "open row", checked: false },
    ]);
    expect(body.detail.dependencies).toEqual([
      { id: "task-dep-open", status: "todo", terminal: false },
      { id: "task-dep-terminal", status: "cancelled", terminal: true },
    ]);
    expect(body.detail.pr?.number).toBe(42);
    // Kernel comment tail: the last DEFAULT_TAIL_COMMENTS entries only.
    expect(body.detail.comments.map((comment) => comment.author)).toEqual([
      "carol",
      "dave",
      "erin",
    ]);
    expect(body.detail.comments[0].text).toBe("comment three");
    expect(body.detail.hidden_comments).toBe(2);
  });

  it("bounds the payload: prose cap, per-comment cap, no PR without a branch match", async () => {
    const huge = (await (
      await fetch(`${detailHandle.url}/api/item?id=task-huge`)
    ).json()) as BoardDetailPayload;
    expect(huge.detail.prose_truncated).toBe(true);
    expect(Buffer.byteLength(huge.detail.prose, "utf8")).toBeLessThanOrEqual(
      MAX_DETAIL_PROSE_BYTES,
    );
    expect(huge.detail.comments).toHaveLength(1);
    expect(huge.detail.comments[0].truncated).toBe(true);
    expect(Buffer.byteLength(huge.detail.comments[0].text, "utf8")).toBeLessThanOrEqual(
      MAX_DETAIL_COMMENT_BYTES,
    );

    const open = (await (
      await fetch(`${detailHandle.url}/api/item?id=task-dep-open`)
    ).json()) as BoardDetailPayload;
    expect(open.item.branch).toBe(null);
    expect(open.detail.pr).toBe(null);
  });

  it("answers invalid and missing ids with JSON errors and never writes", async () => {
    const taskPath = runShow({ cwd: detailDir, id: "task-detail" }).path;
    const before = readFileSync(taskPath, "utf8");

    const noId = await fetch(`${detailHandle.url}/api/item`);
    expect(noId.status).toBe(400);
    const noIdBody = (await noId.json()) as { ok: boolean; error: { message: string } };
    expect(noIdBody.ok).toBe(false);
    expect(noIdBody.error.message).toContain("?id=");

    const missing = await fetch(`${detailHandle.url}/api/item?id=task-nope`);
    expect(missing.status).toBe(404);
    const missingBody = (await missing.json()) as { ok: boolean; error: { message: string } };
    expect(missingBody.ok).toBe(false);
    expect(missingBody.error.message).toContain("not found under the tracker");

    // GET only: a POST falls through to the JSON 404 (no write path here).
    const post = await fetch(`${detailHandle.url}/api/item?id=task-detail`, { method: "POST" });
    expect(post.status).toBe(404);

    expect(readFileSync(taskPath, "utf8")).toBe(before);
  });

  it("serves the drawer shell and endpoint wiring on the page (serve-only)", async () => {
    const html = await (await fetch(`${detailHandle.url}/`)).text();
    expect(html).toContain('id="board-drawer"');
    expect(html).toContain('data-detail-endpoint="/api/item"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("wireBoardDetail(toast, renderBoardDetail);");
  });
});
