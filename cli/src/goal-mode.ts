/**
 * ZCode goal-mode contract (spec methodology-adapters-017 §S5, ADR 0020,
 * task-zcode-goal-mode): the objective + verification contract a ZCode Goal
 * Mode loop runs on, DERIVED from one claimed item's acceptance checklist.
 *
 * Why a renderer and not a static prompt: a goal is only honest when its
 * objective is a checklist line the item actually carries. Hand-typed goals
 * drift from the item, and a goal spanning items or worktrees breaks the
 * claim-lease model (exploration-018 §Edge-case hunt: "ZCode goal mode loops on
 * an agent-owned item while a worker has it claimed").
 *
 * Shape (the generated plugin file `templates/goal-mode.md` holds only the
 * shape):
 *
 *   1. ONE objective = the item's first UNCHECKED acceptance criterion. WHICH
 *      criteria exist is decided by the KERNEL's done-gate predicate
 *      `acceptanceComplete` (lib/src/items.ts) — the same call the `done` flip
 *      is refused by, on the SAME canonical input (`item.body`, comment
 *      sections included; a reader that trims or filters first has changed the
 *      question), so a goal can never tell an agent "nothing left to do" while
 *      the gate refuses to close the item. The criterion TEXT comes from
 *      the board renderer's row parser (cli/src/board.ts), normalized to LF
 *      first (its regex is CRLF-blind, `.` never matches `\r`) and filtered
 *      through no rule of its own beyond "has text" (the gate's own rule: a box
 *      with no text after it is a scaffold placeholder, not a criterion). Those
 *      are TWO parsers, not one: they can still disagree, so the disagreement is
 *      handled, never hidden — when the gate says work remains but no criterion
 *      text could be read, the contract says exactly that instead of inventing
 *      an empty goal (see UNRENDERABLE below). One kernel predicate owning
 *      unification is `bug-three-acceptance-parsers-diverging`; until that
 *      lands, the parity corpus in cli/src/goal-mode.test.ts is what keeps this
 *      adapter honest.
 *   2. Verification = the same unchecked criteria as the contract the loop must
 *      satisfy, because every one of them must hold before the item can flip to
 *      `done` (ADR 0015 done gate). Bounded: N lines, each clipped, overflow
 *      counted, so a tampered or oversized item can never produce an unbounded
 *      contract.
 *   3. Boundaries + refusals are appended by THIS module from constants, never
 *      read from the template file, so an adopter editing their generated copy
 *      cannot drop the one-item/one-worktree rules or route around the reviewer
 *      backstop in `hooks/gate.mjs`. The kernel (`arggon validate`, the claim
 *      lease, the done gate) stays the enforcement of record; this is a prompt.
 *
 * Refusals (hard, decided and documented in docs/agents.md §ZCode): the caller
 * identity is unresolvable (so the claim holder cannot be proven to be you), the
 * item is closed, unclaimed, claimed by another identity, or the caller's
 * checkout is not the item's recorded worktree (or that worktree no longer
 * exists). There is no override flag — pointing a goal at another session's
 * worktree is a refusal, not a mode.
 *
 * Pure read: no lock, no writes, no tracker commit. Ever.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
  acceptanceComplete,
  failEnvelope,
  findTasksDir,
  readConventionVersion,
  repoRootFromTasks,
  resolveCurrentLogin,
  runShow,
  successEnvelope,
  toContractWorkItem,
  type CommandOutcome,
  type ContractWorkItem,
  type KernelFailureEnvelope,
  type KernelSuccessEnvelope,
} from "@arggondev/lib";
// The board renderer's row parser. Deliberately NOT moved into `@arggondev/lib`
// here: whether lib grows a row parser — and which parser wins — is the design
// decision `bug-three-acceptance-parsers-diverging` owns, and guessing it here
// would pre-empt that item (and risk a fourth parser). Until it lands, this
// adapter reads text through the board's parser and takes every VERDICT from the
// kernel's `acceptanceComplete`, with the parity corpus pinning the two together.
import { parseAcceptanceRows } from "./board.js";
// The CLI's single EOL helper (docs.ts). Required, not cosmetic: the frontmatter
// parser tolerates CRLF and the board's row regex does not (`.` never matches
// `\r`), so a CRLF item read without normalizing yields ZERO criteria — which is
// exactly how this adapter used to tell an agent "nothing left to do" on an item
// the done gate still refused to close.
import { normalizeEol } from "./docs.js";
import { bundledTemplatesDir } from "./package-assets.js";

/** Generated destination of the goal-mode template (the ZCode plugin seam). */
export const GOAL_TEMPLATE_REL = ".zcode-marketplace/arggon/templates/goal-mode.md";

/** Package template the destination is generated from (same file init writes). */
export const GOAL_TEMPLATE_SOURCE = "docs/zcode/arggon/templates/goal-mode.md";

/** Objective budget: one readable sentence, never a pasted item body. */
export const MAX_GOAL_OBJECTIVE_BYTES = 240;
/** Per-line budget for a verification criterion. */
export const MAX_GOAL_VERIFICATION_BYTES = 200;
/** How many criteria the contract inlines before it defers to the item. */
export const MAX_GOAL_VERIFICATION_LINES = 8;
/**
 * How much of the item's prose is even PARSED for criteria: the derivation
 * reads the acceptance checklist, not the item, so a 10 MB body is clipped
 * before the scan instead of being walked line by line. A clipped read also
 * marks the contract `truncated` — criteria may exist past the cut.
 */
export const MAX_GOAL_PROSE_BYTES = 32 * 1024;
/**
 * Budget for the TEMPLATE text before slot filling — an adopter-inflated or
 * tampered copy is clipped here, so the rendered contract stays bounded even
 * when the file it renders from is not. Clipping happens BEFORE the slots are
 * filled, so an adopter template over this budget can lose its `{{...}}`
 * placeholders; the structured `goal.*` fields still carry the values.
 */
export const MAX_GOAL_TEMPLATE_BYTES = 8 * 1024;
/**
 * Hard cap on the whole rendered contract (ADR 0006 context budget). SOFT in one
 * corner: the appended boundary block is never clipped, so if that block alone
 * ever grew past ~11,262 B the 1 KiB floor for the filled template would push
 * the contract past this constant. Measured block: 1,974 B (the envelope test's
 * byte cap catches growth), i.e. ~9.3 KB of headroom.
 */
export const MAX_GOAL_CONTRACT_BYTES = 12 * 1024;

/** Marker appended to clipped text (3 bytes in UTF-8), inside the budget. */
const ELLIPSIS = "…";
const ELLIPSIS_BYTES = Buffer.byteLength(ELLIPSIS, "utf8");

/**
 * The hard boundaries, appended verbatim to every rendered contract. The goal is
 * a prompt, so these have to read as instructions an agent cannot talk itself
 * out of — and they name the kernel as the enforcement of record so a hook gap
 * is never mistaken for permission.
 */
export const GOAL_BOUNDARIES: readonly string[] = [
  "One goal, one CLAIMED item: this contract covers exactly this item; it never becomes a second goal for a sibling item.",
  "One worktree per item: every command, edit, build and commit runs inside the item's recorded worktree, on its branch. An item that records no worktree at all (no `start --worktree`) is scoped to the repo root you are standing in — the boundary is the item's own scope, never a sibling's.",
  "Never another item's worktree: no sibling checkout, and no worktree whose claim belongs to another identity — `arggon goal` refuses both.",
  "State in git: the claim, the branch and the checklist travel in the tracker; a goal that lives only in the session is not a goal.",
  "Never steal, never reopen: a claim held by another assignee is a refusal, not an invitation (`--force`/`--steal` are human-only, and a `done`/`cancelled` item stays closed).",
  "A reviewer dispatch in flight is read-only: no write, no tracker mutation and no git history command while the plugin's gate denies them (post the verdict with `arggon comment`).",
  "The kernel is the enforcement of record: `arggon validate`, the claim lease and the done gate decide what is allowed. This contract is a prompt — it never widens what the hooks or the CLI permit.",
];

/** The refusal cases, spelled out where the loop reads them. */
export const GOAL_REFUSALS: readonly string[] = [
  "the item is not claimed — claim it with `arggon start <id>` (the claim is what creates its worktree);",
  "the caller identity is unresolvable, so the claim holder cannot be proven to be you — export `GITHUB_USER` (or `GITHUB_ACTOR`, or authenticate `gh`) and re-run;",
  "the item is claimed by another identity — `arggon show <id> --meta` names the assignee;",
  "the item is done or cancelled — never reopened to satisfy a goal;",
  "this checkout is not the item's recorded worktree — the recorded `worktree_path` is the only place the goal may run;",
  "the recorded worktree no longer exists — re-claim it or release the footprint (`arggon cleanup`) before running a goal here.",
];

/** Failure codes surfaced as `error.code` (`GOAL_FAILED` for kernel errors). */
export type GoalErrorCode =
  | "GOAL_FAILED"
  | "GOAL_ITEM_CLOSED"
  | "GOAL_IDENTITY_UNKNOWN"
  | "GOAL_UNCLAIMED"
  | "GOAL_FOREIGN_CLAIM"
  | "GOAL_WORKTREE_MISSING"
  | "GOAL_WORKTREE_MISMATCH"
  | "GOAL_TEMPLATE_UNAVAILABLE";

/** A refusal or read failure, carrying the documented code. */
export class GoalError extends Error {
  readonly code: GoalErrorCode;

  constructor(code: GoalErrorCode, message: string) {
    super(message);
    this.name = "GoalError";
    this.code = code;
  }
}

/** The derived contract, structured (the `goal` field of the `--json` envelope). */
export type GoalContract = {
  /** The single goal, drawn from the first unchecked acceptance criterion. */
  objective: string;
  /** Every unchecked criterion the loop must satisfy, inlined and clipped. */
  verification: string[];
  /** Unchecked criteria NOT inlined (the overflow count). */
  verificationOmitted: number;
  /** False when the DONE GATE is satisfied (nothing left to satisfy). */
  hasGoal: boolean;
  /**
   * False when no criterion text could be read while the gate says work remains
   * (the two parsers disagree — `bug-three-acceptance-parsers-diverging`). The
   * contract then says so instead of inventing a goal.
   */
  renderable: boolean;
  boundaries: string[];
  refusals: string[];
  /** True when any line was clipped or any criterion deferred to the item. */
  truncated: boolean;
  /** Acceptance-checklist arithmetic behind the contract. */
  checklist: { total: number; unchecked: number; checked: number };
  /**
   * The DONE GATE's verdict, verbatim: `!acceptanceComplete(item.body)` — the
   * same predicate AND the same canonical input the `done` flip is refused by
   * (comment sections included). The goal never disagrees with it; that is the
   * load-bearing invariant.
   */
  gateUnchecked: boolean;
  /** Where the loop may run, and whether the item recorded a worktree. */
  worktree: { path: string; recorded: boolean };
  /** Which template copy rendered it: the adopter's, or the packaged one. */
  template: "adopter" | "package";
  /** Caller identity that holds the claim; a goal always has one (or refuses). */
  identity: string;
};

export type GoalResult = {
  id: string;
  /** Repo root the item was read from. */
  root: string;
  /** Absolute path of the item file. */
  path: string;
  item: ContractWorkItem;
  contract: string;
  goal: GoalContract;
};

export type GoalOptions = {
  cwd: string;
  id: string;
  /** Caller login override (tests); defaults to @me resolution. */
  login?: string | undefined;
  /**
   * Templates root override (tests only): same injection point as
   * `currentGeneratedTemplatesFrom` in cli/src/docs.ts, so the
   * `GOAL_TEMPLATE_UNAVAILABLE` refusal can be exercised against a real tree
   * with no template anywhere instead of a mock.
   */
  templatesDir?: string;
};

/** Clip `text` to at most `maxBytes` UTF-8 bytes without splitting a code point. */
function clip(text: string, maxBytes: number): { text: string; clipped: boolean } {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return { text, clipped: false };
  // The ellipsis counts against the budget, so a clipped line stays <= maxBytes.
  let bytes = 0;
  let out = "";
  for (const ch of text) {
    const size = Buffer.byteLength(ch, "utf8");
    if (bytes + size > maxBytes - ELLIPSIS_BYTES) break;
    out += ch;
    bytes += size;
  }
  return { text: `${out.trimEnd()}${ELLIPSIS}`, clipped: true };
}

/** Collapse a checklist line to one bounded line (no newlines, no box marker). */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The derivation, pure: criterion rows + the DONE GATE's verdict → objective +
 * verification.
 *
 * `hasUncheckedCriterion` is `!acceptanceComplete(item.body)` — the kernel
 * predicate the `done` flip is refused by, on the same canonical body (comments
 * included) — so the goal's "is there work left" answer can never contradict the
 * gate's. The rows only supply TEXT, parsed from that same body. Three shapes,
 * and no fourth:
 *
 *   - work remains and a criterion line was read → one objective (the first
 *     unchecked one) + the unchecked criteria as the verification contract;
 *   - the gate says nothing remains → "DEFINE THE GOAL FIRST", never an empty
 *     goal (a body with no criteria at all has no contract to satisfy);
 *   - the gate says work remains but no criterion text could be read (the two
 *     parsers disagree — see the module header and
 *     `bug-three-acceptance-parsers-diverging`) → `UNRENDERABLE`: the contract
 *     says an unchecked criterion exists and refuses to invent its text. This is
 *     the case that used to invert: a CRLF item used to render "define the goal
 *     first" while the done gate refused to close it.
 */
export function deriveGoal(
  rows: Array<{ text: string; checked: boolean }>,
  hasUncheckedCriterion: boolean,
): Pick<
  GoalContract,
  | "objective"
  | "verification"
  | "verificationOmitted"
  | "hasGoal"
  | "renderable"
  | "truncated"
  | "checklist"
> {
  const total = rows.length;
  const checked = rows.filter((row) => row.checked).length;
  const live = rows
    .filter((row) => !row.checked)
    .map((row) => oneLine(row.text))
    .filter((text) => text.length > 0);

  if (!hasUncheckedCriterion) {
    return {
      hasGoal: false,
      renderable: false,
      objective: NO_GOAL_OBJECTIVE,
      verification: [
        "No verification contract: this goal cannot start until the item carries at least one unchecked acceptance criterion.",
      ],
      verificationOmitted: 0,
      truncated: false,
      checklist: { total, unchecked: 0, checked },
    };
  }

  if (live.length === 0) {
    return {
      hasGoal: true,
      renderable: false,
      objective: UNRENDERABLE_OBJECTIVE,
      verification: [
        "No criterion text could be read from the checklist (the kernel's done gate still sees unchecked work), so read the item body before planning: `arggon show <id> --body`.",
      ],
      verificationOmitted: 0,
      truncated: false,
      checklist: { total, unchecked: 0, checked },
    };
  }

  const objective = clip(live[0]!, MAX_GOAL_OBJECTIVE_BYTES);
  const inlined = live.slice(0, MAX_GOAL_VERIFICATION_LINES);
  const verification = inlined.map((line) => clip(line, MAX_GOAL_VERIFICATION_BYTES));
  const verificationOmitted = live.length - inlined.length;
  return {
    hasGoal: true,
    renderable: true,
    objective: objective.text,
    verification: verification.map((line) => line.text),
    verificationOmitted,
    truncated:
      objective.clipped || verification.some((line) => line.clipped) || verificationOmitted > 0,
    checklist: { total, unchecked: live.length, checked },
  };
}

/** Objective for "the gate says the contract is satisfied" (never empty). */
const NO_GOAL_OBJECTIVE =
  "DEFINE THE GOAL FIRST: the done gate is satisfied for this item — every acceptance " +
  "criterion is ticked, or its checklist is empty, so there is nothing verifiable to loop " +
  "on. Either the work is finished — merge the PR and let the coordinator flip the item — or " +
  "write the criterion into the item's Acceptance section (arggon comment) before starting a goal.";

/** Objective for "unchecked work exists but its text was not readable". */
const UNRENDERABLE_OBJECTIVE =
  "READ THE ITEM BODY FIRST: the done gate refuses to close this item (an unchecked " +
  "acceptance criterion exists), but no criterion line could be read from the checklist — the " +
  "kernel predicate and the checklist reader disagree on this body. Do NOT treat the item as " +
  "finished; read `arggon show <id> --body` and plan from what it says.";

/** The checklist tail note: what the inlined lines do and do not cover. */
function checklistNote(goal: GoalContract): string {
  if (!goal.hasGoal) {
    return "The done gate is satisfied for this item, so there is nothing to verify yet.";
  }
  if (!goal.renderable) {
    return "The checklist text could not be read; the goal verdict still comes from the done gate, never from a parser.";
  }
  if (goal.truncated) {
    return "Some checklist text was clipped or deferred: read `arggon show <id> --body` before calling the goal met.";
  }
  return "Every unchecked acceptance criterion is inlined above; the checklist in git is still the source of truth.";
}

/** The boundary/refusal block the CLI appends to every rendered contract. */
export function renderBoundaryBlock(goal: GoalContract): string {
  const lines = [
    "## Boundaries (hard)",
    "",
    ...GOAL_BOUNDARIES.map((line) => `- ${line}`),
    "",
    "## Refusals (stop and report — never route around them)",
    "",
    ...GOAL_REFUSALS.map((line) => `- ${line}`),
    "",
    `Claim holder: ${goal.identity} — the goal is only valid while that identity still holds the claim.`,
    "",
    checklistNote(goal),
    "",
    "Rendered by `arggon goal <id>` — the boundaries above come from the CLI, not from the template file.",
  ];
  return lines.join("\n");
}

/** Template text the contract renders from: the adopter's copy, else the packaged one. */
function loadGoalTemplate(
  root: string,
  templatesDir?: string,
): { body: string; source: "adopter" | "package" } {
  const candidates: Array<{ path: string; source: "adopter" | "package" }> = [
    { path: join(root, ...GOAL_TEMPLATE_REL.split("/")), source: "adopter" },
    {
      path: join(templatesDir ?? bundledTemplatesDir(), ...GOAL_TEMPLATE_SOURCE.split("/")),
      source: "package",
    },
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate.path)) continue;
    const raw = readFileSync(candidate.path, "utf8");
    return { body: clip(raw, MAX_GOAL_TEMPLATE_BYTES).text, source: candidate.source };
  }
  throw new GoalError(
    "GOAL_TEMPLATE_UNAVAILABLE",
    `goal-mode template not found (looked for ${GOAL_TEMPLATE_REL} and the packaged ${GOAL_TEMPLATE_SOURCE}); re-run \`arggon init\` to vendor it`,
  );
}

/** Same-directory realpath when it exists; the raw path otherwise. */
function realpathOrSelf(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * A closed item never has a goal, whoever asks. Reported FIRST so the refusal
 * names the intrinsic cause ("it is done") instead of an environmental one
 * ("set GITHUB_USER") that would send an agent down the wrong path.
 */
function assertNotClosed(item: GoalItem): void {
  if (item.status === "done" || item.status === "cancelled") {
    throw new GoalError(
      "GOAL_ITEM_CLOSED",
      `${item.id} is ${item.status} — a closed item is never reopened to satisfy a goal`,
    );
  }
}

function assertClaimed(item: GoalItem, login: string): void {
  if (!item.assignee) {
    throw new GoalError(
      "GOAL_UNCLAIMED",
      `${item.id} has no claim: one goal per CLAIMED item, so claim it first (\`arggon start ${item.id}\`, which also creates its worktree)`,
    );
  }
  if (item.assignee !== login) {
    throw new GoalError(
      "GOAL_FOREIGN_CLAIM",
      `${item.id} is claimed by '${item.assignee}', not by '${login}' — a goal never targets another identity's claim`,
    );
  }
}

/**
 * The claim-lease proof (B2): the invariant "a goal never targets an item
 * claimed by another identity" can only be enforced if the caller's identity is
 * known. An unresolvable identity therefore REFUSES — it never downgrades to
 * "render it and trust the agent to check", which is how a goal could be pointed
 * at another session's claim.
 */
function assertIdentityResolvable(item: GoalItem, login: string | null): string {
  if (login !== null) return login;
  throw new GoalError(
    "GOAL_IDENTITY_UNKNOWN",
    `cannot resolve the caller identity for ${item.id}, so the claim holder cannot be proven: set GITHUB_USER (or GITHUB_ACTOR), or authenticate \`gh api user\`, and re-run — a goal never renders for an unproven identity`,
  );
}

/**
 * The one-worktree rule: a claimed item's goal runs INSIDE the worktree the
 * claim recorded, and nowhere else. A recorded path that no longer exists is
 * refused too — pointing a goal at a checkout that is not there (or at another
 * session's) is the hazard this whole check exists for.
 */
function assertWorktree(root: string, item: GoalItem): void {
  const recorded = item.worktreePath;
  if (!recorded) return; // no worktree recorded: the repo root is the scope
  if (!existsSync(recorded)) {
    throw new GoalError(
      "GOAL_WORKTREE_MISSING",
      `${item.id} records worktree_path '${recorded}', which no longer exists — re-claim it or release the footprint (\`arggon cleanup\`) instead of running the goal from here`,
    );
  }
  const here = realpathOrSelf(root);
  const there = realpathOrSelf(recorded);
  if (here === there) return;
  throw new GoalError(
    "GOAL_WORKTREE_MISMATCH",
    `${item.id} runs in '${recorded}', not in this checkout ('${here}') — a goal never spans worktrees; run it from the item's worktree`,
  );
}

/** The frontmatter subset the refusals read. */
type GoalItem = {
  id: string;
  status: string;
  assignee?: string | null;
  worktreePath?: string | null;
};

/** Fill the template slots; unknown `{{...}}` placeholders are left untouched. */
function fillSlots(template: string, slots: Record<string, string>): string {
  let out = template;
  for (const [name, value] of Object.entries(slots)) {
    out = out.replaceAll(`{{${name}}}`, value);
  }
  return out;
}

/**
 * The command: derive the goal-mode contract for one claimed item. Pure read —
 * the item file, the template and the caller's checkout, nothing else.
 */
export function runGoal(opts: GoalOptions): GoalResult {
  const id = opts.id.trim();
  if (!id) throw new GoalError("GOAL_FAILED", "id is required");
  const root = repoRootFromTasks(findTasksDir(opts.cwd));
  const shown = runShow({ cwd: opts.cwd, id });
  const item = shown.item;
  const login = opts.login !== undefined ? opts.login : (resolveCurrentLogin(process.env) ?? null);
  // An explicitly empty login means "unresolved", never "matches nobody".
  const identity = login && login.length > 0 ? login : null;

  // Order matters: each refusal names its most specific cause — a closed item
  // first (intrinsic), then the identity that proves the claim lease, then the
  // claim itself, then the checkout. An unproven identity never renders.
  assertNotClosed(item);
  const caller = assertIdentityResolvable(item, identity);
  assertClaimed(item, caller);
  assertWorktree(root, item);

  const template = loadGoalTemplate(root, opts.templatesDir);
  // **One canonical body, every predicate.** `item.body` — the WHOLE body,
  // comment sections included — is exactly what the done gate reads
  // (`lib/src/update.ts:526`, `!acceptanceComplete(item.body)`), so the gate's
  // verdict here is taken on the same input. A reader that trims or filters
  // before calling has changed the question: `shown.prose` (body minus
  // comments) is what makes a checklist filed as an `arggon comment` —
  // first-class here, since `create` has no `--body` flag and
  // `bug-empty-template-checkbox` exists for exactly that case — vanish from
  // the goal while the gate still refuses to close the item. Both the verdict
  // and the criterion text therefore read `item.body`.
  const gateUnchecked = !acceptanceComplete(item.body);
  const prose = clip(item.body, MAX_GOAL_PROSE_BYTES);
  const rows = parseAcceptanceRows(normalizeEol(prose.text));
  const derived = deriveGoal(rows, gateUnchecked);
  const worktreePath = item.worktreePath ?? root;
  const goal: GoalContract = {
    ...derived,
    // Criteria lost to the prose clip must not read as "everything inlined"
    // (round-1 finding 3): a clipped read is a truncated contract.
    truncated: derived.truncated || prose.clipped,
    gateUnchecked,
    boundaries: [...GOAL_BOUNDARIES],
    refusals: [...GOAL_REFUSALS],
    worktree: { path: worktreePath, recorded: Boolean(item.worktreePath) },
    template: template.source,
    identity: caller,
  };

  const verification = goal.verification.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const block = renderBoundaryBlock(goal);
  // Budget the FILLED TEMPLATE so the appended boundaries always survive: the
  // cap can shrink adopter prose, never the hard rules.
  const templateBudget = Math.max(
    1024,
    MAX_GOAL_CONTRACT_BYTES - Buffer.byteLength(block, "utf8") - 2,
  );
  const filled = clip(
    fillSlots(template.body, {
      ITEM_ID: item.id,
      GOAL_OBJECTIVE: goal.objective,
      GOAL_VERIFICATION: verification,
      WORKTREE_PATH: worktreePath,
      BRANCH: item.branch ?? "(none recorded — claim with `arggon start`)",
    }),
    templateBudget,
  ).text;
  const contract = `${filled.trimEnd()}\n\n${block}\n`;

  return {
    id: item.id,
    root,
    path: shown.path,
    item: toContractWorkItem(item, root),
    contract,
    goal,
  };
}

export type GoalPayload = {
  item: ContractWorkItem;
  path: string;
  goal: GoalContract & { contract: string };
};

/**
 * Convention version for a FAILURE envelope. `readConventionVersion` expects the
 * REPO ROOT (`conventionPathForRoot` joins the tracker dir onto what it is
 * given), so handing it a subdirectory cwd silently yields the default 0 — a
 * refusal envelope that claims the wrong convention version is exactly the kind
 * of quiet wrongness this command exists to avoid. Resolve the tracker root
 * first, and fall back to the raw cwd only when there is no tracker at all.
 */
function conventionVersionFor(cwd: string): number {
  try {
    return readConventionVersion(repoRootFromTasks(findTasksDir(cwd)));
  } catch {
    return readConventionVersion(cwd);
  }
}

/** Envelope assembly + exit codes, one place (the `--json` path). */
export function goalOperation(opts: GoalOptions): CommandOutcome<GoalPayload> {
  try {
    const result = runGoal(opts);
    return {
      ok: true,
      exitCode: 0,
      envelope: successEnvelope(
        "goal",
        {
          item: result.item,
          path: result.path,
          goal: { ...result.goal, contract: result.contract },
        },
        readConventionVersion(result.root),
      ) as KernelSuccessEnvelope<GoalPayload>,
    };
  } catch (err) {
    const error =
      err instanceof GoalError ? err : new Error(String(err instanceof Error ? err.message : err));
    const code: GoalErrorCode = err instanceof GoalError ? err.code : "GOAL_FAILED";
    return {
      ok: false,
      exitCode: 1,
      error,
      envelope: failEnvelope({
        command: "goal",
        message: error.message,
        code,
        conventionVersion: conventionVersionFor(opts.cwd),
      }) as KernelFailureEnvelope<GoalPayload>,
    };
  }
}
