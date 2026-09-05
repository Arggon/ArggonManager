import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { readConventionVersion, CONVENTION_VERSION } from "./convention.js";
import { parseFrontmatter, stringArrayField, stringField } from "./frontmatter.js";
import { assertValidId, isItemType, type ItemType } from "./ids.js";
import { findTasksDir, newItemPath, repoRootFromTasks } from "./paths.js";
import { assertParentEdge, expectedParentType } from "./relations.js";
import { ASSIGNEE_PATTERN, assertClaimAndBlocked, isStatus, type Status } from "./status.js";
import type { Issue } from "./types.js";

export type ValidateOptions = {
  cwd: string;
};

export type ValidateResult = {
  root: string;
  conventionVersion: number;
  errors: Issue[];
  warnings: Issue[];
};

type SoftItem = {
  type: ItemType;
  status: Status;
  id: string;
  title?: string;
  assignee?: string | null;
  parent?: string | null;
  labels: string[];
  blockedReason?: string;
  filePath: string;
  containerDir: string;
  relPath: string;
};

function posixRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

function push(errors: Issue[], path: string, message: string, code: string): void {
  errors.push({ path, message, code });
}

/** Collect every file and directory under tasks/ (skipping dotfiles). */
function walkTree(dir: string): { files: string[]; dirs: string[] } {
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

function softLoad(filePath: string, root: string, errors: Issue[]): SoftItem | null {
  const rel = posixRel(root, filePath);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "READ_FAILED");
    return null;
  }
  if (!raw.startsWith("---")) return null;

  let data: Record<string, unknown>;
  try {
    ({ data } = parseFrontmatter(raw));
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "BROKEN_YAML");
    return null;
  }

  const typeRaw = stringField(data, "type");
  if (!typeRaw) return null; // not a work item
  if (!isItemType(typeRaw)) {
    push(errors, rel, `unknown type '${typeRaw}'`, "UNKNOWN_TYPE");
    return null;
  }

  const id = stringField(data, "id");
  if (!id) {
    push(errors, rel, "missing required field id", "MISSING_ID");
    return null;
  }

  const statusRaw = stringField(data, "status");
  if (!statusRaw) {
    push(errors, rel, "missing required field status", "MISSING_STATUS");
    return null;
  }
  if (!isStatus(statusRaw)) {
    push(errors, rel, `unknown status '${statusRaw}'`, "UNKNOWN_STATUS");
    return null;
  }

  try {
    assertValidId(id);
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "INVALID_ID");
  }

  if (typeRaw !== "task" && typeRaw !== "bug") {
    if (id.startsWith("task-") || id.startsWith("bug-")) {
      push(
        errors,
        rel,
        `container id '${id}' must not start with task- or bug-`,
        "INVALID_ID_PREFIX",
      );
    }
  } else {
    const prefix = typeRaw === "task" ? "task-" : "bug-";
    if (!id.startsWith(prefix)) {
      push(errors, rel, `${typeRaw} id must start with ${prefix}`, "INVALID_ID_PREFIX");
    }
  }

  const stem = basename(filePath, ".md");
  if (stem !== id) {
    push(errors, rel, `filename stem '${stem}' must equal id '${id}'`, "ID_FILENAME_MISMATCH");
  }

  if (typeRaw === "task" && !stem.startsWith("task-")) {
    push(errors, rel, "task filename must start with task-", "TYPE_FILENAME_MISMATCH");
  }
  if (typeRaw === "bug" && !stem.startsWith("bug-")) {
    push(errors, rel, "bug filename must start with bug-", "TYPE_FILENAME_MISMATCH");
  }

  const assigneeField = data.assignee;
  if (assigneeField === "") {
    push(errors, rel, "assignee must not be an empty string", "INVALID_ASSIGNEE");
  }
  const assignee = stringField(data, "assignee") ?? null;
  if (assignee && !ASSIGNEE_PATTERN.test(assignee)) {
    push(errors, rel, `invalid assignee '${assignee}'`, "INVALID_ASSIGNEE");
  }

  const blockedReason = stringField(data, "blocked_reason");
  try {
    assertClaimAndBlocked({
      type: typeRaw,
      status: statusRaw,
      assignee,
      blockedReason,
    });
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "CLAIM_OR_BLOCKED");
  }

  // Unknown unnamespaced keys → warning
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
  for (const key of Object.keys(data)) {
    if (!official.has(key) && !key.startsWith("x-") && key !== "extensions") {
      // warnings collected by caller via side channel — use a deferred list
    }
  }

  let labels: string[] = [];
  try {
    labels = stringArrayField(data, "labels");
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "INVALID_LABELS");
  }

  return {
    type: typeRaw,
    status: statusRaw,
    id,
    title: stringField(data, "title"),
    assignee,
    parent: stringField(data, "parent") ?? null,
    labels,
    blockedReason,
    filePath,
    containerDir: dirname(filePath),
    relPath: rel,
  };
}

function collectWarnings(
  filePath: string,
  root: string,
  data: Record<string, unknown>,
  warnings: Issue[],
): void {
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
  const rel = posixRel(root, filePath);
  for (const key of Object.keys(data)) {
    if (!official.has(key) && !key.startsWith("x-") && key !== "extensions") {
      warnings.push({
        path: rel,
        message: `unknown unnamespaced frontmatter key '${key}'`,
        code: "UNKNOWN_KEY",
      });
    }
  }
}

export function runValidate(opts: ValidateOptions): ValidateResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const conventionVersion = readConventionVersion(root);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  if (conventionVersion > CONVENTION_VERSION) {
    push(
      errors,
      "tasks/.convention.yml",
      `convention version ${conventionVersion} is newer than supported ${CONVENTION_VERSION}`,
      "CONVENTION_VERSION",
    );
    return { root, conventionVersion, errors, warnings };
  }

  const { files, dirs } = walkTree(tasksDir);
  const items: SoftItem[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    // Re-parse for warnings after softLoad
    const item = softLoad(file, root, errors);
    if (!item) {
      // may still be a typed file that failed earlier — try warning parse if type present
      continue;
    }
    try {
      const raw = readFileSync(file, "utf8");
      const { data } = parseFrontmatter(raw);
      collectWarnings(file, root, data, warnings);
    } catch {
      /* already reported */
    }
    items.push(item);
  }

  const byId = new Map<string, SoftItem>();
  for (const item of items) {
    const prev = byId.get(item.id);
    if (prev) {
      push(
        errors,
        item.relPath,
        `duplicate id '${item.id}' (also ${prev.relPath})`,
        "DUPLICATE_ID",
      );
      continue;
    }
    byId.set(item.id, item);
  }

  for (const item of items) {
    const expected = expectedParentType(item.type);
    if (expected === null) {
      if (item.parent) {
        push(errors, item.relPath, "initiative cannot have a parent", "PARENT_FORBIDDEN");
      }
    } else if (!item.parent) {
      push(
        errors,
        item.relPath,
        `${item.type} requires parent type ${expected}`,
        "PARENT_REQUIRED",
      );
    } else {
      const parentItem = byId.get(item.parent);
      if (!parentItem) {
        push(
          errors,
          item.relPath,
          `parent '${item.parent}' does not resolve to an existing item`,
          "PARENT_MISSING",
        );
      } else {
        try {
          assertParentEdge(item.type, parentItem.type);
        } catch (err) {
          push(
            errors,
            item.relPath,
            err instanceof Error ? err.message : String(err),
            "PARENT_TYPE",
          );
        }
        // filesystem parent must match parent's container
        const expectedPath = newItemPath({
          tasksDir,
          type: item.type,
          id: item.id,
          parentContainerDir: parentItem.containerDir,
        });
        if (item.filePath !== expectedPath) {
          push(
            errors,
            item.relPath,
            `path does not match parent '${item.parent}' (expected ${posixRel(root, expectedPath)})`,
            "PARENT_PATH_MISMATCH",
          );
        }
      }
    }

    if (item.type === "initiative") {
      const expectedPath = newItemPath({ tasksDir, type: "initiative", id: item.id });
      if (item.filePath !== expectedPath) {
        push(
          errors,
          item.relPath,
          `initiative path should be ${posixRel(root, expectedPath)}`,
          "TYPE_PATH_MISMATCH",
        );
      }
    }

    // Leaves only under story (also caught by parent type + path)
    if (item.type === "task" || item.type === "bug") {
      const parentDir = dirname(item.filePath);
      const index = join(parentDir, `${basename(parentDir)}.md`);
      if (existsSync(index)) {
        // parent index type checked via parent edge when parent resolves
      }
    }
  }

  // Every directory under tasks/ is a container and needs index <dirname>.md
  for (const dir of dirs) {
    const name = basename(dir);
    if (name.startsWith(".")) continue;
    const index = join(dir, `${name}.md`);
    if (!existsSync(index)) {
      push(errors, posixRel(root, dir), `missing required index ${name}.md`, "MISSING_INDEX");
    }
  }

  // Unknown directories under a story: only index + task-*.md / bug-*.md
  for (const item of items) {
    if (item.type !== "story") continue;
    const dir = item.containerDir;
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".")) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        push(
          errors,
          posixRel(root, full),
          "unknown directory under story (v0 allows only task-*.md / bug-*.md)",
          "UNKNOWN_STORY_CHILD",
        );
        continue;
      }
      if (!name.endsWith(".md")) continue;
      if (name === `${item.id}.md`) continue;
      if (name.startsWith("task-") || name.startsWith("bug-")) continue;
      push(
        errors,
        posixRel(root, full),
        "unknown file under story (v0 allows only index + task-*.md / bug-*.md)",
        "UNKNOWN_STORY_CHILD",
      );
    }
  }

  errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  warnings.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return { root, conventionVersion, errors, warnings };
}

export function formatValidateHuman(result: ValidateResult): string {
  const lines: string[] = [];
  for (const e of result.errors) {
    lines.push(`error ${e.path}: ${e.message} [${e.code}]`);
  }
  for (const w of result.warnings) {
    lines.push(`warning ${w.path}: ${w.message} [${w.code}]`);
  }
  if (result.errors.length === 0) {
    lines.push(
      `arggon validate: ok (${result.warnings.length} warning(s), convention v${result.conventionVersion})`,
    );
  } else {
    lines.push(
      `arggon validate: failed with ${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
    );
  }
  return `${lines.join("\n")}\n`;
}
