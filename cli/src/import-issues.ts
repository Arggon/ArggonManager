import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { runCreate } from "./create.js";
import { parseRepoSlug } from "./get-open-prs.js";
import { itemId, slugify } from "./ids.js";
import { itemsById, loadItems } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { runUpdate } from "./update.js";

/**
 * Signature for the gh executor (injectable for tests, like get-open-prs).
 */
export type GhExecutor = (file: string, args: string[], options?: ExecFileSyncOptions) => string;

/** Default gh executor bound for use as a default value. */
const defaultExecGh: GhExecutor = (file, args, options) =>
  execFileSync(file, args, options) as string;

/** Id of the default parent story for imported issues (created on demand). */
export const IMPORTED_STORY_ID = "story-imported-issues";
/** Import title prefix, so imported tasks are recognizable in every view. */
const TITLE_PREFIX = "issue";
/**
 * Temporary claimant used to walk a closed issue through the legal kernel
 * path (todo -> in_progress -> done, unassigning at `done`). Never persists:
 * the final update clears it.
 */
const IMPORT_CLAIMANT = "github-import";

export type GhIssueLabel = string | { name?: string };

/** Shape of one `gh issue list --json number,title,state,body,labels` entry. */
export type GhIssue = {
  number: number;
  title: string;
  state: string;
  body?: string | null;
  labels?: GhIssueLabel[];
};

export type ImportEntryAction = "created" | "skipped" | "would-create" | "would-skip";

export type ImportEntry = {
  /** GitHub issue number. */
  issue: number;
  /** Target/imported work-item id (e.g. task-issue-12). */
  id: string;
  title: string;
  /** Mapped status: open -> todo, closed -> done. */
  status: "todo" | "done";
  action: ImportEntryAction;
};

export type ImportIssuesResult = {
  /** Repo root (parent of tasks/). */
  root: string;
  dryRun: boolean;
  /** Target story for imported leaves. */
  story: { id: string; created: boolean };
  /** One entry per issue, in gh order. */
  entries: ImportEntry[];
  created: number;
  skipped: number;
  /** Issue labels mapped into item labels (after kebab-case normalization). */
  labelsMapped: number;
  /** Labels dropped silently (un-slugifiable / invalid), counted in the report. */
  labelsSkipped: number;
};

export type ImportIssuesOptions = {
  cwd: string;
  /** `owner/name` slug for gh; omit to let gh resolve the repo from cwd. */
  repo?: string;
  /** Target story id; default `story-imported-issues`, created under the first epic. */
  parent?: string;
  dryRun?: boolean;
  execGh?: GhExecutor;
  now?: Date;
};

/**
 * Shared `gh issue list` invocation — the one place that owns the JSON
 * contract for the import. `--state all` so closed issues import too
 * (they map to `done`). Throws a plain technical error; runImportIssues
 * adds the IMPORT_FAILED context.
 */
export function ghIssueListJson(opts: {
  repo?: string;
  execGh?: GhExecutor;
}): GhIssue[] {
  const execGh = opts.execGh ?? defaultExecGh;
  const args = [
    "issue",
    "list",
    "--state",
    "all",
    "--limit",
    "200",
    "--json",
    "number,title,state,body,labels",
  ];
  if (opts.repo) args.push("--repo", opts.repo);
  let out: string;
  try {
    out = execGh(
      "gh",
      args,
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 30_000 },
    ) as string;
  } catch (err) {
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err.code === "ENOENT" || err.code === -2)
    ) {
      throw new Error("gh not found (install gh and run `gh auth login`)");
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`gh issue list failed (${message}; check \`gh auth status\`)`);
  }
  try {
    const data: unknown = JSON.parse(out);
    if (!Array.isArray(data)) throw new Error("not an array");
    return data as GhIssue[];
  } catch {
    throw new Error("gh issue list returned unparseable JSON (check `gh auth status`)");
  }
}

const LABEL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Normalize gh labels to convention labels: kebab-case (slugified),
 * deduped (case-sensitively after slugify), invalid entries dropped
 * silently but counted.
 */
export function normalizeGhLabels(raw: GhIssueLabel[] | undefined): {
  labels: string[];
  skipped: number;
} {
  const labels: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const entry of raw ?? []) {
    const name = typeof entry === "string" ? entry : (entry?.name ?? "");
    let slug: string;
    try {
      slug = slugify(name);
    } catch {
      skipped += 1;
      continue;
    }
    if (!LABEL_PATTERN.test(slug)) {
      skipped += 1;
      continue;
    }
    if (!seen.has(slug)) {
      seen.add(slug);
      labels.push(slug);
    }
  }
  return { labels, skipped };
}

/** Map gh issue state to the import status (unknown states import as open). */
export function mapIssueState(state: string): "todo" | "done" {
  return state.trim().toLowerCase() === "closed" ? "done" : "todo";
}

/** Imported task body: the original issue body plus the provenance line. */
export function importedBody(issue: GhIssue): string {
  const body = (issue.body ?? "").replace(/\r\n/g, "\n").trimEnd();
  return `${body ? `${body}\n` : ""}> imported from issue #${issue.number}\n`;
}

/**
 * One-shot GitHub issue import (docs/agents.md §0 promise): every issue
 * becomes a task under a parent story.
 *
 * - Idempotency is the core requirement: target ids are `task-issue-<number>`;
 *   existing ids are skipped, so re-running imports nothing.
 * - open -> `todo`, closed -> `done` (create cannot make `done` — closed
 *   issues are created `todo` and updated through the kernel in the same
 *   run; the container cascade may fire, which is fine).
 * - `--dry-run` computes and reports the plan without writing anything
 *   (including the default story).
 */
export function runImportIssues(opts: ImportIssuesOptions): ImportIssuesResult {
  // Fail fast with an actionable error before any gh call.
  if (opts.repo !== undefined) parseRepoSlug(opts.repo);
  const tasksDir = findTasksDir(opts.cwd);
  const issues = ghIssueListJson({ repo: opts.repo, execGh: opts.execGh });
  const dryRun = Boolean(opts.dryRun);
  const now = opts.now ?? new Date();

  const byId = itemsById(loadItems(tasksDir));

  // Resolve (or plan) the parent story: leaves may only live under a story.
  let storyId: string;
  let storyCreated = false;
  if (opts.parent !== undefined) {
    const parent = byId.get(opts.parent);
    if (!parent) {
      throw new Error(
        `--parent '${opts.parent}' does not resolve to an existing item under tasks/`,
      );
    }
    if (parent.type !== "story") {
      throw new Error(
        `--parent '${opts.parent}' is a ${parent.type}, not a story — imported tasks need a story parent`,
      );
    }
    storyId = parent.id;
  } else if (byId.has(IMPORTED_STORY_ID)) {
    const existing = byId.get(IMPORTED_STORY_ID)!;
    if (existing.type !== "story") {
      throw new Error(
        `id '${IMPORTED_STORY_ID}' already exists as a ${existing.type} — pass --parent <story-id> to choose the target story`,
      );
    }
    storyId = IMPORTED_STORY_ID;
  } else {
    const epics = [...byId.values()]
      .filter((item) => item.type === "epic")
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (epics.length === 0) {
      throw new Error(
        "no epic found under tasks/ — imported tasks need a parent story (stories live under an epic). " +
          "Create one with `arggon create epic <title> --parent <initiative-id>` or pass --parent <story-id>",
      );
    }
    if (!dryRun) {
      runCreate({
        cwd: opts.cwd,
        type: "story",
        title: "Imported GitHub issues",
        id: IMPORTED_STORY_ID,
        parent: epics[0].id,
        now,
      });
      storyCreated = true;
    }
    storyId = IMPORTED_STORY_ID;
  }

  const entries: ImportEntry[] = [];
  let created = 0;
  let skipped = 0;
  let labelsMapped = 0;
  let labelsSkipped = 0;

  for (const issue of issues) {
    if (!Number.isInteger(issue?.number) || issue.number <= 0) {
      throw new Error("gh issue list returned an entry without a valid issue number");
    }
    const number = issue.number;
    const id = itemId("task", `issue-${number}`);
    const status = mapIssueState(issue.state ?? "");
    const title = `${TITLE_PREFIX} #${number}: ${(issue.title ?? "").trim()}`;
    if (byId.has(id)) {
      skipped += 1;
      entries.push({ issue: number, id, title, status, action: dryRun ? "would-skip" : "skipped" });
      continue;
    }
    const { labels, skipped: badLabels } = normalizeGhLabels(issue.labels);
    labelsMapped += labels.length;
    labelsSkipped += badLabels;
    if (!dryRun) {
      runCreate({
        cwd: opts.cwd,
        type: "task",
        title,
        parent: storyId,
        id: `issue-${number}`,
        labels,
        body: importedBody(issue),
        now,
      });
      if (status === "done") {
        // `create` cannot make `done` (todo ↛ done) and the claim rule needs
        // an assignee for in_progress, so close through the legal kernel
        // path: todo -> in_progress (temporary claim) -> done, unassigning
        // in the same final update. The container cascade may fire when this
        // closes the story's last open leaf — fine.
        runUpdate({
          cwd: opts.cwd,
          id,
          status: "in_progress",
          assignee: IMPORT_CLAIMANT,
          now,
        });
        runUpdate({ cwd: opts.cwd, id, status: "done", unassign: true, now });
      }
    }
    created += 1;
    entries.push({
      issue: number,
      id,
      title,
      status,
      action: dryRun ? "would-create" : "created",
    });
  }

  return {
    root: repoRootFromTasks(tasksDir),
    dryRun,
    story: { id: storyId, created: storyCreated },
    entries,
    created,
    skipped,
    labelsMapped,
    labelsSkipped,
  };
}
