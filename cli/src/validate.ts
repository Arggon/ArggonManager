import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { CONVENTION_VERSION, readConventionConfig, readConventionVersion } from "./convention.js";
import { assertValidId, BRANCH_PATTERN } from "./ids.js";
import { softTryLoadItem, walkTasksTree, type WorkItem } from "./items.js";
import { findTasksDir, newItemPath, repoRootFromTasks } from "./paths.js";
import { assertParentEdge, expectedParentType } from "./relations.js";
import { ASSIGNEE_PATTERN, assertClaimAndBlocked } from "./status.js";
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

type SoftItem = WorkItem & { relPath: string };

function posixRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

function push(bucket: Issue[], path: string, message: string, code: string): void {
  bucket.push({ path, message, code });
}

function checkItemShape(item: SoftItem, errors: Issue[]): void {
  const { relPath: rel, filePath, type, id, status, assignee, blockedReason, data } = item;

  try {
    assertValidId(id);
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "INVALID_ID");
  }

  if (type !== "task" && type !== "bug") {
    if (id.startsWith("task-") || id.startsWith("bug-")) {
      push(
        errors,
        rel,
        `container id '${id}' must not start with task- or bug-`,
        "INVALID_ID_PREFIX",
      );
    }
  } else {
    const prefix = type === "task" ? "task-" : "bug-";
    if (!id.startsWith(prefix)) {
      push(errors, rel, `${type} id must start with ${prefix}`, "INVALID_ID_PREFIX");
    }
  }

  const stem = basename(filePath, ".md");
  if (stem !== id) {
    push(errors, rel, `filename stem '${stem}' must equal id '${id}'`, "ID_FILENAME_MISMATCH");
  }
  if (type === "task" && !stem.startsWith("task-")) {
    push(errors, rel, "task filename must start with task-", "TYPE_FILENAME_MISMATCH");
  }
  if (type === "bug" && !stem.startsWith("bug-")) {
    push(errors, rel, "bug filename must start with bug-", "TYPE_FILENAME_MISMATCH");
  }

  if (data.assignee === "") {
    push(errors, rel, "assignee must not be an empty string", "INVALID_ASSIGNEE");
  }
  if (assignee && !ASSIGNEE_PATTERN.test(assignee)) {
    push(errors, rel, `invalid assignee '${assignee}'`, "INVALID_ASSIGNEE");
  }

  if (item.branch !== undefined && !BRANCH_PATTERN.test(item.branch)) {
    push(
      errors,
      rel,
      `invalid branch name ${JSON.stringify(item.branch)} (must be a single non-blank token)`,
      "INVALID_BRANCH",
    );
  }

  try {
    assertClaimAndBlocked({ type, status, assignee, blockedReason });
  } catch (err) {
    push(errors, rel, err instanceof Error ? err.message : String(err), "CLAIM_OR_BLOCKED");
  }

  for (const field of ["created", "updated"] as const) {
    const value = item[field];
    if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      push(
        errors,
        rel,
        `${field} must be YYYY-MM-DD (got ${JSON.stringify(value)})`,
        "INVALID_DATE",
      );
    }
  }

  const labelPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const seenLabels = new Set<string>();
  for (const label of item.labels) {
    if (!labelPattern.test(label)) {
      push(
        errors,
        rel,
        `label must be kebab-case ASCII (got ${JSON.stringify(label)})`,
        "INVALID_LABELS",
      );
    }
    if (seenLabels.has(label)) {
      push(errors, rel, `duplicate label ${JSON.stringify(label)}`, "INVALID_LABELS");
    }
    seenLabels.add(label);
  }
}

/**
 * Dependency graph pass (convention v3, ADR 0004): referential integrity and
 * acyclicity over `depends_on`. Advisory-only semantics — these are validate
 * errors, but dependencies never block updates (see docs/convention.md).
 */
function checkDependencies(items: SoftItem[], byId: Map<string, SoftItem>, errors: Issue[]): void {
  const graph = new Map<string, string[]>();
  for (const item of items) {
    const edges: string[] = [];
    for (const dep of item.dependsOn) {
      if (dep === item.id) {
        push(errors, item.relPath, `item '${item.id}' depends on itself`, "SELF_DEPENDENCY");
        continue; // self-loops are reported once here, not as cycles
      }
      if (!byId.has(dep)) {
        push(
          errors,
          item.relPath,
          `depends_on id '${dep}' does not resolve to an existing item`,
          "UNKNOWN_DEPENDENCY",
        );
        continue;
      }
      edges.push(dep);
    }
    graph.set(item.id, edges);
  }

  // Cycle detection (the graph must be a DAG): DFS with gray/black marking.
  // Each distinct cycle is reported once, anchored at its lexicographically
  // smallest member so the issue path is deterministic.
  const color = new Map<string, "gray" | "black">();
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (id: string): void => {
    color.set(id, "gray");
    stack.push(id);
    for (const dep of graph.get(id) ?? []) {
      const state = color.get(dep);
      if (state === "gray") {
        const cycle = [...stack.slice(stack.indexOf(dep)), dep];
        const key = [...cycle].sort().join("\u0000");
        if (!reported.has(key)) {
          reported.add(key);
          // Rotate the chain so it starts at the smallest id: the message and
          // anchor path stay deterministic regardless of traversal order.
          const anchorId = cycle.reduce((a, b) => (a < b ? a : b));
          const at = cycle.indexOf(anchorId);
          const chain = [...cycle.slice(at), ...cycle.slice(0, at)];
          const anchor = byId.get(anchorId);
          if (anchor) {
            push(
              errors,
              anchor.relPath,
              `dependency cycle: ${chain.join(" -> ")}`,
              "DEPENDENCY_CYCLE",
            );
          }
        }
      } else if (state === undefined) {
        visit(dep);
      }
    }
    stack.pop();
    color.set(id, "black");
  };
  for (const item of items) {
    if (!color.has(item.id)) visit(item.id);
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

  try {
    readConventionConfig(root);
  } catch (err) {
    push(
      errors,
      "tasks/.convention.yml",
      err instanceof Error ? err.message : String(err),
      "INVALID_BRANCH_PATTERN",
    );
  }

  const { files, dirs } = walkTasksTree(tasksDir);
  const items: SoftItem[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const rel = posixRel(root, file);
    const loaded = softTryLoadItem(file);
    if (loaded.kind === "skip") continue;
    if (loaded.kind === "fatal") {
      for (const issue of loaded.issues) {
        push(errors, rel, issue.message, issue.code);
      }
      continue;
    }
    for (const issue of loaded.issues) {
      push(errors, rel, issue.message, issue.code);
    }
    const reserved = new Set(["order", "rank", "blocked_by", "priority", "estimate"]);
    for (const key of loaded.unknownKeys) {
      if (reserved.has(key)) {
        push(errors, rel, `reserved frontmatter key '${key}' is invalid in v0`, "RESERVED_KEY");
      } else {
        push(warnings, rel, `unknown unnamespaced frontmatter key '${key}'`, "UNKNOWN_KEY");
      }
    }
    const soft: SoftItem = { ...loaded.item, relPath: rel };
    checkItemShape(soft, errors);
    items.push(soft);
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
  }

  for (const dir of dirs) {
    const name = basename(dir);
    if (name.startsWith(".")) continue;
    const index = join(dir, `${name}.md`);
    if (!existsSync(index)) {
      push(errors, posixRel(root, dir), `missing required index ${name}.md`, "MISSING_INDEX");
    }
  }

  checkDependencies(items, byId, errors);

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
