import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { toContractWorkItem } from "./contract.js";
import { loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { STATUSES } from "./status.js";
import type { WorkItem } from "./types.js";

export const DEFAULT_BOARD_FILE = "board.html";

export type BoardOptions = {
  cwd: string;
  out?: string;
  /** ISO timestamp rendered into the header (injectable for tests). */
  generatedAt?: string;
  /** When true, overlay live GitHub PR state on cards with a `branch` (read-only). */
  github?: boolean;
  /** Injectable GitHub reader (tests pass a fake; default shells out to `gh`). */
  gh?: BoardGithub;
};

export type BoardResult = {
  root: string;
  outPath: string;
  itemCount: number;
  /** PRs matched to card branches (0 unless `github` is on). */
  prCount: number;
};

/** Live PR state for one branch, matched by head ref name. */
export type PrInfo = {
  branch: string;
  number: number;
  url: string;
  /** OPEN | MERGED | CLOSED (as reported by `gh pr list`). */
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  /** Aggregated from statusCheckRollup: no checks -> "unknown". */
  checks: "passing" | "failing" | "pending" | "unknown";
};

/** GitHub reader, injectable for tests. Never writes. */
export interface BoardGithub {
  listPrs(cwd: string): PrInfo[];
}

type GhPrJson = {
  number?: number;
  headRefName?: string;
  url?: string;
  state?: string;
  isDraft?: boolean;
  statusCheckRollup?: { status?: string; conclusion?: string | null }[];
};

function toPrInfo(entry: GhPrJson): PrInfo | null {
  if (typeof entry.number !== "number" || typeof entry.headRefName !== "string") return null;
  const state = entry.state === "MERGED" || entry.state === "CLOSED" ? entry.state : "OPEN";
  return {
    branch: entry.headRefName,
    number: entry.number,
    url: typeof entry.url === "string" ? entry.url : "",
    state,
    isDraft: entry.isDraft === true,
    checks: summarizeChecks(entry.statusCheckRollup ?? []),
  };
}

export function summarizeChecks(
  rollup: { status?: string; conclusion?: string | null }[],
): PrInfo["checks"] {
  if (rollup.length === 0) return "unknown";
  const conclusions = rollup.map((c) => (c.conclusion ?? "").toUpperCase());
  if (conclusions.some((c) => c === "FAILURE" || c === "TIMED_OUT" || c === "ACTION_REQUIRED")) {
    return "failing";
  }
  const pending = rollup.some((c) => (c.status ?? "").toUpperCase() !== "COMPLETED");
  if (pending || conclusions.some((c) => c === "" || c === "PENDING" || c === "STALE")) {
    return "pending";
  }
  return "passing";
}

function gh(args: string[], cwd: string): string {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOENT" || err.code === -2)
    ) {
      throw new Error(
        "GitHub overlay unavailable: `gh` not found (install gh and run `gh auth login`, or run plain `arggon board` for the offline snapshot)",
      );
    }
    const stderr =
      err !== null && typeof err === "object" && "stderr" in err ? String(err.stderr).trim() : "";
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `GitHub overlay unavailable${stderr ? `: ${stderr}` : ` (${message})`} (check \`gh auth status\`, or run plain \`arggon board\` for the offline snapshot)`,
    );
  }
}

export function defaultBoardGithub(): BoardGithub {
  return {
    listPrs(cwd: string): PrInfo[] {
      const out = gh(
        [
          "pr",
          "list",
          "--limit",
          "100",
          "--json",
          "number,headRefName,url,isDraft,state,statusCheckRollup",
        ],
        cwd,
      );
      if (!out) return [];
      let entries: GhPrJson[];
      try {
        entries = JSON.parse(out) as GhPrJson[];
      } catch {
        throw new Error(
          "GitHub overlay unavailable: `gh pr list` returned unparseable JSON (check `gh auth status`, or run plain `arggon board` for the offline snapshot)",
        );
      }
      if (!Array.isArray(entries)) return [];
      const prs: PrInfo[] = [];
      for (const entry of entries) {
        const pr = toPrInfo(entry);
        if (pr) prs.push(pr);
      }
      return prs;
    },
  };
}

/**
 * Load items from the shared kernel (same read path as `list`) and write a
 * static, self-contained HTML board. Read-only: nothing is read back from the
 * file, and no item in tasks/ is modified. With `github`, live PR state is
 * overlaid on cards with a `branch` (matched by head ref name); the overlay
 * never writes either.
 */
export function runBoard(opts: BoardOptions): BoardResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = loadItems(tasksDir).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let overlay = new Map<string, PrInfo>();
  if (opts.github) {
    const reader = opts.gh ?? defaultBoardGithub();
    overlay = new Map(reader.listPrs(root).map((pr) => [pr.branch, pr]));
  }
  const html = renderBoardHtml(
    items.map((item) => toContractWorkItem(item, root)),
    {
      generatedAt: opts.generatedAt ?? new Date().toISOString(),
      prs: overlay,
      live: opts.github === true,
    },
  );
  const outPath = opts.out ? resolve(opts.cwd, opts.out) : resolve(root, DEFAULT_BOARD_FILE);
  writeFileSync(outPath, html, "utf8");
  return { root, outPath, itemCount: items.length, prCount: overlay.size };
}

const TYPE_COLORS: Record<WorkItem["type"], string> = {
  initiative: "#6366f1",
  epic: "#8b5cf6",
  story: "#0ea5e9",
  task: "#10b981",
  bug: "#ef4444",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Badge for the live GitHub overlay. No branch or no matching PR -> neutral badge. */
function prBadge(pr: PrInfo | undefined): string {
  if (!pr) return `<div class="pr nopr">○ no PR</div>`;
  const kind =
    pr.state === "MERGED"
      ? "merged"
      : pr.state === "CLOSED"
        ? "closed"
        : pr.isDraft
          ? "draft"
          : "open";
  const label =
    pr.state === "MERGED"
      ? "merged"
      : pr.state === "CLOSED"
        ? "closed"
        : pr.isDraft
          ? "draft"
          : "open";
  const checks =
    pr.checks === "passing"
      ? " · ✓"
      : pr.checks === "failing"
        ? " · ✗"
        : pr.checks === "pending"
          ? " · …"
          : "";
  const text = `#${pr.number} · ${label}${checks}`;
  return pr.url
    ? `<div class="pr ${kind}"><a href="${escapeHtml(pr.url)}">${escapeHtml(text)}</a></div>`
    : `<div class="pr ${kind}">${escapeHtml(text)}</div>`;
}

/**
 * Pure renderer for the static board. Columns are the v0 statuses in enum
 * order; every card shows its own status (no rollup). All dynamic text is
 * HTML-escaped. Sorted lexicographically by id within each column.
 */
export function renderBoardHtml(
  items: WorkItem[],
  opts: { generatedAt: string; repoName?: string; prs?: Map<string, PrInfo>; live?: boolean } = {
    generatedAt: "",
  },
): string {
  const esc = escapeHtml;
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const prs = opts.prs ?? new Map<string, PrInfo>();
  // Offline snapshot stays byte-identical: the PR line only renders with the live overlay on.
  const showPr = opts.live === true;

  const columns = STATUSES.map((status) => {
    const cards = sorted
      .filter((item) => item.status === status)
      .map((item) => {
        const title = esc(item.title ?? item.id);
        const breadcrumb = item.parent ? `<div class="parent">${esc(item.parent)}</div>` : "";
        const assignee = item.assignee
          ? `<div class="assignee">@${esc(item.assignee)}</div>`
          : `<div class="assignee unassigned">unassigned</div>`;
        const branch = item.branch ? `<div class="branch">⑂ ${esc(item.branch)}</div>` : "";
        const pr = showPr ? prBadge(item.branch ? prs.get(item.branch) : undefined) : "";
        const reason = item.blocked_reason
          ? `<div class="blocked-reason">${esc(item.blocked_reason)}</div>`
          : "";
        const labels =
          item.labels.length > 0
            ? `<div class="labels">${item.labels
                .map((label) => `<span class="label">${esc(label)}</span>`)
                .join("")}</div>`
            : "";
        return `<div class="card">
  <div class="card-head"><span class="type" data-type="${esc(item.type)}" style="--type-color: ${TYPE_COLORS[item.type]}">${esc(item.type)}</span><code>${esc(item.id)}</code></div>
  <div class="title">${title}</div>
  ${breadcrumb}
  ${assignee}
  ${branch}
  ${pr}
  ${labels}
  ${reason}
</div>`;
      })
      .join("\n");
    const count = sorted.filter((item) => item.status === status).length;
    return `<section class="column" data-status="${status}">
  <h2>${status} <span class="count">${count}</span></h2>
  ${cards || '<div class="empty">—</div>'}
</section>`;
  }).join("\n");

  const counts = STATUSES.map(
    (status) => `${status}: ${sorted.filter((item) => item.status === status).length}`,
  ).join(" · ");
  const repo = opts.repoName ? ` — ${esc(opts.repoName)}` : "";
  const live = showPr ? ` · live GitHub overlay (${prs.size} PR(s))` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>arggon board${repo}</title>
<style>
:root { color-scheme: light; font-family: system-ui, sans-serif; }
body { margin: 0; padding: 16px; background: #f4f5f7; color: #1f2328; }
header { margin-bottom: 16px; }
header h1 { margin: 0 0 4px; font-size: 20px; }
header .meta { color: #59636e; font-size: 13px; }
.board { display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr)); gap: 12px; align-items: start; }
@media (max-width: 1100px) { .board { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); } }
.column { background: #ebecf0; border-radius: 8px; padding: 10px; }
.column h2 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #424a53; }
.column .count { background: #d0d4da; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
.column .empty { color: #8c919a; text-align: center; padding: 12px 0; }
.card { background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); padding: 10px; margin-bottom: 8px; font-size: 13px; }
.card:last-child { margin-bottom: 0; }
.card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.card code { font-size: 11px; color: #59636e; }
.type { background: var(--type-color); color: #fff; border-radius: 4px; padding: 1px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.title { font-weight: 600; margin-bottom: 4px; overflow-wrap: anywhere; }
.parent { color: #59636e; font-size: 11px; margin-bottom: 4px; }
.parent::before { content: "↳ "; }
.assignee { color: #424a53; font-size: 12px; }
.assignee.unassigned { color: #a0a6ad; }
.branch { color: #8250df; font-size: 12px; font-family: ui-monospace, monospace; }
.pr { font-size: 12px; margin-top: 2px; }
.pr a { color: inherit; text-decoration: none; }
.pr a:hover { text-decoration: underline; }
.pr.nopr { color: #a0a6ad; }
.pr.draft { color: #8c919a; }
.pr.open { color: #1a7f37; font-weight: 600; }
.pr.merged { color: #8250df; }
.pr.closed { color: #cf222e; }
.labels { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.label { background: #e7ebef; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
.blocked-reason { margin-top: 6px; color: #9a3412; background: #fff1e7; border-radius: 4px; padding: 4px 6px; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>arggon board${repo}</h1>
  <div class="meta">generated ${esc(opts.generatedAt)} · ${sorted.length} item(s) · ${counts} · read-only snapshot; git files under tasks/ remain the source of truth${live}</div>
</header>
<main class="board">
${columns}
</main>
</body>
</html>
`;
}

/** Posix path for human/JSON output, relative to cwd when inside it. */
export function displayPath(outPath: string, cwd: string): string {
  const rel = relative(cwd, outPath);
  // relative() only yields ".." segments when outPath sits outside cwd.
  if (rel && !rel.startsWith("..")) {
    return rel.split(sep).join("/");
  }
  return outPath.split(sep).join("/");
}
