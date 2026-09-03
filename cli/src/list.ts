import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

export const WORK_ITEM_TYPES = ["initiative", "epic", "story", "task", "bug"] as const;
export const WORK_ITEM_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;

export type ListOptions = {
  dir: string;
  status?: string;
  type?: string;
  assignee?: string;
  json?: boolean;
};

export type ListDeps = {
  env?: NodeJS.ProcessEnv;
  resolveMe?: () => string | undefined;
};

export type ListResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type ListItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  assignee: string | null;
  parent: string | null;
  labels: string[];
  path: string;
};

const FRONTMATTER_OPEN = /^---\r?\n/;

export function resolveCurrentLogin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const user = env.GITHUB_USER?.trim();
  if (user) return user;
  const actor = env.GITHUB_ACTOR?.trim();
  if (actor) return actor;
  try {
    const out = execFileSync("gh", ["api", "user", "-q", ".login"], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env,
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

function fail(message: string): ListResult {
  return { stdout: "", stderr: `arggon list: ${message}\n`, exitCode: 1 };
}

function posixRel(from: string, to: string): string {
  return relative(from, to).split(sep).join("/");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Split leading YAML frontmatter. `yamlError` is set when fences exist but YAML is invalid. */
export function splitFrontmatter(content: string): {
  hasFence: boolean;
  yamlText: string;
  body: string;
  data: Record<string, unknown> | null;
  yamlError: string | null;
} {
  if (!FRONTMATTER_OPEN.test(content)) {
    return { hasFence: false, yamlText: "", body: content, data: null, yamlError: null };
  }
  const afterOpen = content.search(/\r?\n/);
  const rest = content.slice(afterOpen + 1);
  const close = rest.search(/\r?\n---(?:\r?\n|$)/);
  if (close === -1) {
    return {
      hasFence: true,
      yamlText: rest,
      body: "",
      data: null,
      yamlError: "missing closing --- fence",
    };
  }
  const yamlText = rest.slice(0, close);
  const afterYaml = rest.slice(close).replace(/^\r?\n---(?:\r?\n|$)/, "");
  try {
    const parsed: unknown = parseYaml(yamlText);
    if (!isRecord(parsed)) {
      return { hasFence: true, yamlText, body: afterYaml, data: null, yamlError: null };
    }
    return { hasFence: true, yamlText, body: afterYaml, data: parsed, yamlError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { hasFence: true, yamlText, body: afterYaml, data: null, yamlError: message };
  }
}

function firstH1(body: string): string | undefined {
  const match = body.match(/^#\s+(.+)$/m);
  const title = match?.[1]?.trim();
  return title || undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return String(value);
}

function asLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry));
}

function displayTitle(fmTitle: unknown, body: string, id: string): string {
  if (typeof fmTitle === "string" && fmTitle.trim()) return fmTitle.trim();
  return firstH1(body) ?? id;
}

function collectMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectMarkdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(path);
    }
  }
  return out;
}

function formatTable(items: ListItem[]): string {
  const headers = ["id", "type", "status", "assignee", "title"] as const;
  const rows = items.map((item) => [
    item.id,
    item.type,
    item.status,
    item.assignee ?? "-",
    item.title,
  ]);
  const all = [headers.map((h) => h), ...rows];
  const widths = headers.map((_, col) => Math.max(...all.map((row) => row[col].length)));
  const lines = all.map((row) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join("  "),
  );
  return `${lines.join("\n")}\n`;
}

function toJsonDocument(items: ListItem[]): string {
  const payload = {
    schemaVersion: 0,
    items: items.map((item) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      title: item.title,
      assignee: item.assignee,
      parent: item.parent,
      labels: item.labels,
      path: item.path,
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function runList(opts: ListOptions, deps: ListDeps = {}): ListResult {
  const typeFilter = opts.type;
  if (typeFilter !== undefined) {
    if (!(WORK_ITEM_TYPES as readonly string[]).includes(typeFilter)) {
      return fail(`unknown type "${typeFilter}". Allowed: ${WORK_ITEM_TYPES.join(", ")}`);
    }
  }
  const statusFilter = opts.status;
  if (statusFilter !== undefined) {
    if (!(WORK_ITEM_STATUSES as readonly string[]).includes(statusFilter)) {
      return fail(`unknown status "${statusFilter}". Allowed: ${WORK_ITEM_STATUSES.join(", ")}`);
    }
  }

  const env = deps.env ?? process.env;
  let assigneeFilter = opts.assignee;
  if (assigneeFilter === "@me") {
    const login = (deps.resolveMe ?? (() => resolveCurrentLogin(env)))();
    if (!login) {
      return fail(
        "could not resolve @me (set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
      );
    }
    assigneeFilter = login;
  }

  const root = resolve(opts.dir);
  const tasksPath = join(root, "tasks");
  if (!existsSync(tasksPath) || !statSync(tasksPath).isDirectory()) {
    return fail(`tasks/ not found in ${root} (looked for tasks/ in --dir; no walk-up)`);
  }

  let files: string[];
  try {
    files = collectMarkdownFiles(tasksPath).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message);
  }

  const items: ListItem[] = [];
  for (const filePath of files) {
    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(`could not read ${posixRel(root, filePath)}: ${message}`);
    }
    const fm = splitFrontmatter(content);
    const rel = posixRel(root, filePath);
    if (fm.yamlError) {
      return fail(`invalid YAML frontmatter in ${rel}: ${fm.yamlError}`);
    }
    if (!fm.data || !Object.prototype.hasOwnProperty.call(fm.data, "type")) {
      continue;
    }
    const id = asString(fm.data.id)?.trim() || basename(filePath, ".md");
    items.push({
      id,
      type: fm.data.type === undefined || fm.data.type === null ? "" : String(fm.data.type),
      status: fm.data.status === undefined || fm.data.status === null ? "" : String(fm.data.status),
      title: displayTitle(fm.data.title, fm.body, id),
      assignee: nullableString(fm.data.assignee),
      parent: nullableString(fm.data.parent),
      labels: asLabels(fm.data.labels),
      path: rel,
    });
  }

  const filtered = items.filter((item) => {
    if (typeFilter !== undefined && item.type !== typeFilter) return false;
    if (statusFilter !== undefined && item.status !== statusFilter) return false;
    if (assigneeFilter !== undefined && item.assignee !== assigneeFilter) return false;
    return true;
  });

  filtered.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const stdout = opts.json ? toJsonDocument(filtered) : formatTable(filtered);
  return { stdout, stderr: "", exitCode: 0 };
}
