import { writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  STATUSES,
  buildStatusIndex,
  findTasksDir,
  ghPrListJson,
  groupItemsBy,
  loadItems,
  openDependencyIds,
  readConventionConfig,
  repoRootFromTasks,
  resolveCurrentLogin,
  sortById,
  statusCounts,
  toContractWorkItem,
  type ContractWorkItem as WorkItem,
} from "@arggondev/lib";

export const DEFAULT_BOARD_FILE = "board.html";

export type BoardOptions = {
  cwd: string;
  out?: string;
  /** ISO timestamp rendered into the header (injectable for tests). */
  generatedAt?: string;
  /** When true, overlay live GitHub PR state on cards with a `branch` (read-only). */
  github?: boolean;
  /** Prototype (ADR 0003) `milestone`, or `story` (task-board-dependency-visuals): group cards within each column. */
  groupBy?: string;
  /** Injectable GitHub reader (tests pass a fake; default shells out to `gh`). */
  gh?: BoardGithub;
  /**
   * Resolved login baked into the page for `@me` in a lens/filter expression
   * (task-board-filter-lenses). Default resolves like `runList`'s caller
   * (`resolveCurrentLogin`: env, then `gh`); tests inject `null` for hermetic,
   * subprocess-free renders.
   */
  me?: string | null;
};

export type BoardResult = {
  root: string;
  outPath: string;
  itemCount: number;
  /** PRs matched to card branches (0 unless `github` is on). */
  prCount: number;
  /** Set when the board was rendered grouped ("milestone" prototype, or "story"). */
  groupBy?: "milestone" | "story";
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
 * file, and no item in the tracker is modified. With `github`, live PR state is
 * overlaid on cards with a `branch` (matched by head ref name); the overlay
 * never writes either.
 */
export function runBoard(opts: BoardOptions): BoardResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  let groupBy: BoardResult["groupBy"];
  if (opts.groupBy !== undefined) {
    if (opts.groupBy !== "milestone" && opts.groupBy !== "story") {
      throw new Error(`unknown --group-by field '${opts.groupBy}' (supported: milestone, story)`);
    }
    groupBy = opts.groupBy;
  }
  const items = sortById(loadItems(tasksDir));
  let overlay = new Map<string, PrInfo>();
  if (opts.github) {
    const reader = opts.gh ?? defaultBoardGithub();
    overlay = new Map(reader.listPrs(root).map((pr) => [pr.branch, pr]));
  }
  // Saved views (x-views) and the @me login are generation-time reads, exactly
  // like `runList --view`: the static page has no server to consult. A
  // malformed convention file degrades to no lenses (validate reports it) —
  // the board never grew a config-validation dependency.
  let lenses: Record<string, string> = {};
  try {
    lenses = readConventionConfig(root).views;
  } catch {
    lenses = {};
  }
  const me = opts.me !== undefined ? opts.me : (resolveCurrentLogin() ?? null);
  const html = renderBoardHtml(
    items.map((item) => toContractWorkItem(item, root)),
    {
      generatedAt: opts.generatedAt ?? new Date().toISOString(),
      prs: overlay,
      live: opts.github === true,
      groupBy,
      lenses,
      me,
    },
  );
  const outPath = opts.out ? resolve(opts.cwd, opts.out) : resolve(root, DEFAULT_BOARD_FILE);
  writeFileSync(outPath, html, "utf8");
  return groupBy
    ? { root, outPath, itemCount: items.length, prCount: overlay.size, groupBy }
    : { root, outPath, itemCount: items.length, prCount: overlay.size };
}

/**
 * Type badge fills. The `.type` chip paints white 10px text on these, so every
 * value is darkened from its original Tailwind-ish hue until white clears the
 * WCAG 2.2 AA text threshold of 4.5:1 (task-axe-core-browser-ci; the
 * `color-contrast` rule in the `@smoke` lane measures the rendered pair). The
 * hues are unchanged — only their lightness moved: initiative 4.47 -> 4.60,
 * epic 4.23 -> 4.60, story 2.77 -> 4.64, task 2.54 -> 4.64, bug 3.76 -> 4.60.
 */
const TYPE_COLORS: Record<WorkItem["type"], string> = {
  initiative: "#6264ed",
  epic: "#8458ea",
  story: "#0b7cb0",
  task: "#0c855d",
  bug: "#d53d3d",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Badge for the live GitHub overlay. No branch or no matching PR -> neutral
 * badge. With `diffLinks` (serve-mode review surface only), a second link to
 * the PR's files view (…/pull/<n>/files) is appended after the badge text.
 */
function prBadge(pr: PrInfo | undefined, diffLinks: boolean): string {
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
  const diff =
    diffLinks && pr.url ? ` · <a class="diff" href="${escapeHtml(pr.url)}/files">diff</a>` : "";
  return pr.url
    ? `<div class="pr ${kind}"><a href="${escapeHtml(pr.url)}">${escapeHtml(text)}</a>${diff}</div>`
    : `<div class="pr ${kind}">${escapeHtml(text)}${diff}</div>`;
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

/** Item shape the embedded board lens reads (a subset of the contract WorkItem). */
export type BoardLensItem = {
  id: string;
  title?: string | null;
  type: string;
  status: string;
  assignee?: string | null;
  labels?: string[];
  parent?: string | null;
  priority?: string | null;
};

/** Board lens verdict: the visible ids, or the actionable refusal message. */
export type BoardLensResult = { ok: true; visible: string[] } | { ok: false; error: string };

/**
 * Client-side board lens (task-board-filter-lenses): free text on id/title
 * plus the supported kernel predicates, 1:1 with `lib/src/filter.ts` for that
 * subset. The board renderer embeds this function's compiled source into the
 * page script, so it must stay self-contained: no module-scope references,
 * no template literals.
 *
 * Supported predicate fields: `type`, `status`, `label`, `assignee`,
 * `priority`, `ancestor`. Tokens without a colon are free text
 * (case-insensitive substring on id/title), ANDed with the predicates; `!`
 * negates predicates only. Quoting, `!` negation, empty-value and quote
 * errors mirror the kernel parser, and `type`/`status`/`priority` values are
 * validated like `runList` does (same messages). `assignee:@me` resolves
 * through the caller-passed `me` (the same rule as `runList`: `@me` is the
 * caller's job) and fails loudly when it cannot be resolved.
 *
 * The kernel's `parent:`, `depends-on:` and `blocked-by:` predicates (and the
 * `ready` lens) are NOT in the v1 board subset: the board renders contract
 * WorkItems (`depends_on`) while the kernel lens reads `dependsOn` — that
 * shape resolution lives in task-ui-viewmodel-contract-deps — so the board
 * refuses them with a pointer to `arggon list` instead of silently dropping
 * the dependency semantics. That divergence is asserted in
 * cli/src/board-parity.test.ts.
 */
export function applyBoardFilter(
  items: BoardLensItem[],
  expr: string,
  me?: string | null,
): BoardLensResult {
  const BOARD_FIELDS = ["type", "status", "label", "assignee", "priority", "ancestor"];
  const KERNEL_ONLY_FIELDS = ["parent", "depends-on", "blocked-by"];
  const TYPES = ["initiative", "epic", "story", "task", "bug"];
  const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"];
  const PRIORITIES = ["p0", "p1", "p2", "p3"];

  /** Split on whitespace outside single/double quotes (quotes kept), like the kernel. */
  function splitTokens(text: string): string[] {
    const tokens: string[] = [];
    let current = "";
    let quote: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      if (quote) {
        current += ch;
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        current += ch;
      } else if (/\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
      } else {
        current += ch;
      }
    }
    if (quote) throw new Error("unterminated quote in filter expression: " + text);
    if (current) tokens.push(current);
    return tokens;
  }

  /** Strip one matching pair of surrounding quotes; reject stray quotes, like the kernel. */
  function unquote(value: string, text: string): string {
    if (value.length >= 2 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      return value.slice(1, -1);
    }
    if (value.length >= 2 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
      return value.slice(1, -1);
    }
    if (value.indexOf('"') !== -1 || value.indexOf("'") !== -1) {
      throw new Error("mismatched quotes in filter expression: " + text);
    }
    return value;
  }

  function messageOf(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  function nullable(value: string | null | undefined): string | null {
    return value === undefined || value === null ? null : value;
  }

  try {
    const tokens = splitTokens(expr.trim());
    const predicates: Array<{ field: string; value: string; negated: boolean }> = [];
    const needles: string[] = [];
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      let negated = false;
      let rest = token;
      if (rest.charAt(0) === "!") {
        negated = true;
        rest = rest.slice(1);
      }
      const colon = rest.indexOf(":");
      if (colon <= 0) {
        if (negated) {
          return {
            ok: false,
            error:
              'bad filter token "' +
              token +
              '" (negation applies to field:value predicates; free text matches id/title as-is)',
          };
        }
        needles.push(unquote(rest, expr).toLowerCase());
        continue;
      }
      const field = rest.slice(0, colon);
      if (KERNEL_ONLY_FIELDS.indexOf(field) !== -1) {
        return {
          ok: false,
          error:
            'the board lens does not support "' +
            field +
            ':" (v1 subset: ' +
            BOARD_FIELDS.join(", ") +
            " plus free text on id/title; use `arggon list --filter` for parent:, depends-on: and blocked-by:)",
        };
      }
      if (BOARD_FIELDS.indexOf(field) === -1) {
        return {
          ok: false,
          error:
            'unknown filter field "' +
            field +
            '". Allowed on the board: ' +
            BOARD_FIELDS.join(", ") +
            ' (a token without ":" is free text on id/title)',
        };
      }
      let value = unquote(rest.slice(colon + 1), expr);
      if (!value) {
        return { ok: false, error: 'empty value in filter token "' + token + '"' };
      }
      if (field === "type" && TYPES.indexOf(value) === -1) {
        return { ok: false, error: 'unknown type "' + value + '". Allowed: ' + TYPES.join(", ") };
      }
      if (field === "status" && STATUSES.indexOf(value) === -1) {
        return {
          ok: false,
          error: 'unknown status "' + value + '". Allowed: ' + STATUSES.join(", "),
        };
      }
      if (field === "priority" && value !== "none" && PRIORITIES.indexOf(value) === -1) {
        return {
          ok: false,
          error: 'unknown priority "' + value + '". Allowed: ' + PRIORITIES.join(", ") + ", none",
        };
      }
      if (field === "assignee" && value === "@me") {
        if (me === undefined || me === null || me === "") {
          return {
            ok: false,
            error:
              "could not resolve @me (set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
          };
        }
        value = me;
      }
      predicates.push({ field: field, value: value, negated: negated });
    }

    // Ancestor index over the WHOLE input (like the kernel's buildAncestorIndex):
    // the parent chain only, nearest parent first, cycle-safe; the item itself
    // is never in its own chain.
    const parentOf = new Map<string, string>();
    for (let p = 0; p < items.length; p++) {
      const parentItem = items[p];
      if (parentItem.id && parentItem.parent) parentOf.set(parentItem.id, parentItem.parent);
    }
    const ancestors = new Map<string, string[]>();
    for (let a = 0; a < items.length; a++) {
      const chain: string[] = [];
      const visited = new Set<string>([items[a].id]);
      let cur = parentOf.get(items[a].id);
      while (cur !== undefined && !visited.has(cur)) {
        chain.push(cur);
        visited.add(cur);
        cur = parentOf.get(cur);
      }
      ancestors.set(items[a].id, chain);
    }

    function predicateHits(
      item: BoardLensItem,
      pred: { field: string; value: string; negated: boolean },
    ): boolean {
      let hit: boolean;
      if (pred.field === "type") hit = item.type === pred.value;
      else if (pred.field === "status") hit = item.status === pred.value;
      else if (pred.field === "assignee") hit = nullable(item.assignee) === pred.value;
      else if (pred.field === "label") hit = (item.labels || []).indexOf(pred.value) !== -1;
      else if (pred.field === "priority") {
        hit = nullable(item.priority) === (pred.value === "none" ? null : pred.value);
      } else {
        hit = (ancestors.get(item.id) || []).indexOf(pred.value) !== -1;
      }
      return pred.negated ? !hit : hit;
    }

    const visible: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let keep = true;
      for (let j = 0; j < predicates.length && keep; j++) {
        if (!predicateHits(item, predicates[j])) keep = false;
      }
      for (let k = 0; k < needles.length && keep; k++) {
        const id = String(item.id || "").toLowerCase();
        const title = String(item.title || "").toLowerCase();
        if (id.indexOf(needles[k]) === -1 && title.indexOf(needles[k]) === -1) keep = false;
      }
      if (keep) visible.push(item.id);
    }
    return { ok: true, visible: visible };
  } catch (err) {
    return { ok: false, error: messageOf(err) };
  }
}

/**
 * JSON for a `<script>` context: `<` is escaped so a title like
 * `</script><script>alert(1)</script>` cannot break out, and the two
 * line-separator code points stay valid string characters. Rendered values
 * are still JSON.parse-able by the browser.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Per-item detail payload for the serve-mode drawer (`GET /api/item`, see
 * cli/src/board-serve.ts). `item` is the contract WorkItem (the same shape the
 * board renders); `detail` carries the kernel bounded read (`show` semantics:
 * prose + the last DEFAULT_TAIL_COMMENTS comments, each field capped
 * server-side). The client renders all of it as DOM text nodes.
 */
export type BoardDetailPayload = {
  ok: true;
  item: WorkItem;
  detail: {
    prose: string;
    /** The server's per-item prose cap cut the text (acceptance rows included). */
    prose_truncated: boolean;
    acceptance: Array<{ text: string; checked: boolean }>;
    comments: Array<{ date: string; author: string; text: string; truncated: boolean }>;
    /** Comments omitted by the kernel tail (allComments - tail). */
    hidden_comments: number;
    dependencies: Array<{ id: string; status: string | null; terminal: boolean }>;
    pr: PrInfo | null;
  };
};

/**
 * Serve-only drawer chrome (task-board-item-detail). Rendered only with
 * `details: true`; the static export stays lean and byte-identical without it.
 */
const DETAIL_CSS = `
.card[tabindex="0"] { cursor: pointer; }
.card:focus-visible { outline: 2px solid #0550ae; outline-offset: 2px; }
.card-move { margin-left: auto; border: 1px solid #d0d4da; background: #fff; color: #424a53; border-radius: 4px; padding: 0 6px; font-size: 10px; font-family: inherit; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; }
.card-move:focus-visible { outline: 2px solid #0550ae; outline-offset: 2px; }
body.drawer-open { overflow: hidden; }
.drawer { position: fixed; inset: 0; z-index: 20; }
.drawer[hidden] { display: none; }
.drawer-backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.35); }
.drawer-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(560px, 92vw); background: #fff; box-shadow: -4px 0 16px rgb(0 0 0 / 0.2); padding: 16px; overflow-y: auto; }
.drawer-close { position: absolute; top: 8px; right: 10px; border: 1px solid #d0d4da; background: #fff; border-radius: 6px; width: 28px; height: 28px; font-size: 16px; line-height: 1; cursor: pointer; }
.drawer-title { margin: 0 34px 6px 0; font-size: 16px; overflow-wrap: anywhere; }
.drawer-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
.drawer-meta code { font-size: 11px; color: #59636e; }
.drawer-row { display: flex; gap: 8px; font-size: 12px; margin-top: 3px; }
.drawer-k { color: #59636e; min-width: 84px; }
.drawer-v { overflow-wrap: anywhere; }
.drawer-section { margin-top: 14px; border-top: 1px solid #e7ebef; padding-top: 10px; }
.drawer-section h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #424a53; }
.drawer-body-text { white-space: pre-wrap; font-size: 13px; overflow-wrap: anywhere; }
.drawer-check { display: flex; gap: 6px; align-items: flex-start; font-size: 13px; margin: 2px 0; }
.drawer-check input { margin-top: 2px; }
.drawer-dep { font-size: 12px; font-family: ui-monospace, monospace; overflow-wrap: anywhere; }
.drawer-dep.open { color: #9a3412; }
.drawer-dep.terminal { color: #1a7f37; }
.drawer-dep.missing { color: #cf222e; }
.drawer-note { color: #59636e; font-size: 11px; margin-top: 4px; }
.drawer-comment { margin-top: 8px; }
.drawer-who { color: #59636e; font-size: 11px; }
.drawer-panel a { color: #0550ae; }
.move-menu { position: fixed; inset: 0; z-index: 30; }
.move-menu[hidden] { display: none; }
.move-menu-backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.35); }
.move-menu-panel { position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%); background: #fff; border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.25); padding: 14px; min-width: 260px; max-width: 92vw; }
.move-menu-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; overflow-wrap: anywhere; }
.move-menu-actions { display: flex; flex-direction: column; gap: 6px; }
.move-menu-target { text-align: left; padding: 6px 10px; font-size: 13px; font-family: inherit; border: 1px solid #d0d4da; background: #fff; color: inherit; border-radius: 6px; cursor: pointer; }
.move-menu-note { color: #59636e; font-size: 12px; }
.move-menu-cancel { margin-top: 10px; padding: 4px 10px; font-size: 12px; font-family: inherit; border: 1px solid #d0d4da; background: #fff; color: inherit; border-radius: 6px; cursor: pointer; }
.move-menu-target:focus-visible, .move-menu-cancel:focus-visible { outline: 2px solid #0550ae; outline-offset: 2px; }
`;

const DRAWER_MARKUP = `<div id="board-drawer" class="drawer" hidden aria-hidden="true">
  <div class="drawer-backdrop" id="board-drawer-backdrop"></div>
  <aside class="drawer-panel" role="dialog" aria-modal="true" aria-label="item detail">
    <button type="button" class="drawer-close" id="board-drawer-close" aria-label="close item detail">×</button>
    <div id="board-drawer-body" class="drawer-body"></div>
  </aside>
</div>`;

/**
 * Serve-only card action menu shell (task-board-keyboard-a11y). One dialog for
 * the whole board; `wireBoardMoveMenu` populates it per card. Hidden at load,
 * so the ready-page axe scan never sees it.
 */
const MOVE_MENU_MARKUP = `<div id="board-move-menu" class="move-menu" hidden aria-hidden="true">
  <div class="move-menu-backdrop" id="board-move-menu-backdrop"></div>
  <div class="move-menu-panel" role="dialog" aria-modal="true" aria-label="move card">
    <div class="move-menu-title" id="board-move-menu-title"></div>
    <div class="move-menu-actions" id="board-move-menu-actions"></div>
    <button type="button" class="move-menu-cancel" id="board-move-menu-cancel">cancel</button>
  </div>
</div>`;

/**
 * Move value dialog shell (task-board-move-dialogs). Rendered on EVERY board —
 * static export and serve alike: the drop flow that replaces `window.prompt`
 * runs in both. The title, confirm label, input aria-label and inline error
 * are filled per invocation by `wireBoardMovePrompt`.
 */
const MOVE_PROMPT_MARKUP = `<div id="board-move-prompt" class="move-prompt" hidden aria-hidden="true">
  <div class="move-prompt-backdrop" id="board-move-prompt-backdrop"></div>
  <div class="move-prompt-panel" role="dialog" aria-modal="true" aria-labelledby="board-move-prompt-title">
    <div class="move-prompt-title" id="board-move-prompt-title"></div>
    <input id="board-move-prompt-input" type="text" autocomplete="off" spellcheck="false">
    <div class="move-prompt-error" id="board-move-prompt-error" role="alert"></div>
    <div class="move-prompt-actions">
      <button type="button" class="move-prompt-cancel" id="board-move-prompt-cancel">cancel</button>
      <button type="button" class="move-prompt-confirm" id="board-move-prompt-confirm">confirm</button>
    </div>
  </div>
</div>`;

/**
 * Client renderer for the serve-mode detail drawer. Embedded into the page
 * script with `toString()` (like `evaluateDrop`/`applyBoardFilter`), so it
 * must stay self-contained: no module-scope references, no template literals.
 *
 * Untrusted tracker content is rendered exclusively through `textContent` and
 * `createElement` — the body is markdown text, never HTML (a hostile
 * `<img onerror>` line stays a literal string). PR links only get an href for
 * an absolute http(s) URL.
 */
export function renderBoardDetail(container: HTMLElement, payload: BoardDetailPayload): void {
  const doc = container.ownerDocument;
  const item = payload.item || ({} as BoardDetailPayload["item"]);
  const detail = payload.detail || ({} as BoardDetailPayload["detail"]);

  function el(tag: string, className: string, text?: string): HTMLElement {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function row(key: string, value: string): HTMLElement {
    const line = el("div", "drawer-row");
    line.appendChild(el("span", "drawer-k", key));
    line.appendChild(el("span", "drawer-v", value));
    return line;
  }
  function section(title: string, className: string): HTMLElement {
    const node = el("section", "drawer-section " + className);
    node.appendChild(el("h3", "", title));
    return node;
  }

  container.textContent = "";
  container.appendChild(el("h2", "drawer-title", String(item.title || item.id || "item")));

  const meta = el("div", "drawer-meta");
  meta.appendChild(el("span", "type", String(item.type || "?")));
  if (item.priority) {
    meta.appendChild(el("span", "priority " + String(item.priority), String(item.priority)));
  }
  meta.appendChild(el("span", "status", String(item.status || "?")));
  meta.appendChild(el("code", "", String(item.id || "")));
  container.appendChild(meta);

  container.appendChild(
    row("assignee", item.assignee ? "@" + String(item.assignee) : "unassigned"),
  );
  if (item.parent) container.appendChild(row("parent", String(item.parent)));
  container.appendChild(
    row("labels", item.labels && item.labels.length > 0 ? item.labels.join(", ") : "none"),
  );
  container.appendChild(row("branch", item.branch ? String(item.branch) : "none"));
  container.appendChild(row("worktree", item.worktree_path ? String(item.worktree_path) : "none"));
  container.appendChild(row("path", String(item.path || "")));
  if (item.milestone) container.appendChild(row("milestone", String(item.milestone)));
  if (item.issue !== null && item.issue !== undefined) {
    container.appendChild(row("issue", "#" + String(item.issue)));
  }

  const depsSection = section("dependencies", "drawer-deps");
  const deps = detail.dependencies || [];
  if (deps.length === 0) depsSection.appendChild(el("div", "drawer-note", "none"));
  for (let d = 0; d < deps.length; d++) {
    const dep = deps[d];
    const state = dep.status ? String(dep.status) : "missing";
    const depClass = dep.terminal ? "terminal" : dep.status ? "open" : "missing";
    depsSection.appendChild(el("div", "drawer-dep " + depClass, String(dep.id) + " · " + state));
  }
  container.appendChild(depsSection);

  const prSection = section("pull request", "drawer-pr");
  const pr = detail.pr;
  if (pr && pr.url && /^https?:\/\//.test(String(pr.url))) {
    const link = doc.createElement("a");
    link.href = String(pr.url);
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    const checks = pr.checks && pr.checks !== "unknown" ? " · " + String(pr.checks) : "";
    link.textContent =
      "#" +
      String(pr.number) +
      " · " +
      String(pr.state || "").toLowerCase() +
      (pr.isDraft ? " · draft" : "") +
      checks;
    prSection.appendChild(link);
  } else {
    prSection.appendChild(el("div", "drawer-note", "○ no PR"));
  }
  container.appendChild(prSection);

  const acceptance = detail.acceptance || [];
  if (acceptance.length > 0) {
    const accSection = section("acceptance", "drawer-acceptance");
    for (let a = 0; a < acceptance.length; a++) {
      const check = doc.createElement("label");
      check.className = "drawer-check";
      const box = doc.createElement("input");
      box.type = "checkbox";
      box.disabled = true;
      box.checked = acceptance[a].checked === true;
      check.appendChild(box);
      check.appendChild(el("span", "", String(acceptance[a].text)));
      accSection.appendChild(check);
    }
    container.appendChild(accSection);
  }

  const bodySection = section("body", "drawer-prose");
  bodySection.appendChild(el("div", "drawer-body-text", String(detail.prose || "")));
  if (detail.prose_truncated) {
    bodySection.appendChild(
      el("div", "drawer-note", "body truncated — open the item file for the full text"),
    );
  }
  container.appendChild(bodySection);

  const comments = detail.comments || [];
  const hidden = detail.hidden_comments || 0;
  const commentsSection = section(
    "comments (" + comments.length + " of " + (comments.length + hidden) + ")",
    "drawer-comments",
  );
  if (comments.length === 0) commentsSection.appendChild(el("div", "drawer-note", "none"));
  for (let c = 0; c < comments.length; c++) {
    const comment = el("div", "drawer-comment");
    comment.appendChild(
      el("div", "drawer-who", String(comments[c].date) + " @" + String(comments[c].author)),
    );
    comment.appendChild(el("div", "drawer-body-text", String(comments[c].text)));
    if (comments[c].truncated) {
      comment.appendChild(el("div", "drawer-note", "comment truncated"));
    }
    commentsSection.appendChild(comment);
  }
  container.appendChild(commentsSection);
}

/**
 * Event wiring for the detail drawer. Embedded with `toString()` and invoked
 * as `wireBoardDetail(toast, renderBoardDetail)`; the two dependencies are
 * parameters so the function stays self-contained. Esc is captured on
 * `document` and stopped while the drawer is open, so it closes the drawer
 * before the filter input's own Escape-to-clear can run. Tab is trapped inside
 * the panel while the drawer is open (task-board-keyboard-a11y) and focus
 * returns to the opening card on close.
 */
export function wireBoardDetail(
  toast: (message: string, kind?: string) => void,
  renderDetail: (container: HTMLElement, payload: BoardDetailPayload) => void,
): void {
  const drawer = document.getElementById("board-drawer");
  const body = document.getElementById("board-drawer-body");
  const closeButton = document.getElementById("board-drawer-close");
  const backdrop = document.getElementById("board-drawer-backdrop");
  if (!drawer || !body) return;
  const drawerEl: HTMLElement = drawer;
  const bodyEl: HTMLElement = body;
  let lastCard: HTMLElement | null = null;
  let seq = 0;

  function close(restoreFocus: boolean): void {
    if (drawerEl.hidden) return;
    drawerEl.hidden = true;
    drawerEl.setAttribute("aria-hidden", "true");
    // Live reload (task-board-live-reload-state): the reload client reads the
    // open item from this attribute to reopen the drawer after the page
    // reload; closed means absent, so a deleted item cannot be reopened.
    drawerEl.removeAttribute("data-item-id");
    document.body.classList.remove("drawer-open");
    seq++;
    if (restoreFocus && lastCard && lastCard.isConnected) lastCard.focus();
  }

  function open(card: Element): void {
    const id = card.getAttribute("data-id") || "";
    if (!id) return;
    lastCard = card as HTMLElement;
    const current = ++seq;
    drawerEl.hidden = false;
    drawerEl.setAttribute("aria-hidden", "false");
    drawerEl.setAttribute("data-item-id", id);
    document.body.classList.add("drawer-open");
    bodyEl.textContent = "loading …";
    if (closeButton) closeButton.focus();
    const endpoint = document.body.getAttribute("data-detail-endpoint") || "/api/item";
    fetch(endpoint + "?id=" + encodeURIComponent(id))
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return { ok: false, error: { message: "HTTP " + res.status } };
          })
          .then(function (data: { ok?: boolean; error?: { message?: string } }) {
            return { status: res.status, data: data };
          });
      })
      .then(function (result) {
        if (current !== seq || drawerEl.hidden) return;
        if (result.data && result.data.ok) {
          renderDetail(bodyEl, result.data as BoardDetailPayload);
          return;
        }
        const message =
          result.data && result.data.error && result.data.error.message
            ? result.data.error.message
            : "detail request failed";
        if (result.status === 404) {
          close(true);
          toast("item " + id + " is gone — " + message, "refused");
          return;
        }
        bodyEl.textContent = "";
        const note = document.createElement("div");
        note.className = "drawer-note";
        note.textContent = message;
        bodyEl.appendChild(note);
      })
      .catch(function (err: { message?: string }) {
        if (current !== seq || drawerEl.hidden) return;
        bodyEl.textContent =
          "detail unavailable — " + (err && err.message ? err.message : "fetch failed");
      });
  }

  document.addEventListener("click", function (event) {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("#board-drawer")) return;
    if (target.closest("a, button, input, select, textarea")) return;
    const card = target.closest(".card");
    if (card) open(card);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
    if (!drawerEl.hidden) return;
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("a, button, input, select, textarea")) return;
    const card = target.closest(".card");
    if (!card) return;
    event.preventDefault();
    open(card);
  });

  document.addEventListener(
    "keydown",
    function (event) {
      if (drawerEl.hidden) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (drawerEl.hidden) return;
      if (event.key !== "Tab") return;
      const panel = drawerEl.querySelector(".drawer-panel") as HTMLElement | null;
      if (panel) trapBoardFocus(panel, event);
    },
    true,
  );

  if (closeButton) {
    closeButton.addEventListener("click", function () {
      close(true);
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      close(true);
    });
  }
}

/**
 * The one client-side claim-prompt classification, shared by the drag flow
 * (attemptMove) and the card move menu (task-board-keyboard-a11y): a verdict
 * that only fails for the missing --assignee is legal once the flow's claim
 * prompt answers it. Every other refusal is final. Lives beside evaluateDrop
 * so both callers run the identical rule — there is no second legality
 * implementation on the page.
 */
export function dropNeedsClaimPrompt(verdict: { ok: boolean; reason: string }): boolean {
  return !verdict.ok && verdict.reason.indexOf("requires --assignee") !== -1;
}

/**
 * Focus trap for the serve-mode dialogs (detail drawer, card move menu).
 * Embedded with `toString()` (like `wireBoardDetail`), so it must stay
 * self-contained: no module-scope references, no template literals. Cycles Tab
 * (and Shift+Tab) inside `container`; pulls focus back in when it escaped.
 */
export function trapBoardFocus(container: HTMLElement, event: Event): void {
  const focusables = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (focusables.length === 0) return;
  const active = document.activeElement;
  const first = focusables[0] as HTMLElement;
  const last = focusables[focusables.length - 1] as HTMLElement;
  const inside = active !== null && container.contains(active);
  if (!inside) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event instanceof KeyboardEvent && event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (event instanceof KeyboardEvent && !event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Roving-tabindex arrow navigation over the board's cards
 * (task-board-keyboard-a11y, serve-only). Embedded with `toString()`; must
 * stay self-contained. Up/Down move within the focused card's column, Left/
 * Right to the nearest non-empty column in that direction (keeping the row
 * position), Home/End to the first/last visible card of the column. Focus
 * moves the roving anchor with it, so Tab re-enters the board on the same
 * card. Filtered-out cards are skipped everywhere. Returns the handle the
 * filter code uses to re-seat the anchor when it gets hidden.
 */
export function wireBoardKeyboardNav(): { ensureAnchor(): void } {
  const columns: HTMLElement[] = Array.prototype.slice.call(
    document.querySelectorAll(".column"),
  ) as HTMLElement[];
  function visibleCards(column: HTMLElement): HTMLElement[] {
    // A collapsed column hides its cards (task-board-column-controls): the
    // arrow keys must skip it exactly like an empty one.
    if (column.classList.contains("collapsed")) return [];
    return Array.prototype.slice.call(
      column.querySelectorAll(".card:not(.filtered-out)"),
    ) as HTMLElement[];
  }
  function setRoving(card: HTMLElement): void {
    document.querySelectorAll(".board .card").forEach(function (element) {
      const el = element as HTMLElement;
      el.setAttribute("tabindex", el === card ? "0" : "-1");
    });
  }
  function inCollapsedColumn(card: Element): boolean {
    const column = card.closest(".column");
    return column !== null && column.classList.contains("collapsed");
  }
  function ensureAnchor(): void {
    const anchor = document.querySelector('.board .card[tabindex="0"]');
    if (anchor && !anchor.classList.contains("filtered-out") && !inCollapsedColumn(anchor)) {
      return;
    }
    const candidates = document.querySelectorAll(".board .card:not(.filtered-out)");
    for (let i = 0; i < candidates.length; i++) {
      if (!inCollapsedColumn(candidates[i])) {
        setRoving(candidates[i] as HTMLElement);
        return;
      }
    }
  }
  document.addEventListener("keydown", function (event) {
    const key = event.key;
    if (
      key !== "ArrowDown" &&
      key !== "ArrowUp" &&
      key !== "ArrowLeft" &&
      key !== "ArrowRight" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    // Never hijack the arrows of a control inside the card.
    if (target.closest("a, button, input, select, textarea")) return;
    const card = target.closest(".card") as HTMLElement | null;
    if (!card) return;
    const column = card.closest(".column") as HTMLElement | null;
    if (!column) return;
    const list = visibleCards(column);
    const index = list.indexOf(card);
    let next: HTMLElement | null = null;
    if (key === "ArrowDown") next = list[index + 1] || card;
    else if (key === "ArrowUp") next = list[index - 1] || card;
    else if (key === "Home") next = list[0] || card;
    else if (key === "End") next = list[list.length - 1] || card;
    else {
      const step = key === "ArrowRight" ? 1 : -1;
      for (let c = columns.indexOf(column) + step; c >= 0 && c < columns.length; c += step) {
        const others = visibleCards(columns[c]);
        if (others.length > 0) {
          next = others[Math.min(Math.max(index, 0), others.length - 1)];
          break;
        }
      }
    }
    if (!next || next === card) return;
    event.preventDefault();
    setRoving(next);
    next.focus();
  });
  return { ensureAnchor: ensureAnchor };
}

/**
 * Column controls (task-board-column-controls): per-column collapse toggles in
 * the column headings and a filterbar pair — hide done/cancelled and reset
 * layout. Embedded with `toString()` into EVERY board (static export and
 * serve alike — both modes must behave the same), so it must stay
 * self-contained: no module-scope references, no template literals.
 *
 * State persists in localStorage under `arggon-board-columns-v1`
 * ({ collapsed: string[], terminalHidden: boolean }) — a documented choice:
 * the layout is a per-browser view preference, not tracker data, so it never
 * touches the git files that remain the source of truth. Missing, corrupt or
 * unavailable storage degrades to the default layout on every load (a write
 * failure just means the state does not persist). The reset button restores
 * the default layout and writes it, so the reset itself persists.
 *
 * `ensureAnchor` is the roving-focus handle from `wireBoardKeyboardNav`
 * (serve mode; null in the static export): every layout application re-seats
 * the anchor, so collapsing the column that holds it never strands keyboard
 * entry into the board.
 */
export function wireBoardColumns(ensureAnchor?: (() => void) | null): void {
  const KEY = "arggon-board-columns-v1";
  const TERMINAL = ["done", "cancelled"];
  type Layout = { collapsed: string[]; terminalHidden: boolean };
  function store(state: Layout): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable or full: layout just does not persist */
    }
  }
  function load(): Layout {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Layout> | null;
      if (raw === null || typeof raw !== "object" || !Array.isArray(raw.collapsed)) {
        return { collapsed: [], terminalHidden: false };
      }
      return {
        collapsed: raw.collapsed.filter((status) => typeof status === "string"),
        terminalHidden: raw.terminalHidden === true,
      };
    } catch {
      return { collapsed: [], terminalHidden: false };
    }
  }
  function apply(state: Layout): void {
    document.querySelectorAll(".column").forEach(function (column) {
      const col = column as HTMLElement;
      const status = col.getAttribute("data-status") || "";
      const collapsed = state.collapsed.indexOf(status) !== -1;
      col.classList.toggle("collapsed", collapsed);
      col.classList.toggle(
        "terminal-hidden",
        state.terminalHidden && TERMINAL.indexOf(status) !== -1,
      );
      const button = col.querySelector(".col-toggle");
      if (button) {
        button.setAttribute("aria-expanded", collapsed ? "false" : "true");
        button.setAttribute(
          "aria-label",
          (collapsed ? "expand the " : "collapse the ") + status + " column",
        );
        button.textContent = collapsed ? "+" : "\u2013";
      }
    });
    const toggle = document.getElementById("board-terminal-toggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", state.terminalHidden ? "true" : "false");
      toggle.textContent = state.terminalHidden ? "show done/cancelled" : "hide done/cancelled";
    }
    if (ensureAnchor) ensureAnchor();
  }
  let state = load();
  apply(state);
  document.addEventListener("click", function (event) {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    const toggle = target.closest(".col-toggle") as HTMLElement | null;
    if (toggle) {
      const status = toggle.getAttribute("data-status") || "";
      const index = state.collapsed.indexOf(status);
      if (index === -1) state.collapsed.push(status);
      else state.collapsed.splice(index, 1);
      apply(state);
      store(state);
      return;
    }
    if (target.closest("#board-terminal-toggle")) {
      state.terminalHidden = !state.terminalHidden;
      apply(state);
      store(state);
      return;
    }
    if (target.closest("#board-layout-reset")) {
      state = { collapsed: [], terminalHidden: false };
      apply(state);
      store(state);
    }
  });
}

/**
 * The card action menu (task-board-keyboard-a11y, serve-only): the keyboard
 * and touch alternative to drag-and-drop. Embedded with `toString()`; must
 * stay self-contained. A tap/click on a card's `move` button — or the `m` key
 * on a focused card — opens a dialog listing ONLY the legal status transitions
 * for that card, as classified by the same `evaluateDrop` parity path drag
 * uses (a transition that `dropNeedsClaimPrompt` accepts counts, because
 * `attemptMove` completes it through the same claim prompt). Picking a target
 * runs `attemptMove` — the identical flow as a drop, prompts included. Focus
 * is trapped in the dialog and restored to the opener on close.
 */
export function wireBoardMoveMenu(attemptMove: (card: HTMLElement, to: string) => void): void {
  const menu = document.getElementById("board-move-menu");
  const title = document.getElementById("board-move-menu-title");
  const actions = document.getElementById("board-move-menu-actions");
  const cancelButton = document.getElementById("board-move-menu-cancel");
  const backdrop = document.getElementById("board-move-menu-backdrop");
  if (!menu || !title || !actions) return;
  const menuEl: HTMLElement = menu;
  const titleEl: HTMLElement = title;
  const actionsEl: HTMLElement = actions;
  let opener: HTMLElement | null = null;
  let card: HTMLElement | null = null;

  function close(restoreFocus: boolean): void {
    if (menuEl.hidden) return;
    menuEl.hidden = true;
    menuEl.setAttribute("aria-hidden", "true");
    if (restoreFocus && opener && opener.isConnected) opener.focus();
    opener = null;
    card = null;
  }

  function open(target: HTMLElement, by: HTMLElement): void {
    const id = target.getAttribute("data-id") || "";
    if (!id) return;
    opener = by;
    card = target;
    titleEl.textContent = "move " + id;
    actionsEl.textContent = "";
    let offered = 0;
    // Candidates are the rendered columns; legality is evaluateDrop's verdict
    // plus the shared claim-prompt case. Nothing else decides what is offered.
    document.querySelectorAll(".column").forEach(function (column) {
      const to = (column as HTMLElement).getAttribute("data-status") || "";
      const cardData = {
        id: id,
        type: target.getAttribute("data-type") || "",
        status: target.getAttribute("data-status") || "",
        assignee: target.getAttribute("data-assignee"),
      };
      const verdict = evaluateDrop(cardData, to, {});
      if (!verdict.ok && !dropNeedsClaimPrompt(verdict)) return;
      offered++;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "move-menu-target";
      button.setAttribute("data-target", to);
      button.textContent = "move to " + to + (verdict.ok ? "" : " (claim first)");
      button.addEventListener("click", function () {
        const moved = card;
        close(true);
        if (moved) attemptMove(moved, to);
      });
      actionsEl.appendChild(button);
    });
    if (offered === 0) {
      const note = document.createElement("div");
      note.className = "move-menu-note";
      note.textContent = "no legal status transitions for " + id;
      actionsEl.appendChild(note);
    }
    menuEl.hidden = false;
    menuEl.setAttribute("aria-hidden", "false");
    const firstTarget = actionsEl.querySelector("button");
    if (firstTarget) (firstTarget as HTMLElement).focus();
    else if (cancelButton) cancelButton.focus();
  }

  document.addEventListener("click", function (event) {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    const button = target.closest(".card-move");
    if (!button) return;
    const cardEl = button.closest(".card") as HTMLElement | null;
    if (cardEl) open(cardEl, button as HTMLElement);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "m" && event.key !== "M") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!menuEl.hidden) return;
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("a, button, input, select, textarea")) return;
    const cardEl = target.closest(".card") as HTMLElement | null;
    if (!cardEl) return;
    event.preventDefault();
    open(cardEl, target as HTMLElement);
  });

  document.addEventListener(
    "keydown",
    function (event) {
      if (menuEl.hidden) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close(true);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    function (event) {
      if (menuEl.hidden) return;
      if (event.key !== "Tab") return;
      const panel = menuEl.querySelector(".move-menu-panel") as HTMLElement | null;
      if (panel) trapBoardFocus(panel, event);
    },
    true,
  );

  if (cancelButton) {
    cancelButton.addEventListener("click", function () {
      close(true);
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      close(true);
    });
  }
}

/**
 * The move value dialog (task-board-move-dialogs): the in-page replacement
 * for the drop flow's two `window.prompt` calls. Embedded with `toString()`
 * on EVERY board (static export and serve alike — the drop flow is the same
 * in both), so it must stay self-contained: no module-scope references, no
 * template literals. `ask(title, confirmLabel, onDone)` shows one modal
 * panel: Esc, the cancel button and the backdrop resolve `onDone(null)`;
 * confirming with whitespace-only input shows the inline validation message
 * and keeps the dialog open (an assignee is required for an `in_progress`
 * claim, a non-empty reason for `blocked`); confirming with a value resolves
 * `onDone(value.trim())`. Focus is trapped in the panel (the shared
 * `trapBoardFocus`), moved to the input on open and restored to the opener
 * on close; the input is `aria-label`ed per mode and the error `role=alert`.
 */
export function wireBoardMovePrompt(): (
  title: string,
  confirmLabel: string,
  inputLabel: string,
  onDone: (value: string | null) => void,
) => void {
  const shell = document.getElementById("board-move-prompt");
  const titleEl = document.getElementById("board-move-prompt-title");
  const input = document.getElementById("board-move-prompt-input") as HTMLInputElement | null;
  const error = document.getElementById("board-move-prompt-error");
  const confirmBtn = document.getElementById(
    "board-move-prompt-confirm",
  ) as HTMLButtonElement | null;
  const cancelBtn = document.getElementById("board-move-prompt-cancel");
  const backdrop = document.getElementById("board-move-prompt-backdrop");
  if (!shell || !titleEl || !input || !error || !confirmBtn || !cancelBtn) {
    return function (title, confirmLabel, inputLabel, onDone) {
      // Degraded markup: cancel rather than fall back to a blocking prompt.
      void title;
      void confirmLabel;
      void inputLabel;
      onDone(null);
    };
  }
  const shellEl: HTMLElement = shell;
  const titleText: HTMLElement = titleEl;
  const inputEl: HTMLInputElement = input;
  const errorEl: HTMLElement = error;
  const confirmEl: HTMLButtonElement = confirmBtn;
  const cancelEl: HTMLElement = cancelBtn;
  let opener: HTMLElement | null = null;
  let onDone: ((value: string | null) => void) | null = null;

  function close(restoreFocus: boolean): void {
    if (shellEl.hidden) return;
    shellEl.hidden = true;
    shellEl.setAttribute("aria-hidden", "true");
    errorEl.textContent = "";
    errorEl.classList.remove("show");
    inputEl.value = "";
    if (restoreFocus && opener && opener.isConnected) opener.focus();
    opener = null;
    onDone = null;
  }

  function resolve(value: string | null): void {
    const done = onDone;
    close(true);
    if (done) done(value);
  }

  function ask(
    title: string,
    confirmLabel: string,
    inputLabel: string,
    done: (value: string | null) => void,
  ): void {
    if (!shellEl.hidden) return; // one dialog at a time; the pending one wins
    opener = document.activeElement as HTMLElement | null;
    onDone = done;
    titleText.textContent = title;
    confirmEl.textContent = confirmLabel;
    inputEl.setAttribute("aria-label", inputLabel);
    shellEl.hidden = false;
    shellEl.setAttribute("aria-hidden", "false");
    inputEl.focus();
  }

  confirmEl.addEventListener("click", function () {
    if (shellEl.hidden || !onDone) return;
    const value = inputEl.value.trim();
    if (!value) {
      errorEl.textContent = "a value is required (Esc or cancel aborts the move)";
      errorEl.classList.add("show");
      inputEl.focus();
      return;
    }
    resolve(value);
  });
  inputEl.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmEl.click();
    }
  });
  cancelEl.addEventListener("click", function () {
    resolve(null);
  });
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      resolve(null);
    });
  }
  document.addEventListener(
    "keydown",
    function (event) {
      if (shellEl.hidden) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      resolve(null);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    function (event) {
      if (shellEl.hidden) return;
      if (event.key !== "Tab") return;
      trapBoardFocus(shellEl.querySelector(".move-prompt-panel") as HTMLElement, event);
    },
    true,
  );
  return ask;
}

/**
 * Pure renderer for the static board. Columns are the v0 statuses in enum
 * order; every card shows its own status (no rollup). All dynamic text is
 * HTML-escaped. Sorted lexicographically by id within each column. With
 * `groupBy: "milestone"` (ADR 0003 prototype), cards inside each column are
 * grouped under milestone headers sorted ascending; items without a
 * milestone group last under a "no milestone" header - only when the column
 * also has milestone items, so milestone-less columns render as before.
 * With `groupBy: "story"` (task-board-dependency-visuals) cards group under
 * parent-story headers sorted ascending; parent-less cards render last under
 * a "no story" header only when the column also has parent groups.
 * With `live: true` (GitHub overlay) cards with a `branch` also render a PR
 * badge: state (open/draft/merged/closed) + checks summary; with
 * `diffLinks: true` (task-board-review-surface, --serve only) a second link
 * to the PR's files view is appended. Without `live` the export stays
 * badge-free and byte-identical to the plain render.
 * Cards with open dependencies (ADR 0004: deps not done/cancelled) are
 * visually distinct: a `dep-blocked` class (dimmed card) plus a
 * `blocked by N` badge, and a `↳ blocked by <id>` line per open dep;
 * terminal deps render nothing.
 * With `lenses` (task-board-filter-lenses: the tracker `x-views` map) the page
 * gains one chip per saved view (name + `name: expression` tooltip) and a
 * filter/search box over the same client-side lens for every board — static
 * export and serve alike. The active expression round-trips through the URL
 * hash (`#filter=<expr>`); `me` is the generation-time `@me` login (the
 * caller resolves it, like `runList`). Both options are additive: without
 * `lenses` the chips container is absent and the board degrades to the plain
 * export plus the filter box.
 * With `details` (task-board-item-detail, serve-only) cards become focusable
 * (`tabindex`) and the page carries the drawer shell + client script that
 * fetches `/api/item?id=<id>` (kernel bounded read) and renders it as DOM
 * text nodes. Without the flag the static export is byte-identical to the
 * pre-drawer output: no drawer markup, no endpoint wiring, no extra script.
 * Column controls (task-board-column-controls) render on EVERY board — static
 * and serve: a per-column collapse toggle in each heading (the count badge
 * stays visible when collapsed), a filterbar toggle that hides the terminal
 * done/cancelled columns, and a reset-layout button; the layout persists in
 * localStorage (`arggon-board-columns-v1`, a per-browser view preference that
 * never touches the tracker) and degrades to the default layout without it.
 * Column headings are sticky while the board scrolls.
 * The drop flow's value collection is an in-page dialog (task-board-move-dialogs)
 * on EVERY board — claiming into `in_progress` asks the assignee, moving to
 * `blocked` asks the reason; Esc/cancel aborts, focus is trapped and restored,
 * and a successful move offers an Undo toast action when the reverse
 * transition is legal under the same drop rules. There is no `window.prompt`.
 */
export function renderBoardHtml(
  items: WorkItem[],
  opts: {
    generatedAt: string;
    repoName?: string;
    prs?: Map<string, PrInfo>;
    live?: boolean;
    /** Serve-mode review surface (task-board-review-surface): add per-PR diff links. */
    diffLinks?: boolean;
    groupBy?: "milestone" | "story";
    /** Saved views (`x-views`) rendered as lens chips: view name -> filter expression. */
    lenses?: Record<string, string>;
    /** Resolved login for `@me` in an expression; null/absent = unresolved (loud error). */
    me?: string | null;
    /**
     * Serve-mode item detail drawer (task-board-item-detail): focusable cards
     * (click/Enter) plus the drawer shell and its client script, which fetches
     * `/api/item?id=<id>` (kernel bounded read) and renders the payload as DOM
     * text nodes. Serve-only, like `diffLinks`: the static export stays lean
     * and byte-identical without the flag.
     *
     * Serve-mode keyboard/touch surface (task-board-keyboard-a11y): the cards
     * carry a roving tabindex (arrow/Home/End navigation, one Tab stop for the
     * whole board), a per-card `move` button opens the card action menu (the
     * keyboard/touch alternative to drag; `m` works from a focused card), and
     * both dialogs trap focus and restore it on close. Every board — static
     * export included — renders named column landmarks and labeled cards.
     */
    details?: boolean;
  } = {
    generatedAt: "",
  },
): string {
  const esc = escapeHtml;
  const sorted = sortById(items);
  const prs = opts.prs ?? new Map<string, PrInfo>();
  // Offline snapshot stays byte-identical: the PR line only renders with the live overlay on.
  const showPr = opts.live === true;
  const diffLinks = showPr && opts.diffLinks === true;
  const groupByMilestone = opts.groupBy === "milestone";
  const groupByStory = opts.groupBy === "story";
  const lenses = opts.lenses ?? {};
  const lensNames = Object.keys(lenses);
  const me = opts.me ?? null;
  const details = opts.details === true;

  // The client-side lens filters a snapshot of the card fields that travels
  // with the page (there is no server to read the tracker from). Only the
  // fields the embedded predicate mirror reads are included.
  const lensItems: BoardLensItem[] = sorted.map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    assignee: item.assignee,
    labels: item.labels,
    parent: item.parent,
    priority: item.priority,
  }));

  // Saved views (x-views) as lens chips. Tooltip = name + expression, so the
  // predicate behind a chip is visible without leaving the board.
  const lensChips =
    lensNames.length > 0
      ? `<div class="lenses" id="board-lenses">${lensNames
          .map((name) => {
            const expr = lenses[name];
            return `<button type="button" class="lens" data-name="${esc(name)}" data-filter="${esc(expr)}" title="${esc(`${name}: ${expr}`)}">${esc(name)}</button>`;
          })
          .join("")}</div>`
      : "";

  // Dependency edges (ADR 0004) through the shared view-model (kernel rule):
  // a dep is open when it is not done/cancelled; unknown ids count as open
  // (validate flags them as UNKNOWN_DEPENDENCY).
  const statusById = buildStatusIndex(sorted);
  const openDeps = (item: WorkItem): string[] => openDependencyIds(item.depends_on, statusById);

  const NO_MILESTONE = null;
  const milestoneOf = (item: WorkItem): string | null =>
    typeof item.milestone === "string" && item.milestone !== "" ? item.milestone : NO_MILESTONE;

  // Grouping key per mode: milestone (ADR 0003) or parent story
  // (task-board-dependency-visuals). Any non-empty parent id is a group key;
  // stories without cards never render (groups are built from cards).
  const NO_GROUP = null;
  const groupKeyOf = groupByStory
    ? (item: WorkItem): string | null =>
        typeof item.parent === "string" && item.parent !== "" ? item.parent : NO_GROUP
    : (item: WorkItem): string | null => milestoneOf(item);
  const noGroupLabel = groupByStory ? "no story" : "no milestone";

  // Roving tabindex (task-board-keyboard-a11y, serve mode): exactly one card
  // carries tabindex="0" and the rest -1, so Tab reaches the board once and the
  // arrow keys (wired by wireBoardKeyboardNav) move between cards. The server
  // seeds the anchor on the first rendered card; the client script re-seats it
  // whenever a filter change hides it.
  let rovingAssigned = false;

  const columns = STATUSES.map((status) => {
    const columnItems = sorted.filter((item) => item.status === status);
    const renderCard = (item: WorkItem): string => {
      const title = esc(item.title ?? item.id);
      const breadcrumb = item.parent ? `<div class="parent">${esc(item.parent)}</div>` : "";
      const assignee = item.assignee
        ? `<div class="assignee">@${esc(item.assignee)}</div>`
        : `<div class="assignee unassigned">unassigned</div>`;
      const branch = item.branch ? `<div class="branch">⑂ ${esc(item.branch)}</div>` : "";
      const pr = showPr ? prBadge(item.branch ? prs.get(item.branch) : undefined, diffLinks) : "";
      const reason = item.blocked_reason
        ? `<div class="blocked-reason">${esc(item.blocked_reason)}</div>`
        : "";
      const milestone = milestoneOf(item)
        ? `<div class="milestone">⚑ ${esc(milestoneOf(item)!)}</div>`
        : "";
      const blocked = openDeps(item);
      const blockedBy = blocked
        .map((depId) => `<div class="blocked-by">↳ blocked by ${esc(depId)}</div>`)
        .join("\n  ");
      const blockedBadge = blocked.length
        ? `<span class="blocked-badge">blocked by ${blocked.length}</span>`
        : "";
      const labels =
        item.labels.length > 0
          ? `<div class="labels">${item.labels
              .map((label) => `<span class="label">${esc(label)}</span>`)
              .join("")}</div>`
          : "";
      // Priority chip (convention v4, spec-priority-field-008): additive —
      // unprioritized cards render byte-identical to the pre-v4 output.
      const priorityChip = item.priority
        ? `<span class="priority ${esc(item.priority)}">${esc(item.priority)}</span>`
        : "";
      // Accessible name (task-board-keyboard-a11y): a card is announced as
      // "type id: title (status, @assignee)" — the same fields the eye gets,
      // bounded to what is already on the card. Hostile values go through esc.
      const cardLabel = `${item.type} ${item.id}: ${item.title ?? item.id} (${item.status}${item.assignee ? `, @${item.assignee}` : ""})`;
      // Serve-only roving tabindex (see rovingAssigned above) and the tap/click
      // affordance for the move menu: the static export stays lean (no
      // tabindex, no button) and byte-identical apart from the ARIA labels.
      const rovingTabindex = details ? (rovingAssigned ? ' tabindex="-1"' : ' tabindex="0"') : "";
      if (details) rovingAssigned = true;
      const moveButton = details
        ? `<button type="button" class="card-move" aria-label="move ${esc(item.id)}">move</button>`
        : "";
      return `<div class="card${blocked.length ? " dep-blocked" : ""}" role="group" aria-label="${esc(cardLabel)}" draggable="true"${rovingTabindex} data-id="${esc(item.id)}" data-type="${esc(item.type)}" data-status="${esc(item.status)}"${item.assignee ? ` data-assignee="${esc(item.assignee)}"` : ""}${milestoneOf(item) ? ` data-milestone="${esc(milestoneOf(item)!)}"` : ""}>
  <div class="card-head"><span class="type" data-type="${esc(item.type)}" style="--type-color: ${TYPE_COLORS[item.type]}">${esc(item.type)}</span>${priorityChip}<code>${esc(item.id)}</code>${blockedBadge}${moveButton}</div>
  <div class="title">${title}</div>
  ${breadcrumb}
  ${assignee}
  ${branch}
  ${pr}
  ${labels}
  ${milestone}
  ${blockedBy}
  ${reason}
</div>`;
    };

    // Groups render in this order (shared view-model rule): keys ascending,
    // then the key-less group. An ungrouped column keeps a single key-less
    // bucket, which renders exactly like the plain card body.
    const groups = groupItemsBy(
      columnItems,
      groupByMilestone || groupByStory ? groupKeyOf : () => NO_GROUP,
    );

    const cards = groups
      .map(({ key, items: groupItems }) => {
        const body = groupItems.map(renderCard).join("\n");
        // The key-less header only appears when it shares a column
        // with keyed groups; a column without any key renders as before.
        if (key === NO_GROUP && groups.length === 1) return body;
        const label = key === NO_GROUP ? noGroupLabel : `⚑ ${esc(key)}`;
        const cls = key === NO_GROUP ? "mgroup-head none" : "mgroup-head";
        return `<div class="${cls}">${label}</div>\n${body}`;
      })
      .join("\n");
    // Named landmark per column (task-board-keyboard-a11y): the section's
    // aria-labelledby points at its heading, so assistive tech announces
    // "todo, region/heading" instead of an anonymous group. Statuses are the
    // unique id namespace. The collapse toggle (task-board-column-controls)
    // rides in the heading; the count badge stays visible when collapsed.
    return `<section class="column" data-status="${status}" aria-labelledby="board-column-${status}">
  <h2 id="board-column-${status}">${status} <span class="count">${columnItems.length}</span><button type="button" class="col-toggle" data-status="${status}" aria-expanded="true" aria-label="collapse the ${status} column">&ndash;</button></h2>
  ${cards || '<div class="empty">—</div>'}
</section>`;
  }).join("\n");

  const statusTotals = statusCounts(sorted);
  const counts = STATUSES.map((status) => `${status}: ${statusTotals[status]}`).join(" · ");
  const repo = opts.repoName ? ` — ${esc(opts.repoName)}` : "";
  const live = showPr ? ` · live GitHub overlay (${prs.size} PR(s))` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>arggon board${repo}</title>
<style>
/* Contrast policy (task-axe-core-browser-ci): the @smoke lane runs axe
   against this page and fails on any WCAG A/AA-tagged automated violation, so
   every foreground/background pair here is chosen to clear 4.5:1 for body text
   (WCAG 2.2 AA, 1.4.3) at the size it is actually rendered. The muted text grey
   is a single value (#666a6f) rather than several near-identical ones, because
   it has to clear the threshold on all three surfaces it appears on — the white
   card (#fff, 5.45:1), the column (#ebecf0, 4.61:1) and the dep-blocked card
   (#f6f7f9, 5.08:1). The two greys it replaced, #a0a6ad (2.46:1) and #8c919a
   (3.17:1 on the card), failed. */
:root { color-scheme: light; font-family: system-ui, sans-serif; }
body { margin: 0; padding: 16px; background: #f4f5f7; color: #1f2328; }
/* Visible keyboard focus everywhere (task-board-keyboard-a11y): one shared
   rule for every button on the page (filter clear, lens chips, serve-mode card
   and dialog buttons), matching the card focus ring. */
button:focus-visible { outline: 2px solid #0550ae; outline-offset: 2px; }
header { margin-bottom: 16px; }
header h1 { margin: 0 0 4px; font-size: 20px; }
header .meta { color: #59636e; font-size: 13px; }
.board { display: grid; grid-template-columns: repeat(5, minmax(220px, 1fr)); gap: 12px; align-items: start; }
@media (max-width: 1100px) { .board { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); } }
.column { background: #ebecf0; border-radius: 8px; padding: 10px; }
/* Sticky column headers (task-board-column-controls): the header stays
   visible while the board scrolls, pinned to the viewport top for as long as
   its column is in view. The negative margins/padding extend the header over
   the column's own padding so cards slide under an opaque surface instead of
   peeking through the gutters; the radius matches the column's top corners.
   Grid and responsive rules above are untouched. */
.column h2 { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 6px; background: #ebecf0; border-radius: 8px 8px 0 0; margin: -10px -10px 10px; padding: 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #424a53; }
.column .count { background: #d0d4da; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
.column .empty { color: #666a6f; text-align: center; padding: 12px 0; }
/* Column collapse (task-board-column-controls): a collapsed column keeps only
   its header — the count badge stays visible, cards and group heads hide. */
.column.collapsed .card, .column.collapsed .mgroup-head, .column.collapsed .empty { display: none; }
.column.terminal-hidden { display: none; }
.col-toggle { margin-left: auto; flex: 0 0 auto; border: 1px solid #d0d4da; background: #fff; color: #424a53; border-radius: 4px; width: 20px; height: 20px; font-size: 13px; line-height: 1; cursor: pointer; font-family: inherit; }
.layout-toggle { border: 1px solid #d0d4da; background: #fff; border-radius: 12px; padding: 3px 10px; font-size: 12px; font-family: inherit; color: inherit; cursor: pointer; }
.layout-toggle[aria-pressed="true"] { background: #0550ae; border-color: #0550ae; color: #fff; }
.card { background: #fff; border-radius: 6px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.1); padding: 10px; margin-bottom: 8px; font-size: 13px; }
.card:last-child { margin-bottom: 0; }
.card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.card code { font-size: 11px; color: #59636e; }
.type { background: var(--type-color); color: #fff; border-radius: 4px; padding: 1px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.priority { color: #fff; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
.priority.p0 { background: #cf222e; }
.priority.p1 { background: #bc4c00; }
.priority.p2 { background: #0550ae; }
.priority.p3 { background: #59636e; }
.title { font-weight: 600; margin-bottom: 4px; overflow-wrap: anywhere; }
.parent { color: #59636e; font-size: 11px; margin-bottom: 4px; }
.parent::before { content: "↳ "; }
.assignee { color: #424a53; font-size: 12px; }
.assignee.unassigned { color: #666a6f; }
.branch { color: #8250df; font-size: 12px; font-family: ui-monospace, monospace; }
.pr { font-size: 12px; margin-top: 2px; }
.pr a { color: inherit; text-decoration: none; }
.pr a:hover { text-decoration: underline; }
.pr a.diff { color: #0550ae; font-weight: 400; }
.pr.nopr { color: #666a6f; }
.pr.draft { color: #666a6f; }
.pr.open { color: #1a7f37; font-weight: 600; }
.pr.merged { color: #8250df; }
.pr.closed { color: #cf222e; }
.labels { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.label { background: #e7ebef; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
.blocked-reason { margin-top: 6px; color: #9a3412; background: #fff1e7; border-radius: 4px; padding: 4px 6px; font-size: 12px; }
.blocked-by { color: #9a3412; font-size: 11px; margin-top: 2px; overflow-wrap: anywhere; }
/* A dep-blocked card reads as muted through its surface, not through a blanket
   opacity: opacity composites every descendant against the column and took
   the whole card to 1.5-2.7:1 (axe color-contrast on the title, id, parent,
   branch, badges and labels — 13 nodes on the @smoke fixture). The muted fill
   keeps the de-emphasis cue and leaves the text legible (#59636e on #f6f7f9 is
   5.70:1). */
.card.dep-blocked { background: #f6f7f9; }
.card.dep-blocked .title { color: #59636e; }
.blocked-badge { margin-left: auto; color: #9a3412; background: #fff1e7; border-radius: 10px; padding: 0 8px; font-size: 10px; font-weight: 600; white-space: nowrap; }
.milestone { color: #0550ae; font-size: 12px; margin-top: 2px; }
.mgroup-head { margin: 10px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #0550ae; }
.mgroup-head:first-child { margin-top: 0; }
.mgroup-head.none { color: #666a6f; }
.card[draggable="true"] { cursor: grab; }
.card.dragging { opacity: 0.5; }
.column.over { outline: 2px dashed #666a6f; outline-offset: -4px; }
#board-toast { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); max-width: 80%; background: #424a53; color: #fff; border-radius: 6px; padding: 8px 14px; font-size: 13px; display: none; z-index: 10; box-shadow: 0 2px 8px rgb(0 0 0 / 0.3); }
#board-toast.show { display: block; }
#board-toast.refused { background: #cf222e; }
#board-toast.ok { background: #1a7f37; }
#board-toast .toast-action { margin-left: 10px; border: 1px solid #fff; background: transparent; color: #fff; border-radius: 4px; padding: 1px 8px; font-size: 12px; font-family: inherit; cursor: pointer; text-decoration: underline; }
/* Move value dialog (task-board-move-dialogs): the in-page replacement for
   the drop flow's blocking prompts. Same chrome as the move menu; on every
   board, because the drop flow is. The input carries the boundary grey. */
.move-prompt { position: fixed; inset: 0; z-index: 30; }
.move-prompt[hidden] { display: none; }
.move-prompt-backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / 0.35); }
.move-prompt-panel { position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%); background: #fff; border: 1px solid #666a6f; border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.25); padding: 14px; min-width: 300px; max-width: 92vw; }
.move-prompt-title { font-weight: 600; font-size: 13px; margin-bottom: 8px; overflow-wrap: anywhere; }
.move-prompt-panel input { width: 100%; box-sizing: border-box; padding: 6px 10px; font-size: 13px; font-family: inherit; border: 1px solid #666a6f; border-radius: 6px; background: #fff; color: inherit; }
.move-prompt-error { display: none; margin-top: 6px; font-size: 12px; color: #cf222e; }
.move-prompt-error.show { display: block; }
.move-prompt-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
.move-prompt-cancel { padding: 4px 10px; font-size: 12px; font-family: inherit; border: 1px solid #666a6f; background: #fff; color: inherit; border-radius: 6px; cursor: pointer; }
.move-prompt-confirm { padding: 4px 10px; font-size: 12px; font-family: inherit; border: 1px solid #0550ae; background: #0550ae; color: #fff; border-radius: 6px; cursor: pointer; }
.move-prompt-cancel:focus-visible, .move-prompt-confirm:focus-visible { outline: 2px solid #0550ae; outline-offset: 2px; }
.filterbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.filterbar label { font-size: 11px; color: #59636e; text-transform: uppercase; letter-spacing: 0.05em; }
#board-filter-input { flex: 1 1 260px; max-width: 560px; padding: 6px 10px; font-size: 13px; font-family: inherit; border: 1px solid #d0d4da; border-radius: 6px; background: #fff; color: inherit; }
#board-filter-input:focus { outline: 2px solid #0550ae; outline-offset: -1px; }
#board-filter-clear { padding: 6px 10px; font-size: 12px; font-family: inherit; border: 1px solid #d0d4da; border-radius: 6px; background: #fff; cursor: pointer; }
.filter-count { font-size: 12px; color: #59636e; }
.filter-error { display: none; font-size: 12px; color: #cf222e; }
.filter-error.show { display: inline; }
.lenses { display: flex; flex-wrap: wrap; gap: 6px; }
.lens { border: 1px solid #d0d4da; background: #fff; border-radius: 12px; padding: 3px 10px; font-size: 12px; font-family: inherit; color: inherit; cursor: pointer; }
.lens.active { background: #0550ae; border-color: #0550ae; color: #fff; }
.card.filtered-out, .mgroup-head.filtered-out { display: none; }
${details ? DETAIL_CSS : ""}
</style>
</head>
<body${details ? ' data-detail-endpoint="/api/item"' : ""}>
<header>
  <h1>arggon board${repo}</h1>
  <div class="meta">generated ${esc(opts.generatedAt)} · ${sorted.length} item(s) · <span id="status-counts">${counts}</span> · tracker files remain the source of truth; drops persist only against a live server (arggon board --serve)${live}</div>
</header>
<div class="filterbar" id="board-filterbar">
  <label for="board-filter-input">filter</label>
  <input id="board-filter-input" type="search" autocomplete="off" spellcheck="false" placeholder="free text or field:value (type, status, label, assignee, priority, ancestor)">
  <button type="button" id="board-filter-clear">clear</button>
  <span id="board-filter-count" class="filter-count">${sorted.length} item(s)</span>
  <span id="board-filter-error" class="filter-error" role="alert"></span>
  ${lensChips}
  <button type="button" id="board-terminal-toggle" class="layout-toggle" aria-pressed="false">hide done/cancelled</button>
  <button type="button" id="board-layout-reset" class="layout-toggle">reset layout</button>
</div>
<main class="board" aria-label="arggon board">
${columns}
</main>
<div id="board-toast" role="status" aria-live="polite"></div>
${details ? DRAWER_MARKUP : ""}
${details ? MOVE_MENU_MARKUP : ""}
${MOVE_PROMPT_MARKUP}
<script>
'use strict';
${evaluateDrop.toString()}
/* board-filter:start */
${applyBoardFilter.toString()}
/* board-filter:end */
${dropNeedsClaimPrompt.toString()}
${wireBoardColumns.toString()}
${trapBoardFocus.toString()}
${wireBoardMovePrompt.toString()}
${details ? renderBoardDetail.toString() : ""}
${details ? wireBoardDetail.toString() : ""}
${details ? wireBoardKeyboardNav.toString() : ""}
${details ? wireBoardMoveMenu.toString() : ""}
(function () {
  var ENDPOINT = document.body.getAttribute("data-update-endpoint") || "/api/update";
  var BOARD_ITEMS = ${embedJson(lensItems)};
  var BOARD_ME = ${embedJson(me)};
  // Roving focus anchor (serve mode): the filter re-seats the focusable card
  // when the current one gets hidden; null in the static export.
  var keyboardNav = ${details ? "wireBoardKeyboardNav()" : "null"};
  // Column collapse/terminal-hide/reset (task-board-column-controls): every
  // board — static and serve — restores the persisted layout at boot; in serve
  // mode the roving anchor is re-seated after every layout change.
  wireBoardColumns(keyboardNav ? keyboardNav.ensureAnchor : null);
  var filterInput = document.getElementById("board-filter-input");
  var filterError = document.getElementById("board-filter-error");
  var filterCount = document.getElementById("board-filter-count");
  var lensChips = document.querySelectorAll("#board-lenses .lens");
  var toastTimer = null;
  function toast(message, kind, action) {
    var el = document.getElementById("board-toast");
    el.textContent = message;
    // Undo affordance (task-board-move-dialogs): when the caller passes an
    // action, the toast carries an explicit button instead of text only.
    if (action) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toast-action";
      btn.textContent = action.label;
      btn.addEventListener("click", function () {
        el.className = "";
        if (toastTimer) clearTimeout(toastTimer);
        action.run();
      });
      el.appendChild(btn);
    }
    el.className = "show " + (kind || "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ""; }, 6000);
  }
  function columnFor(status) {
    return document.querySelector('.column[data-status="' + status + '"]');
  }
  // Same shape the renderer bakes into role="group" aria-label; rebuilt from
  // live DOM state so a moved card keeps announcing its current status/claim.
  function cardAriaLabel(card, status) {
    var id = card.getAttribute("data-id") || "";
    var type = card.getAttribute("data-type") || "";
    var titleEl = card.querySelector(".title");
    var title = titleEl && titleEl.textContent ? titleEl.textContent : id;
    var assignee = card.getAttribute("data-assignee");
    return type + " " + id + ": " + title + " (" + status + (assignee ? ", @" + assignee : "") + ")";
  }
  function currentExpr() {
    return filterInput ? filterInput.value : "";
  }
  function visibleCards(column) {
    return column.querySelectorAll(".card:not(.filtered-out)");
  }
  function refreshCounts() {
    var parts = [];
    document.querySelectorAll(".column").forEach(function (col) {
      var n = visibleCards(col).length;
      col.querySelector(".count").textContent = String(n);
      parts.push(col.getAttribute("data-status") + ": " + n);
    });
    var metaCounts = document.getElementById("status-counts");
    if (metaCounts) metaCounts.textContent = parts.join(" · ");
  }
  function normalizeEmpties() {
    document.querySelectorAll(".column").forEach(function (col) {
      var empty = col.querySelector(".empty");
      if (visibleCards(col).length === 0) {
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
  function refreshGroupHeads() {
    document.querySelectorAll(".column").forEach(function (col) {
      col.querySelectorAll(".mgroup-head").forEach(function (head) {
        var visible = 0;
        var sib = head.nextElementSibling;
        while (sib && !sib.classList.contains("mgroup-head")) {
          if (sib.classList.contains("card") && !sib.classList.contains("filtered-out")) visible++;
          sib = sib.nextElementSibling;
        }
        if (visible === 0) head.classList.add("filtered-out");
        else head.classList.remove("filtered-out");
      });
    });
  }
  function refreshFilterCount() {
    if (!filterCount) return;
    var total = BOARD_ITEMS.length;
    var shown = document.querySelectorAll(".board .card:not(.filtered-out)").length;
    filterCount.textContent = shown === total ? total + " item(s)" : shown + " of " + total + " item(s)";
  }
  function setFilterState(expr) {
    var result = applyBoardFilter(BOARD_ITEMS, expr, BOARD_ME);
    // Prototype-less: ids like "constructor" must not read as visible.
    var shown = Object.create(null);
    if (result.ok) {
      for (var i = 0; i < result.visible.length; i++) shown[result.visible[i]] = true;
    } else {
      // Invalid expression: keep the whole board visible, surface the error.
      for (var j = 0; j < BOARD_ITEMS.length; j++) shown[BOARD_ITEMS[j].id] = true;
    }
    if (filterError) {
      filterError.textContent = result.ok ? "" : result.error;
      filterError.className = result.ok ? "filter-error" : "filter-error show";
    }
    document.querySelectorAll(".board .card").forEach(function (card) {
      if (shown[card.getAttribute("data-id")]) card.classList.remove("filtered-out");
      else card.classList.add("filtered-out");
    });
    lensChips.forEach(function (chip) {
      chip.className = chip.getAttribute("data-filter") === expr ? "lens active" : "lens";
    });
    refreshCounts();
    normalizeEmpties();
    refreshGroupHeads();
    refreshFilterCount();
    if (keyboardNav) keyboardNav.ensureAnchor();
  }
  function hashFilter() {
    var match = /[#&]filter=([^&]*)/.exec(window.location.hash);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]);
    } catch (err) {
      return match[1];
    }
  }
  function writeHash(expr) {
    var next = expr === "" ? "" : "#filter=" + encodeURIComponent(expr);
    if (window.location.hash === next) return;
    var base = window.location.pathname + window.location.search;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", base + next);
    } else {
      window.location.hash = next;
    }
  }
  function setFilter(expr, writeUrl) {
    if (filterInput) filterInput.value = expr;
    if (writeUrl) writeHash(expr);
    setFilterState(expr);
  }
  if (filterInput) {
    filterInput.addEventListener("input", function () { setFilter(filterInput.value, true); });
    filterInput.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setFilter("", true);
    });
  }
  var clearButton = document.getElementById("board-filter-clear");
  if (clearButton) {
    clearButton.addEventListener("click", function () {
      setFilter("", true);
      if (filterInput) filterInput.focus();
    });
  }
  lensChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var expr = chip.getAttribute("data-filter") || "";
      setFilter(filterInput && filterInput.value === expr ? "" : expr, true);
    });
  });
  window.addEventListener("hashchange", function () { setFilter(hashFilter(), false); });
  setFilter(hashFilter(), false);
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
    // The optimistic move + server round-trip, as one closure over the card,
    // the target and the collected edit (task-board-move-dialogs): the value
    // dialogs resolve asynchronously, so the flow continues from callbacks.
    function runMove(reason) {
      var verdictOk = evaluateDrop(cardData, to, edit);
      if (!verdictOk.ok) {
        toast("✗ " + verdictOk.reason, "refused");
        return;
      }
      var anchor = card.nextSibling;
      var prevAssignee = card.getAttribute("data-assignee");
      // Reparenting a focused element drops focus to <body> (Chromium), so the
      // keyboard/touch move flow keeps it: whatever inside the card held focus
      // (the card itself, or its move button) is re-focused after the move.
      var focusHeld = null;
      if (document.activeElement && (document.activeElement === card || card.contains(document.activeElement))) {
        focusHeld = document.activeElement;
      }
      // Never includes force: the update path must reject claim steals itself.
      var body = { id: id, status: to };
      if (reason) body.blocked_reason = reason;
      if (edit.assignee) body.assignee = edit.assignee;
      // Optimistic move; the catch below reverts it when the update call fails.
      // The accessible name moves with the card (task-board-keyboard-a11y):
      // assistive tech must announce the new status/claim immediately, not after
      // the next server render.
      card.setAttribute("data-status", to);
      if (edit.assignee) card.setAttribute("data-assignee", edit.assignee);
      card.setAttribute("aria-label", cardAriaLabel(card, to));
      columnFor(to).appendChild(card);
      if (focusHeld) focusHeld.focus();
      setFilterState(currentExpr());
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
            // Undo affordance (task-board-move-dialogs): the toast carries an
            // explicit Undo button when the REVERSE transition is legal under
            // the same evaluateDrop parity rules (never force, never steal —
            // undo runs attemptMove, so it collects a claim/reason through the
            // same dialogs and reverts through the same server path).
            var reverse = evaluateDrop(
              {
                id: id,
                type: cardData.type,
                status: to,
                assignee: card.getAttribute("data-assignee")
              },
              from,
              {}
            );
            if (reverse.ok || dropNeedsClaimPrompt(reverse)) {
              toast("✓ " + id + " -> " + to, "ok", {
                label: "Undo",
                run: function () {
                  attemptMove(card, from);
                }
              });
            } else {
              toast("✓ " + id + " -> " + to, "ok");
            }
            return;
          }
          throw new Error(data && data.error && data.error.message ? data.error.message : "update failed");
        })
        .catch(function (err) {
          card.setAttribute("data-status", from);
          if (edit.assignee) {
            if (prevAssignee) card.setAttribute("data-assignee", prevAssignee);
            else card.removeAttribute("data-assignee");
          }
          card.setAttribute("aria-label", cardAriaLabel(card, from));
          var col = columnFor(from);
          if (anchor && anchor.parentNode === col) col.insertBefore(card, anchor);
          else col.appendChild(card);
          if (focusHeld && focusHeld.isConnected) focusHeld.focus();
          setFilterState(currentExpr());
          var message = err && err.message ? err.message : "update failed";
          if (message === "Failed to fetch") {
            message = "static snapshot: no update endpoint (serve with arggon board --serve)";
          }
          toast("✗ " + id + " not moved — " + message + " (run: arggon update " + id + " --status " + to + ")", "refused");
        });
    }
    if (dropNeedsClaimPrompt(verdict)) {
      // Claim via board: the in-page dialog asks for the login, then the rule
      // is re-run with it (task-board-move-dialogs — no blocking prompt).
      askMoveValue(
        "--assignee required to claim " + id + " (GitHub login or agent id):",
        "claim",
        "assignee",
        function (login) {
          if (login === null) {
            toast("✗ " + verdict.reason + " (drop cancelled)", "refused");
            return;
          }
          edit.assignee = login;
          runMove(null);
        },
      );
      return;
    }
    if (!verdict.ok) {
      toast("✗ " + verdict.reason, "refused");
      return;
    }
    if (to === "blocked") {
      askMoveValue(
        "--blocked-reason required to block " + id + ":",
        "block",
        "blocked reason",
        function (reason) {
          if (reason === null) {
            toast("✗ status blocked requires --blocked-reason (drop cancelled)", "refused");
            return;
          }
          runMove(reason);
        },
      );
      return;
    }
    runMove(null);
  }
  ${details ? "wireBoardDetail(toast, renderBoardDetail); wireBoardMoveMenu(attemptMove);" : ""}
  var askMoveValue = wireBoardMovePrompt();
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
