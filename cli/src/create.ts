import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringifyFrontmatter, type Frontmatter } from "./frontmatter.js";
import { innerSlug, isItemType, itemId, slugify, type ItemType } from "./ids.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { bundledTemplatesDir, findTasksDir, newItemPath, repoRootFromTasks } from "./paths.js";
import { assertAssignee, assertClaimAndBlocked, assertStatus, type Status } from "./status.js";

const PARENT_TYPE: Record<ItemType, ItemType | null> = {
  initiative: null,
  epic: "initiative",
  story: "epic",
  task: "story",
  bug: "story",
};

export type CreateOptions = {
  cwd: string;
  type: string;
  title: string;
  parent?: string;
  id?: string;
  assignee?: string;
  status?: string;
  blockedReason?: string;
  now?: Date;
};

export type CreateResult = {
  id: string;
  path: string;
};

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  if (opts.assignee !== undefined) assertAssignee(opts.assignee);
  assertClaimAndBlocked({
    type,
    status,
    assignee: opts.assignee,
    blockedReason: opts.blockedReason,
  });

  const requiredParent = PARENT_TYPE[type];
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
      throw new Error(`parent '${opts.parent}' not found under tasks/`);
    }
    if (parentItem.type !== requiredParent) {
      throw new Error(
        `parent '${opts.parent}' is type ${parentItem.type}, but ${type} must live under a ${requiredParent}`,
      );
    }
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
  const templatePath = resolveTemplate(tasksDir, type);
  const template = readFileSync(templatePath, "utf8");
  const body = fillTemplateBody(stripFrontmatterBody(template), {
    type,
    id,
    title,
    parent: parentItem,
    byId,
  });

  const data: Frontmatter = {
    type,
    status,
    id,
    title,
    labels: [],
    created: today,
    updated: today,
  };
  if (opts.assignee) data.assignee = opts.assignee;
  if (parentItem) data.parent = parentItem.id;
  if (status === "blocked" && opts.blockedReason) {
    data.blocked_reason = opts.blockedReason.trim();
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, stringifyFrontmatter(data, body), "utf8");

  console.log(`arggon create: ${type} ${id}`);
  console.log(`  ${filePath}`);
  return { id, path: filePath };
}

function resolveTemplate(tasksDir: string, type: ItemType): string {
  const name = `${type}.md`;
  const local = join(repoRootFromTasks(tasksDir), "templates", name);
  if (existsSync(local)) return local;
  const bundled = join(bundledTemplatesDir(), name);
  if (existsSync(bundled)) return bundled;
  throw new Error(`Template not found: ${name}`);
}

function stripFrontmatterBody(raw: string): string {
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  let body = raw.slice(end + 4);
  if (body.startsWith("\n")) body = body.slice(1);
  return body;
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
  const keys = Object.keys(tokens).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    out = out.replaceAll(`<${key}>`, tokens[key]);
  }
  return out;
}
