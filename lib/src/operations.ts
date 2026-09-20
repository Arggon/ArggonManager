/**
 * In-process kernel operations (W1, task-native-kernel-lib).
 *
 * One function per command the machine surfaces consume: each operation calls
 * the same `run*` kernel function the CLI uses and returns the exact documented
 * `--json` envelope (`ArggonManager/docs/json-output.md`) plus the CLI
 * exit-code semantics. ADR 0011 §4 (one logic path, one library): the CLI, the
 * stdio MCP adapter and (from W2/W3) the native plugin tools all reach the
 * kernel through these operations, so envelope assembly and failure codes
 * exist exactly once.
 *
 * Boundaries:
 * - No printing. Callers emit `outcome.envelope` themselves (`emitJson` in the
 *   CLI, JSON tool text in the MCP/native surfaces).
 * - No argv parsing, TTY gates or human formatting: those stay in `cli.ts`.
 * - Kernel errors never escape: they come back as the documented `ok: false`
 *   envelope with the command's failure code, so a tool surface can turn them
 *   into a typed tool error without try/catch.
 */
import { relative, sep } from "node:path";
import { readConventionVersion } from "./convention.js";
import { toContractWorkItem } from "./contract.js";
import { runCreate, type CreateOptions } from "./create.js";
import { runComment, type CommentOptions, type CommentResult } from "./comment.js";
import { runHandoff, type HandoffOptions, type HandoffResult } from "./handoff.js";
import {
  runImportIssues,
  type ImportIssuesOptions,
  type ImportIssuesResult,
} from "./import-issues.js";
import { failEnvelope, successEnvelope, type JsonEnvelopeBase, type JsonError } from "./json.js";
import { runList, type ListOptions } from "./list.js";
import { runNext, type NextOptions } from "./next.js";
import {
  runPriorityMigrate,
  type PriorityMigrateEntry,
  type PriorityMigrateOptions,
} from "./priority.js";
import { runReport, type ReportGroup } from "./report.js";
import { runShow, type ShowComment, type ShowOptions } from "./show.js";
import { runSync } from "./sync-command.js";
import type { SyncFilled, SyncResult } from "./sync-types.js";
import { commitPayload, type CommitPayload } from "./tracker-commit.js";
import { runTrend, type TrendResult } from "./trend.js";
import type { Issue, WorkItem as ContractWorkItem } from "./types.js";
import { maybeCommitUpdate, runUpdate, type UpdateOptions, type UpdateResult } from "./update.js";
import { runValidate } from "./validate.js";
import type { TrackerLayout } from "./paths.js";

/** Envelope payload fields (the command-specific fields documented per command). */
export type EnvelopePayload = Record<string, unknown>;

/** Success envelope: the shared base plus the command payload. */
export type KernelSuccessEnvelope<P extends EnvelopePayload = EnvelopePayload> =
  JsonEnvelopeBase & {
    ok: true;
  } & P;

/** Failure envelope: the shared base plus the error and any partial payload. */
export type KernelFailureEnvelope<P extends EnvelopePayload = EnvelopePayload> =
  JsonEnvelopeBase & {
    ok: false;
    error: JsonError;
  } & P;

/**
 * One command outcome: the ready-to-emit envelope plus the exit code the CLI
 * applies. `ok` mirrors `envelope.ok` and is the discriminant a tool surface
 * uses for `isError`.
 */
export type CommandOutcome<P extends EnvelopePayload = EnvelopePayload> =
  | { ok: true; envelope: KernelSuccessEnvelope<P>; exitCode: 0 | 1 }
  | { ok: false; envelope: KernelFailureEnvelope<P>; exitCode: 0 | 1; error?: Error };

function succeed<P extends EnvelopePayload>(
  command: string,
  payload: P,
  conventionVersion: number,
): CommandOutcome<P> {
  return {
    ok: true,
    envelope: successEnvelope(command, payload, conventionVersion) as KernelSuccessEnvelope<P>,
    exitCode: 0,
  };
}

/**
 * Failure envelope for a thrown kernel error. `cwd` (not the repo root) feeds
 * the convention version, matching the CLI's failure path byte for byte; a
 * successful run reports the version of the detected tracker root instead.
 */
function fail<P extends EnvelopePayload = EnvelopePayload>(
  command: string,
  cwd: string,
  code: string,
  err: unknown,
): CommandOutcome<P> {
  const error = err instanceof Error ? err : new Error(String(err));
  return {
    ok: false,
    envelope: failEnvelope({
      command,
      message: error.message,
      code,
      conventionVersion: readConventionVersion(cwd),
    }) as KernelFailureEnvelope<P>,
    exitCode: 1,
    error,
  };
}

// ---------------------------------------------------------------------------
// list / show / next / report / validate (pure reads)
// ---------------------------------------------------------------------------

export type ListOperationOptions = ListOptions & {
  /** Compact ADR 0006 shape is the default; `true` restores null/empty fields. */
  full?: boolean;
};

export type ListPayload = { items: ContractWorkItem[] };

export function listOperation(opts: ListOperationOptions): CommandOutcome<ListPayload> {
  try {
    const result = runList(opts);
    return succeed(
      "list",
      {
        items: result.items.map((item) =>
          toContractWorkItem(item, result.root, { full: opts.full === true }),
        ),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    return fail("list", opts.cwd, "LIST_FAILED", err);
  }
}

export type ShowPayload = {
  item: ContractWorkItem;
  path: string;
  /**
   * `--body` (or an MCP body request) includes the full body plus every
   * comment; the compact view includes only the bounded comment tail.
   */
  body?: string;
  comments?: ShowComment[];
};

export function showOperation(opts: ShowOptions): CommandOutcome<ShowPayload> {
  try {
    const result = runShow(opts);
    return succeed(
      "show",
      {
        item: toContractWorkItem(result.item, result.root),
        path: result.path,
        ...(opts.body === true
          ? { body: result.item.body, comments: result.allComments.map((c) => ({ ...c })) }
          : { comments: result.comments.map((c) => ({ ...c })) }),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    return fail("show", opts.cwd, "SHOW_FAILED", err);
  }
}

export type NextPayload = {
  suggestion: {
    item: ContractWorkItem;
    parentChain: string[];
    reason: string;
    blockedBy: string[];
    unblocks: number;
  } | null;
};

export function nextOperation(opts: NextOptions): CommandOutcome<NextPayload> {
  try {
    const result = runNext(opts);
    const suggestion = result.suggestion
      ? {
          item: toContractWorkItem(result.suggestion.item, result.root),
          parentChain: result.suggestion.parentChain,
          reason: result.suggestion.reason,
          blockedBy: result.suggestion.blockedBy,
          unblocks: result.suggestion.unblocks,
        }
      : null;
    return succeed("next", { suggestion }, readConventionVersion(result.root));
  } catch (err) {
    return fail("next", opts.cwd, "NEXT_FAILED", err);
  }
}

export type ReportOperationOptions = {
  cwd: string;
  /** Mine git history for weekly completions and cycle time (pure read). */
  trend?: boolean;
  /** Trend window start, YYYY-MM-DD (requires `trend`). */
  since?: string;
};

export type ReportPayload = { groups: ReportGroup[]; trend?: TrendResult };

export function reportOperation(opts: ReportOperationOptions): CommandOutcome<ReportPayload> {
  try {
    if (opts.since !== undefined && opts.trend !== true) {
      // Same guard and message text as the CLI.
      throw new Error("--since requires --trend");
    }
    let trend: TrendResult | null = null;
    if (opts.trend === true) {
      try {
        trend = runTrend({ cwd: opts.cwd, since: opts.since });
      } catch (err) {
        return fail("report", opts.cwd, "TREND_FAILED", err);
      }
    }
    const result = runReport({ cwd: opts.cwd });
    const payload: ReportPayload = { groups: result.groups };
    if (trend) payload.trend = trend;
    return succeed("report", payload, readConventionVersion(result.root));
  } catch (err) {
    return fail("report", opts.cwd, "REPORT_FAILED", err);
  }
}

export type ValidatePayload = {
  /** Payload-level ok: `false` when validation found errors (envelope ok:false too). */
  ok: boolean;
  layout: TrackerLayout;
  errors: Issue[];
  warnings: Issue[];
};

export function validateOperation(opts: { cwd: string }): CommandOutcome<ValidatePayload> {
  try {
    const result = runValidate({ cwd: opts.cwd });
    const payload: ValidatePayload = {
      ok: result.errors.length === 0,
      layout: result.layout,
      errors: result.errors,
      warnings: result.warnings,
    };
    // Same envelope shape as the CLI: the shared base + the payload, with the
    // error field when validation failed (envelope ok flips to false and the
    // CLI exits non-zero; tool surfaces map it to a tool error).
    const envelope = successEnvelope(
      "validate",
      {
        ...payload,
        ...(result.errors.length > 0
          ? {
              error: {
                message: `validate failed with ${result.errors.length} error(s)`,
                code: "VALIDATE_FAILED",
              },
            }
          : {}),
      },
      result.conventionVersion,
    );
    return result.errors.length === 0
      ? { ok: true, envelope: envelope as KernelSuccessEnvelope<ValidatePayload>, exitCode: 0 }
      : { ok: false, envelope: envelope as KernelFailureEnvelope<ValidatePayload>, exitCode: 1 };
  } catch (err) {
    return fail("validate", opts.cwd, "VALIDATE_FAILED", err);
  }
}

// ---------------------------------------------------------------------------
// create / update / comment / handoff / priority (writes)
// ---------------------------------------------------------------------------

export type CreateOperationOptions = CreateOptions & {
  /** Compact ADR 0006 shape is the default; `true` restores null/empty fields. */
  full?: boolean;
};

export type CreatePayload = {
  path: string;
  item: ContractWorkItem;
  commit?: CommitPayload;
};

export function createOperation(opts: CreateOperationOptions): CommandOutcome<CreatePayload> {
  try {
    const result = runCreate(opts);
    return succeed(
      "create",
      {
        path: relativePath(result.root, result.path),
        item: toContractWorkItem(result.item, result.root, { full: opts.full === true }),
        commit: commitPayload(result.commit),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    return fail("create", opts.cwd, "CREATE_FAILED", err);
  }
}

export type UpdateOperationOptions = UpdateOptions & {
  /** Compact ADR 0006 shape is the default; `true` restores null/empty fields. */
  full?: boolean;
  /** Tracker auto-commit flag; `undefined` resolves via `x-tracker.auto-commit`. */
  commit?: boolean;
};

export type UpdatePayload = {
  item: ContractWorkItem;
  autoCompleted: string[];
  cascadeLevels: string[];
  movedFrom?: string;
  renamedFrom?: string;
  cascadeSkipped: UpdateResult["cascadeSkipped"];
  issueRoundtrip?: UpdateResult["issueRoundtrip"];
  commit?: CommitPayload;
};

export function updateOperation(opts: UpdateOperationOptions): CommandOutcome<UpdatePayload> {
  try {
    const result = runUpdate(opts);
    const commit = maybeCommitUpdate(result, opts.commit);
    return succeed(
      "update",
      {
        item: toContractWorkItem(result.item, result.root, { full: opts.full === true }),
        autoCompleted: result.autoCompleted,
        cascadeLevels: result.cascadeLevels,
        ...(result.movedFrom ? { movedFrom: result.movedFrom } : {}),
        ...(result.renamedFrom ? { renamedFrom: result.renamedFrom } : {}),
        cascadeSkipped: result.cascadeSkipped,
        ...(result.issueRoundtrip ? { issueRoundtrip: result.issueRoundtrip } : {}),
        ...(commit ? { commit: commitPayload(commit) } : {}),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    return fail("update", opts.cwd, "UPDATE_FAILED", err);
  }
}

export type CommentPayload = {
  id: string;
  path: string;
  comment: CommentResult["comment"];
  commit?: CommitPayload;
};

export function commentOperation(opts: CommentOptions): CommandOutcome<CommentPayload> {
  try {
    const result = runComment(opts);
    return succeed(
      "comment",
      {
        id: result.id,
        path: result.path,
        comment: result.comment,
        commit: commitPayload(result.commit),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    // COMMENT_FAILED is the documented code for both body-append commands.
    return fail("comment", opts.cwd, "COMMENT_FAILED", err);
  }
}

export type HandoffPayload = CommentPayload & { handoff: HandoffResult["handoff"] };

export function handoffOperation(opts: HandoffOptions): CommandOutcome<HandoffPayload> {
  try {
    const result = runHandoff(opts);
    return succeed(
      "handoff",
      {
        id: result.id,
        path: result.path,
        comment: result.comment,
        handoff: result.handoff,
        commit: commitPayload(result.commit),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    // COMMENT_FAILED by design: the handoff kernel IS the comment kernel
    // (same body-append path, same failure modes).
    return fail("handoff", opts.cwd, "COMMENT_FAILED", err);
  }
}

export type PriorityPayload = {
  dryRun: boolean;
  scanned: number;
  changed: number;
  entries: PriorityMigrateEntry[];
};

export function priorityOperation(opts: PriorityMigrateOptions): CommandOutcome<PriorityPayload> {
  try {
    const result = runPriorityMigrate(opts);
    return succeed(
      "priority",
      {
        dryRun: result.dryRun,
        scanned: result.scanned,
        changed: result.changed,
        entries: result.entries,
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    return fail("priority", opts.cwd, "PRIORITY_FAILED", err);
  }
}

// ---------------------------------------------------------------------------
// sync / import-issues (GitHub reconciliation)
// ---------------------------------------------------------------------------

export type SyncOperationOptions = {
  cwd: string;
  check?: boolean;
  write?: boolean;
  repo?: string;
};

export type SyncPayload = {
  mode: SyncResult["mode"];
  matched: string[];
  unmatched: string[];
  pending: string[];
  ambiguous: SyncResult["ambiguous"];
  suggestions: SyncResult["suggestions"];
  filled: SyncFilled | null;
  errors: string[];
  exit_code: 0 | 1;
};

export function syncOperation(opts: SyncOperationOptions): CommandOutcome<SyncPayload> {
  try {
    const result = runSync(opts);
    const payload: SyncPayload = {
      mode: result.mode,
      matched: result.matched,
      unmatched: result.unmatched,
      pending: result.pending,
      ambiguous: result.ambiguous,
      suggestions: result.suggestions,
      filled: result.filled,
      errors: result.errors,
      exit_code: result.exit_code,
    };
    if (result.errors.length > 0) {
      const error = new Error(result.errors.join("; "));
      return {
        ok: false,
        envelope: failEnvelope({
          command: "sync",
          message: error.message,
          code: "SYNC_FAILED",
          conventionVersion: readConventionVersion(opts.cwd),
        }) as KernelFailureEnvelope<SyncPayload>,
        exitCode: result.exit_code === 0 ? 0 : 1,
        error,
      };
    }
    return {
      ok: true,
      envelope: successEnvelope(
        "sync",
        payload,
        readConventionVersion(opts.cwd),
      ) as KernelSuccessEnvelope<SyncPayload>,
      exitCode: result.exit_code === 0 ? 0 : 1,
    };
  } catch (err) {
    return fail("sync", opts.cwd, "SYNC_FAILED", err);
  }
}

export type ImportIssuesOperationOptions = ImportIssuesOptions;

export type ImportIssuesPayload = {
  dryRun: boolean;
  story: ImportIssuesResult["story"];
  entries: ImportIssuesResult["entries"];
  created: number;
  skipped: number;
  labels: { mapped: number; skipped: number };
  commit?: CommitPayload;
};

export function importIssuesOperation(
  opts: ImportIssuesOperationOptions,
): CommandOutcome<ImportIssuesPayload> {
  try {
    const result = runImportIssues(opts);
    return succeed(
      "import-issues",
      {
        dryRun: result.dryRun,
        story: result.story,
        entries: result.entries,
        created: result.created,
        skipped: result.skipped,
        labels: { mapped: result.labelsMapped, skipped: result.labelsSkipped },
        ...(result.commit ? { commit: commitPayload(result.commit) } : {}),
      },
      readConventionVersion(result.root),
    );
  } catch (err) {
    return fail("import-issues", opts.cwd, "IMPORT_FAILED", err);
  }
}

/** Posix repo-relative path, the `--json` contract shape for file paths. */
function relativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}
