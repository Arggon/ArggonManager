import { spawn } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  renderBoardHtml,
  defaultBoardGithub,
  buildBoardSummary,
  buildBoardDetail,
  type BoardGithub,
  type PrInfo,
} from "./board.js";
import {
  findTasksDir,
  loadItems,
  readConventionConfig,
  repoRootFromTasks,
  resolveCurrentLogin,
  runUpdate,
  toContractWorkItem,
} from "@arggondev/lib";

/**
 * `arggon board --serve` (task-board-serve): serve the static board locally
 * with live reload. Binds 127.0.0.1 only. The browser page is the same static
 * board (rendered fresh per request) plus a tiny SSE client that reloads the
 * tab whenever any tracker file changes — preserving scroll, the filter
 * expression and an open drawer across the reload, with a connecting/live/
 * reconnecting banner on the SSE stream (task-board-live-reload-state). Edits
 * posted by drag-and-drop go through the kernel update path (runUpdate) —
 * never raw file writes from the browser, keeping "git files under the
 * tracker are the source of truth".
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
 *
 * Hardening (task-board-serve-hardening): the one mutating route,
 * `POST /api/update`, gates on `isAllowedMutatingOrigin` — loopback Host with
 * the served port, no cross-site `Sec-Fetch-Site`, and (when the client sends
 * one) a loopback `Origin` — and answers 403 otherwise; `GET /favicon.ico`
 * serves a minimal SVG glyph so the browser console stays clean, linked from
 * the served page only; `--open` best-effort launches the default browser
 * after listen (`openInBrowser`). The static export gains none of this.
 */

/**
 * Serve-mode live-reload client (task-board-live-reload-state). Injected only
 * in serve mode — the static export stays byte-identical. Three jobs:
 *
 * 1. **Connection banner** (`#board-conn`, role=status aria-live=polite):
 *    `connecting …` until the first EventSource `onopen`, `live` while the
 *    stream is up, `reconnecting — board may be stale` on `onerror` (the
 *    visual stale marker; EventSource keeps retrying on the server's
 *    `retry: 1000` and `onopen` flips the pill back to `live`). The pill's
 *    three background/text pairs (#59636e, #1a7f37, #cf222e with #fff) all
 *    clear WCAG AA 4.5:1 — the axe scan in the `@smoke` lane measures the
 *    rendered pair. It floats over the drawer's top-right corner, where the
 *    close button lives, so it is strictly passive (`pointer-events: none`) —
 *    a status pill must never intercept a click (the `@smoke` drawer test
 *    caught exactly that before the flag was added).
 * 2. **State snapshot** before every reload and **restore** after it: scroll
 *    position, the filter expression (belt and braces — the URL hash already
 *    round-trips it) and the open drawer's item id (read from the drawer's
 *    `data-item-id`, set/cleared by `wireBoardDetail`). State travels through
 *    sessionStorage (per tab, survives the reload, gone afterwards). A drawer
 *    whose card no longer exists is simply not reopened — the delete test
 *    pins that the drawer closes gracefully. Collapsed columns have no state
 *    to preserve yet (no collapse feature on the board; the upcoming column
 *    controls keep theirs in localStorage, which survives reload natively).
 * 3. **The reload itself**: still a full `location.reload()` on the SSE
 *    `reload` message — the server render stays authoritative; the snapshot
 *    is what makes it non-destructive.
 */
const RELOAD_SCRIPT = `<script>
(function () {
  'use strict';
  var KEY = "board-live-state";
  var style = document.createElement("style");
  style.textContent = "#board-conn{position:fixed;top:10px;right:10px;z-index:40;pointer-events:none;border-radius:10px;padding:2px 10px;font-size:12px;color:#fff;background:#59636e;box-shadow:0 1px 4px rgb(0 0 0 / 0.25)}#board-conn.live{background:#1a7f37}#board-conn.reconnecting{background:#cf222e}";
  document.head.appendChild(style);
  var banner = document.createElement("div");
  banner.id = "board-conn";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.className = "connecting";
  banner.textContent = "connecting …";
  document.body.appendChild(banner);
  function setBanner(state, text) {
    banner.className = state;
    banner.textContent = text;
  }
  function snapshot() {
    try {
      var drawer = document.getElementById("board-drawer");
      var input = document.getElementById("board-filter-input");
      sessionStorage.setItem(KEY, JSON.stringify({
        x: window.scrollX,
        y: window.scrollY,
        filter: input ? input.value : "",
        drawer: drawer && !drawer.hidden ? drawer.getAttribute("data-item-id") || "" : ""
      }));
    } catch (e) { /* storage unavailable: reload without restore */ }
  }
  function restore() {
    var state = null;
    try { state = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    if (!state) return;
    var input = document.getElementById("board-filter-input");
    if (state.filter && input && input.value !== state.filter) {
      input.value = state.filter;
      input.dispatchEvent(new Event("input"));
    }
    window.scrollTo(state.x || 0, state.y || 0);
    if (state.drawer) {
      var cards = document.querySelectorAll(".card[data-id]");
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].getAttribute("data-id") === state.drawer) {
          cards[i].click(); /* the user's own open path: fetch + render */
          break;
        }
      }
    }
  }
  restore();
  var es = new EventSource("/events");
  es.onopen = function () { setBanner("live", "live"); };
  es.onerror = function () { setBanner("reconnecting", "reconnecting — board may be stale"); };
  es.onmessage = function (e) {
    if (e.data !== "reload") return;
    snapshot();
    location.reload();
  };
})();
</script>`;

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
 * Detail-drawer payload surface (task-board-item-detail, moved to board.ts by
 * task-board-static-details so the static `--details` embedding shares it):
 * the byte caps, the clippers, the acceptance-row parser and the per-item
 * payload builder live beside `BoardDetailPayload` now. Re-exported here so
 * the serve surface keeps its import path.
 */
export {
  MAX_DETAIL_COMMENT_BYTES,
  MAX_DETAIL_PROSE_BYTES,
  buildBoardDetail,
  clipDetailText,
  parseAcceptanceRows,
} from "./board.js";

/**
 * Mutating-request gate for the serve endpoints (task-board-serve-hardening).
 * The server binds 127.0.0.1 only, but any local process or web page reachable
 * from the same machine can still knock on the port; the mutating route
 * therefore re-checks that the request really comes from the served origin
 * before the kernel write path runs:
 *
 * - `Host` must be the served loopback host with the served port
 *   (`127.0.0.1:<port>` / `localhost:<port>` / `[::1]:<port>`). This is the
 *   only check a non-browser client (curl, scripts) is held to.
 * - `Sec-Fetch-Site`, when the client sends it, must not be `cross-site`.
 * - `Origin`, when the client sends it, must parse to the served loopback
 *   origin — same scheme (http), same loopback host, same port. A missing or
 *   empty Origin is accepted (non-browser clients never send it); a literal
 *   `null` origin (sandboxed iframe, redirect chains) is refused.
 *
 * Every refusal answers 403 with a JSON error body; the request never reaches
 * `runUpdate`. DNS names that resolve to 127.0.0.1 do NOT pass — only the
 * literal loopback hostnames are accepted (a rebound hosts-file entry must not
 * become an origin).
 */
export function isAllowedMutatingOrigin(
  headers: { origin?: string; host?: string; secFetchSite?: string },
  port: number,
): boolean {
  const loopbackHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
  if (!headers.host || !loopbackHosts.has(headers.host)) return false;
  if (
    headers.secFetchSite &&
    !["same-origin", "same-site", "none"].includes(headers.secFetchSite)
  ) {
    return false;
  }
  if (headers.origin === undefined || headers.origin === "") return true;
  try {
    const parsed = new URL(headers.origin);
    return parsed.protocol === "http:" && loopbackHosts.has(parsed.host);
  } catch {
    return false; // includes the literal `null` origin
  }
}

/**
 * Minimal board favicon (task-board-serve-hardening): a 16x16 kanban glyph so
 * the browser tab request stops 404-ing — it was the only console error in the
 * 2026-09-22 drive. Serve-mode only; the static export is untouched.
 */
export const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
  '<rect width="16" height="16" rx="3" fill="#424a53"/>' +
  '<rect x="3" y="3" width="3.5" height="10" rx="1" fill="#ffffff"/>' +
  '<rect x="9" y="3" width="3.5" height="6.5" rx="1" fill="#1a7f37"/>' +
  "</svg>";

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
        // Summary header (task-board-progress-header): the kernel report
        // aggregation over the already-loaded items — static and serve parity.
        summary: buildBoardSummary(items),
        // Serve-only item detail drawer (task-board-item-detail): cards fetch
        // `/api/item` through the kernel bounded read. The static export never
        // sets this flag and stays lean.
        details: true,
      },
    );
    // Serve-only favicon link (task-board-serve-hardening): points at the
    // /favicon.ico route below; the static export stays byte-identical.
    return html
      .replace("<head>", '<head><link rel="icon" href="/favicon.ico">')
      .replace("</body>", `${RELOAD_SCRIPT}</body>`);
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
    // Board favicon (task-board-serve-hardening): keeps the browser console
    // clean; the static export has no such route or link.
    if (req.method === "GET" && url.pathname === "/favicon.ico") {
      res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=3600" });
      res.end(FAVICON_SVG);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/update") {
      // Mutating-route origin gate (task-board-serve-hardening): anything that
      // is not the served loopback origin is refused before the kernel write
      // path runs. Defense in depth on top of the 127.0.0.1-only binding.
      const header = (name: string): string | undefined => {
        const value = req.headers[name];
        return Array.isArray(value) ? value[0] : value;
      };
      if (
        !isAllowedMutatingOrigin(
          {
            origin: header("origin"),
            host: header("host"),
            secFetchSite: header("sec-fetch-site"),
          },
          port(),
        )
      ) {
        sendUpdateError(
          res,
          403,
          "cross-site update refused (this server mutates for loopback clients only)",
        );
        return;
      }
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

/**
 * Best-effort default-browser launch for `board --serve --open`
 * (task-board-serve-hardening). `xdg-open` / `open` / `cmd start` per platform,
 * detached, stdio discarded; spawn errors (missing binary, no desktop session)
 * are swallowed — the server keeps serving either way, which is what
 * "best-effort" means here. The launcher is injectable for tests.
 */
export function openInBrowser(
  url: string,
  platform: string = process.platform,
  spawnFn: typeof spawn = spawn,
): boolean {
  try {
    const child =
      platform === "darwin"
        ? spawnFn("open", [url], { stdio: "ignore", detached: true })
        : platform === "win32"
          ? spawnFn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true })
          : spawnFn("xdg-open", [url], { stdio: "ignore", detached: true });
    child.on("error", () => {}); // best-effort: a failed launch never breaks serving
    child.unref();
    return true;
  } catch {
    return false;
  }
}
