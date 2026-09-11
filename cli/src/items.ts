import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  parseFrontmatter,
  stringArrayField,
  stringField,
  type Frontmatter,
} from "./frontmatter.js";
import { isItemType, type ItemType } from "./ids.js";
import { isStatus, type Status } from "./status.js";

export type WorkItem = {
  type: ItemType;
  status: Status;
  id: string;
  title?: string;
  assignee?: string | null;
  /** Working branch name (v1 field); omit/null = none. */
  branch?: string;
  parent?: string | null;
  labels: string[];
  created?: string;
  updated?: string;
  blockedReason?: string;
  /** Milestone target date, quoted YYYY-MM-DD (prototype per ADR 0003; official in v3). */
  milestone?: string | null;
  /** Ids this item waits for (v3 field per ADR 0004); empty = no dependencies. */
  dependsOn: string[];
  extras: Frontmatter;
  filePath: string;
  containerDir: string;
  data: Frontmatter;
  body: string;
};

const OFFICIAL_KEYS = new Set([
  "type",
  "status",
  "id",
  "title",
  "assignee",
  "branch",
  "parent",
  "labels",
  "created",
  "updated",
  "blocked_reason",
]);

/**
 * Forward-declared keys: not in the v0 OFFICIAL_KEYS block (so they live in
 * extras and round-trip), but known to the tooling - no UNKNOWN_KEY warning.
 * milestone is the ADR 0003 prototype field; depends_on is official in
 * convention v3 (ADR 0004). Both parse unconditionally: parsing is additive,
 * so v0-v2 trees keep loading (and validating) unchanged.
 */
const PROTOTYPE_KEYS = new Set(["milestone", "depends_on"]);

/** One soft-load finding (path added by caller). */
export type SoftIssue = {
  code: string;
  message: string;
};

export type SoftLoadResult =
  | { kind: "skip" }
  | { kind: "fatal"; issues: SoftIssue[] }
  | {
      kind: "item";
      item: WorkItem;
      /** Non-fatal schema issues discovered while loading. */
      issues: SoftIssue[];
      /** Unnamespaced unknown keys (callers may warn). */
      unknownKeys: string[];
    };

/** Collect every file and directory under tasks/ (skipping dotfiles). Shared by validate. */
export function walkTasksTree(dir: string): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs: string[] = [];
  if (!existsSync(dir)) return { files, dirs };
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur)) {
      if (name.startsWith(".")) continue;
      const full = join(cur, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        dirs.push(full);
        stack.push(full);
      } else {
        files.push(full);
      }
    }
  }
  return { files, dirs };
}

/**
 * Soft-load a work item without throwing.
 * Broken YAML / missing required fields are fatal; other schema issues attach to the item.
 * One parse path — unknown keys returned for the caller to warn on.
 */
export function softTryLoadItem(filePath: string): SoftLoadResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    return {
      kind: "fatal",
      issues: [{ code: "READ_FAILED", message: err instanceof Error ? err.message : String(err) }],
    };
  }
  if (!raw.startsWith("---")) return { kind: "skip" };

  let data: Frontmatter;
  let body: string;
  try {
    ({ data, body } = parseFrontmatter(raw));
  } catch (err) {
    return {
      kind: "fatal",
      issues: [{ code: "BROKEN_YAML", message: err instanceof Error ? err.message : String(err) }],
    };
  }

  const typeRaw = stringField(data, "type");
  if (!typeRaw) return { kind: "skip" };
  if (!isItemType(typeRaw)) {
    return {
      kind: "fatal",
      issues: [{ code: "UNKNOWN_TYPE", message: `unknown type '${typeRaw}'` }],
    };
  }

  const issues: SoftIssue[] = [];
  const id = stringField(data, "id");
  if (!id) {
    return {
      kind: "fatal",
      issues: [{ code: "MISSING_ID", message: "missing required field id" }],
    };
  }
  const statusRaw = stringField(data, "status");
  if (!statusRaw) {
    return {
      kind: "fatal",
      issues: [{ code: "MISSING_STATUS", message: "missing required field status" }],
    };
  }
  if (!isStatus(statusRaw)) {
    return {
      kind: "fatal",
      issues: [{ code: "UNKNOWN_STATUS", message: `unknown status '${statusRaw}'` }],
    };
  }

  let labels: string[] = [];
  try {
    labels = stringArrayField(data, "labels");
  } catch (err) {
    issues.push({
      code: "INVALID_LABELS",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let dependsOn: string[] = [];
  try {
    dependsOn = stringArrayField(data, "depends_on");
  } catch (err) {
    issues.push({
      code: "INVALID_DEPENDS_ON",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const extras: Frontmatter = {};
  const unknownKeys: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (!OFFICIAL_KEYS.has(k)) {
      extras[k] = v;
      if (!k.startsWith("x-") && k !== "extensions" && !PROTOTYPE_KEYS.has(k)) {
        unknownKeys.push(k);
      }
    }
  }

  const item: WorkItem = {
    type: typeRaw,
    status: statusRaw,
    id,
    title: stringField(data, "title"),
    assignee: stringField(data, "assignee") ?? null,
    branch: stringField(data, "branch"),
    parent: stringField(data, "parent") ?? null,
    labels,
    created: stringField(data, "created"),
    updated: stringField(data, "updated"),
    blockedReason: stringField(data, "blocked_reason"),
    milestone: stringField(data, "milestone") ?? null,
    dependsOn,
    extras,
    filePath,
    containerDir: dirname(filePath),
    data,
    body,
  };

  return { kind: "item", item, issues, unknownKeys };
}

export function loadItems(tasksDir: string): WorkItem[] {
  const items: WorkItem[] = [];
  walk(tasksDir, items);
  return items;
}

function walk(dir: string, items: WorkItem[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, items);
      continue;
    }
    if (!name.endsWith(".md")) continue;
    const item = tryLoadItem(full);
    if (item) items.push(item);
  }
}

export function tryLoadItem(filePath: string): WorkItem | null {
  const result = softTryLoadItem(filePath);
  if (result.kind === "skip") return null;
  if (result.kind === "fatal") {
    if (result.issues.some((i) => i.code === "UNKNOWN_TYPE")) return null;
    throw new Error(`${filePath}: ${result.issues[0]?.message ?? "invalid work item"}`);
  }
  if (result.issues.length > 0) {
    // Strict loader used by list/create: labels/depends_on type errors still throw
    const strictErr = result.issues.find(
      (i) => i.code === "INVALID_LABELS" || i.code === "INVALID_DEPENDS_ON",
    );
    if (strictErr) throw new Error(`${filePath}: ${strictErr.message}`);
  }
  return result.item;
}

export function itemsById(items: WorkItem[]): Map<string, WorkItem> {
  const map = new Map<string, WorkItem>();
  for (const item of items) {
    const prev = map.get(item.id);
    if (prev) {
      throw new Error(
        `Duplicate id '${item.id}' under tasks/ (${prev.filePath} and ${item.filePath})`,
      );
    }
    map.set(item.id, item);
  }
  return map;
}
