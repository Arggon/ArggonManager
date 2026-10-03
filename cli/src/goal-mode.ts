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
 *   1. ONE objective = the item's first UNCHECKED acceptance box (an empty box
 *      is a scaffold placeholder, not a criterion — the same rule the done gate
 *      applies). No unchecked box → an explicit "define the goal first"
 *      contract, never an empty goal.
 *   2. Verification = the same unchecked boxes as the contract the loop must
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
 * Refusals (hard, decided and documented in docs/agents.md §ZCode): the item is
 * closed, unclaimed, claimed by another identity, or the caller's checkout is
 * not the item's recorded worktree (or that worktree no longer exists). There is
 * no override flag — pointing a goal at another session's worktree is a refusal,
 * not a mode.
 *
 * Pure read: no lock, no writes, no tracker commit. Ever.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import {
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
import { parseAcceptanceRows } from "./board.js";
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
 * before the scan instead of being walked line by line.
 */
export const MAX_GOAL_PROSE_BYTES = 32 * 1024;
/**
 * Budget for the TEMPLATE text before slot filling — an adopter-inflated or
 * tampered copy is clipped here, so the rendered contract stays bounded even
 * when the file it renders from is not.
 */
export const MAX_GOAL_TEMPLATE_BYTES = 8 * 1024;
/** Hard cap on the whole rendered contract (ADR 0006 context budget). */
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
  "One worktree per item: every command, edit, build and commit runs inside the item's recorded worktree, on its branch.",
  "Never another item's worktree: no sibling checkout, and no worktree whose claim belongs to another identity — `arggon goal` refuses both.",
  "State in git: the claim, the branch and the checklist travel in the tracker; a goal that lives only in the session is not a goal.",
  "Never steal, never reopen: a claim held by another assignee is a refusal, not an invitation (`--force`/`--steal` are human-only, and a `done`/`cancelled` item stays closed).",
  "A reviewer dispatch in flight is read-only: no write, no tracker mutation and no git history command while the plugin's gate denies them (post the verdict with `arggon comment`).",
  "The kernel is the enforcement of record: `arggon validate`, the claim lease and the done gate decide what is allowed. This contract is a prompt — it never widens what the hooks or the CLI permit.",
];

/** The refusal cases, spelled out where the loop reads them. */
export const GOAL_REFUSALS: readonly string[] = [
  "the item is not claimed — claim it with `arggon start <id>` (the claim is what creates its worktree);",
  "the item is claimed by another identity — `arggon show <id> --meta` names the assignee;",
  "the item is done or cancelled — never reopened to satisfy a goal;",
  "this checkout is not the item's recorded worktree — the recorded `worktree_path` is the only place the goal may run;",
  "the recorded worktree no longer exists — re-claim it or release the footprint (`arggon cleanup`) before running a goal here.",
];

/** Failure codes surfaced as `error.code` (plus `GOAL_FAILED` for kernel errors). */
export type GoalErrorCode =
  | "GOAL_FAILED"
  | "GOAL_ITEM_CLOSED"
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
  /** The single goal, drawn from the first unchecked acceptance box. */
  objective: string;
  /** Every unchecked criterion the loop must satisfy, inlined and clipped. */
  verification: string[];
  /** Unchecked criteria NOT inlined (the overflow count). */
  verificationOmitted: number;
  /** False when the item carries no unchecked criterion ("define the goal first"). */
  hasGoal: boolean;
  boundaries: string[];
  refusals: string[];
  /** True when any line was clipped or any criterion deferred to the item. */
  truncated: boolean;
  /** Acceptance-checklist arithmetic behind the contract. */
  checklist: { total: number; unchecked: number; checked: number };
  /** Where the loop may run, and whether the item recorded a worktree. */
  worktree: { path: string; recorded: boolean };
  /** Which template copy rendered it: the adopter's, or the packaged one. */
  template: "adopter" | "package";
  /** Caller identity resolved from the environment; null when unresolved. */
  identity: string | null;
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
 * The derivation, pure: unchecked acceptance rows → objective + verification.
 * Rows come from the kernel's own acceptance parser, so the goal reads exactly
 * the checklist the done gate gates on (empty `- [ ]` boxes are placeholders,
 * not criteria, and are skipped).
 */
export function deriveGoal(
  rows: Array<{ text: string; checked: boolean }>,
): Pick<
  GoalContract,
  "objective" | "verification" | "verificationOmitted" | "hasGoal" | "truncated" | "checklist"
> {
  const total = rows.length;
  const checked = rows.filter((row) => row.checked).length;
  const unchecked = rows.filter((row) => !row.checked).map((row) => oneLine(row.text));
  const live = unchecked.filter((row) => row.length > 0);

  if (live.length === 0) {
    return {
      hasGoal: false,
      objective:
        "DEFINE THE GOAL FIRST: this item carries no unchecked acceptance criterion " +
        "(every box is ticked, or its checklist is empty), so there is nothing verifiable to loop on. " +
        "Either the work is finished — merge the PR and let the coordinator flip the item — or write the " +
        "criterion into the item's Acceptance section (arggon comment) before starting a goal.",
      verification: [
        "No verification contract: this goal cannot start until the item carries at least one unchecked acceptance criterion.",
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

/** The checklist tail note: what the inlined lines do and do not cover. */
function checklistNote(goal: GoalContract): string {
  if (!goal.hasGoal) {
    return "No unchecked acceptance criterion exists, so there is nothing to verify yet.";
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
    goal.identity === null
      ? "Caller identity could not be resolved in this environment (GITHUB_USER / GITHUB_ACTOR / `gh api user`), so the claim holder was not verified by login: confirm `arggon show <id> --meta` names you before the first write."
      : `Claim holder: ${goal.identity} — the goal is only valid while that identity still holds the claim.`,
    "",
    checklistNote(goal),
    "",
    "Rendered by `arggon goal <id>` — the boundaries above come from the CLI, not from the template file.",
  ];
  return lines.join("\n");
}

/** Template text the contract renders from: the adopter's copy, else the packaged one. */
function loadGoalTemplate(root: string): { body: string; source: "adopter" | "package" } {
  const candidates: Array<{ path: string; source: "adopter" | "package" }> = [
    { path: join(root, ...GOAL_TEMPLATE_REL.split("/")), source: "adopter" },
    {
      path: join(bundledTemplatesDir(), ...GOAL_TEMPLATE_SOURCE.split("/")),
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

function assertClaimed(item: GoalItem, login: string | undefined): void {
  if (item.status === "done" || item.status === "cancelled") {
    throw new GoalError(
      "GOAL_ITEM_CLOSED",
      `${item.id} is ${item.status} — a closed item is never reopened to satisfy a goal`,
    );
  }
  if (!item.assignee) {
    throw new GoalError(
      "GOAL_UNCLAIMED",
      `${item.id} has no claim: one goal per CLAIMED item, so claim it first (\`arggon start ${item.id}\`, which also creates its worktree)`,
    );
  }
  if (login !== undefined && item.assignee !== login) {
    throw new GoalError(
      "GOAL_FOREIGN_CLAIM",
      `${item.id} is claimed by '${item.assignee}', not by '${login}' — a goal never targets another identity's claim`,
    );
  }
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

  assertClaimed(item, identity ?? undefined);
  assertWorktree(root, item);

  const template = loadGoalTemplate(root);
  const derived = deriveGoal(parseAcceptanceRows(clip(shown.prose, MAX_GOAL_PROSE_BYTES).text));
  const worktreePath = item.worktreePath ?? root;
  const goal: GoalContract = {
    ...derived,
    boundaries: [...GOAL_BOUNDARIES],
    refusals: [...GOAL_REFUSALS],
    worktree: { path: worktreePath, recorded: Boolean(item.worktreePath) },
    template: template.source,
    identity,
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
        conventionVersion: readConventionVersion(opts.cwd),
      }) as KernelFailureEnvelope<GoalPayload>,
    };
  }
}
