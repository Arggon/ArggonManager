import { watch, type FSWatcher } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  renderBoardHtml,
  defaultBoardGithub,
  type BoardDetailPayload,
  type BoardGithub,
  type PrInfo,
} from "./board.js";
import {
  buildStatusIndex,
  findTasksDir,
  loadItems,
  readConventionConfig,
  repoRootFromTasks,
  resolveCurrentLogin,
  runShow,
  runUpdate,
  toContractWorkItem,
} from "@arggondev/lib";

/**
 * `arggon board --serve` (task-board-serve): serve the static board locally
 * with live reload. Binds 127.0.0.1 only. The browser page is the same static
 * board (rendered fresh per request) plus a tiny SSE client that reloads the
 * tab whenever any tracker file changes. Edits posted by drag-and-drop
 * go through the kernel update path (runUpdate) — never raw file writes from
 * the browser, keeping "git files under the tracker are the source of truth".
 *
 * Review surface (task-board-review-surface): the served board overlays live
 * PR state (open/draft/merged + checks) and per-PR diff links on cards with a
 * `branch`, polling the shared gh read path (get-open-prs via BoardGithub) on
 * a fixed interval. Rate-limit/gh failures are swallowed: the last good PR
 * snapshot (or none) keeps rendering and cards degrade to the neutral badge —
 * the same clean degradation as the offline board.
 *
 * Item detail drawer (task-board-item-detail): `GET /api/item?id=<id>` answers
 * with the kernel bounded read (`runShow`: prose + the last 3 comments, clipped
 * to a documented per-item byte cap) plus dependency states and the cached PR
 * match, and the served page opens it on card click/Enter. Serve-only: the
 * static export stays lean and has no drawer. Read-only — the route never
 * touches the tracker.
 */

const RELOAD_SCRIPT =
  '<script>(function(){var es=new EventSource("/events");es.onmessage=function(e){if(e.data==="reload")location.reload();};})();</script>';

export type BoardServeOptions = {
  cwd: string;
  /** Port to bind on 127.0.0.1; 0 (default) picks a free ephemeral port. */
  port?: number;
  /** Group cards within each column: `milestone` (ADR 0003) or `story`. */
  groupBy?: string;
  /** Injectable GitHub reader (tests pass a fake; default shells out to `gh`). */
  gh?: BoardGithub;
  /** PR poll interval in ms (default 60_000). */
  pollMs?: number;
  /**
   * Resolved login baked into the page for `@me` in a lens/filter expression
   * (task-board-filter-lenses); default resolves once at startup like
   * `runList`'s caller. Tests inject `null` to stay hermetic.
   */
  me?: string | null;
};

export type BoardServeHandle = {
  /** Fixed loopback base URL, e.g. http://127.0.0.1:4173 */
  url: string;
  port: number;
  root: string;
  /** Resolves once the server is accepting connections. */
  ready: Promise<void>;
  /** Stops the watcher, disconnects SSE clients, closes the server. */
  close: () => Promise<void>;
};

/**
 * Per-item byte caps for the serve-mode detail drawer (task-board-item-detail):
 * the item body is prose that grows with the corpus, so the route clips it
 * before it reaches the browser (ADR 0006 spirit). The prose cap also bounds
 * the acceptance rows parsed from it; the comment cap applies per comment in
 * the kernel tail (DEFAULT_TAIL_COMMENTS entries). `prose_truncated` /
 * `comments[].truncated` tell the drawer to point at the item file.
 */
export const MAX_DETAIL_PROSE_BYTES = 8 * 1024;
export const MAX_DETAIL_COMMENT_BYTES = 4 * 1024;

/** Clip `text` to at most `maxBytes` UTF-8 bytes without splitting a code point. */
export function clipDetailText(
  text: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return { text, truncated: false };
  let bytes = 0;
  let clipped = "";
  for (const ch of text) {
    const size = Buffer.byteLength(ch, "utf8");
    if (bytes + size > maxBytes) break;
    clipped += ch;
    bytes += size;
  }
  return { text: clipped, truncated: true };
}

/** Read-only acceptance rows: `- [ ]`/`- [x]` lines of the item prose. */
export function parseAcceptanceRows(prose: string): Array<{ text: string; checked: boolean }> {
  const rows: Array<{ text: string; checked: boolean }> = [];
  for (const line of prose.split("\n")) {
    const match = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (match) rows.push({ text: match[2].trim(), checked: match[1].toLowerCase() === "x" });
  }
  return rows;
}

/**
 * Assemble the `/api/item` payload through the kernel bounded read path:
 * `runShow` (ADR 0006 — prose + the last `DEFAULT_TAIL_COMMENTS` comments,
 * never the full body) plus the shared status index for dependency states
 * (the ADR 0004 open/terminal rule; unknown ids count as open, exactly like
 * the card's blocked-by line). Pure read: no writes, no locks, no commit.
 * `id` not found throws `runShow`'s message (the route maps it to 404).
 * Cost: two kernel reads per request (O(n) over the tracker — `runShow` for
 * the item, `loadItems` for the dependency index); the route is triggered by a
 * user opening one drawer, never by the poll loop.
 */
export function buildBoardDetail(opts: {
  cwd: string;
  id: string;
  /** Live PR overlay snapshot (branch -> PrInfo); absent = no PR data. */
  prs?: Map<string, PrInfo>;
}): BoardDetailPayload {
  const shown = runShow({ cwd: opts.cwd, id: opts.id });
  const statusById = buildStatusIndex(loadItems(findTasksDir(opts.cwd)));
  const item = toContractWorkItem(shown.item, shown.root);
  const prose = clipDetailText(shown.prose, MAX_DETAIL_PROSE_BYTES);
  const comments = shown.comments.map((comment) => {
    const clipped = clipDetailText(comment.lines.join("\n"), MAX_DETAIL_COMMENT_BYTES);
    return {
      date: comment.date,
      author: comment.author,
      text: clipped.text,
      truncated: clipped.truncated,
    };
  });
  const dependencies = shown.item.dependsOn.map((depId) => {
    const entry = statusById.get(depId);
    const status = entry ? entry.status : null;
    return { id: depId, status, terminal: status === "done" || status === "cancelled" };
  });
  return {
    ok: true,
    item,
    detail: {
      prose: prose.text,
      prose_truncated: prose.truncated,
      acceptance: parseAcceptanceRows(prose.text),
      comments,
      hidden_comments: shown.allComments.length - shown.comments.length,
      dependencies,
      pr: item.branch ? (opts.prs?.get(item.branch) ?? null) : null,
    },
  };
}

export function startBoardServer(opts: BoardServeOptions): BoardServeHandle {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  let groupBy: "milestone" | "story" | undefined;
  if (opts.groupBy !== undefined) {
    if (opts.groupBy !== "milestone" && opts.groupBy !== "story") {
      throw new Error(`unknown --group-by field '${opts.groupBy}' (supported: milestone, story)`);
    }
    groupBy = opts.groupBy;
  }

  // `@me` is resolved once at startup (the same rule as runList's caller):
  // per-request resolution would shell out to gh on every reload.
  const me = opts.me !== undefined ? opts.me : (resolveCurrentLogin() ?? null);

  const clients = new Set<ServerResponse>();
  let debounce: NodeJS.Timeout | undefined;

  // Live PR overlay (task-board-review-surface): cached snapshot polled from
  // the shared gh read path. Missing gh/auth or a failed poll never breaks
  // the server — the last good snapshot keeps rendering.
  const gh: BoardGithub = opts.gh ?? defaultBoardGithub();
  const pollMs = opts.pollMs ?? 60_000;
  let prs = new Map<string, PrInfo>();

  const prsEqual = (a: Map<string, PrInfo>, b: Map<string, PrInfo>): boolean => {
    if (a.size !== b.size) return false;
    for (const [branch, info] of a) {
      const other = b.get(branch);
      if (!other) return false;
      if (
        info.number !== other.number ||
        info.state !== other.state ||
        info.isDraft !== other.isDraft ||
        info.checks !== other.checks ||
        info.url !== other.url
      ) {
        return false;
      }
    }
    return true;
  };

  /** Refresh the PR cache; returns true when the snapshot changed. */
  const refreshPrs = (): boolean => {
    try {
      const next = new Map(gh.listPrs(root).map((pr) => [pr.branch, pr]));
      const changed = !prsEqual(prs, next);
      prs = next;
      return changed;
    } catch {
      return false; // keep last good snapshot; degrade quietly
    }
  };

  const render = (): string => {
    const items = loadItems(tasksDir).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // Saved views are re-read per render (the watcher reloads on config
    // changes); a malformed convention file degrades to no chips, never a 500.
    let lenses: Record<string, string> = {};
    try {
      lenses = readConventionConfig(root).views;
    } catch {
      lenses = {};
    }
    const html = renderBoardHtml(
      items.map((item) => toContractWorkItem(item, root)),
      {
        generatedAt: new Date().toISOString(),
        groupBy,
        prs,
        live: true,
        diffLinks: true,
        lenses,
        me,
        // Serve-only item detail drawer (task-board-item-detail): cards fetch
        // `/api/item` through the kernel bounded read. The static export never
        // sets this flag and stays lean.
        details: true,
      },
    );
    // Live-reload client, injected only in serve mode; the static export
    // stays byte-identical to the plain `arggon board` output.
    return html.replace("</body>", `${RELOAD_SCRIPT}</body>`);
  };

  const broadcastReload = (): void => {
    for (const res of clients) res.write("data: reload\n\n");
  };

  const watcher: FSWatcher = watch(tasksDir, { recursive: true }, () => {
    clearTimeout(debounce);
    debounce = setTimeout(broadcastReload, 100);
  });

  // Poll gh off the accept path: the first render may precede the first
  // successful snapshot (cards show the neutral badge until data lands).
  const prPoll = setInterval(() => {
    if (refreshPrs()) broadcastReload();
  }, pollMs);
  prPoll.unref?.();
  queueMicrotask(() => {
    if (refreshPrs()) broadcastReload();
  });

  const server: Server = createServer((req, res) => {
    void route(req, res).catch((err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: { message: String(err) } }));
    });
  });

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(render());
      return;
    }
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 1000\n\n");
      res.write("data: hello\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/update") {
      const body = await readBody(req);
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(body) as Record<string, unknown>;
      } catch {
        sendUpdateError(res, 400, "request body is not valid JSON");
        return;
      }
      const id = typeof payload.id === "string" ? payload.id : undefined;
      const status = typeof payload.status === "string" ? payload.status : undefined;
      if (!id || !status) {
        sendUpdateError(res, 400, "update requires id and status");
        return;
      }
      try {
        const result = runUpdate({
          cwd: root,
          id,
          status,
          assignee: typeof payload.assignee === "string" ? payload.assignee : undefined,
          blockedReason:
            typeof payload.blocked_reason === "string" ? payload.blocked_reason : undefined,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, changed: result.changed }));
      } catch (err) {
        sendUpdateError(res, 400, err instanceof Error ? err.message : String(err));
      }
      return;
    }
    // Item detail drawer (task-board-item-detail): a pure read through the
    // kernel bounded `show` path. GET only; the browser never reads tracker
    // files, and there is no write path here.
    if (req.method === "GET" && url.pathname === "/api/item") {
      const id = (url.searchParams.get("id") ?? "").trim();
      if (!id) {
        sendUpdateError(res, 400, "item detail requires ?id=<item-id>");
        return;
      }
      try {
        const payload = buildBoardDetail({ cwd: root, id, prs });
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(payload));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("not found under the tracker")) sendUpdateError(res, 404, message);
        else sendUpdateError(res, 500, message);
      }
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: { message: `not found: ${url.pathname}` } }));
  }

  function sendUpdateError(res: ServerResponse, code: number, message: string): void {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: { message } }));
  }

  server.listen(opts.port ?? 0, "127.0.0.1");
  const ready = new Promise<void>((resolve) => server.once("listening", resolve));

  return {
    get url(): string {
      return `http://127.0.0.1:${port()}`;
    },
    get port(): number {
      return port();
    },
    root,
    ready,
    close: () => {
      watcher.close();
      clearTimeout(debounce);
      if (prPoll) clearInterval(prPoll);
      for (const res of clients) res.end();
      clients.clear();
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };

  function port(): number {
    const address = server.address() as AddressInfo | null;
    return address?.port ?? opts.port ?? 0;
  }
}

function readBody(req: IncomingMessage, limit = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(chunks.join("")));
    req.on("error", reject);
  });
}
