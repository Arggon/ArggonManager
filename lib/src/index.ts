/**
 * Kernel library entry (`@arggondev/lib`, ADR 0011 §4 / ADR 0013: one logic path,
 * one library, shipped as its own package).
 *
 * The CLI (`arggon-manager`), the stdio MCP adapter and the native plugin
 * tools all consume the kernel through this module. It exposes, as one
 * importable and typed surface:
 *
 * - **items** — the tracker model: load/parse/walk (`loadItems`, `itemsById`,
 *   `tryLoadItem`), frontmatter round-tripping and the stable JSON contract
 *   shape (`toContractWorkItem`) plus its types.
 * - **rules** — the playbook and tree invariants that must hold no matter how
 *   a caller reaches the kernel: `rules.ts` is the single source
 *   (`assertUpdateRules`), over the status/transition, parent-edge and id
 *   primitives it builds on.
 * - **paths** — tracker detection (v5 `ArggonManager/` and legacy `tasks/`),
 *   repo-root derivation and new-item placement.
 * - **envelopes** — the `--json` contract builders
 *   (`ArggonManager/docs/json-output.md`): `successEnvelope`, `failEnvelope`,
 *   `compactWorkItem`, and one `*Operation` per command returning the exact
 *   documented envelope plus the CLI exit-code semantics.
 * - **view-model** — the derived board data the web board, the terminal TUI and
 *   the native panel all render (`view-model.ts`): id/priority ordering,
 *   dependency-blocked marks, grouping, per-status counts, tree flattening and
 *   the filter lens. Pure, no I/O, no new dependencies.
 *
 * The package ships no assets and no printing: argv parsing, TTY gates and
 * stdout formatting live in the root CLI; the bundled templates dir is
 * injected by the root adapter (`templatesDir` on create/import options).
 *
 * Surface discipline (task-native-kernel-lib-polish finding 5 / ADR 0013):
 * the **stable subset** the machine surfaces rely on is items + rules + paths
 * + envelopes/operations; everything else re-exported here (frontmatter/id
 * primitives, `run*` command kernels, human formatters, tracker-commit and
 * config helpers the root adapter uses) is deliberately public for the root
 * adapter but is **not** part of the stable contract — see `lib/README.md`.
 * No commander dependency.
 */
export type { Issue, ItemType, Status, WorkItem as ContractWorkItem } from "./types.js";
export type { SoftIssue, SoftLoadResult, WorkItem, WorkItem as KernelWorkItem } from "./items.js";
export type { Frontmatter } from "./frontmatter.js";

// --- Items -----------------------------------------------------------------

export {
  acceptanceComplete,
  itemsById,
  loadItems,
  softTryLoadItem,
  tryLoadItem,
  walkTasksTree,
} from "./items.js";
export {
  numberField,
  parseFrontmatter,
  stringArrayField,
  stringField,
  stringifyFrontmatter,
} from "./frontmatter.js";
export { toContractWorkItem } from "./contract.js";

// --- Rules (single source: rules.ts) ---------------------------------------

export { assertUpdateRules } from "./rules.js";
export type { CallerKind, UpdateIntent } from "./rules.js";
export {
  ASSIGNEE_PATTERN,
  CLAIMABLE_TYPES,
  CREATE_STATUSES,
  STATUSES,
  TRANSITIONS,
  assertAssignee,
  assertClaimAndBlocked,
  assertCreatableStatus,
  assertStatus,
  canTransition,
  isClaimable,
  isClaimed,
  unclaim,
} from "./status.js";
export { PARENT_TYPE, assertParentEdge, expectedParentType } from "./relations.js";
export {
  BRANCH_PATTERN,
  ITEM_TYPES,
  MAX_ID_LENGTH,
  assertBranchName,
  assertLabels,
  assertValidId,
  firstDuplicateId,
  innerSlug,
  isItemType,
  itemId,
  slugify,
} from "./ids.js";

// --- Paths -----------------------------------------------------------------

export {
  CONVENTION_FILE_NAME,
  LEGACY_TRACKER_DIR_NAME,
  TRACKER_DIR_NAME,
  conventionPathForLayout,
  conventionPathForRoot,
  docsDirForRoot,
  findTasksDir,
  findTrackerLocation,
  newItemPath,
  repoRootFromTasks,
  trackerAt,
  trackerNonItemDirs,
} from "./paths.js";
export type { TrackerLayout, TrackerLocation } from "./paths.js";

// --- Convention, filtering and ranking -------------------------------------

export {
  CONVENTION_VERSION,
  CONVENTION_VERSION_DEFAULT,
  DEFAULT_BRANCH_PATTERNS,
  parseConventionConfig,
  readConventionConfig,
  readConventionVersion,
  resolveBranchName,
} from "./convention.js";
export type { ConventionConfig, PlaybooksConfig, TrackerConfig } from "./convention.js";
export {
  FILTER_FIELDS,
  buildAncestorIndex,
  buildBlockedByIndex,
  matchesPredicate,
  parseFilter,
} from "./filter.js";
export type {
  AncestorIndex,
  BlockedByIndex,
  FilterField,
  FilterPredicate,
  FilterableItem,
} from "./filter.js";
export { downstreamWeight, isReady, openDependencies, runNext } from "./next.js";
export type { NextOptions, NextResult, NextSuggestion } from "./next.js";
export { formatDate, formatDateTime } from "./dates.js";
export { lockFilePathFor, withItemLock } from "./lock.js";
export type { LockOptions } from "./lock.js";
export {
  PRIORITIES,
  PRIORITY_LABEL_PATTERN,
  assertPriority,
  isPriority,
  priorityRank,
  runPriorityMigrate,
} from "./priority.js";
export type {
  Priority,
  PriorityMigrateEntry,
  PriorityMigrateOptions,
  PriorityMigrateResult,
} from "./priority.js";

// --- Board view-model (derived display data shared by web/TUI/panel) --------

export {
  applyViewLens,
  buildStatusIndex,
  groupItemsBy,
  hasOpenDependencies,
  itemsForStatus,
  matchesSubstringFilter,
  openDependencyIds,
  priorityTier,
  readyTodoCount,
  sortById,
  sortByPriority,
  statusCounts,
  treeEntries,
  visibleItems,
} from "./view-model.js";
export type { ViewGroup, ViewItem, ViewLens, ViewTreeEntry } from "./view-model.js";

// --- Envelopes (the `--json` contract) --------------------------------------

export { JSON_SCHEMA_VERSION, compactWorkItem, failEnvelope, successEnvelope } from "./json.js";
export type { JsonEnvelopeBase, JsonError } from "./json.js";
export { commitPayload } from "./tracker-commit.js";
export type { CommitPayload, TrackerCommitResult } from "./tracker-commit.js";
export type { SyncFilled } from "./sync-types.js";

// --- Command kernels (raw results; operations assemble the envelopes) -------

export { runCreate } from "./create.js";
export type { CreateOptions, CreateResult } from "./create.js";
export { runList } from "./list.js";
export type { ListOptions, ListResult } from "./list.js";
export { runShow } from "./show.js";
export type { ShowComment, ShowOptions, ShowResult } from "./show.js";
export { runReport } from "./report.js";
export type {
  ReportBlocked,
  ReportContainer,
  ReportGroup,
  ReportResult,
  StatusCounts,
} from "./report.js";
export { runTrend } from "./trend.js";
export type { RunTrendOptions, TrendCycleTime, TrendResult, TrendWeek } from "./trend.js";
export { isoWeekKey, parseLog, parseSince } from "./trend.js";
export type { ParsedLog } from "./trend.js";
export { parseOlderThan } from "./list.js";
export { runValidate } from "./validate.js";
export type { ValidateOptions, ValidateResult } from "./validate.js";
export { runUpdate, maybeCommitUpdate, parseCsvList } from "./update.js";
export type { UpdateOptions, UpdateResult } from "./update.js";
export { runComment } from "./comment.js";
export type { CommentOptions, CommentResult } from "./comment.js";
export { HANDOFF_FIELD_CAP, HANDOFF_SESSION_CAP, runHandoff } from "./handoff.js";
export type { HandoffOptions, HandoffResult } from "./handoff.js";
export { runSync } from "./sync-command.js";
export type { SyncResult } from "./sync-types.js";
export {
  CLEANUP_TERMINAL_STATUSES,
  classifyCleanupEntry,
  defaultCleanupGit,
  findMergedPr,
} from "./cleanup.js";
export type { ClassifyCleanupDeps, CleanupEntry, CleanupGit, MergedPr } from "./cleanup.js";
export {
  buildLocalWorkspaces,
  linkNodeModules,
  linkedWorkspacePackages,
  localWorkspacePackages,
  packageBuildScript,
  packageEntryExists,
  packageEntryPaths,
  pointWorkspaceAtLocal,
  unlinkNodeModulesLink,
} from "./worktree.js";
export type { LocalWorkspacePackage, WorkspaceBuildRunner } from "./worktree.js";
export { runImportIssues } from "./import-issues.js";
export type { GhExecutor, ImportIssuesOptions, ImportIssuesResult } from "./import-issues.js";
export {
  ghIssueListJson,
  importedBody,
  mapIssueState,
  normalizeGhLabels,
  resolveImportType,
} from "./import-issues.js";

// --- Operations (one per tool command; return the `--json` envelope) --------

export {
  commentOperation,
  createOperation,
  handoffOperation,
  importIssuesOperation,
  listOperation,
  nextOperation,
  priorityOperation,
  reportOperation,
  showOperation,
  syncOperation,
  updateOperation,
  validateOperation,
} from "./operations.js";
export type {
  CommandOutcome,
  CommentPayload,
  CreateOperationOptions,
  CreatePayload,
  EnvelopePayload,
  HandoffPayload,
  ImportIssuesOperationOptions,
  ImportIssuesPayload,
  KernelFailureEnvelope,
  KernelSuccessEnvelope,
  ListOperationOptions,
  ListPayload,
  NextPayload,
  PriorityPayload,
  ReportOperationOptions,
  ReportPayload,
  ShowPayload,
  SyncOperationOptions,
  SyncPayload,
  UpdateOperationOptions,
  UpdatePayload,
  ValidatePayload,
} from "./operations.js";

// --- Adapter helpers (public for the root package; not the stable subset) ---

export { writeFileAtomic } from "./atomic.js";
export {
  MAX_HUMAN_ERROR_CHARS,
  MAX_HUMAN_VALUE_CHARS,
  sanitizeHumanError,
  sanitizeHumanText,
  sanitizeHumanTextUncapped,
  sanitizeHumanValue,
} from "./sanitize.js";
export {
  parseGeneratedProjectName,
  readGeneratedProjectName,
  readGeneratedState,
  serializeGeneratedSection,
  updateGeneratedSection,
} from "./convention.js";
export type { GeneratedEntry } from "./convention.js";
export {
  commitTrackerMutation,
  formatCommitLine,
  readAutoCommitConfig,
  resolveAutoCommit,
  resolveCommonGitDir,
  trackerCommitMessage,
  trackerGitLockKey,
  updateCommitMessage,
} from "./tracker-commit.js";
export { formatListTable, resolveCurrentLogin } from "./list.js";
export { DEFAULT_TAIL_COMMENTS, renderShowText } from "./show.js";
export { formatReportMarkdown, formatReportTable } from "./report.js";
export { formatTrendMarkdown, formatTrendTable } from "./trend.js";
export { formatValidateHuman } from "./validate.js";
export { ghPrListJson } from "./get-open-prs.js";
export type { GhPrListOptions } from "./get-open-prs.js";
export { bindJsonProgram, emitJson, failJson, jsonEnabled, successJson } from "./json.js";
export type { FailJsonOptions } from "./json.js";
