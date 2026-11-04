import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { stringifyFrontmatter, type Frontmatter } from "./frontmatter.js";
import { assertLabels, innerSlug, isItemType, itemId, slugify, type ItemType } from "./ids.js";
import { itemsById, loadItems, tryLoadItem, type WorkItem } from "./items.js";
import { assertPriority } from "./priority.js";
import { findTasksDir, newItemPath, repoRootFromTasks } from "./paths.js";
import { assertParentEdge, expectedParentType } from "./relations.js";
import {
  assertAssignee,
  assertClaimAndBlocked,
  assertCreatableStatus,
  assertStatus,
  type Status,
} from "./status.js";
import { formatDate } from "./dates.js";
import {
  commitTrackerMutation,
  readAutoCommitConfig,
  resolveAutoCommit,
  trackerCommitMessage,
  type TrackerCommitResult,
} from "./tracker-commit.js";

export type CreateOptions = {
  cwd: string;
  type: string;
  title: string;
  parent?: string;
  id?: string;
  assignee?: string;
  status?: string;
  blockedReason?: string;
  /** Replace the default empty labels list (must satisfy the kebab-case rules). */
  labels?: string[];
  /**
   * Set the v4 `priority` field at creation (spec-priority-field-008):
   * p0 | p1 | p2 | p3. Omit/empty = unprioritized (the field is never
   * defaulted); invalid values fail before anything is written.
   */
  priority?: string;
  /**
   * GitHub issue number recorded in the additive `issue` frontmatter field
   * (import-issues provenance; `start --open-pr` turns it into `Closes #N`).
   */
  issue?: number;
  /**
   * Replace the template-derived body with verbatim content (e.g.
   * import-issues writes the original issue body plus a provenance line).
   * Omit to fill the type's template body as usual. Mutually exclusive with
   * `acceptance`: an authored body is already the complete contract.
   */
  body?: string;
  /**
   * Author the live `## Acceptance` section as unchecked criteria
   * (`- [ ] <criterion>` each), replacing whatever the template put there.
   * The common case for `create --acceptance '<criterion>'` (issue #870):
   * the Context stays the template's, the contract is authored. Mutually
   * exclusive with `body`; each criterion must be non-empty and single-line
   * so one flag cannot inject extra rows or headings.
   */
  acceptance?: string[];
  /**
   * Auto-commit the created item file (tracker hygiene,
   * task-auto-commit-tracker). `undefined` resolves via `x-tracker.auto-commit`
   * config, default ON. Internal callers that commit themselves (adopt) or
   * stay uncommitted (import-issues) pass `false` explicitly.
   */
  commit?: boolean;
  /**
   * Fallback directory holding the distribution's item templates
   * (`<templatesDir>/<type>.md`). The repo's own `templates/` always wins;
   * the root package injects its bundled dir here (ADR 0013: the kernel
   * library ships no assets).
   */
  templatesDir?: string;
  now?: Date;
};

export type CreateResult = {
  id: string;
  path: string;
  /** Repo root (parent of the tracker dir). */
  root: string;
  /** The created item, reloaded from disk. */
  item: WorkItem;
  /** Tracker auto-commit outcome (task-auto-commit-tracker). */
  commit?: TrackerCommitResult;
};

export function runCreate(opts: CreateOptions): CreateResult {
  if (!isItemType(opts.type)) {
    throw new Error(`Unknown type '${opts.type}'. Expected: initiative, epic, story, task, bug`);
  }
  const type = opts.type;
  const title = opts.title.trim();
  if (!title) throw new Error("title is required");

  const statusRaw = opts.status ?? "todo";
  assertStatus(statusRaw);
  const status: Status = statusRaw;
  assertCreatableStatus(status);
  if (opts.assignee !== undefined) assertAssignee(opts.assignee);
  if (opts.labels !== undefined) assertLabels(opts.labels);
  // priority (v4, spec-priority-field-008): empty = not requested (create has
  // nothing to clear); anything else must be the exact enum.
  const priority = opts.priority?.trim() ? opts.priority.trim() : undefined;
  if (priority !== undefined) assertPriority(priority);
  assertClaimAndBlocked({
    type,
    status,
    assignee: opts.assignee,
    blockedReason: opts.blockedReason,
  });

  const requiredParent = expectedParentType(type);
  if (requiredParent === null) {
    if (opts.parent) throw new Error("initiative cannot have --parent");
  } else if (!opts.parent) {
    throw new Error(`${type} requires --parent <${requiredParent} id>`);
  }

  const tasksDir = findTasksDir(opts.cwd);
  const byId = itemsById(loadItems(tasksDir));

  const stem = opts.id ? opts.id.trim() : slugify(title);
  if (!stem) throw new Error("id is required");
  const id = itemId(type, stem);

  const existing = byId.get(id);
  if (existing) {
    throw new Error(`id '${id}' already exists at ${existing.filePath}`);
  }

  let parentItem: WorkItem | undefined;
  if (opts.parent) {
    parentItem = byId.get(opts.parent);
    if (!parentItem) {
      throw new Error(`parent '${opts.parent}' not found under the tracker`);
    }
    assertParentEdge(type, parentItem.type);
  }

  const filePath = newItemPath({
    tasksDir,
    type,
    id,
    parentContainerDir: parentItem?.containerDir,
  });
  if (existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }

  const today = formatDate(opts.now ?? new Date());
  if (opts.body !== undefined && opts.acceptance !== undefined && opts.acceptance.length > 0) {
    throw new Error(
      "body and acceptance are mutually exclusive (a body already authors the contract)",
    );
  }
  const criteria = normalizeAcceptanceCriteria(opts.acceptance);
  let body: string;
  if (opts.body !== undefined) {
    // An authored body is complete: it must not depend on a local or bundled
    // template being installed (and is never token-expanded).
    body = opts.body;
  } else {
    const templatePath = resolveTemplate(tasksDir, type, opts.templatesDir);
    body = fillTemplateBody(stripFrontmatterBody(readFileSync(templatePath, "utf8")), {
      type,
      id,
      title,
      parent: parentItem,
      byId,
    });
    if (criteria.length > 0) body = withAcceptanceRows(body, criteria);
  }

  const data: Frontmatter = {
    type,
    status,
    id,
    title,
    labels: opts.labels ?? [],
    created: today,
    updated: today,
  };
  if (opts.assignee) data.assignee = opts.assignee;
  if (parentItem) data.parent = parentItem.id;
  if (priority !== undefined) data.priority = priority;
  if (opts.issue !== undefined) {
    if (!Number.isInteger(opts.issue) || opts.issue <= 0) {
      throw new Error("issue must be a positive integer (the GitHub issue number)");
    }
    data.issue = opts.issue;
  }
  if (status === "blocked" && opts.blockedReason) {
    data.blocked_reason = opts.blockedReason.trim();
  }

  mkdirSync(dirname(filePath), { recursive: true });
  // Atomic (bug-comment-torn-read audit): a concurrent reader (list/validate/
  // MCP) must never observe the new item half-written.
  writeFileAtomic(filePath, stringifyFrontmatter(data, body));

  const created = tryLoadItem(filePath);
  if (!created) {
    throw new Error(`Created item is unreadable: ${filePath}`);
  }
  const root = repoRootFromTasks(tasksDir);
  const commit = commitTrackerMutation(root, [filePath], {
    message: trackerCommitMessage("created", [id]),
    commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
  });
  return { id, path: filePath, root, item: created, commit };
}

function resolveTemplate(tasksDir: string, type: ItemType, templatesDir?: string): string {
  const name = `${type}.md`;
  const local = join(repoRootFromTasks(tasksDir), "templates", name);
  if (existsSync(local)) return local;
  if (templatesDir !== undefined) {
    const bundled = join(templatesDir, name);
    if (existsSync(bundled)) return bundled;
  }
  throw new Error(`Template not found: ${name}`);
}

/**
 * Validate and normalize the repeatable `--acceptance` criteria. Each flag is
 * one live acceptance row, so a value that carries a line terminator or is
 * empty is refused BEFORE anything is written: `- [ ] a\n- [x] b` must never
 * smuggle a second row or a heading into the authored contract.
 */
function normalizeAcceptanceCriteria(acceptance: string[] | undefined): string[] {
  if (acceptance === undefined) return [];
  const criteria: string[] = [];
  for (const value of acceptance) {
    const criterion = value.trim();
    if (criterion.length === 0) {
      throw new Error("acceptance criterion must not be empty (one --acceptance per criterion)");
    }
    if (/[\n\r\u2028\u2029]/.test(criterion)) {
      throw new Error(
        "acceptance criterion must be a single line (one --acceptance per criterion)",
      );
    }
    criteria.push(criterion);
  }
  return criteria;
}

/**
 * Replace the live `## Acceptance` section's content with unchecked rows.
 * Runs on the filled template body (never on an authored `--body`), whose
 * Acceptance section is the generated scaffold; a custom template with no
 * such section gets one appended so the flag always authors the contract it
 * names. Section ends at the next rank 1/2 heading, matching the kernel's
 * live-section address.
 */
function withAcceptanceRows(body: string, criteria: string[]): string {
  const rows = criteria.map((criterion) => `- [ ] ${criterion}`);
  // Accept CRLF/CR template bodies: the heading and section-end tests run on
  // whole lines, so the generated body is normalized to LF here.
  const lines = body.split(/\r\n|\r|\n/);
  let heading = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##[ \t]+acceptance[ \t]*$/i.test(lines[i]!)) {
      heading = i;
      break;
    }
  }
  if (heading === -1)
    return `${body.endsWith("\n") ? body : `${body}\n`}\n## Acceptance\n\n${rows.join("\n")}\n`;
  let end = lines.length;
  for (let i = heading + 1; i < lines.length; i += 1) {
    if (/^#{1,2}[ \t]/.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  // heading + blank + rows + blank, then the next heading (or EOF) verbatim.
  return [...lines.slice(0, heading + 1), "", ...rows, "", ...lines.slice(end)].join("\n");
}

function stripFrontmatterBody(raw: string): string {
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  let body = raw.slice(end + 4);
  if (body.startsWith("\n")) body = body.slice(1);
  return body;
}

/**
 * Render a title as inline Markdown text: collapse every line terminator to a
 * space (so a title can open no heading, fence or extra row), HTML-escape the
 * markup characters, and backslash-escape the inline-Markdown punctuation.
 * The result is inserted as `<title-inline>` in the shipped task/bug
 * templates; `<title>` stays the raw value for frontmatter and the H1.
 */
function inlineTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]{}()#!|~]/g, "\\$&");
}

function fillTemplateBody(
  body: string,
  ctx: {
    type: ItemType;
    id: string;
    title: string;
    parent?: WorkItem;
    byId: Map<string, WorkItem>;
  },
): string {
  const tokens: Record<string, string> = {
    title: ctx.title,
    "title-inline": inlineTitle(ctx.title),
    id: ctx.id,
    "inner-slug": innerSlug(ctx.id),
  };
  if (ctx.parent) {
    if (ctx.type === "epic") tokens["initiative-id"] = ctx.parent.id;
    if (ctx.type === "story") {
      tokens["epic-id"] = ctx.parent.id;
      if (ctx.parent.parent) tokens["initiative-id"] = ctx.parent.parent;
    }
    if (ctx.type === "task" || ctx.type === "bug") {
      tokens["story-id"] = ctx.parent.id;
      const epic = ctx.parent.parent ? ctx.byId.get(ctx.parent.parent) : undefined;
      if (epic) {
        tokens["epic-id"] = epic.id;
        if (epic.parent) tokens["initiative-id"] = epic.parent;
      }
    }
  }
  let out = body;
  out = out.replaceAll("task-<inner-slug>", ctx.type === "task" ? ctx.id : "task-<inner-slug>");
  out = out.replaceAll("bug-<inner-slug>", ctx.type === "bug" ? ctx.id : "bug-<inner-slug>");
  // Replace only tokens present in the template, in ONE pass: a title supplied
  // for <title-inline> must never be re-interpreted as another token (a title
  // such as "<id>" stays that literal text).
  return out.replace(/<([^<>]+)>/g, (match, key: string) =>
    Object.hasOwn(tokens, key) ? tokens[key] : match,
  );
}
