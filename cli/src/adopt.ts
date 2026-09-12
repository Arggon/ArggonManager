import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { readGeneratedState } from "./convention.js";
import { runCreate } from "./create.js";
import { runDoctor } from "./doctor.js";
import { itemId } from "./ids.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir } from "./paths.js";

/**
 * `arggon adopt` (story-adopt, task-adopt-command): agent-assisted adoption
 * for existing repos. Turns "start using ArggonManager here" into a tracked,
 * agent-executable migration task. Depends on the doctor pre-flight
 * (story-adoption-state): the tree must already be initialized — the adoption
 * checklist fills the arggon-generated docs that `arggon init` laid down.
 *
 * Two layers, deliberately split for testability:
 *  - `buildInventory(root)`: pure read — which governing docs exist, their
 *    sizes, whether they are arggon-managed (an `x-generated` provenance entry
 *    exists for the path) or adopter-owned, plus cheap stack-manifest hints.
 *  - `runAdopt(opts)`: command wiring — pre-flight, story resolution,
 *    idempotent task creation, dry-run.
 */

/** Id of the auto-created parent story (kernel adds no prefix for stories). */
export const ADOPT_STORY_ID = "story-arggon-adoption";
/** Title of the auto-created parent story. */
export const ADOPT_STORY_TITLE = "ArggonManager adoption";
/** Id stem of the adoption task (the kernel adds the task- prefix). */
export const ADOPT_TASK_STEM = "adopt-arggon";
/** Canonical adoption task id. */
export const ADOPT_TASK_ID = "task-adopt-arggon";
/** Title of the adoption task. */
export const ADOPT_TASK_TITLE = "Adopt ArggonManager in this repo";

/**
 * Governing docs the sweep considers (posix, relative to the repo root): the
 * standard arggon destinations plus the common alternates adopter repos use.
 * Absent paths are reported too, so the plan shows what init would add.
 */
export const ADOPT_SCAN_PATHS: string[] = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".editorconfig",
  "ARCHITECTURE.md",
  ".github/copilot-instructions.md",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "docs/convention.md",
  "docs/engineering.md",
  "docs/runbooks/README.md",
  "README.md",
  // Common alternates (adopter-owned conventions arggon does not generate).
  ".cursorrules",
  "docs/index.md",
  ".github/CONTRIBUTING.md",
  "docs/CONTRIBUTING.md",
];

/**
 * Stack manifests detected by filename only (cheap, at the repo root): input
 * for the checklist's playbook-creation step — one playbook per technology.
 */
export const STACK_MANIFESTS: string[] = [
  "package.json",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
];

/** One scanned governing doc (read-only snapshot). */
export type InventoryDoc = {
  /** Posix path relative to the repo root. */
  path: string;
  /** Whether the file exists on disk. */
  exists: boolean;
  /** Byte size on disk (0 when absent). */
  bytes: number;
  /**
   * True when an `x-generated` provenance entry exists for this path — the
   * file is part of the arggon-generated doc set (possibly edited since).
   * An existing file without an entry is adopter-owned (content to extract);
   * an absent file is neither (`exists: false`).
   */
  managed: boolean;
};

/** Pure-read inventory the dry-run reports and the checklist consumes. */
export type Inventory = {
  /** One entry per scanned path, sorted by path. */
  docs: InventoryDoc[];
  /** Stack manifest filenames found at the repo root (detection order). */
  stackHints: string[];
};

/**
 * Pure inventory logic: no writes, no tracker access, no CLI wiring.
 * `root` is the repo root (parent of tasks/).
 */
export function buildInventory(root: string): Inventory {
  const state = readGeneratedState(root);
  const docs: InventoryDoc[] = ADOPT_SCAN_PATHS.map((path) => {
    const abs = join(root, ...path.split("/"));
    if (!existsSync(abs)) {
      return { path, exists: false, bytes: 0, managed: state[path] !== undefined };
    }
    return {
      path,
      exists: true,
      bytes: statSync(abs).size,
      managed: state[path] !== undefined,
    };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const stackHints = STACK_MANIFESTS.filter((manifest) =>
    existsSync(join(root, manifest)),
  );
  return { docs, stackHints };
}

/**
 * The adoption task body: the full agent checklist (task-adopt-agent-playbook).
 * A template constant, verbatim via runCreate's `body` override — the
 * executing agent follows it end-to-end, so it must stay rich and ordered.
 */
export const ADOPT_TASK_BODY = `## Context

This repo is adopting ArggonManager over an existing documentation set: \`arggon init\` generated the governing docs (marked \`<!-- arggon:generated ... -->\`, with TODO placeholders), while any pre-existing docs were left untouched on disk. Your job as the executing agent: extract the valuable content from the adopter docs into the generated ones, archive what you replace, and report back on this task.

Current inventory (paths, sizes, managed vs adopter-owned, stack manifests):

\`\`\`
arggon adopt --dry-run --json
\`\`\`

## Checklist

- [ ] 1. Read the arggon-generated governing docs first: AGENTS.md, docs/convention.md, docs/engineering.md, docs/playbooks/ (if present). Follow them for the rest of this migration.
- [ ] 2. Sweep the existing repo docs (list them from the inventory above): extract the project description, conventions, workflows, and stack info. Extract, don't wholesale-copy — rewrite into the target doc's structure and drop duplicated or outdated material.
- [ ] 3. Complete the arggon-generated docs with the extracted content — fill the TODO placeholders: project description in AGENTS.md; CONTRIBUTING.md specifics (environment setup, build/test commands); ARCHITECTURE.md problem statement. The SECURITY.md contact is human input — leave it flagged for a human, never invent it.
- [ ] 4. Archive replaced originals to backup/<YYYY-MM-DD>/ preserving their relative paths (use today's date). Only docs you REPLACED get archived; never archive README.md — merge into it instead.
- [ ] 5. Detect the stack from the manifests (package.json / requirements.txt / go.mod / Cargo.toml / pom.xml); for each technology create a playbook (\`arggon playbook new <tech>\`), research current versions and best practices with dated sources, then record them with \`arggon playbook refresh <tech> --version <v>\`.
- [ ] 6. Verify: \`arggon validate\` + \`arggon spec validate\` (if specs exist) + \`arggon playbook status\`.
- [ ] 7. Report: comment on this task (\`arggon comment task-adopt-arggon\`) listing the extracted content, archived files, and created playbooks; flip this task done when the human reviews.
`;

export type AdoptOptions = {
  cwd: string;
  /** Parent story override; default is the auto-created story-arggon-adoption. */
  story?: string;
  /** Plan only: print/report the inventory and planned actions, write nothing. */
  dryRun?: boolean;
  /** Injection point for tests. */
  now?: Date;
};

export type AdoptResult = {
  /** Repo root (parent of tasks/). */
  root: string;
  dryRun: boolean;
  inventory: Inventory;
  /** Parent story of the adoption task (existing or planned). */
  storyId: string;
  /** True when this run created the story (always false in dry-run). */
  storyCreated: boolean;
  /** The adoption task id (task-adopt-arggon). */
  taskId: string;
  /** True when this run created the task (always false in dry-run). */
  taskCreated: boolean;
  /** True when an open adoption task already existed and creation was skipped. */
  skipped: boolean;
  /** Absolute path of the created or existing task file. */
  taskPath: string;
};

function firstEpicId(byId: Map<string, WorkItem>): string | null {
  const epics = [...byId.values()]
    .filter((item) => item.type === "epic")
    .map((item) => item.id)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return epics[0] ?? null;
}

/**
 * Adoption command: pre-flight (doctor), inventory, then create the tracked
 * adoption task with the checklist body. Idempotent: an existing open
 * (`todo`/`in_progress`) task-adopt-arggon is reported, not duplicated.
 * `--dry-run` creates nothing (not even the default story).
 */
export function runAdopt(opts: AdoptOptions): AdoptResult {
  // Pre-flight: same sources as `arggon doctor` (story-adoption-state).
  const doctor = runDoctor({ cwd: opts.cwd });
  if (!doctor.initialized || doctor.root === null) {
    throw new Error("not an arggon-managed tree — run `arggon init` first");
  }
  const root = doctor.root;
  const tasksDir = findTasksDir(opts.cwd);
  const dryRun = Boolean(opts.dryRun);
  const inventory = buildInventory(root);

  const byId = itemsById(loadItems(tasksDir));

  // Resolve the parent story: explicit --story, else the shared auto story
  // (created under the first epic, lexicographic — same pattern as import-issues).
  let storyId: string;
  let storyCreated = false;
  if (opts.story !== undefined) {
    const parent = byId.get(opts.story);
    if (!parent) {
      throw new Error(`--story '${opts.story}' does not resolve to an existing item under tasks/`);
    }
    if (parent.type !== "story") {
      throw new Error(
        `--story '${opts.story}' is a ${parent.type}, not a story — the adoption task needs a story parent`,
      );
    }
    storyId = parent.id;
  } else if (byId.has(ADOPT_STORY_ID)) {
    const existing = byId.get(ADOPT_STORY_ID)!;
    if (existing.type !== "story") {
      throw new Error(
        `id '${ADOPT_STORY_ID}' already exists as a ${existing.type} — pass --story <story-id> to choose the parent story`,
      );
    }
    storyId = ADOPT_STORY_ID;
  } else {
    const epicId = firstEpicId(byId);
    if (epicId === null) {
      throw new Error(
        "no epic found under tasks/ — the adoption story needs a parent epic. " +
          "Create one with `arggon create epic <title> --parent <initiative-id>` or pass --story <story-id>",
      );
    }
    if (!dryRun) {
      runCreate({
        cwd: opts.cwd,
        type: "story",
        title: ADOPT_STORY_TITLE,
        // Container ids keep their full stem (only leaves get a kernel prefix).
        id: ADOPT_STORY_ID,
        parent: epicId,
        now: opts.now,
      });
      storyCreated = true;
    }
    storyId = ADOPT_STORY_ID;
  }

  // Idempotency: an open adoption task is reported, never duplicated. A
  // terminal one means adoption already completed — re-running is an error,
  // not a silent no-op.
  const existingTask = byId.get(ADOPT_TASK_ID);
  if (existingTask) {
    if (existingTask.status === "todo" || existingTask.status === "in_progress") {
      return {
        root,
        dryRun,
        inventory,
        storyId: existingTask.parent ?? storyId,
        storyCreated: false,
        taskId: existingTask.id,
        taskCreated: false,
        skipped: true,
        taskPath: existingTask.filePath,
      };
    }
    throw new Error(
      `${ADOPT_TASK_ID} already exists (${existingTask.status}) — adoption already completed. ` +
        "Create a fresh task manually if you need to re-run the migration.",
    );
  }

  if (!dryRun) {
    const created = runCreate({
      cwd: opts.cwd,
      type: "task",
      title: ADOPT_TASK_TITLE,
      parent: storyId,
      id: ADOPT_TASK_STEM,
      body: ADOPT_TASK_BODY,
      now: opts.now,
    });
    return {
      root,
      dryRun,
      inventory,
      storyId,
      storyCreated,
      taskId: created.id,
      taskCreated: true,
      skipped: false,
      taskPath: created.path,
    };
  }
  return {
    root,
    dryRun,
    inventory,
    storyId,
    storyCreated: false,
    taskId: itemId("task", ADOPT_TASK_STEM),
    taskCreated: false,
    skipped: false,
    taskPath: "(dry run — not created)",
  };
}

/** Human-readable summary (pairs with the adopt --json payload). */
export function formatAdoptReport(result: AdoptResult): string {
  const present = result.inventory.docs.filter((doc) => doc.exists);
  const managed = present.filter((doc) => doc.managed);
  const adopterOwned = present.filter((doc) => !doc.managed);
  const absent = result.inventory.docs.length - present.length;

  const lines: string[] = [];
  const action = result.skipped
    ? `already tracked as ${result.taskId} (open adoption task — skipped)`
    : result.dryRun
      ? `would create ${result.taskId} under ${result.storyId}`
      : `${result.taskId} under ${result.storyId}`;
  lines.push(`arggon adopt${result.dryRun && !result.skipped ? " (dry run)" : ""}: ${action}`);
  if (!result.dryRun && !result.skipped) {
    lines.push(`  ${result.taskPath}`);
  }
  const storyState = result.skipped
    ? "(existing)"
    : result.storyCreated
      ? "(created)"
      : result.dryRun
        ? "(would create when missing)"
        : "(existing)";
  lines.push(`  story: ${result.storyId} ${storyState}`);
  lines.push(
    `  docs: ${result.inventory.docs.length} scanned — ` +
      `${present.length} present (${managed.length} arggon-managed, ${adopterOwned.length} adopter-owned), ${absent} absent`,
  );
  if (result.dryRun && !result.skipped) {
    for (const doc of result.inventory.docs) {
      const label = !doc.exists ? "absent" : doc.managed ? "managed" : "adopter";
      const size = doc.exists ? ` — ${doc.bytes} B` : "";
      lines.push(`    [${label}] ${doc.path}${size}`);
    }
  }
  if (result.inventory.stackHints.length > 0) {
    lines.push(`  stack hints: ${result.inventory.stackHints.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}
