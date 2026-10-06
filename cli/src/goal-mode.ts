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
 *   1. ONE objective = the item's first UNCHECKED acceptance criterion, read from
 *      the KERNEL's one acceptance grammar. Since
 *      `bug-three-acceptance-parsers-diverging` (PR #611) the kernel owns the
 *      only row parser in the tree — `acceptanceRows` / `acceptanceCriteria` /
 *      `acceptanceUnchecked` / `acceptanceComplete`, plus `acceptanceBody` for the
 *      one canonical input and `acceptanceGate` / `liveAcceptanceRows` /
 *      `liveAcceptanceUnchecked` for the LIVE question the `done` flip asks
 *      (`bug-done-gate-counts-checkboxes-inside-comment-blocks`) — and this adapter
 *      defers to it for BOTH the verdict and the text. There is no second parser
 *      left to disagree: the objective, the verification contract and the done
 *      flip's refusal set are the SAME rows, computed by the SAME functions, over
 *      the SAME bytes.
 *      `acceptanceBody(item)` is that input, verbatim: a checklist filed as an
 *      `arggon comment` (first-class here — `create` has no `--body` flag) is
 *      inside it, while a reader's bounded `prose` is not, and passing one of
 *      those to a predicate changes the question.
 *      Bounded on the ROWS, as the kernel documents: byte-clipped lines, a fixed
 *      number inlined, the rest counted, so a tampered or oversized item cannot
 *      produce an unbounded contract.
 *   2. Verification = the unchecked criteria as the contract the loop must
 *      satisfy, because every one of them must hold before the item can flip to
 *      `done` (ADR 0015 done gate).
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
  acceptanceBody,
  acceptanceGate,
  failEnvelope,
  findTasksDir,
  liveAcceptanceRows,
  liveAcceptanceUnchecked,
  readConventionVersion,
  repoRootFromTasks,
  resolveCurrentLogin,
  runShow,
  successEnvelope,
  toContractWorkItem,
  type AcceptanceRow,
  type CommandOutcome,
  type ContractWorkItem,
  type KernelFailureEnvelope,
  type KernelSuccessEnvelope,
} from "@arggondev/lib";
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
  boundaries: string[];
  refusals: string[];
  /** True when any line was clipped or any criterion deferred to the item. */
  truncated: boolean;
  /** Acceptance-row arithmetic behind the contract. */
  checklist: { total: number; unchecked: number; checked: number };
  /**
   * The DONE GATE's verdict: `acceptanceGate(acceptanceBody(item)).gated`, the
   * kernel's own answer, so the goal cannot disagree with the refusal by
   * construction. `true` covers both reasons the gate refuses — an unticked
   * criterion in the live `## Acceptance` section, and no criterion published
   * there at all (bug-done-gate-counts-checkboxes-inside-comment-blocks).
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

/**
 * Display-only normalization of a criterion's text: rows come from the kernel
 * already trimmed and single-line (it splits on the LineTerminator set), so this
 * only collapses interior whitespace runs for a readable contract line. It
 * decides nothing — no row is created, dropped or reclassified here.
 */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The derivation, pure: the kernel's rows → objective + verification.
 *
 * `rows` and `unchecked` are BOTH the kernel's, read from the same canonical
 * body and the same REGION (`liveAcceptanceRows(acceptanceBody(item))` /
 * `liveAcceptanceUnchecked(...)`), so "is there work left" and "what is left"
 * cannot disagree — and neither can the `done` flip's refusal set, which is
 * `acceptanceGate` over exactly those bytes
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks). The region is the
 * item's live `## Acceptance` section, because a dated comment block is history:
 * listing its boxes as a verification contract would send an agent to re-verify
 * a criterion that was already closed out in the record. Two shapes:
 *
 *   - work remains → one objective (the first unchecked criterion) + the
 *     unchecked criteria as the verification contract;
 *   - nothing remains → "DEFINE THE GOAL FIRST", never an empty goal. That
 *     includes an item whose live section publishes no criteria at all: the gate
 *     refuses its flip, and the honest contract is to write the criteria down.
 *
 * There is deliberately no third shape. An earlier revision kept an "unrenderable"
 * branch for the case where the verdict and the text came from two parsers that
 * disagreed; `bug-three-acceptance-parsers-diverging` removed that class by making
 * the kernel the only parser, so the branch is gone with the class.
 *
 * Bounded on the ROWS (the kernel's own guidance for a consumer that renders
 * them): byte-clipped lines, a fixed number inlined, the rest counted.
 */
export function deriveGoal(
  rows: AcceptanceRow[],
  unchecked: AcceptanceRow[],
): Pick<
  GoalContract,
  "objective" | "verification" | "verificationOmitted" | "hasGoal" | "truncated" | "checklist"
> {
  const total = rows.length;
  const checked = rows.filter((row) => row.checked).length;
  const live = unchecked.map((row) => oneLine(row.text));

  if (live.length === 0) {
    // Two situations, two next steps, told apart by the CRITERION count rather
    // than by a second caller-supplied flag: zero criteria means the live section
    // published no contract at all (the gate refuses for `no-live-contract`) —
    // bare `- [ ]` scaffold rows do not count as one — while a non-zero count
    // means every criterion it published is ticked.
    const noContract = rows.every((row) => !row.criterion);
    return {
      hasGoal: false,
      objective: noContract ? NO_CONTRACT_OBJECTIVE : NO_GOAL_OBJECTIVE,
      verification: [
        noContract
          ? NO_CONTRACT_VERIFICATION
          : "No verification contract: this goal cannot start until the item carries at least one unchecked acceptance criterion.",
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
  "criterion in its live Acceptance section is ticked, so there is nothing verifiable " +
  "to loop on. Either the work is finished — merge the PR and let the coordinator flip " +
  "the item — or write a new criterion into the item's live Acceptance section before " +
  "starting a goal.";

/**
 * Objective for the OTHER no-goal case: the item publishes no acceptance criteria
 * at all, so the done gate refuses its flip
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks). Naming this separately
 * matters — the two look identical to a reader ("nothing to loop on") and lead to
 * opposite actions: one says merge it, the other says write the criteria down.
 */
const NO_CONTRACT_OBJECTIVE =
  "DEFINE THE GOAL FIRST: this item's live '## Acceptance' section publishes no " +
  "criteria, so the done gate refuses its flip and there is nothing verifiable to " +
  "loop on. Write the real acceptance criteria into that section — the gate reads " +
  "the live body, and boxes inside dated comment blocks are history, not the contract " +
  "— then start the goal.";

const NO_CONTRACT_VERIFICATION =
  "No verification contract: a goal cannot start until the item's live '## Acceptance' " +
  "section carries at least one criterion and one of them is unchecked.";

/** The checklist tail note: what the inlined lines do and do not cover. */
function checklistNote(goal: GoalContract): string {
  if (!goal.hasGoal) {
    return goal.objective === NO_CONTRACT_OBJECTIVE
      ? "The item publishes no acceptance criteria in its live '## Acceptance' section, so the done gate will refuse the flip until some are written."
      : "The done gate is satisfied for this item, so there is nothing to verify yet.";
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
  // **One canonical body, one kernel parser, one region.** `acceptanceBody(item)`
  // is the item's whole body (comment sections included) and `acceptanceGate` /
  // `liveAcceptanceRows` are the kernel's own functions over it — the same ones
  // the `done` flip is refused by, so the verdict and the criteria text cannot
  // disagree with each other or with the gate. The rows come from the item's LIVE
  // `## Acceptance` section (`bug-done-gate-counts-checkboxes-inside-comment-blocks`):
  // a dated comment block is history, so its boxes are neither the contract nor
  // the work left.
  //
  // Do NOT hand a reader's string to these: a bounded `prose` (body minus
  // comments) makes a checklist filed as an `arggon comment` — first-class here,
  // since `create` has no `--body` flag — vanish from the goal while the gate
  // still refuses to close the item. That inversion is what this call site exists
  // to prevent.
  const body = acceptanceBody(item);
  const rows = liveAcceptanceRows(body);
  const unchecked = liveAcceptanceUnchecked(body);
  const gateUnchecked = acceptanceGate(body).gated;
  const derived = deriveGoal(rows, unchecked);
  const worktreePath = item.worktreePath ?? root;
  const goal: GoalContract = {
    ...derived,
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
