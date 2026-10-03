import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  parseFrontmatter,
  numberField,
  stringArrayField,
  stringField,
  type Frontmatter,
} from "./frontmatter.js";
import { isItemType, type ItemType } from "./ids.js";
import { trackerNonItemDirs } from "./paths.js";
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
  /**
   * Judgment priority (convention v4, spec-priority-field-008): p0|p1|p2|p3;
   * omit/null = unprioritized (never defaulted). Parsed unconditionally, so
   * v0-v3 trees that adopt the field early keep loading and validating. The
   * raw token is kept (not enum-narrowed) so a hand-edited invalid value
   * still round-trips; `validate` reports it as PRIORITY_INVALID.
   */
  priority?: string | null;
  created?: string;
  updated?: string;
  blockedReason?: string;
  /** Milestone target date, quoted YYYY-MM-DD (prototype per ADR 0003; official in v3). */
  milestone?: string | null;
  /** Ids this item waits for (v3 field per ADR 0004); empty = no dependencies. */
  dependsOn: string[];
  /**
   * Soft lease: ISO date-time set when a claimable item is claimed
   * (in_progress + assignee) and cleared when the claim is released.
   * Reporting only — never gates a transition (see docs/convention.md).
   */
  claimedAt?: string | null;
  /**
   * Absolute path of the git worktree created by `start --worktree`
   * (story-start-worktree); omit/null = none.
   */
  worktreePath?: string | null;
  /**
   * GitHub issue number recorded by `import-issues` (story-tracker-hygiene);
   * omit/null = not linked. `start --open-pr` turns it into `Closes #N` in
   * the PR body.
   */
  issue?: number | null;
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
  "priority",
  "created",
  "updated",
  "blocked_reason",
]);

/**
 * Forward-declared keys: not in the v0 OFFICIAL_KEYS block (so they live in
 * extras and round-trip), but known to the tooling - no UNKNOWN_KEY warning.
 * milestone is the ADR 0003 prototype field; depends_on is official in
 * convention v3 (ADR 0004). issue records the GitHub issue number written by
 * `import-issues` (story-tracker-hygiene). All parse unconditionally:
 * parsing is additive, so v0-v2 trees keep loading (and validating) unchanged.
 * (priority became OFFICIAL in convention v4 — spec-priority-field-008.)
 */
const PROTOTYPE_KEYS = new Set(["milestone", "depends_on", "claimed_at", "worktree_path", "issue"]);

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

/** Collect every file and directory under the tracker root (skipping dotfiles). Shared by validate. */
export function walkTasksTree(
  dir: string,
  opts?: { skipDirs?: string[] },
): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs: string[] = [];
  if (!existsSync(dir)) return { files, dirs };
  const skip = new Set((opts?.skipDirs ?? trackerNonItemDirs(dir)).map((d) => resolve(d)));
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur)) {
      if (name.startsWith(".")) continue;
      const full = join(cur, name);
      if (skip.has(resolve(full))) continue;
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

  // Convention v4 (spec-priority-field-008): parse unconditionally, keep the
  // raw token (enum enforcement lives in validate's PRIORITY_INVALID rule).
  const priority = stringField(data, "priority") ?? null;

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
    priority,
    created: stringField(data, "created"),
    updated: stringField(data, "updated"),
    blockedReason: stringField(data, "blocked_reason"),
    milestone: stringField(data, "milestone") ?? null,
    dependsOn,
    claimedAt: stringField(data, "claimed_at") ?? null,
    worktreePath: stringField(data, "worktree_path") ?? null,
    issue: numberField(data, "issue") ?? null,
    extras,
    filePath,
    containerDir: dirname(filePath),
    data,
    body,
  };

  return { kind: "item", item, issues, unknownKeys };
}

export function loadItems(tasksDir: string, opts?: { skipDirs?: string[] }): WorkItem[] {
  const items: WorkItem[] = [];
  walk(
    tasksDir,
    items,
    new Set((opts?.skipDirs ?? trackerNonItemDirs(tasksDir)).map((d) => resolve(d))),
  );
  return items;
}

function walk(dir: string, items: WorkItem[], skip: Set<string>): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    if (skip.has(resolve(full))) continue;
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, items, skip);
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
        `Duplicate id '${item.id}' under the tracker (${prev.filePath} and ${item.filePath})`,
      );
    }
    map.set(item.id, item);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Acceptance parsing — the ONE kernel owner (bug-three-acceptance-parsers-diverging)
// ---------------------------------------------------------------------------

/**
 * The canonical acceptance marker: leading `[ \t]*`, a `-` or `*` bullet,
 * EXACTLY ONE space, then a `[ ]` / `[x]` / `[X]` box.
 *
 * The single space is the done gate's historical rule and is load-bearing:
 * `-  [ ] text` (two spaces) is NOT a row, so it must not start gating the
 * `done` flip (bug-three-acceptance-parsers-diverging acceptance 6: this
 * unification may not add or remove a refusal). A box glued to its text
 * (`- [ ]x`) and a bare `- [ ] x` ARE rows — decided and documented in
 * `ArggonManager/docs/convention.md` §Acceptance rows.
 *
 * `m` gives `^`/`$` their per-line meaning, and `$` also matches before a
 * `\r`, so the captured text never contains the carriage return of a CRLF
 * body. That is the fix for the CRLF inversion: a `.`-based per-line regex
 * does not match `\r`, so the board and the TUI detail block used to read a
 * CRLF item as "no acceptance rows" while this gate still refused the flip.
 * Do NOT re-express this as `.*` over `split("\n")` — that is the old bug.
 */
const ACCEPTANCE_MARKER = /^[ \t]*[-*] \[( |x|X)\][ \t]*/;

/** The tail of a marker line that actually carries text (the gate's `[^\s]`). */
const ACCEPTANCE_TEXT = /^\S/;

/**
 * One acceptance checkbox row, as the kernel classifies it.
 *
 * - `text` — everything after the marker on that line, trimmed, for DISPLAY.
 *   `""` for a bare box (the `- [ ]` scaffold placeholder).
 * - `criterion` — whether this row gates the done flip. A row with no text
 *   after the box is a scaffold placeholder, never a criterion
 *   (bug-empty-template-checkbox). This is deliberately a separate fact from
 *   `text !== ""`: the gate's own rule is "the first character after the box
 *   is not whitespace", so `- [ ]\u00a0x` is a row whose text trims to `"x"`
 *   and still is not a criterion. Deriving one from the other re-introduces
 *   a parser.
 */
export interface AcceptanceRow {
  text: string;
  checked: boolean;
  criterion: boolean;
}

/** Minimal shape `acceptanceBody` needs — any loaded item or show envelope. */
export interface AcceptanceBodySource {
  body: string;
}

/**
 * THE canonical body every acceptance consumer must read
 * (bug-three-acceptance-parsers-diverging).
 *
 * ## The invariant: one question, one input
 *
 * The done gate's refusal and every rendered "acceptance" list are the SAME
 * question asked of the SAME bytes, so they are answered by one parser
 * (`acceptanceRows` / `acceptanceCriteria` / `acceptanceComplete`) over one
 * input — this accessor.
 *
 * **Never pass a reader-derived string to an acceptance predicate.** A reader
 * that trims, clips, byte-caps, strips HTML comments or strips COMMENT
 * SECTIONS before calling has changed the question, and on reachable shapes
 * it changes the ANSWER: a checklist filed as a comment (`arggon create` has
 * no `--body` flag, so this is the path every new item takes) then reads as
 * "nothing unchecked" from a consumer while the gate still blocks the flip.
 * That inversion is the defect this accessor exists to prevent, and it is
 * structural: the only way to get it wrong now is to bypass the accessor.
 *
 * Bounded reads (`runShow`'s `prose`, the board's clipped prose, a bounded
 * comment tail) are for PROSE RENDERING, not for verdicts. A consumer that
 * needs the verdict calls the predicate on `acceptanceBody(item)`; a consumer
 * that renders rows calls `acceptanceRows(acceptanceBody(item))` and applies
 * its own byte cap to the resulting rows.
 *
 * Byte-for-byte identity is deliberate. LF normalization would be *sound*
 * (the marker above is CRLF-safe) but adds a second representation of the same
 * document for no gain, so it is not done here.
 */
export function acceptanceBody(source: AcceptanceBodySource): string {
  return source.body;
}

/**
 * Every acceptance checkbox row in `body`, in document order.
 *
 * The ONE row parser: the done gate, the board renderer, the native detail
 * block and the ZCode goal contract all read rows through here, so they
 * cannot disagree about which lines are rows. Consumers MUST pass
 * `acceptanceBody(item)` (see that function's invariant).
 *
 * Pure; O(lines). A marker that reaches end-of-line with nothing after it is
 * returned as a non-criterion row so renderers can still show the box.
 */
export function acceptanceRows(body: string): AcceptanceRow[] {
  const rows: AcceptanceRow[] = [];
  for (const line of body.split("\n")) {
    const match = ACCEPTANCE_MARKER.exec(line);
    if (!match) continue;
    const tail = line.slice(match[0].length);
    rows.push({
      text: tail.trim(),
      checked: match[1] !== " ",
      criterion: ACCEPTANCE_TEXT.test(tail),
    });
  }
  return rows;
}

/**
 * The rows that gate the done flip: `acceptanceRows` minus the bare-box
 * scaffold placeholders (bug-empty-template-checkbox). Exposed so a consumer
 * can print "these are the boxes the done gate refuses on" without
 * re-deriving the placeholder rule.
 */
export function acceptanceCriteria(body: string): AcceptanceRow[] {
  return acceptanceRows(body).filter((row) => row.criterion);
}

/** The unchecked criteria — exactly the rows that make `acceptanceComplete` false. */
export function acceptanceUnchecked(body: string): AcceptanceRow[] {
  return acceptanceCriteria(body).filter((row) => !row.checked);
}

/**
 * Acceptance-aware cascade helper (task-cascade-acceptance-aware): does the
 * item body carry an acceptance contract, and is it fully satisfied?
 *
 * Defined over `acceptanceCriteria`, so it is the same row set every renderer
 * displays: Markdown task-list items only (`- [ ]` / `- [x]` / `- [X]`, one
 * space after the bullet, leading whitespace tolerated). A body with NO
 * task-list items has no acceptance checklist — treated as complete so the
 * cascade may finish it as before. A body WITH checklist items is complete
 * only when every CRITERION is checked, and a checkbox line with no text
 * after the box is not a criterion (bug-empty-template-checkbox): it is a
 * scaffold placeholder — `create` used to leave one under `## Acceptance`,
 * and since the real checklist is filed in a comment, that stale empty box
 * must never wedge the done gate or the cascade. Real (text-bearing)
 * unchecked boxes still gate strictly.
 *
 * This is the DONE GATE (ADR 0015). Its refusal set is the contract every
 * other consumer is measured against; unifying the parsers must never change
 * it, so this function is specified as `!acceptanceUnchecked(body).length`.
 */
export function acceptanceComplete(body: string): boolean {
  return acceptanceUnchecked(body).length === 0;
}
