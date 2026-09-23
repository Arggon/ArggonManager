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
      return `<div class="card${blocked.length ? " dep-blocked" : ""}" draggable="true" data-id="${esc(item.id)}" data-type="${esc(item.type)}" data-status="${esc(item.status)}"${item.assignee ? ` data-assignee="${esc(item.assignee)}"` : ""}${milestoneOf(item) ? ` data-milestone="${esc(milestoneOf(item)!)}"` : ""}>
  <div class="card-head"><span class="type" data-type="${esc(item.type)}" style="--type-color: ${TYPE_COLORS[item.type]}">${esc(item.type)}</span>${priorityChip}<code>${esc(item.id)}</code>${blockedBadge}</div>
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
    return `<section class="column" data-status="${status}">
  <h2>${status} <span class="count">${columnItems.length}</span></h2>
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
.priority { color: #fff; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; }
.priority.p0 { background: #cf222e; }
.priority.p1 { background: #bc4c00; }
.priority.p2 { background: #0550ae; }
.priority.p3 { background: #59636e; }
.title { font-weight: 600; margin-bottom: 4px; overflow-wrap: anywhere; }
.parent { color: #59636e; font-size: 11px; margin-bottom: 4px; }
.parent::before { content: "↳ "; }
.assignee { color: #424a53; font-size: 12px; }
.assignee.unassigned { color: #a0a6ad; }
.branch { color: #8250df; font-size: 12px; font-family: ui-monospace, monospace; }
.pr { font-size: 12px; margin-top: 2px; }
.pr a { color: inherit; text-decoration: none; }
.pr a:hover { text-decoration: underline; }
.pr a.diff { color: #0550ae; font-weight: 400; }
.pr.nopr { color: #a0a6ad; }
.pr.draft { color: #8c919a; }
.pr.open { color: #1a7f37; font-weight: 600; }
.pr.merged { color: #8250df; }
.pr.closed { color: #cf222e; }
.labels { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.label { background: #e7ebef; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
.blocked-reason { margin-top: 6px; color: #9a3412; background: #fff1e7; border-radius: 4px; padding: 4px 6px; font-size: 12px; }
.blocked-by { color: #9a3412; font-size: 11px; margin-top: 2px; overflow-wrap: anywhere; }
.card.dep-blocked { opacity: 0.55; }
.card.dep-blocked .title { color: #59636e; }
.blocked-badge { margin-left: auto; color: #9a3412; background: #fff1e7; border-radius: 10px; padding: 0 8px; font-size: 10px; font-weight: 600; white-space: nowrap; }
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
</style>
</head>
<body>
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
</div>
<main class="board">
${columns}
</main>
<div id="board-toast" role="status" aria-live="polite"></div>
<script>
'use strict';
${evaluateDrop.toString()}
/* board-filter:start */
${applyBoardFilter.toString()}
/* board-filter:end */
(function () {
  var ENDPOINT = document.body.getAttribute("data-update-endpoint") || "/api/update";
  var BOARD_ITEMS = ${embedJson(lensItems)};
  var BOARD_ME = ${embedJson(me)};
  var filterInput = document.getElementById("board-filter-input");
  var filterError = document.getElementById("board-filter-error");
  var filterCount = document.getElementById("board-filter-count");
  var lensChips = document.querySelectorAll("#board-lenses .lens");
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
        setFilterState(currentExpr());
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
