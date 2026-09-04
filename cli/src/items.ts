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
  parent?: string | null;
  labels: string[];
  created?: string;
  updated?: string;
  blockedReason?: string;
  extras: Frontmatter;
  filePath: string;
  containerDir: string;
  data: Frontmatter;
  body: string;
};

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
  const raw = readFileSync(filePath, "utf8");
  if (!raw.startsWith("---")) return null;
  const { data, body } = parseFrontmatter(raw);
  const typeRaw = stringField(data, "type");
  if (!typeRaw || !isItemType(typeRaw)) return null;
  const id = stringField(data, "id");
  if (!id) {
    throw new Error(`${filePath}: work item missing id`);
  }
  const statusRaw = stringField(data, "status");
  if (!statusRaw || !isStatus(statusRaw)) {
    throw new Error(`${filePath}: invalid or missing status`);
  }
  const official = new Set([
    "type",
    "status",
    "id",
    "title",
    "assignee",
    "parent",
    "labels",
    "created",
    "updated",
    "blocked_reason",
  ]);
  const extras: Frontmatter = {};
  for (const [k, v] of Object.entries(data)) {
    if (!official.has(k)) extras[k] = v;
  }
  return {
    type: typeRaw,
    status: statusRaw,
    id,
    title: stringField(data, "title"),
    assignee: stringField(data, "assignee") ?? null,
    parent: stringField(data, "parent") ?? null,
    labels: stringArrayField(data, "labels"),
    created: stringField(data, "created"),
    updated: stringField(data, "updated"),
    blockedReason: stringField(data, "blocked_reason"),
    extras,
    filePath,
    containerDir: dirname(filePath),
    data,
    body,
  };
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
