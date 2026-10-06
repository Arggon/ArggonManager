import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  FrontmatterParseError,
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

/**
 * WHY a `.md` file is not a work item (bug-validate-does-not-check-frontmatter-present).
 *
 * `no-frontmatter` is the interesting one: the file carries no block at all,
 * which is either a deliberate non-item document OR a work item whose block
 * was destroyed. Only a caller that knows the file's expected ROLE can tell the
 * two apart, so the loader reports the reason instead of deciding — and
 * `validate` turns it into a `MISSING_FRONTMATTER` error for a file the layout
 * says must be an item. Readers that have no such role knowledge
 * (`loadItems`, `list`, `next`) keep skipping both reasons unchanged.
 */
export type SkipReason =
  /** No `---` fence at the start of the file (also true for a 0-byte file). */
  | "no-frontmatter"
  /** A block parsed, but it carries no `type:` — not an item document. */
  | "no-type";

export type SoftLoadResult =
  | { kind: "skip"; reason: SkipReason }
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
 * Classify a frontmatter parse refusal into a `SoftIssue`.
 *
 * The two STRUCTURAL codes pass through under their own names: the block is
 * absent (`MISSING_FRONTMATTER`) or was opened and never closed
 * (`UNTERMINATED_FRONTMATTER`) — the shapes `validate` must be able to tell
 * apart from each other and from ordinary YAML breakage. Everything else keeps
 * the historical generic `BROKEN_YAML`, so a malformed line inside an
 * otherwise well-formed block reports exactly as it did before
 * (bug-validate-does-not-check-frontmatter-present, additive).
 */
function parseIssue(err: unknown): SoftIssue {
  const message = err instanceof Error ? err.message : String(err);
  if (
    err instanceof FrontmatterParseError &&
    (err.code === "MISSING_FRONTMATTER" || err.code === "UNTERMINATED_FRONTMATTER")
  ) {
    return { code: err.code, message };
  }
  return { code: "BROKEN_YAML", message };
}

/**
 * Soft-load a work item without throwing.
 * Broken YAML / missing required fields are fatal; other schema issues attach to the item.
 * One parse path — unknown keys returned for the caller to warn on.
 *
 * A file that is not a work item is a `skip` carrying its REASON
 * (`SkipReason`), never a bare skip (bug-validate-does-not-check-frontmatter-present):
 * the two reasons need opposite verdicts. A missing `type` is a plain
 * non-item document. A missing frontmatter BLOCK is only a non-item document if
 * nothing expected an item there — and only `validate` knows the tree layout,
 * so it is the caller that promotes that skip into an error.
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
  if (!raw.startsWith("---")) return { kind: "skip", reason: "no-frontmatter" };

  let data: Frontmatter;
  let body: string;
  try {
    ({ data, body } = parseFrontmatter(raw));
  } catch (err) {
    return { kind: "fatal", issues: [parseIssue(err)] };
  }

  const typeRaw = stringField(data, "type");
  if (!typeRaw) return { kind: "skip", reason: "no-type" };
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
 * Matched against ONE line at a time (see `ACCEPTANCE_LINE_BREAK`); this regex
 * itself carries no `m` flag because the caller hands it a single line.
 */
const ACCEPTANCE_MARKER = /^[ \t]*[-*] \[( |x|X)\][ \t]*/;

/** The tail of a marker line that actually carries text (the gate's `[^\s]`). */
const ACCEPTANCE_TEXT = /^\S/;

/**
 * Where an acceptance row may START — the ECMAScript **LineTerminator** set,
 * and nothing else: `\n` (LF), `\r` (CR), `\u2028` (LINE SEPARATOR) and
 * `\u2029` (PARAGRAPH SEPARATOR).
 *
 * This set is the whole reason the row scan cannot be written as
 * `split("\n")`. The done gate has always been a `/…/gm` regex, and JS `^`
 * under `m` anchors after **every** LineTerminator — all four, not just `\n`.
 * Splitting on `\n` alone therefore glues the rest of a CR-separated,
 * U+2028-separated or U+2029-separated body onto the previous line, and a
 * criterion the gate used to refuse on silently becomes invisible:
 * `- [x] a\u2028- [ ] b\n` reads as one ticked row and the flip is ALLOWED.
 * That is a gate false-pass, so the refusal set must match, not merely
 * overlap (bug-three-acceptance-parsers-diverging, review F1).
 *
 * Deliberately NOT in the set: `\v` (U+000B) and `\f` (U+000C). They are
 * whitespace but not LineTerminators, so `^` under `m` never anchored after
 * them — `- [x] a\v- [ ] b` is ONE row to the gate, and must stay one.
 * `\u00a0` and friends likewise stay inside the tail, where the gate's `[^\s]`
 * (mirrored by `ACCEPTANCE_TEXT`) rejects them as leading whitespace.
 */
const ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/;

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
 * question asked of the SAME bytes, so they are answered by one parser over one
 * input — this accessor. The gate's own question is scoped to the live
 * `## Acceptance` section (`acceptanceGate`, below), and the scoping happens
 * INSIDE that predicate, on the canonical body: narrowing the INPUT at a call
 * site is the mistake, narrowing the question the predicate asks is the fix
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks).
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
 *
 * The split is `ACCEPTANCE_LINE_BREAK` (the LineTerminator set), never `"\n"`:
 * see that constant for the gate-false-pass that a `\n`-only split produces on
 * CR / U+2028 / U+2029 bodies.
 */
export function acceptanceRows(body: string): AcceptanceRow[] {
  const rows: AcceptanceRow[] = [];
  for (const line of body.split(ACCEPTANCE_LINE_BREAK)) {
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
 * The WHOLE-BODY question, and that is a deliberate split rather than a leftover:
 * the acceptance-aware container cascade asks exactly this ("does this
 * container's own body still carry an open obligation?"), and containers are
 * exempt from the done gate precisely so the same contract is never enforced
 * twice on one item. The `→ done` flip on a claimable leaf asks the narrower,
 * LIVE question instead — `acceptanceGate`, which scopes to the `##
 * Acceptance` section and refuses an item that publishes no criteria at all
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks). Both are one parser
 * (`acceptanceRows`) over one input (`acceptanceBody`); they differ in which
 * bytes are the question, and that difference is stated in
 * `ArggonManager/docs/convention.md` §Done gate.
 */
export function acceptanceComplete(body: string): boolean {
  return acceptanceUnchecked(body).length === 0;
}

// ---------------------------------------------------------------------------
// The LIVE acceptance contract — the region the done gate reads
// (bug-done-gate-counts-checkboxes-inside-comment-blocks)
// ---------------------------------------------------------------------------

/**
 * The live acceptance heading: a level-2 ATX heading whose whole text is
 * `Acceptance`, case-insensitively.
 *
 * Exact on purpose. Every template in the tree writes exactly `## Acceptance`,
 * and the section name is the ADDRESS of the contract: a fuzzy match could
 * scope the gate onto prose that merely starts with the word (`## Acceptance
 * mapping`, `## Acceptance audit (the boxes vs this diff)`), which would let a
 * non-contract section answer the question. An item that names its acceptance
 * section something else has published no live contract, which the gate reports
 * as such instead of guessing.
 *
 * Trailing whitespace is tolerated because the LineTerminator split below
 * already removed `\r`, so a CRLF body needs no separate rule.
 */
const ACCEPTANCE_HEADING = /^##[ \t]+acceptance[ \t]*$/i;

/**
 * A heading of rank 1 or 2 — the live section ends at the next one. Rank 3
 * (`###`) does NOT end it: a dated comment block may carry its own `###`
 * subheadings, and `## Acceptance` sections legitimately hold `###` prose.
 */
const SECTION_END_HEADING = /^#{1,2}[ \t]/;

/**
 * A comment block heading, in the two shapes the kernel writes:
 * `### <YYYY-MM-DD> @<author>` (`runComment`, `runHandoff`) and
 * `### Waiver <date>` (the ADR 0015 waiver). Mirrors `acceptance.ts`'s
 * `COMMENT_HEADING`; a hand-written `### Gates` is NOT a comment block.
 */
const COMMENT_BLOCK_HEADING = /^###[ \t]+(?:\d{4}-\d{2}-\d{2}[ \t]+@|Waiver\b)/;

/**
 * The body with every dated comment block removed — history stripped, live
 * prose kept.
 *
 * A block runs from its comment heading to the NEXT comment-shaped heading or the
 * end of the body, and **not** to the next `###`: a reporter who pastes a whole
 * item shape into a comment brings its own `### Acceptance` heading with it, and
 * that nested content is comment text, not a live section. A non-comment `###`
 * outside any block (`### Gates` under a live section) opens nothing. Comment
 * headings are append-only and normally sit after the live sections, so stripping
 * FIRST is also what keeps a `## Acceptance` pasted inside a comment from being
 * read as the contract at all.
 *
 * Not fence-aware, deliberately: `acceptanceRows` counts a `- [ ]` inside a
 * fenced block as a row (pinned by `cli/src/acceptance-parity.test.ts`), so
 * tracking fences here would be a second grammar for one document.
 */
function withoutCommentBlocks(body: string): string {
  const out: string[] = [];
  let inComment = false;
  for (const line of body.split(ACCEPTANCE_LINE_BREAK)) {
    // Only a COMMENT-SHAPED heading opens a block. A nested `### Acceptance`
    // inside a comment does not close it — that is the whole point — so this test
    // must never reset `inComment` back to false.
    if (COMMENT_BLOCK_HEADING.test(line)) inComment = true;
    if (!inComment) out.push(line);
  }
  return out.join("\n");
}

/**
 * The item's LIVE acceptance section: the body of its `## Acceptance` heading
 * up to the next rank-1/rank-2 heading, with dated comment blocks removed
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks).
 *
 * `null` when the item has no such section — the "no live contract" shape, which
 * the done gate refuses rather than reading as "nothing left to do" (an absent
 * section and an empty one are the same fact: no criteria are published).
 *
 * Why this is the gate's input and not a reader's: a dated comment block is
 * append-only history that is never edited, so an unticked box inside one is a
 * record of what the criteria WERE, not an open obligation. Before this, the
 * gate counted `- [ ]` anywhere in the body, so whether an item could reach
 * `done` depended on whether its history happened to contain unticked boxes:
 * two items with identical live acceptance got opposite verdicts, and an item
 * whose criteria are recorded in a dated comment could never be completed.
 * The live section is the contract; the comment record is history.
 *
 * Pure; O(lines). Takes the canonical body (`acceptanceBody(item)`), like every
 * other acceptance consumer.
 */
export function liveAcceptanceRegion(body: string): string | null {
  const lines = withoutCommentBlocks(body).split(ACCEPTANCE_LINE_BREAK);
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (ACCEPTANCE_HEADING.test(lines[i]!)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  const region: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (SECTION_END_HEADING.test(line)) break;
    region.push(line);
  }
  return region.join("\n");
}

/**
 * The acceptance rows of the LIVE section, in document order — the same row
 * parser over the section the gate reads. `[]` when there is no live section
 * (renderers fall back to {@link acceptanceRows} over the whole body, which
 * keeps an item's history visible).
 */
export function liveAcceptanceRows(body: string): AcceptanceRow[] {
  const region = liveAcceptanceRegion(body);
  return region === null ? [] : acceptanceRows(region);
}

/** The live section's criteria rows — the ones the done flip is judged on. */
export function liveAcceptanceCriteria(body: string): AcceptanceRow[] {
  return liveAcceptanceRows(body).filter((row) => row.criterion);
}

/** The live section's unchecked criteria — exactly what refuses the done flip. */
export function liveAcceptanceUnchecked(body: string): AcceptanceRow[] {
  return liveAcceptanceCriteria(body).filter((row) => !row.checked);
}

/** Why the done gate refuses a flip. Both reasons are waivable (ADR 0015). */
export type AcceptanceGateRefusal = "unchecked-live-criteria" | "no-live-contract";

/** The gate's answer: it flips, or it refuses for one of exactly two reasons. */
export type AcceptanceGateVerdict =
  { gated: false } | { gated: true; reason: AcceptanceGateRefusal };

/**
 * THE done gate's verdict (ADR 0015, scoped by
 * bug-done-gate-counts-checkboxes-inside-comment-blocks) over one item body.
 *
 * Two refusals, and the second is the half that keeps the first honest:
 *
 * 1. `unchecked-live-criteria` — the live `## Acceptance` section carries at
 *    least one criterion and one is unticked. This is the refusal the gate has
 *    always made, minus the boxes that live in append-only comment history.
 * 2. `no-live-contract` — the live section publishes NO criterion at all: the
 *    section is absent, empty, or still the `<!-- … -->` template placeholder.
 *
 * Refusal 2 exists because scoping alone trades one lie for a worse one. An
 * item whose live section is the untouched template, while its real criteria sit
 * ticked in dated comments, would otherwise reach `done` with no acceptance
 * contract whatsoever — vacuous success, the defect class this repo already
 * tracks (`bug-verification-regex-matching-nothing`,
 * `bug-wave-probe-file-check-model-dependent`). "No criterion" is decided by
 * {@link liveAcceptanceCriteria} being empty, which is the one rule that cannot
 * be satisfied by accident: an absent heading, a whitespace-only section, the
 * template placeholder comment and a section of bare `- [ ]` scaffold rows all
 * reduce to it.
 *
 * A bare `- [ ]` row is still NOT an unmet criterion
 * (bug-empty-template-checkbox): it never appears in
 * {@link liveAcceptanceUnchecked} and never produces refusal 1. A section whose
 * only rows are bare placeholders carries no criteria, so it refuses with
 * refusal 2 — for having no contract, never for an unfinished box.
 *
 * Not a `validate` rule and not a container rule: the acceptance-aware cascade
 * keeps asking {@link acceptanceComplete} the whole-body question (containers
 * are exempt from this gate), and renderers keep listing whole-body rows.
 */
export function acceptanceGate(body: string): AcceptanceGateVerdict {
  const criteria = liveAcceptanceCriteria(body);
  if (criteria.length === 0) return { gated: true, reason: "no-live-contract" };
  return liveAcceptanceUnchecked(body).length === 0
    ? { gated: false }
    : { gated: true, reason: "unchecked-live-criteria" };
}
