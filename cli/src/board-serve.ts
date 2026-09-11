import { watch, type FSWatcher } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { renderBoardHtml } from "./board.js";
import { toContractWorkItem } from "./contract.js";
import { loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { runUpdate } from "./update.js";

/**
 * `arggon board --serve` (task-board-serve): serve the static board locally
 * with live reload. Binds 127.0.0.1 only. The browser page is the same static
 * board (rendered fresh per request) plus a tiny SSE client that reloads the
 * tab whenever any file under tasks/ changes. Edits posted by drag-and-drop
 * go through the kernel update path (runUpdate) — never raw file writes from
 * the browser, keeping "git files under tasks/ are the source of truth".
 */

const RELOAD_SCRIPT =
  '<script>(function(){var es=new EventSource("/events");es.onmessage=function(e){if(e.data==="reload")location.reload();};})();</script>';

export type BoardServeOptions = {
  cwd: string;
  /** Port to bind on 127.0.0.1; 0 (default) picks a free ephemeral port. */
  port?: number;
  /** Prototype (ADR 0003): render the served board grouped by `milestone`. */
  groupBy?: string;
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

export function startBoardServer(opts: BoardServeOptions): BoardServeHandle {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  let groupBy: "milestone" | undefined;
  if (opts.groupBy !== undefined) {
    if (opts.groupBy !== "milestone") {
      throw new Error(`unknown --group-by field '${opts.groupBy}' (supported: milestone)`);
    }
    groupBy = "milestone";
  }

  const clients = new Set<ServerResponse>();
  let debounce: NodeJS.Timeout | undefined;

  const render = (): string => {
    const items = loadItems(tasksDir).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const html = renderBoardHtml(
      items.map((item) => toContractWorkItem(item, root)),
      { generatedAt: new Date().toISOString(), groupBy },
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
