import { writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { toContractWorkItem } from "./contract.js";
import { ghPrListJson } from "./get-open-prs.js";
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
  /** Prototype (ADR 0003): group cards within each column by `milestone`. */
  groupBy?: string;
  /** Injectable GitHub reader (tests pass a fake; default shells out to `gh`). */
  gh?: BoardGithub;
};

export type BoardResult = {
  root: string;
  outPath: string;
  itemCount: number;
  /** PRs matched to card branches (0 unless `github` is on). */
  prCount: number;
  /** Set when the board was rendered grouped (prototype: "milestone"). */
  groupBy?: "milestone";
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

export function defaultBoardGithub(): BoardGithub {
  return {
    listPrs(cwd: string): PrInfo[] {
      // Single gh invocation contract lives in get-open-prs.ts (limit + JSON);
      // this wrapper only adds the overlay UX context on failure.
      let entries: GhPrJson[];
      try {
        entries = ghPrListJson({
          cwd,
          fields: "number,headRefName,url,isDraft,state,statusCheckRollup",
        }) as GhPrJson[];
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `GitHub overlay unavailable: ${detail} (or run plain \`arggon board\` for the offline snapshot)`,
        );
      }
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
  let groupBy: BoardResult["groupBy"];
  if (opts.groupBy !== undefined) {
    if (opts.groupBy !== "milestone") {
      throw new Error(`unknown --group-by field '${opts.groupBy}' (supported: milestone)`);
    }
    groupBy = "milestone";
  }
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
      groupBy,
    },
  );
  const outPath = opts.out ? resolve(opts.cwd, opts.out) : resolve(root, DEFAULT_BOARD_FILE);
  writeFileSync(outPath, html, "utf8");
  return groupBy
    ? { root, outPath, itemCount: items.length, prCount: overlay.size, groupBy }
    : { root, outPath, itemCount: items.length, prCount: overlay.size };
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
 * Client-side drop rule, 1:1 with the CLI update path (cli/src/status.ts
 * TRANSITIONS plus the claim, claim-conflict and blocked-reason rules from
 * cli/src/update.ts). The board renderer embeds this function's compiled
 * source into the page script, so it must stay self-contained: no
 * module-scope references, no template literals (they would break the
 * surrounding HTML template). Blocked moves pass the rule here; the
 * --blocked-reason and --assignee prompts are drop-flow UI, not rules.
 * `edit.force` is always refused: the board route never honors force
 * (claim steals stay CLI-only), so a smuggled force flag cannot relax the
 * claim-conflict rule below.
 */
export function evaluateDrop(
  card: { id: string; type: string; status: string; assignee?: string | null },
  to: string,
  edit: { assignee?: string | null; force?: boolean } = {},
): { ok: boolean; reason: string } {
  const transitions: Record<string, string[]> = {
    todo: ["in_progress", "cancelled"],
    in_progress: ["blocked", "done", "cancelled", "todo"],
    blocked: ["in_progress", "cancelled"],
    done: ["todo"],
    cancelled: ["todo"],
  };
  const claimable = ["story", "task", "bug"];
  if (edit.force) {
    return {
      ok: false,
      reason: "--force is CLI-only: board edits route through the update path without force",
    };
  }
  const allowed = transitions[card.status];
  if (!allowed) {
    return { ok: false, reason: "unknown status '" + card.status + "'" };
  }
  if (to === card.status) {
    return { ok: false, reason: card.id + " is already in that column" };
  }
  if (allowed.indexOf(to) === -1) {
    return {
      ok: false,
      reason:
        "cannot transition " + card.status + " -> " + to + " (allowed: " + allowed.join(", ") + ")",
    };
  }
  // Claim steal guard, 1:1 with runUpdate: refuse reassignment of a claimed
  // item. Force is not honored here (checked above), ever.
  if (
    card.assignee &&
    claimable.indexOf(card.type) !== -1 &&
    card.status === "in_progress" &&
    edit.assignee !== undefined &&
    edit.assignee !== card.assignee
  ) {
    return {
      ok: false,
      reason:
        "claim conflict: '" +
        card.id +
        "' is claimed by '" +
        card.assignee +
        "' (status in_progress). Unclaim first (arggon update " +
        card.id +
        " --status todo) or coordinate.",
    };
  }
  const effectiveAssignee = edit.assignee !== undefined ? edit.assignee : card.assignee;
  if (to === "in_progress" && claimable.indexOf(card.type) !== -1 && !effectiveAssignee) {
    return {
      ok: false,
      reason:
        card.type +
        " '" +
        card.id +
        "' with status in_progress requires --assignee (claim first: arggon update " +
        card.id +
        " --assignee <login>)",
    };
  }
  return { ok: true, reason: "" };
}

/**
 * Pure renderer for the static board. Columns are the v0 statuses in enum
 * order; every card shows its own status (no rollup). All dynamic text is
 * HTML-escaped. Sorted lexicographically by id within each column. With
 * `groupBy: "milestone"` (ADR 0003 prototype), cards inside each column are
 * grouped under milestone headers sorted ascending; items without a
 * milestone group last under a "no milestone" header - only when the column
 * also has milestone items, so milestone-less columns render as before.
 */
export function renderBoardHtml(
  items: WorkItem[],
  opts: {
    generatedAt: string;
    repoName?: string;
    prs?: Map<string, PrInfo>;
    live?: boolean;
    groupBy?: "milestone";
  } = {
    generatedAt: "",
  },
): string {
  const esc = escapeHtml;
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const prs = opts.prs ?? new Map<string, PrInfo>();
  // Offline snapshot stays byte-identical: the PR line only renders with the live overlay on.
  const showPr = opts.live === true;
  const groupByMilestone = opts.groupBy === "milestone";

  const NO_MILESTONE = null;
  const milestoneOf = (item: WorkItem): string | null =>
    typeof item.milestone === "string" && item.milestone !== "" ? item.milestone : NO_MILESTONE;

  const columns = STATUSES.map((status) => {
    const columnItems = sorted.filter((item) => item.status === status);
    const renderCard = (item: WorkItem): string => {
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
      const milestone = milestoneOf(item)
        ? `<div class="milestone">⚑ ${esc(milestoneOf(item)!)}</div>`
        : "";
      const labels =
        item.labels.length > 0
          ? `<div class="labels">${item.labels
              .map((label) => `<span class="label">${esc(label)}</span>`)
              .join("")}</div>`
          : "";
      return `<div class="card" draggable="true" data-id="${esc(item.id)}" data-type="${esc(item.type)}" data-status="${esc(item.status)}"${item.assignee ? ` data-assignee="${esc(item.assignee)}"` : ""}${milestoneOf(item) ? ` data-milestone="${esc(milestoneOf(item)!)}"` : ""}>
  <div class="card-head"><span class="type" data-type="${esc(item.type)}" style="--type-color: ${TYPE_COLORS[item.type]}">${esc(item.type)}</span><code>${esc(item.id)}</code></div>
  <div class="title">${title}</div>
  ${breadcrumb}
  ${assignee}
  ${branch}
  ${pr}
  ${labels}
  ${milestone}
  ${reason}
</div>`;
    };

    // Groups render in this order: milestones ascending, then no-milestone.
    let groups: Array<{ key: string | null; items: WorkItem[] }>;
    if (groupByMilestone) {
      const byKey = new Map<string | null, WorkItem[]>();
      for (const item of columnItems) {
        const key = milestoneOf(item);
        const bucket = byKey.get(key);
        if (bucket) bucket.push(item);
        else byKey.set(key, [item]);
      }
      const withMilestone = [...byKey.keys()]
        .filter((key): key is string => key !== NO_MILESTONE)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((key) => ({ key, items: byKey.get(key)! }));
      const bare = byKey.get(NO_MILESTONE);
      groups =
        bare && withMilestone.length > 0
          ? [...withMilestone, { key: NO_MILESTONE, items: bare }]
          : bare
            ? [{ key: NO_MILESTONE, items: bare }]
            : withMilestone;
    } else {
      groups = columnItems.length > 0 ? [{ key: NO_MILESTONE, items: columnItems }] : [];
    }

    const cards = groups
      .map(({ key, items: groupItems }) => {
        const body = groupItems.map(renderCard).join("\n");
        // The "no milestone" header only appears when it shares a column
        // with milestone groups; a milestone-less column renders as before.
        if (key === NO_MILESTONE && groups.length === 1) return body;
        const label = key === NO_MILESTONE ? "no milestone" : `⚑ ${esc(key)}`;
        const cls = key === NO_MILESTONE ? "mgroup-head none" : "mgroup-head";
        return `<div class="${cls}">${label}</div>\n${body}`;
      })
      .join("\n");
    return `<section class="column" data-status="${status}">
  <h2>${status} <span class="count">${columnItems.length}</span></h2>
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
.milestone { color: #0550ae; font-size: 12px; margin-top: 2px; }
.mgroup-head { margin: 10px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #0550ae; }
.mgroup-head:first-child { margin-top: 0; }
.mgroup-head.none { color: #8c919a; }
.card[draggable="true"] { cursor: grab; }
.card.dragging { opacity: 0.5; }
.column.over { outline: 2px dashed #8c919a; outline-offset: -4px; }
#board-toast { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); max-width: 80%; background: #424a53; color: #fff; border-radius: 6px; padding: 8px 14px; font-size: 13px; display: none; z-index: 10; box-shadow: 0 2px 8px rgb(0 0 0 / 0.3); }
#board-toast.show { display: block; }
#board-toast.refused { background: #cf222e; }
#board-toast.ok { background: #1a7f37; }
</style>
</head>
<body>
<header>
  <h1>arggon board${repo}</h1>
  <div class="meta">generated ${esc(opts.generatedAt)} · ${sorted.length} item(s) · <span id="status-counts">${counts}</span> · git files under tasks/ remain the source of truth; drops persist only against a live server (arggon board --serve)${live}</div>
</header>
<main class="board">
${columns}
</main>
<div id="board-toast" role="status" aria-live="polite"></div>
<script>
'use strict';
${evaluateDrop.toString()}
(function () {
  var ENDPOINT = document.body.getAttribute("data-update-endpoint") || "/api/update";
  var toastTimer = null;
  function toast(message, kind) {
    var el = document.getElementById("board-toast");
    el.textContent = message;
    el.className = "show " + (kind || "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ""; }, 6000);
  }
  function columnFor(status) {
    return document.querySelector('.column[data-status="' + status + '"]');
  }
  function refreshCounts() {
    var parts = [];
    document.querySelectorAll(".column").forEach(function (col) {
      var n = col.querySelectorAll(".card").length;
      col.querySelector(".count").textContent = String(n);
      parts.push(col.getAttribute("data-status") + ": " + n);
    });
    var metaCounts = document.getElementById("status-counts");
    if (metaCounts) metaCounts.textContent = parts.join(" · ");
  }
  function normalizeEmpties() {
    document.querySelectorAll(".column").forEach(function (col) {
      var empty = col.querySelector(".empty");
      if (col.querySelectorAll(".card").length === 0) {
        if (!empty) {
          var d = document.createElement("div");
          d.className = "empty";
          d.textContent = "—";
          col.appendChild(d);
        }
      } else if (empty) {
        empty.remove();
      }
    });
  }
  var dragged = null;
  document.addEventListener("dragstart", function (e) {
    var card = e.target && e.target.closest ? e.target.closest(".card") : null;
    if (!card) return;
    dragged = card;
    card.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.getAttribute("data-id"));
    }
  });
  document.addEventListener("dragend", function () {
    document.querySelectorAll(".card.dragging").forEach(function (c) { c.classList.remove("dragging"); });
    document.querySelectorAll(".column.over").forEach(function (c) { c.classList.remove("over"); });
    dragged = null;
  });
  document.querySelectorAll(".column").forEach(function (col) {
    col.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      col.classList.add("over");
    });
    col.addEventListener("dragleave", function (e) {
      if (!col.contains(e.relatedTarget)) col.classList.remove("over");
    });
    col.addEventListener("drop", function (e) {
      e.preventDefault();
      col.classList.remove("over");
      var card = dragged;
      dragged = null;
      if (card) attemptMove(card, col.getAttribute("data-status"));
    });
  });
  function attemptMove(card, to) {
    var from = card.getAttribute("data-status");
    var id = card.getAttribute("data-id");
    var cardData = {
      id: id,
      type: card.getAttribute("data-type"),
      status: from,
      assignee: card.getAttribute("data-assignee")
    };
    var edit = {};
    var verdict = evaluateDrop(cardData, to, edit);
    if (!verdict.ok && verdict.reason.indexOf("requires --assignee") !== -1) {
      // Claim via board: prompt for the login, then re-run the rule with it.
      var login = window.prompt("--assignee required to claim " + id + " (GitHub login or agent id):");
      if (!login || !login.trim()) {
        toast("✗ " + verdict.reason + " (drop cancelled)", "refused");
        return;
      }
      edit.assignee = login.trim();
      verdict = evaluateDrop(cardData, to, edit);
    }
    if (!verdict.ok) {
      toast("✗ " + verdict.reason, "refused");
      return;
    }
    var reason = null;
    if (to === "blocked") {
      reason = window.prompt("--blocked-reason required to block " + id + ":");
      if (!reason || !reason.trim()) {
        toast("✗ status blocked requires --blocked-reason (drop cancelled)", "refused");
        return;
      }
      reason = reason.trim();
    }
    var anchor = card.nextSibling;
    // Never includes force: the update path must reject claim steals itself.
    var body = { id: id, status: to };
    if (reason) body.blocked_reason = reason;
    if (edit.assignee) body.assignee = edit.assignee;
    // Optimistic move; the catch below reverts it when the update call fails.
    card.setAttribute("data-status", to);
    columnFor(to).appendChild(card);
    normalizeEmpties();
    refreshCounts();
    toast("… arggon update " + id + " --status " + to, "pending");
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().catch(function () {
          return { ok: false, error: { message: "HTTP " + res.status } };
        });
      })
      .then(function (data) {
        if (data && data.ok) {
          toast("✓ " + id + " -> " + to, "ok");
          return;
        }
        throw new Error(data && data.error && data.error.message ? data.error.message : "update failed");
      })
      .catch(function (err) {
        card.setAttribute("data-status", from);
        var col = columnFor(from);
        if (anchor && anchor.parentNode === col) col.insertBefore(card, anchor);
        else col.appendChild(card);
        normalizeEmpties();
        refreshCounts();
        var message = err && err.message ? err.message : "update failed";
        if (message === "Failed to fetch") {
          message = "static snapshot: no update endpoint (serve with arggon board --serve)";
        }
        toast("✗ " + id + " not moved — " + message + " (run: arggon update " + id + " --status " + to + ")", "refused");
      });
  }
})();
</script>
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
