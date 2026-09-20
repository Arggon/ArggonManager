import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  TRACKER_DIR_NAME,
  commitTrackerMutation,
  conventionPathForRoot,
  docsDirForRoot,
  findTasksDir,
  formatCommitLine,
  itemId,
  itemsById,
  loadItems,
  parseFrontmatter,
  readAutoCommitConfig,
  readGeneratedProjectName,
  readGeneratedState,
  resolveAutoCommit,
  runCreate,
  sanitizeHumanTextUncapped,
  stringField,
  trackerCommitMessage,
  updateGeneratedSection,
  writeFileAtomic,
  type GeneratedEntry,
  type TrackerCommitResult,
  type WorkItem,
} from "@arggon/lib";

import { arggonVersion, checksumOf } from "./docs.js";
import { bundledTemplatesDir } from "./package-assets.js";

import { runDoctor } from "./doctor.js";

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
 *
 * Plus `runAdoptAck(opts)` (`--ack`, task-adopt-checksum-refresh): a
 * standalone acknowledgment that makes the CURRENT on-disk content of every
 * generated doc the new `x-generated` baseline, so the sanctioned sweep edits
 * stop reporting as adopter-modified while later hand edits stay protected.
 */

/** Id of the auto-created parent story (kernel adds no prefix for stories). */
export const ADOPT_STORY_ID = "story-arggon-adoption";
/** Title of the auto-created parent story. */
export const ADOPT_STORY_TITLE = "ArggonManager adoption";
/** Title of the auto-created initiative and epic containers (same title both). */
export const ADOPT_CONTAINER_TITLE = "ArggonManager adoption";
/**
 * Id of the auto-created initiative container (task-start-dirty-scope-adopt-hierarchy):
 * created only when the tree has NO epic at all (e.g. a fresh `init --full`
 * tree scaffolds no hierarchy). Ids are globally unique, so the epic uses a
 * distinct id (`epic-arggon-adoption`).
 */
export const ADOPT_INITIATIVE_ID = "arggon-adoption";
/** Id of the auto-created epic container (see ADOPT_INITIATIVE_ID). */
export const ADOPT_EPIC_ID = "epic-arggon-adoption";
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
  "docs/deploy.md",
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

/**
 * Spec-corpus formats detected by fingerprint at inventory time
 * (task-adopt-corpus-fingerprints): an existing documentation corpus the
 * adoption sweep should know about before it touches anything. Pure read.
 */
export type CorpusFormat = "openspec" | "arggon" | "adr" | "rfc";

/** One detected spec corpus (inventory snapshot). */
export type DetectedCorpus = {
  /** Fingerprint family the corpus matched. */
  format: CorpusFormat;
  /** Number of corpus files matched. */
  files: number;
  /** The tool/practice the corpus originates from. */
  origin: string;
};

/**
 * Fingerprint rules (posix, relative to the repo root) — multiple corpora can
 * coexist and are all reported:
 *  - `openspec`: `openspec/config.yaml` present; file count is the number of
 *    `openspec/specs/<capability>/spec.md` files.
 *  - `arggon`: `docs/specs/spec-*.md` files carrying arggon frontmatter (a
 *    `spec_id` field) — the already-migrated corpus.
 *  - `adr`: a `docs/adr/` directory with `*.md` records.
 *  - `rfc`: RFC markdown under `docs/rfc/` or `rfc/`.
 */
export function detectSpecCorpora(root: string): DetectedCorpus[] {
  const corpora: DetectedCorpus[] = [];
  const countMd = (dir: string): number => {
    try {
      return readdirSync(dir).filter((name) => name.endsWith(".md")).length;
    } catch {
      return 0;
    }
  };
  // OpenSpec: config.yaml plus per-capability spec.md files.
  if (existsSync(join(root, "openspec", "config.yaml"))) {
    const specsDir = join(root, "openspec", "specs");
    let files = 0;
    let entries: string[] = [];
    try {
      entries = existsSync(specsDir) ? readdirSync(specsDir) : [];
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (existsSync(join(specsDir, entry, "spec.md"))) files++;
    }
    corpora.push({ format: "openspec", files, origin: "OpenSpec" });
  }
  // Already-migrated arggon specs: spec-*.md with a `spec_id` frontmatter field.
  const arggonSpecsDir = join(docsDirForRoot(root), "specs");
  if (existsSync(arggonSpecsDir)) {
    let files = 0;
    let entries: string[] = [];
    try {
      entries = readdirSync(arggonSpecsDir);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!/^spec-.*\.md$/.test(entry)) continue;
      try {
        const data = parseFrontmatter(readFileSync(join(arggonSpecsDir, entry), "utf8")).data;
        if (stringField(data, "spec_id") !== undefined) files++;
      } catch {
        // Unreadable/malformed file: not a fingerprint match.
      }
    }
    if (files > 0) {
      corpora.push({ format: "arggon", files, origin: "ArggonManager" });
    }
  }
  // ADR directory.
  const adrDir = join(docsDirForRoot(root), "adr");
  if (existsSync(adrDir)) {
    const files = countMd(adrDir);
    if (files > 0) {
      corpora.push({ format: "adr", files, origin: "ADR" });
    }
  }
  // RFC markdown (docs/rfc/ preferred, plain rfc/ as the alternate).
  const docsRel = relative(root, docsDirForRoot(root)).split(sep).join("/");
  for (const rfcRel of [`${docsRel}/rfc`, "rfc"]) {
    const abs = join(root, ...rfcRel.split("/"));
    if (!existsSync(abs)) continue;
    const files = countMd(abs);
    if (files > 0) {
      corpora.push({ format: "rfc", files, origin: "RFC" });
      break;
    }
  }
  return corpora;
}

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
  /**
   * Spec corpora detected by fingerprint (task-adopt-corpus-fingerprints),
   * in detection order: openspec, arggon, adr, rfc. Empty when the tree has
   * no spec corpus.
   */
  corpora: DetectedCorpus[];
};

/**
 * Pure inventory logic: no writes, no tracker access, no CLI wiring.
 * `root` is the repo root (parent of the tracker dir).
 */
export function buildInventory(root: string): Inventory {
  const state = readGeneratedState(root);
  const docsRel = relative(root, docsDirForRoot(root)).split(sep).join("/");
  const docs: InventoryDoc[] = ADOPT_SCAN_PATHS.map((path) => {
    // Layout-aware scan (ADR 0012): `docs/...` scan paths resolve under the
    // product-docs dir — `ArggonManager/docs/...` on v5 trees, unchanged on
    // legacy trees. The x-generated state keys use the same resolved path.
    const resolved =
      docsRel !== "docs" && path.startsWith("docs/")
        ? `${docsRel}/${path.slice("docs/".length)}`
        : path;
    const abs = join(root, ...resolved.split("/"));
    if (!existsSync(abs)) {
      return { path: resolved, exists: false, bytes: 0, managed: state[resolved] !== undefined };
    }
    return {
      path: resolved,
      exists: true,
      bytes: statSync(abs).size,
      managed: state[resolved] !== undefined,
    };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const stackHints = STACK_MANIFESTS.filter((manifest) => existsSync(join(root, manifest)));
  return { docs, stackHints, corpora: detectSpecCorpora(root) };
}

/**
 * The generic (no-corpus) spec-corpus section of the adoption task body: the
 * detection-fingerprint primer. Kept as a constant so composeAdoptTaskBody
 * can swap it out verbatim when corpora were detected.
 */
const ADOPT_CORPUS_SECTION_GENERIC = `## Spec corpus (if the repo has one)

Detection fingerprints (run before the prose sweep above):
- \`openspec/config.yaml\` + \`specs/*/spec.md\` = OpenSpec corpus.
- \`ArggonManager/docs/specs/spec-*.md\` with arggon frontmatter = already migrated (skip).
- ADR directories, RFC markdown = other formats (map conservatively into the same phases).
No corpus: skip this section.

`;

/**
 * The adoption task body: the full agent checklist (task-adopt-agent-playbook).
 * A template constant, verbatim via runCreate's `body` override — the
 * executing agent follows it end-to-end, so it must stay rich and ordered.
 * With detected corpora, composeAdoptTaskBody swaps the generic corpus
 * section (interpolated above) for a concrete one; without corpora the
 * composed body is byte-identical to this constant.
 */
export const ADOPT_TASK_BODY = `## Context

This repo is adopting ArggonManager over an existing documentation set: \`arggon init\` generated the governing docs (marked \`<!-- arggon:generated ... -->\`, with TODO placeholders), while any pre-existing docs were left untouched on disk. Your job as the executing agent: extract the valuable content from the adopter docs into the generated ones, archive what you replace, and report back on this task.

Current inventory (paths, sizes, managed vs adopter-owned, stack manifests):

\`\`\`
arggon adopt --dry-run --json
\`\`\`

## Checklist

- [ ] 1. Read the arggon-generated governing docs first: AGENTS.md, \`ArggonManager/docs/convention.md\`, \`ArggonManager/docs/engineering.md\`, \`ArggonManager/docs/playbooks/\` (if present). Follow them for the rest of this migration.
- [ ] 2. Sweep the existing repo docs (list them from the inventory above): extract the project description, conventions, workflows, and stack info. Extract, don't wholesale-copy — rewrite into the target doc's structure and drop duplicated or outdated material.
- [ ] 3. Complete the arggon-generated docs with the extracted content — fill the TODO placeholders: project description in AGENTS.md; CONTRIBUTING.md specifics (environment setup, build/test commands); ARCHITECTURE.md problem statement. The SECURITY.md contact is human input — leave it flagged for a human, never invent it.
- [ ] 4. Archive replaced originals to backup/<YYYY-MM-DD>/ preserving their relative paths (use today's date). Only docs you REPLACED get archived; never archive README.md — merge into it instead.
- [ ] 5. Detect the stack from the manifests (package.json / requirements.txt / go.mod / Cargo.toml / pom.xml); for each technology create a playbook (\`arggon playbook new <tech>\`), research current versions and best practices with dated sources, then record them with \`arggon playbook refresh <tech> --version <v>\`.
- [ ] 6. Baseline the sanctioned edits: run \`arggon adopt --ack\` so the generated docs you completed in step 3 become the new x-generated baseline (their checksums are refreshed and they stop reporting as modified). Hand edits made AFTER this ack leave the file adopter-owned: init re-runs never overwrite or regenerate it, and \`arggon doctor\` surfaces any such edit in the informational \`acknowledgedDrifted\` bucket (it never counts as \`modified\`).
- [ ] 7. Verify: \`arggon validate\` + \`arggon spec validate\` (if specs exist) + \`arggon playbook status\`.
- [ ] 8. Report: comment on this task (\`arggon comment task-adopt-arggon\`) listing the extracted content, archived files, and created playbooks; flip this task done when the human reviews.

${ADOPT_CORPUS_SECTION_GENERIC}- [ ] 9. Fase 0 — Mapeo: build the format->template table per spec. OpenSpec mapping: \`## Purpose\` -> Purpose; \`## Requirements\` (\`### Requirement:\` / \`#### Scenario:\` Given/When/Then) -> Acceptance criteria verbatim; add a \`### Verification checklist\` per requirement; provenance as an italic line (source path + date).
- [ ] 10. Fase 1 — Migración 1:1: one new spec per capability with the mapped content. Mechanical, no judgment. Zero-loss assertion: re-assembled content == source body (normalized).
- [ ] 11. Fase 2 — Auditoría: duplication detection (shingle-Jaccard similarity + shared verbatim requirement/scenario titles) -> candidates classified DUPLICATE / MERGE / KEEP-SEPARATE with evidence.
- [ ] 12. Fase 3 — Consolidación: apply merges (strictest copy wins on divergence); citation sweep for absorbed ids; new shared-pattern spec where patterns repeat. Consolidation reconciles, never deletes normative text; file deletion only after verified absorption.
- [ ] 13. Fase 4 — Refactor al contrato in file-disjoint waves: real Synopsis, TBDs filled from code, error paths verified against the implementation — inventing SHALLs forbidden. Spec-code gaps -> tracker items.
- [ ] 14. Gates per phase: \`arggon spec validate\` 0 errors / 0 warnings; \`arggon spec analyze\` with no NEW findings vs the baseline (orphans reported and accepted, never cosmetically cited). Consolidar antes de reescribir. One requirement one owner (reference by spec_id); implemented = verified against code.
`;

/**
 * Compose the adoption task body for the detected spec corpora
 * (task-adopt-corpus-body-injection). With no corpora the body is the static
 * template, byte-identical. With corpora, the generic fingerprint primer is
 * replaced by a concrete section (format, file count, origin, in detection
 * order) and the executing agent is pointed at the phased checklist below —
 * the detection already ran, so the section is no longer conditional.
 * Deterministic: corpora appear in the order detection reports them.
 *
 * `docsRel` is the product-docs dir relative to the repo root
 * (`ArggonManager/docs` on v5 trees — the default — or `docs` on legacy
 * trees); the body's doc references are remapped accordingly.
 */
export function composeAdoptTaskBody(
  corpora: DetectedCorpus[],
  docsRel: string = `${TRACKER_DIR_NAME}/docs`,
): string {
  const base =
    docsRel === `${TRACKER_DIR_NAME}/docs`
      ? ADOPT_TASK_BODY
      : ADOPT_TASK_BODY.replaceAll(`${TRACKER_DIR_NAME}/docs`, docsRel);
  if (corpora.length === 0) return base;
  const list = corpora
    .map((corpus) => `- \`${corpus.format}\` — ${corpus.files} file(s), origin: ${corpus.origin}.`)
    .join("\n");
  const concrete =
    `## Spec corpus — detected\n\n` +
    `Detection already ran at inventory time (fingerprint match — do not re-derive it). ` +
    `This repo has ${corpora.length} spec ${corpora.length === 1 ? "corpus" : "corpora"}:\n` +
    `${list}\n\n` +
    `Follow the phased checklist below (Fase 0–4 + gates) for THIS corpus, in the order listed. ` +
    `OpenSpec corpora map per the Fase 0 table; other formats map conservatively into the same phases.\n\n`;
  return base.replace(ADOPT_CORPUS_SECTION_GENERIC, concrete);
}

export type AdoptOptions = {
  cwd: string;
  /** Parent story override; default is the auto-created story-arggon-adoption. */
  story?: string;
  /** Plan only: print/report the inventory and planned actions, write nothing. */
  dryRun?: boolean;
  /**
   * Auto-commit the files written this run (tracker hygiene): ONE commit
   * covering the adoption task and (when created) its story. `undefined`
   * resolves via `x-tracker.auto-commit` config, default ON.
   */
  commit?: boolean;
  /** Injection point for tests. */
  now?: Date;
};

export type AdoptResult = {
  /** Repo root (parent of the tracker dir). */
  root: string;
  dryRun: boolean;
  inventory: Inventory;
  /** Parent story of the adoption task (existing or planned). */
  storyId: string;
  /** True when this run created the story (always false in dry-run). */
  storyCreated: boolean;
  /**
   * Container ids auto-created this run (task-start-dirty-scope-adopt-hierarchy):
   * the initiative and epic chain when the tree had no epic (fresh `init
   * --full`). Empty when an epic already existed, `--story` was passed, or on
   * the idempotent-skip path. In dry-run the planned ids are listed (nothing
   * is written).
   */
  createdContainers: string[];
  /** The adoption task id (task-adopt-arggon). */
  taskId: string;
  /** True when this run created the task (always false in dry-run). */
  taskCreated: boolean;
  /** True when an open adoption task already existed and creation was skipped. */
  skipped: boolean;
  /** Absolute path of the created or existing task file. */
  taskPath: string;
  /** Tracker auto-commit outcome for the files written this run. */
  commit?: TrackerCommitResult;
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

  // Tracker hygiene (task-auto-commit-tracker): one commit covering the files
  // written this run (the adoption task plus, when created, its story). The
  // internal runCreate calls suppress their own auto-commit. The message
  // references the primary item id (the adoption task; its story on the
  // story-only path).
  const autoCommit = resolveAutoCommit(opts.commit, readAutoCommitConfig(root));
  const writtenPaths: string[] = [];
  const commitWritten = (primaryId: string): TrackerCommitResult | undefined => {
    if (writtenPaths.length === 0) return undefined;
    return commitTrackerMutation(root, writtenPaths, {
      message: trackerCommitMessage("adopted", [primaryId]),
      commit: autoCommit,
    });
  };

  // Resolve the parent story: explicit --story, else the shared auto story
  // (created under the first epic, lexicographic — same pattern as import-issues).
  // When the tree has NO epic at all (e.g. a fresh `init --full` tree scaffolds
  // no hierarchy), the minimal container chain is auto-created
  // (task-start-dirty-scope-adopt-hierarchy): initiative `arggon-adoption` →
  // epic `epic-arggon-adoption` → the adoption story. Adopting an EXISTING repo
  // that already has its own structure should pass --story to place the task
  // under the right story instead of relying on the containers.
  let storyId: string;
  let storyCreated = false;
  const createdContainers: string[] = [];
  if (opts.story !== undefined) {
    const parent = byId.get(opts.story);
    if (!parent) {
      throw new Error(
        `--story '${opts.story}' does not resolve to an existing item in the tracker`,
      );
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
    let epicId = firstEpicId(byId);
    if (epicId === null) {
      // No epic anywhere: build the minimal chain. Existing items with the
      // container ids are reused as-is (never duplicated).
      if (!dryRun) {
        const existingInitiative = byId.get(ADOPT_INITIATIVE_ID);
        if (!existingInitiative) {
          const initiative = runCreate({
            cwd: opts.cwd,
            type: "initiative",
            title: ADOPT_CONTAINER_TITLE,
            id: ADOPT_INITIATIVE_ID,
            commit: false,
            templatesDir: bundledTemplatesDir(),
            now: opts.now,
          });
          writtenPaths.push(initiative.path);
          createdContainers.push(initiative.id);
        }
        const epic = runCreate({
          cwd: opts.cwd,
          type: "epic",
          title: ADOPT_CONTAINER_TITLE,
          id: ADOPT_EPIC_ID,
          parent: existingInitiative ? existingInitiative.id : ADOPT_INITIATIVE_ID,
          commit: false,
          templatesDir: bundledTemplatesDir(),
          now: opts.now,
        });
        writtenPaths.push(epic.path);
        createdContainers.push(epic.id);
      } else {
        // Dry-run plans the containers without writing them.
        createdContainers.push(ADOPT_INITIATIVE_ID, ADOPT_EPIC_ID);
      }
      epicId = ADOPT_EPIC_ID;
    }
    if (!dryRun) {
      const story = runCreate({
        cwd: opts.cwd,
        type: "story",
        title: ADOPT_STORY_TITLE,
        // Container ids keep their full stem (only leaves get a kernel prefix).
        id: ADOPT_STORY_ID,
        parent: epicId,
        commit: false,
        templatesDir: bundledTemplatesDir(),
        now: opts.now,
      });
      writtenPaths.push(story.path);
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
        storyCreated,
        createdContainers,
        taskId: existingTask.id,
        taskCreated: false,
        skipped: true,
        taskPath: existingTask.filePath,
        commit: commitWritten(ADOPT_STORY_ID),
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
      body: composeAdoptTaskBody(
        inventory.corpora,
        relative(root, docsDirForRoot(root)).split(sep).join("/"),
      ),
      commit: false,
      templatesDir: bundledTemplatesDir(),
      now: opts.now,
    });
    writtenPaths.push(created.path);
    return {
      root,
      dryRun,
      inventory,
      storyId,
      storyCreated,
      createdContainers,
      taskId: created.id,
      taskCreated: true,
      skipped: false,
      taskPath: created.path,
      commit: commitWritten(created.id),
    };
  }
  return {
    root,
    dryRun,
    inventory,
    storyId,
    storyCreated: false,
    createdContainers,
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

  // Every value below can be repo-controlled (the skip path takes storyId from
  // the existing adoption task's `parent:`, taskPath from the filename), so the
  // interpolations escape in place (task-row-table-stdout-sanitize); --json
  // keeps the raw values byte for byte.
  const esc = sanitizeHumanTextUncapped;
  const lines: string[] = [];
  const action = result.skipped
    ? `already tracked as ${esc(result.taskId)} (open adoption task — skipped)`
    : result.dryRun
      ? `would create ${esc(result.taskId)} under ${esc(result.storyId)}`
      : `${esc(result.taskId)} under ${esc(result.storyId)}`;
  lines.push(`arggon adopt${result.dryRun && !result.skipped ? " (dry run)" : ""}: ${action}`);
  if (!result.dryRun && !result.skipped) {
    lines.push(`  ${esc(result.taskPath)}`);
  }
  const storyState = result.skipped
    ? "(existing)"
    : result.storyCreated
      ? "(created)"
      : result.dryRun
        ? "(would create when missing)"
        : "(existing)";
  lines.push(`  story: ${esc(result.storyId)} ${storyState}`);
  if (result.createdContainers.length > 0) {
    const state = result.dryRun ? "(planned)" : "(created)";
    lines.push(`  containers: ${result.createdContainers.map(esc).join(` ${state}, `)} ${state}`);
  }
  const commitLine = formatCommitLine(result.commit);
  if (commitLine) {
    lines.push(`  ${commitLine}`);
  }
  lines.push(
    `  docs: ${result.inventory.docs.length} scanned — ` +
      `${present.length} present (${managed.length} arggon-managed, ${adopterOwned.length} adopter-owned), ${absent} absent`,
  );
  if (result.dryRun && !result.skipped) {
    for (const doc of result.inventory.docs) {
      const label = !doc.exists ? "absent" : doc.managed ? "managed" : "adopter";
      const size = doc.exists ? ` — ${doc.bytes} B` : "";
      lines.push(`    [${label}] ${esc(doc.path)}${size}`);
    }
  }
  if (result.inventory.stackHints.length > 0) {
    lines.push(`  stack hints: ${result.inventory.stackHints.join(", ")}`);
  }
  if (result.inventory.corpora.length > 0) {
    const corpora = result.inventory.corpora
      .map((corpus) => `${corpus.format} (${corpus.files} files, ${corpus.origin})`)
      .join(", ");
    lines.push(`  spec corpora: ${corpora}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * One acknowledged generated doc (task-adopt-checksum-refresh): the on-disk
 * content became the new `x-generated` baseline.
 */
export type AckedDoc = {
  /** Posix path relative to the repo root. */
  path: string;
  /** The new baseline checksum ("sha256:<hex>"), computed from disk. */
  checksum: string;
};

export type AdoptAckOptions = {
  cwd: string;
  /** Injection point for tests: the recorded generatedAt timestamp. */
  now?: Date;
};

export type AdoptAckResult = {
  /** Repo root (parent of the tracker dir). */
  root: string;
  /** Acknowledged docs, sorted by path. */
  acked: AckedDoc[];
  /** Number of acknowledged docs (acked.length). */
  count: number;
};

/**
 * `arggon adopt --ack` (task-adopt-checksum-refresh): acknowledge the CURRENT
 * on-disk content of every arggon-generated doc (each path present in the
 * `x-generated` state) as the new baseline. The adoption sweep legitimately
 * fills the generated docs, which would otherwise stay permanently
 * "adopter-modified" and shadow every future template upgrade; the explicit
 * ack recomputes the checksums from disk and refreshes the state entries
 * (checksum + arggonVersion + generatedAt).
 *
 * Guarantees:
 *  - state entries whose file is missing on disk are left untouched (nothing
 *    is created);
 *  - files absent from the state are never touched (adopter-owned docs stay
 *    untracked);
 *  - standalone: no tracker access, works even when task-adopt-arggon is
 *    already done.
 *
 * Each acked entry is additionally flagged `acknowledged: true`
 * (bug-ack-baseline-regen-loss): later `init` re-runs must never regenerate
 * acknowledged docs — their recorded checksum equals the adopter's sanctioned
 * content, not the template render, so the old "untouched -> regenerate" path
 * would silently destroy the sanctioned edits.
 */
export function runAdoptAck(opts: AdoptAckOptions): AdoptAckResult {
  // Pre-flight: same sources as `arggon doctor` (story-adoption-state).
  const doctor = runDoctor({ cwd: opts.cwd });
  if (!doctor.initialized || doctor.root === null) {
    throw new Error("not an arggon-managed tree — run `arggon init` first");
  }
  const root = doctor.root;
  const statePath = conventionPathForRoot(root);
  const prevState = readGeneratedState(root);
  const generatedAt = (opts.now ?? new Date()).toISOString();
  const version = arggonVersion();

  const nextState: Record<string, GeneratedEntry> = { ...prevState };
  const acked: AckedDoc[] = [];
  for (const path of Object.keys(prevState).sort()) {
    const abs = join(root, ...path.split("/"));
    // Missing on disk: nothing to acknowledge, and nothing may be created.
    if (!existsSync(abs)) continue;
    const checksum = checksumOf(readFileSync(abs, "utf8"));
    // acknowledged: true (bug-ack-baseline-regen-loss) — the acked baseline is
    // the adopter's sanctioned content, so later init re-runs must never
    // regenerate these files (they would otherwise classify as "untouched"
    // and silently overwrite the sanctioned edits from the template).
    nextState[path] = {
      ...prevState[path]!,
      checksum,
      arggonVersion: version,
      generatedAt,
      acknowledged: true,
    };
    acked.push({ path, checksum });
  }

  // Nothing acknowledged (no state entries, or none of the tracked files on
  // disk): leave the state file byte-identical — never degrade it to an empty
  // section.
  if (acked.length === 0) {
    return { root, acked, count: 0 };
  }

  // Atomic (bug-atomic-write-followups F3): readers must never observe a torn
  // .convention.yml while the ack baseline is refreshed.
  writeFileAtomic(
    statePath,
    // Preserve the recorded project name (bug-project-name-dir-derived): the
    // ack rewrites the x-generated section but must not drop x-generated.projectName.
    updateGeneratedSection(
      readFileSync(statePath, "utf8"),
      nextState,
      readGeneratedProjectName(root),
    ),
  );
  return { root, acked, count: acked.length };
}

/** Human-readable ack report (pairs with the adopt --ack --json payload). */
export function formatAdoptAckReport(result: AdoptAckResult): string {
  const lines = [
    `arggon adopt --ack: ${result.count} generated doc(s) acknowledged as the new baseline`,
  ];
  for (const doc of result.acked) {
    // The path comes from the x-generated keys (.convention.yml): repo-
    // controlled bytes, escaped in place (task-row-table-stdout-sanitize).
    // The checksum is a locally computed sha256 hex digest.
    lines.push(`  ${sanitizeHumanTextUncapped(doc.path)} — ${doc.checksum}`);
  }
  return `${lines.join("\n")}\n`;
}
