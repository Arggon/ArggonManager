#!/usr/bin/env node
import { Command } from "commander";
import { relative, sep } from "node:path";
import { formatAdoptAckReport, formatAdoptReport, runAdopt, runAdoptAck } from "./adopt.js";
import { displayPath, runBoard } from "./board.js";
import { startBoardServer } from "./board-serve.js";
import { runBranch } from "./branch.js";
import {
  DEFAULT_TAIL_COMMENTS,
  JSON_SCHEMA_VERSION,
  bindJsonProgram,
  commentOperation,
  commitPayload,
  createOperation,
  emitJson,
  failEnvelope,
  failJson,
  formatCommitLine,
  formatListTable,
  formatReportMarkdown,
  formatReportTable,
  formatTrendMarkdown,
  formatTrendTable,
  formatValidateHuman,
  handoffOperation,
  importIssuesOperation,
  jsonEnabled,
  listOperation,
  maybeCommitUpdate,
  nextOperation,
  parseCsvList,
  priorityOperation,
  readConventionVersion,
  renderShowText,
  reportOperation,
  runComment,
  runCreate,
  runHandoff,
  runImportIssues,
  runList,
  runNext,
  runPriorityMigrate,
  runReport,
  runShow,
  runSync,
  runTrend,
  runUpdate,
  runValidate,
  sanitizeHumanError,
  showOperation,
  successEnvelope,
  successJson,
  syncOperation,
  toContractWorkItem,
  updateOperation,
  validateOperation,
  type TrendResult,
} from "@arggon/lib";

import { runStart } from "./start.js";
import { runCleanup } from "./cleanup.js";

import { runDoctor, formatDoctorReport, measureBudgetForDoctor } from "./doctor.js";

import {
  runInit,
  dryRunInit,
  type InitResult,
  type InitDryRunResult,
  type ProposalEntry,
} from "./init.js";

import { runInstructions } from "./instructions.js";
import { formatLayoutMigrateHuman, runLayoutMigrate } from "./layout-migrate.js";
import { runMcpServer } from "./mcp-server.js";
import { bundledTemplatesDir } from "./package-assets.js";

import {
  formatPlaybookStatusTable,
  runPlaybookNew,
  runPlaybookRefresh,
  runPlaybookStatus,
  runStackExplore,
} from "./playbooks.js";
import {
  formatSpecAnalyzeHuman,
  formatSpecBaselineCompareHuman,
  formatSpecBaselineSaveHuman,
  formatSpecValidateHuman,
  runSpecAnalyze,
  runSpecAnalyzeCompareBaseline,
  runSpecAnalyzeSaveBaseline,
  runSpecNew,
  runSpecValidate,
} from "./spec.js";
import { runSpecImport, SpecImportError } from "./spec-import.js";
import { formatSpecAuditHuman, runSpecAudit, SPEC_AUDIT_DEFAULTS } from "./spec-audit.js";

import { runTuiBoard } from "./tui.js";

import { arggonVersion } from "./docs.js";
import { buildVersion } from "./build-info.js";

import { gateSteal, findItemStatus, gateReopen } from "./steal-gate.js";
const program = new Command();

/**
 * Human failure line for a command: one display-sanitized line on stderr
 * (bug-cli-error-output-injection F1). Failure messages can embed
 * repo-controlled values (item file paths, config keys, git output); escaping
 * them at this boundary keeps a hostile repo from forging a line or emitting a
 * raw control sequence. Display only: the `--json` error envelope keeps the
 * raw message, byte for byte (docs/json-output.md §Failures).
 */
function printHumanError(label: string, message: string): void {
  console.error(`${label}: ${sanitizeHumanError(message)}`);
}

/**
 * Success-path human lines share the display policy above
 * (task-success-stdout-sanitize, the last channel of the human-output hygiene
 * chain): every dynamic value interpolated into a human stdout line is
 * sanitized at its print site — repo-controlled paths, ids, branch names,
 * titles, labels, hook commands, external issue/PR data, and operator argv
 * echoes (baseline paths) cannot forge a line or emit a raw control sequence.
 * Like failures, the composite-diagnostic cap (`MAX_HUMAN_ERROR_CHARS`, 2000)
 * is used rather than the 200-char report-value cap: these lines routinely
 * carry absolute paths and generated sentences (the `next` rationale is
 * ~330 chars), and the tighter cap would cut ordinary output. Ordinary values
 * render byte-identical; `--json` keeps the raw value.
 */

program
  .name("arggon")
  .description("Git-native task CLI for ArggonManager")
  // Package version (manual bump per release wave; see README "Versioning")
  // plus the build's git sha/branch (task-npm-packaging), so side-by-side
  // installs — main vs opencode2 — are distinguishable. The git probe is
  // failure-isolated and only paid for `--version`: no other command needs the
  // identity, and a plain `arggonVersion()` keeps generated-doc provenance
  // byte-stable. Subcommand-local `--version` flags (playbook new/refresh) are
  // scoped by enablePositionalOptions and never reach this root flag; seeing
  // one here only costs an extra probe, it never changes behavior.
  .version(
    process.argv.slice(2).some((a) => a === "--version" || a === "-V")
      ? buildVersion()
      : arggonVersion(),
  )
  // Positional options: the root --version flag must not swallow a subcommand's
  // own --version (playbook new/refresh), so options after the subcommand name
  // are parsed by that subcommand only.
  .enablePositionalOptions()
  .option("--json", "emit one JSON object on stdout (agent contract)", false);

bindJsonProgram(program);

program
  .command("hello")
  .description("Sanity-check that the CLI runs")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { json?: boolean }) => {
    const message = "arggon: hello from Phase 1 scaffold";
    if (jsonEnabled(opts)) {
      successJson("hello", { message }, readConventionVersion(process.cwd()));
      return;
    }
    console.log(message);
  });

program
  .command("init")
  .description(
    "Scaffold the tracker convention (+ templates + governing docs) in a repo (ArggonManager/; legacy tasks/ trees upgrade in place)",
  )
  .argument("[dir]", "target directory", ".")
  .option(
    "-f, --force",
    "overwrite existing convention/templates (docs are never overwritten)",
    false,
  )
  .option(
    "--full",
    "also generate the tier-2 doc set (ARCHITECTURE.md, ArggonManager/docs/convention.md, ...)",
    false,
  )
  .option(
    "--backup",
    "archive adopter-modified docs to backup/<date>/<dest> before regenerating them (default: skip modified docs)",
    false,
  )
  .option(
    "--propose",
    "upgrade channel for acked/modified docs: write template updates to <dest>.proposed-<version> side files (originals untouched, state unmutated, nothing committed) — diff/merge/re-ack to adopt (task-init-propose-acked-updates; section-level regions by default, spec-propose-section-backports-007)",
    false,
  )
  .option(
    "--propose-whole-file",
    "with --propose: force whole-file proposals (the pre-007 behavior) instead of the default section-level region backports",
    false,
  )
  .option(
    "--dry-run",
    "plan only: print exactly what init would do per destination and write NOTHING — no files, no backup dir, no auto-commit (pure read)",
    false,
  )
  .option(
    "--no-commit",
    "keep the generated docs untracked: skip the auto-commit of what init wrote (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      dir: string,
      opts: {
        force: boolean;
        full?: boolean;
        backup?: boolean;
        propose?: boolean;
        proposeWholeFile?: boolean;
        dryRun?: boolean;
        commit?: boolean;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      try {
        if (opts.propose && (opts.backup || opts.force)) {
          throw new Error(
            "init --propose does not combine with --backup/--force (proposals never touch originals or regenerate)",
          );
        }
        if (opts.dryRun) {
          const result = dryRunInit({
            dir,
            force: Boolean(opts.force),
            full: Boolean(opts.full),
            backup: Boolean(opts.backup),
            propose: Boolean(opts.propose),
            proposeWholeFile: Boolean(opts.proposeWholeFile),
          });
          if (json) {
            successJson(
              "init",
              {
                root: result.root,
                alreadyInitialized: result.alreadyInitialized,
                force: result.force,
                created: result.created,
                updated: result.updated,
                modified: result.modified,
                backedUp: result.backedUp,
                skipped: result.skipped,
                restored: result.restored,
                conventionPath: result.conventionPath,
                ...(result.proposals ? { proposals: proposalPayload(result.proposals) } : {}),
                dryRun: true,
                plan: result.plan,
                ...(result.warning ? { warning: result.warning } : {}),
              },
              readConventionVersion(result.root),
            );
            return;
          }
          printInitDryRun(result);
          return;
        }
        const result = runInit({
          dir,
          force: Boolean(opts.force),
          full: Boolean(opts.full),
          backup: Boolean(opts.backup),
          propose: Boolean(opts.propose),
          proposeWholeFile: Boolean(opts.proposeWholeFile),
          commit: opts.commit === false ? false : undefined,
        });
        if (json) {
          successJson(
            "init",
            {
              root: result.root,
              alreadyInitialized: result.alreadyInitialized,
              force: result.force,
              created: result.created,
              updated: result.updated,
              modified: result.modified,
              backedUp: result.backedUp,
              skipped: result.skipped,
              restored: result.restored,
              conventionPath: result.conventionPath,
              ...(result.proposals ? { proposals: proposalPayload(result.proposals) } : {}),
              commit: commitPayload(result.commit),
              ...(result.warning ? { warning: result.warning } : {}),
            },
            readConventionVersion(result.root),
          );
          return;
        }
        if (result.proposals) {
          printInitProposeHuman(result);
          return;
        }
        printInitHuman(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "init",
            message,
            code: "INIT_FAILED",
            conventionVersion: readConventionVersion(dir),
          });
          return;
        }
        printHumanError("arggon init", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("doctor")
  .description(
    "Report installation state: convention version, generated-doc provenance, tracker counts (pure read); with --budget, also the ADR 0006 context-budget surfaces incl. the live MCP tool-schema size (report-only)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .option(
    "--budget",
    "also measure the ADR 0006 context-budget surfaces (fresh init --full in a deleted temp tree; live MCP tools/list; report-only)",
    false,
  )
  .action(async (opts: { json?: boolean; budget?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runDoctor({ cwd: process.cwd() });
      if (opts.budget === true) {
        // Measured after the tree report (both initialized and not): the
        // budget surfaces come from a throwaway temp tree + the live MCP
        // server, not from the tree being examined (task-schema-budget).
        Object.assign(result, await measureBudgetForDoctor());
      }
      if (json) {
        successJson(
          "doctor",
          {
            root: result.root,
            initialized: result.initialized,
            // Resolved {{PROJECT_NAME}} for this run (null = unrecoverable;
            // bug-project-name-dir-derived, additive).
            projectName: result.projectName,
            docs: result.docs,
            tracker: result.tracker,
            git: result.git,
            // OpenCode integration state (task-opencode-v2-doctor, additive).
            opencode: result.opencode,
            ...(result.budget ? { budget: result.budget } : {}),
            ...(result.budgetError !== undefined ? { budgetError: result.budgetError } : {}),
          },
          result.conventionVersion,
        );
        return;
      }
      process.stdout.write(formatDoctorReport(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "doctor",
          message,
          code: "DOCTOR_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon doctor", message);
      process.exitCode = 1;
    }
  });

program
  .command("adopt")
  .description(
    "Inventory the repo's governing docs and create the tracked, agent-executable adoption task (requires init)",
  )
  .option("--dry-run", "print the inventory and planned actions, create nothing", false)
  .option(
    "--story <story-id>",
    "parent story for the adoption task (default: auto-create story-arggon-adoption under the first epic; with no epic at all, an initiative+epic chain is auto-created). Prefer --story when adopting an existing repo with its own structure",
  )
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the adoption task + story (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option(
    "--ack",
    "standalone: acknowledge the current on-disk content of every generated doc as the new x-generated baseline (refresh checksums; sanctioned sweep edits stop reporting as modified)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      dryRun?: boolean;
      story?: string;
      commit?: boolean;
      ack?: boolean;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      try {
        if (opts.ack) {
          const result = runAdoptAck({ cwd: process.cwd() });
          if (json) {
            successJson(
              "adopt",
              { acked: result.acked, count: result.count },
              readConventionVersion(result.root),
            );
            return;
          }
          process.stdout.write(formatAdoptAckReport(result));
          return;
        }
        const result = runAdopt({
          cwd: process.cwd(),
          story: opts.story,
          dryRun: Boolean(opts.dryRun),
          commit: opts.commit === false ? false : undefined,
        });
        if (json) {
          successJson(
            "adopt",
            {
              taskId: result.taskId,
              storyId: result.storyId,
              storyCreated: result.storyCreated,
              createdContainers: result.createdContainers,
              taskCreated: result.taskCreated,
              skipped: result.skipped,
              taskPath: result.taskPath,
              inventory: result.inventory,
              dryRun: result.dryRun,
              commit: commitPayload(result.commit),
            },
            readConventionVersion(result.root),
          );
          return;
        }
        process.stdout.write(formatAdoptReport(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "adopt",
            message,
            code: "ADOPT_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon adopt", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("create")
  .description("Create a work item under the tracker root (label at creation with --labels <csv>)")
  .argument("<type>", "initiative | epic | story | task | bug")
  .argument("<title>", "title (id is slugified; override with --id)")
  .option(
    "-p, --parent <id>",
    "parent item id (required except initiative; expected parent per type — initiative: none; epic: initiative; story: epic; task/bug: story)",
  )
  .option("--id <id>", "override id stem (CLI still adds task-/bug- for leaves)")
  .option("--assignee <login>", "assignee (omit when unassigned)")
  .option(
    "--labels <csv>",
    "label the new item at creation (comma-separated; same kebab-case rules as update --labels)",
  )
  .option(
    "--priority <p>",
    "set the priority field at creation (convention v4): p0 | p1 | p2 | p3 (optional; absent = unprioritized)",
  )
  .option("--status <status>", "status (default: todo)", "todo")
  .option("--blocked-reason <text>", "required when --status blocked")
  .option(
    "--issue <n>",
    "GitHub issue number recorded in the additive issue frontmatter field (start --open-pr appends Closes #N; positive integer)",
  )
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the created item (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option(
    "--full",
    "emit complete WorkItem shapes (default: compact per ADR 0006 — null/empty optional fields omitted)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      type: string,
      title: string,
      opts: {
        parent?: string;
        id?: string;
        assignee?: string;
        labels?: string;
        priority?: string;
        status?: string;
        blockedReason?: string;
        issue?: string;
        commit?: boolean;
        full?: boolean;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      try {
        if (json) {
          // The kernel operation assembles the documented envelope; the CLI
          // only emits it (ADR 0011 §4: one logic path, one library).
          const outcome = createOperation({
            cwd: process.cwd(),
            type,
            title,
            parent: opts.parent,
            id: opts.id,
            assignee: opts.assignee,
            labels: opts.labels !== undefined ? parseCsvList(opts.labels) : undefined,
            priority: opts.priority,
            status: opts.status,
            blockedReason: opts.blockedReason,
            issue: opts.issue !== undefined ? Number(opts.issue) : undefined,
            commit: opts.commit === false ? false : undefined,
            templatesDir: bundledTemplatesDir(),
            full: opts.full === true,
          });
          emitJson(outcome.envelope);
          if (!outcome.ok) process.exitCode = 1;
          return;
        }
        const result = runCreate({
          cwd: process.cwd(),
          type,
          title,
          parent: opts.parent,
          id: opts.id,
          assignee: opts.assignee,
          labels: opts.labels !== undefined ? parseCsvList(opts.labels) : undefined,
          priority: opts.priority,
          status: opts.status,
          blockedReason: opts.blockedReason,
          issue: opts.issue !== undefined ? Number(opts.issue) : undefined,
          commit: opts.commit === false ? false : undefined,
          templatesDir: bundledTemplatesDir(),
        });
        console.log(`arggon create: ${result.item.type} ${sanitizeHumanError(result.id)}`);
        console.log(`  ${sanitizeHumanError(result.path)}`);
        const commitLine = formatCommitLine(result.commit);
        if (commitLine) console.log(`  ${commitLine}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "create",
            message,
            code: "CREATE_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon create", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("list")
  .description("List work items under the tracker root with optional filters")
  .option("--status <status>", "exact v0 status (todo | in_progress | blocked | done | cancelled)")
  .option("--type <type>", "exact v0 type (initiative | epic | story | task | bug)")
  .option(
    "--parent <id>",
    'exact parent item id (sugar for the "parent:" filter predicate); ANDed with the other flags',
  )
  .option(
    "--assignee <login>",
    "exact assignee login; @me resolves via GITHUB_USER, then GITHUB_ACTOR, then `gh api user`",
  )
  .option(
    "--filter <expr>",
    'compact filter (e.g. "status:todo !label:security"); fields status, type, assignee, label, parent, depends-on, blocked-by, ancestor, priority; ! negates; quotes allow spaces',
  )
  .option(
    "--view <name>",
    "saved view name from the tracker .convention.yml x-views; ANDed with the flags and --filter",
  )
  .option(
    "--stale",
    "list claimed items whose claimed_at lease is older than --older-than (claims from before claimed_at count as stale)",
    false,
  )
  .option(
    "--older-than <duration>",
    "stale threshold for --stale: <number><d|h|m> (e.g. 7d, 12h, 30m)",
  )
  .option(
    "--full",
    "emit complete WorkItem shapes (default: compact per ADR 0006 — null/empty optional fields omitted)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      status?: string;
      full?: boolean;
      type?: string;
      parent?: string;
      assignee?: string;
      filter?: string;
      view?: string;
      stale?: boolean;
      olderThan?: string;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      try {
        if (json) {
          const outcome = listOperation({
            cwd: process.cwd(),
            status: opts.status,
            type: opts.type,
            parent: opts.parent,
            assignee: opts.assignee,
            filter: opts.filter,
            view: opts.view,
            stale: opts.stale,
            olderThan: opts.olderThan,
            full: opts.full === true,
          });
          emitJson(outcome.envelope);
          if (!outcome.ok) process.exitCode = 1;
          return;
        }
        const result = runList({
          cwd: process.cwd(),
          status: opts.status,
          type: opts.type,
          parent: opts.parent,
          assignee: opts.assignee,
          filter: opts.filter,
          view: opts.view,
          stale: opts.stale,
          olderThan: opts.olderThan,
        });
        process.stdout.write(formatListTable(result.items));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "list",
            message,
            code: "LIST_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon list", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("next")
  .description(
    "Suggest the next claimable leaf item (task/bug leaves; ready items rank first, by downstream weight — unblocks count; lexicographic id on ties; --include-stories opts stories back in)",
  )
  .option(
    "--ready",
    "limit the pool to ready items (unclaimed todos whose depends_on are all done/cancelled)",
    false,
  )
  .option(
    "--include-stories",
    "include unclaimed stories in the suggestion pool (default: leaf work only)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { ready?: boolean; includeStories?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      if (json) {
        const outcome = nextOperation({
          cwd: process.cwd(),
          ready: Boolean(opts.ready),
          includeStories: Boolean(opts.includeStories),
        });
        emitJson(outcome.envelope);
        if (!outcome.ok) process.exitCode = 1;
        return;
      }
      const result = runNext({
        cwd: process.cwd(),
        ready: Boolean(opts.ready),
        includeStories: Boolean(opts.includeStories),
      });
      if (!result.suggestion) {
        // Default pool excludes stories; distinguish "only stories remain"
        // from a fully empty pool so the message points at the right flag.
        const onlyStories =
          !opts.includeStories &&
          runNext({ cwd: process.cwd(), includeStories: true }).suggestion !== null;
        console.log(
          opts.ready
            ? "arggon next: ready pool is empty — nothing unblocked to claim."
            : onlyStories
              ? "arggon next: no unclaimed leaf work remains — only stories are left (plan explicitly, or retry with --include-stories)."
              : "arggon next: todo pool is empty — nothing claimable.",
        );
        console.log('  Create work with `arggon create task "<title>" --parent <story-id>`.');
        return;
      }
      const item = result.suggestion.item;
      console.log(
        `arggon next: ${sanitizeHumanError(item.id)} — ${sanitizeHumanError(item.title ?? item.id)}`,
      );
      console.log(
        `  type: ${item.type} · parent: ${sanitizeHumanError(result.suggestion.parentChainDisplay.join(" > ")) || "(none)"}`,
      );
      console.log(`  why: ${sanitizeHumanError(result.suggestion.reason)}`);
      console.log(`  next: arggon start ${sanitizeHumanError(item.id)} --assignee <login>`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "next",
          message,
          code: "NEXT_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon next", message);
      process.exitCode = 1;
    }
  });

program
  .command("show")
  .description(
    "Read one item with bounded output (ADR 0006): frontmatter + last comments; full body is an explicit opt-in",
  )
  .argument("<id>", "work item id")
  .option("--meta", "frontmatter only — no body, no comments", false)
  .option("--body", "full body including ALL comments (unbounded; explicit opt-in)", false)
  .option(
    "--tail-comments <n>",
    `compact view: include the last N comments instead of the default ${DEFAULT_TAIL_COMMENTS}`,
    Number.parseInt,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      opts: { meta?: boolean; body?: boolean; tailComments?: number; json?: boolean },
    ) => {
      const json = jsonEnabled(opts);
      try {
        if (
          opts.tailComments !== undefined &&
          (!Number.isInteger(opts.tailComments) || opts.tailComments < 0)
        ) {
          throw new Error(
            `--tail-comments must be a non-negative integer (got '${opts.tailComments}')`,
          );
        }
        if (json) {
          const outcome = showOperation({
            cwd: process.cwd(),
            id,
            meta: opts.meta,
            body: opts.body,
            tailComments: opts.tailComments,
          });
          emitJson(outcome.envelope);
          if (!outcome.ok) process.exitCode = 1;
          return;
        }
        const result = runShow({
          cwd: process.cwd(),
          id,
          meta: opts.meta,
          body: opts.body,
          tailComments: opts.tailComments,
        });
        console.log(renderShowText(result).join("\n"));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "show",
            message,
            code: "SHOW_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon show", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("report")
  .description("Aggregate leaf statuses per container, grouped by epic (display only)")
  .option(
    "--format <format>",
    "output format: table (default) or markdown (standup summary)",
    "table",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .option("--trend", "mine git history: weekly completions and cycle time (pure read)", false)
  .option("--since <date>", "trend window start, YYYY-MM-DD (requires --trend)")
  .action((opts: { format?: string; json?: boolean; trend?: boolean; since?: string }) => {
    const json = jsonEnabled(opts);
    const format = opts.format ?? "table";
    if (format !== "table" && format !== "markdown") {
      const message = `unknown --format '${format}' (supported: table, markdown)`;
      if (json) {
        failJson({
          command: "report",
          message,
          code: "REPORT_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon report", message);
      process.exitCode = 1;
      return;
    }
    if (opts.since !== undefined && !opts.trend) {
      const message = "--since requires --trend";
      if (json) {
        failJson({
          command: "report",
          message,
          code: "REPORT_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon report", message);
      process.exitCode = 1;
      return;
    }
    if (json) {
      const outcome = reportOperation({
        cwd: process.cwd(),
        trend: opts.trend,
        since: opts.since,
      });
      emitJson(outcome.envelope);
      if (!outcome.ok) process.exitCode = 1;
      return;
    }
    const fail = (message: string): void => {
      printHumanError("arggon report", message);
      process.exitCode = 1;
    };
    let trend: TrendResult | null = null;
    if (opts.trend) {
      try {
        trend = runTrend({ cwd: process.cwd(), since: opts.since });
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    try {
      const result = runReport({ cwd: process.cwd() });
      if (format === "markdown") {
        const md = trend
          ? `${formatReportMarkdown(result)}${formatTrendMarkdown(trend)}`
          : formatReportMarkdown(result);
        process.stdout.write(md);
        return;
      }
      process.stdout.write(formatReportTable(result.groups));
      if (trend) process.stdout.write(formatTrendTable(trend));
    } catch (err) {
      printHumanError("arggon report", err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  });

program
  .command("update")
  .description("Update frontmatter fields of a work item")
  .argument("<id>", "work item id")
  .option("--title <title>", "new title (non-empty)")
  .option("--status <status>", "new status (must follow v0 transitions)")
  .option("--assignee <login>", "new assignee (claimable types need one when in_progress)")
  .option("--branch <name>", "set working branch (empty string clears; unclaim clears by default)")
  .option(
    "--parent <id>",
    "reparent the item: rewrite parent and move the file/directory per the layout rules (leaves move as a file; containers move their whole directory)",
  )
  .option(
    "--type <type>",
    "convert the item's type in place; v1 supports only 'story' (promote a task: moves the file to the story layout under the grandparent epic, renames task-x to story-x, rewrites depends_on references, keeps issue/labels/body; refuses bugs, stories, and missing epics)",
  )
  .option("--unassign", "clear assignee (in_progress -> todo does this by default)", false)
  .option("--labels <csv>", "replace the full labels list (comma-separated)")
  .option(
    "--priority <p>",
    "set the priority field (convention v4): p0 | p1 | p2 | p3 (empty string clears it)",
  )
  .option(
    "--depends-on <csv>",
    "replace the full depends_on list of item ids (comma-separated; empty clears)",
  )
  .option("--add-depends-on <id>", "append one depends_on id (no-op when already present)")
  .option(
    "--issue <n>",
    "set the GitHub issue number in the additive issue frontmatter field (positive integer; 0 clears it)",
  )
  .option("--blocked-reason <text>", "required when status becomes blocked")
  .option("--force", "allow reassignment of an already-claimed item", false)
  .option(
    "--steal",
    "human-only supervised takeover of a claimed item (requires --reason and --assignee; agents are refused)",
    false,
  )
  .option("--reason <text>", "non-empty rationale for --steal, recorded in the item body")
  .option(
    "--no-cascade",
    "skip automatic container completion when this update closes the last open descendant",
  )
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the mutated item files, cascade included (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option(
    "--full",
    "emit complete WorkItem shapes (default: compact per ADR 0006 — null/empty optional fields omitted)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      opts: {
        full?: boolean;
        title?: string;
        status?: string;
        assignee?: string;
        branch?: string;
        parent?: string;
        type?: string;
        unassign?: boolean;
        labels?: string;
        priority?: string;
        dependsOn?: string;
        addDependsOn?: string;
        issue?: string;
        blockedReason?: string;
        force?: boolean;
        steal?: boolean;
        reason?: string;
        cascade?: boolean;
        commit?: boolean;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      const main = async (): Promise<void> => {
        try {
          // Claim-steal gate (bug-cli-steal-not-gated): human-only, enforced at
          // the CLI entry point BEFORE the kernel — repo opt-in via
          // x-tracker.allow-steal, then an interactive TTY confirmation.
          // runUpdate keeps its kernel steal semantics (agents refused via the
          // rules layer, shared with MCP).
          if (opts.steal) {
            await gateSteal({ cwd: process.cwd(), id });
          }
          // Reopen gate (bug-reopen-ungated-cli): done/cancelled -> todo is a
          // legal transition (humans reopen legitimately), but the playbook
          // forbids agents from reopening and the CLI has no caller identity —
          // so, like the steal gate, it requires an interactive terminal with a
          // y/N confirmation. Never config-armed; the kernel (rules.ts) keeps
          // refusing agents via the MCP path unchanged.
          if (opts.status === "todo") {
            const current = findItemStatus(process.cwd(), id);
            if (current === "done" || current === "cancelled") {
              await gateReopen({ id, from: current, to: "todo" });
            }
          }
          if (json) {
            const outcome = updateOperation({
              cwd: process.cwd(),
              id,
              title: opts.title,
              status: opts.status,
              assignee: opts.assignee,
              branch: opts.branch,
              parent: opts.parent,
              type: opts.type,
              unassign: opts.unassign,
              labels: opts.labels,
              priority: opts.priority,
              dependsOn: opts.dependsOn,
              addDependsOn: opts.addDependsOn,
              issue: opts.issue !== undefined ? Number(opts.issue) : undefined,
              blockedReason: opts.blockedReason,
              force: Boolean(opts.force),
              steal: Boolean(opts.steal),
              reason: opts.reason,
              cascade: opts.cascade !== false,
              full: opts.full === true,
              commit: opts.commit,
            });
            emitJson(outcome.envelope);
            if (!outcome.ok) process.exitCode = 1;
            return;
          }
          const result = runUpdate({
            cwd: process.cwd(),
            id,
            title: opts.title,
            status: opts.status,
            assignee: opts.assignee,
            branch: opts.branch,
            parent: opts.parent,
            type: opts.type,
            unassign: opts.unassign,
            labels: opts.labels,
            priority: opts.priority,
            dependsOn: opts.dependsOn,
            addDependsOn: opts.addDependsOn,
            issue: opts.issue !== undefined ? Number(opts.issue) : undefined,
            blockedReason: opts.blockedReason,
            force: Boolean(opts.force),
            steal: Boolean(opts.steal),
            reason: opts.reason,
            cascade: opts.cascade !== false,
          });
          // Tracker hygiene (task-autocommit-update-import): auto-commit ALL
          // item files written this run (the updated item + cascade-completed
          // ancestors) AFTER the mutation — a refused update (reopen/steal
          // gates above) never commits. Only a run that actually changed
          // fields commits; a no-op write (nothing requested changed) keeps
          // the previous no-commit behavior.
          const commit = maybeCommitUpdate(result, opts.commit);
          const what = result.changed.length > 0 ? ` (${result.changed.join(", ")})` : "";
          console.log(`arggon update: ${result.item.type} ${sanitizeHumanError(result.id)}${what}`);
          console.log(`  ${sanitizeHumanError(result.path)}`);
          if (result.movedFrom)
            console.log(`  moved from: ${sanitizeHumanError(result.movedFrom)}`);
          if (result.renamedFrom)
            console.log(`  renamed from id: ${sanitizeHumanError(result.renamedFrom)}`);
          for (const skipped of result.cascadeSkipped) {
            const why =
              skipped.reason === "subtree-open"
                ? `subtree still open${"sibling" in skipped && skipped.sibling ? ` (sibling '${sanitizeHumanError(skipped.sibling)}')` : ""}`
                : skipped.reason === "lock-timeout"
                  ? "another arggon process holds its lock (re-run any terminal update to retrigger the cascade)"
                  : "acceptance checklist incomplete";
            console.log(
              `  cascade skipped: ${skipped.type} '${sanitizeHumanError(skipped.id)}' — ${why}`,
            );
          }
          if (result.autoCompleted.length > 0) {
            console.log(`  auto-completed: ${sanitizeHumanError(result.autoCompleted.join(", "))}`);
            const high = result.autoCompleted
              .map((cid, index) => ({ id: cid, level: result.cascadeLevels[index] }))
              .filter((c) => c.level === "epic" || c.level === "initiative");
            if (high.length > 0) {
              const more = high.length - 1;
              const suffix = more > 0 ? ` (and ${more} more ancestor${more === 1 ? "" : "s"})` : "";
              console.log(
                `⚠ cascade: auto-completed ${high[0].level} '${sanitizeHumanError(high[0].id)}'${suffix}` +
                  ` — use --no-cascade to keep containers open`,
              );
            }
          }
          const commitLine = formatCommitLine(commit);
          if (commitLine) console.log(`  ${commitLine}`);
          if (result.issueRoundtrip) {
            const rt = result.issueRoundtrip;
            if (rt.closed) {
              console.log(
                `  issue round-trip: closed #${rt.issue} in ${sanitizeHumanError(rt.repo)}`,
              );
            } else {
              console.log(`  issue round-trip skipped: ${sanitizeHumanError(rt.skipped)}`);
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (json) {
            failJson({
              command: "update",
              message,
              code: "UPDATE_FAILED",
              conventionVersion: readConventionVersion(process.cwd()),
            });
            return;
          }
          printHumanError("arggon update", message);
          process.exitCode = 1;
        }
      };
      void main();
    },
  );

const priority = program
  .command("priority")
  .description("Priority field tools (convention v4, spec-priority-field-008)");

priority
  .command("migrate")
  .description(
    "Move legacy pN labels into the priority field on all items (highest label wins, all pN labels removed, non-priority labels kept; idempotent; never auto-commits — review and commit once)",
  )
  .option("--dry-run", "plan only: print the per-item changes and write NOTHING", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { dryRun?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      if (json) {
        const outcome = priorityOperation({ cwd: process.cwd(), dryRun: Boolean(opts.dryRun) });
        emitJson(outcome.envelope);
        if (!outcome.ok) process.exitCode = 1;
        return;
      }
      const result = runPriorityMigrate({ cwd: process.cwd(), dryRun: Boolean(opts.dryRun) });
      console.log(
        `arggon priority migrate${result.dryRun ? " (dry run)" : ""}: scanned ${result.scanned} item(s), ${result.changed} change(s)`,
      );
      for (const entry of result.entries) {
        const source =
          entry.prioritySource === "label"
            ? "from label"
            : `kept explicit${entry.conflictLabel ? `; label said ${sanitizeHumanError(entry.conflictLabel)}` : ""}`;
        console.log(
          `  ${sanitizeHumanError(entry.id)}: priority ${entry.priority} (${source}); removed labels: ${sanitizeHumanError(entry.labelsRemoved.join(", "))}`,
        );
      }
      if (result.dryRun) {
        console.log("nothing was written (dry run)");
      } else if (result.changed > 0) {
        console.log(
          "migrate never auto-commits — review the tracker diff (`git diff`) and commit the migration as one change.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "priority",
          message,
          code: "PRIORITY_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon priority migrate", message);
      process.exitCode = 1;
    }
  });

program
  .command("migrate")
  .description(
    "Move a legacy tasks/ tracker (and its product docs) to the ArggonManager/ layout (ADR 0012, convention v5; idempotent, never auto-commits)",
  )
  .option(
    "--layout",
    "migrate the tracker layout: tasks/ → ArggonManager/, docs/ → ArggonManager/docs/ (required)",
    false,
  )
  .option("--dry-run", "plan only: print the actions and write NOTHING", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { layout?: boolean; dryRun?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      if (!opts.layout) {
        throw new Error(
          "arggon migrate requires a migration target — pass --layout (the only supported target today)",
        );
      }
      const result = runLayoutMigrate({ cwd: process.cwd(), dryRun: Boolean(opts.dryRun) });
      if (json) {
        successJson(
          "migrate",
          {
            dryRun: result.dryRun,
            alreadyMigrated: result.alreadyMigrated,
            trackerMove: result.trackerMove,
            docsMove: result.docsMove,
            versionBump: result.versionBump,
            rewrittenGeneratedPaths: result.rewrittenGeneratedPaths,
            changed: result.changed,
            trackerDir: result.trackerDir,
            docsDir: result.docsDir,
          },
          readConventionVersion(result.root),
        );
        return;
      }
      console.log(formatLayoutMigrateHuman(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "migrate",
          message,
          code: "MIGRATE_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon migrate --layout", message);
      process.exitCode = 1;
    }
  });

program
  .command("comment")
  .description("Append a timestamped, author-attributed comment section to an item's body")
  .argument("<id>", "work item id")
  .argument("[text]", "comment text (multiline supported); omit when --file is given")
  .option(
    "--file <path>",
    "read the comment text from a file (`-` = stdin); verbatim UTF-8, outside the shell — backticks/quotes/$ land unmangled",
  )
  .option(
    "--author <login>",
    "comment author (default: @me resolution — GITHUB_USER, then GITHUB_ACTOR, then `gh api user`)",
  )
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the commented item (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      text: string | undefined,
      opts: { file?: string; author?: string; commit?: boolean; json?: boolean },
    ) => {
      const json = jsonEnabled(opts);
      try {
        if (opts.file === "-" && process.stdin.isTTY) {
          throw new Error(
            "--file -: stdin is a terminal (pipe the comment text in, or pass a --file <path>)",
          );
        }
        if (json) {
          const outcome = commentOperation({
            cwd: process.cwd(),
            id,
            text: text ?? "",
            file: opts.file,
            author: opts.author,
            commit: opts.commit === false ? false : undefined,
          });
          emitJson(outcome.envelope);
          if (!outcome.ok) process.exitCode = 1;
          return;
        }
        const result = runComment({
          cwd: process.cwd(),
          id,
          text: text ?? "",
          file: opts.file,
          author: opts.author,
          commit: opts.commit === false ? false : undefined,
        });
        console.log(
          `arggon comment: ${sanitizeHumanError(result.id)} (${result.comment.date} @${sanitizeHumanError(result.comment.author)})`,
        );
        console.log(`  ${sanitizeHumanError(result.path)}`);
        const commitLine = formatCommitLine(result.commit);
        if (commitLine) console.log(`  ${commitLine}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "comment",
            message,
            code: "COMMENT_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon comment", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("handoff")
  .description(
    "Append a structured, bounded handoff section (branch, next step, open questions) to an item's body",
  )
  .argument("<id>", "work item id")
  .option("--next <text>", "the first thing the resuming agent should do (required)")
  .option(
    "--branch <name>",
    "working branch (default: auto-detected from git; 'unknown' outside git)",
  )
  .option("--open-questions <text>", "open questions, semicolon-separated by convention (optional)")
  .option(
    "--session <id>",
    "session identifier for provenance, rendered in the heading (optional; capped at 64 chars)",
  )
  .option(
    "--author <login>",
    "handoff author (default: @me resolution — GITHUB_USER, then GITHUB_ACTOR, then `gh api user`)",
  )
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the item (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      opts: {
        next?: string;
        branch?: string;
        openQuestions?: string;
        session?: string;
        author?: string;
        commit?: boolean;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      try {
        // Validated here (not commander .requiredOption) so the failure still
        // emits the JSON envelope under --json (COMMENT_FAILED) instead of
        // commander's pre-action stderr abort.
        if (!opts.next?.trim()) {
          throw new Error(
            'handoff requires --next "<next step>" (the first thing the resuming agent should do)',
          );
        }
        if (json) {
          const outcome = handoffOperation({
            cwd: process.cwd(),
            id,
            next: opts.next,
            branch: opts.branch,
            openQuestions: opts.openQuestions,
            session: opts.session,
            author: opts.author,
            commit: opts.commit === false ? false : undefined,
          });
          emitJson(outcome.envelope);
          if (!outcome.ok) process.exitCode = 1;
          return;
        }
        const result = runHandoff({
          cwd: process.cwd(),
          id,
          next: opts.next,
          branch: opts.branch,
          openQuestions: opts.openQuestions,
          session: opts.session,
          author: opts.author,
          commit: opts.commit === false ? false : undefined,
        });
        console.log(
          `arggon handoff: ${sanitizeHumanError(result.id)} (${result.comment.date} @${sanitizeHumanError(result.comment.author)} — next: ${sanitizeHumanError(result.handoff.next)})`,
        );
        console.log(`  ${sanitizeHumanError(result.path)}`);
        const commitLine = formatCommitLine(result.commit);
        if (commitLine) console.log(`  ${commitLine}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          // COMMENT_FAILED by design: the handoff kernel IS the comment kernel
          // (same body-append path, same failure modes).
          failJson({
            command: "handoff",
            message,
            code: "COMMENT_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon handoff", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("import-issues")
  .description(
    "One-shot import of GitHub issues into the tracker as task/bug items (idempotent; x-import maps labels to types)",
  )
  .option("--repo <owner/repo>", "GitHub repository (default: gh's own resolution from cwd)")
  .option(
    "--parent <story-id>",
    "target story for imported tasks (default: story-imported-issues, created under the first epic when missing)",
  )
  .option("--dry-run", "print the mapping plan (would-create / would-skip) without writing", false)
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the imported items (default: on; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      repo?: string;
      parent?: string;
      dryRun?: boolean;
      commit?: boolean;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      try {
        if (json) {
          const outcome = importIssuesOperation({
            cwd: process.cwd(),
            repo: opts.repo,
            parent: opts.parent,
            dryRun: Boolean(opts.dryRun),
            commit: opts.commit === false ? false : undefined,
            templatesDir: bundledTemplatesDir(),
          });
          emitJson(outcome.envelope);
          if (!outcome.ok) process.exitCode = 1;
          return;
        }
        const result = runImportIssues({
          cwd: process.cwd(),
          repo: opts.repo,
          parent: opts.parent,
          dryRun: Boolean(opts.dryRun),
          commit: opts.commit === false ? false : undefined,
          templatesDir: bundledTemplatesDir(),
        });
        console.log(
          `arggon import-issues${result.dryRun ? " (dry run)" : ""}: ${result.entries.length} issue(s), ${result.created} created, ${result.skipped} skipped`,
        );
        console.log(
          `  target story: ${sanitizeHumanError(result.story.id)}${result.story.created ? " (created)" : result.dryRun ? " (would create when missing)" : ""}`,
        );
        for (const entry of result.entries) {
          console.log(
            `  ${entry.action.padEnd(13)} ${sanitizeHumanError(entry.id)}  ${sanitizeHumanError(entry.title)} [${entry.status}]`,
          );
        }
        console.log(
          `  labels: ${result.labelsMapped} mapped, ${result.labelsSkipped} skipped (invalid)`,
        );
        const commitLine = formatCommitLine(result.commit);
        if (commitLine) console.log(`  ${commitLine}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "import-issues",
            message,
            code: "IMPORT_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon import-issues", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("validate")
  .description("Validate tracker frontmatter and tree integrity")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      if (json) {
        const outcome = validateOperation({ cwd: process.cwd() });
        emitJson(outcome.envelope);
        process.exitCode = outcome.exitCode;
        return;
      }
      const result = runValidate({ cwd: process.cwd() });
      process.stdout.write(formatValidateHuman(result));
      if (result.errors.length > 0) process.exitCode = 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "validate",
          message,
          code: "VALIDATE_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon validate", message);
      process.exitCode = 1;
    }
  });

const spec = program
  .command("spec")
  .description(
    "Validate and scaffold feature specs and plans (ArggonManager/docs/specs, ArggonManager/docs/plans; legacy: docs/)",
  );

spec
  .command("validate")
  .description("Validate spec/plan frontmatter and section structure (pure read)")
  .option(
    "--file <path>",
    "validate a single file (also outside the product-docs specs/plans dirs)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { file?: string; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runSpecValidate({ cwd: process.cwd(), file: opts.file });
      if (json) {
        const payload = {
          ok: result.errors.length === 0,
          schemaVersion: JSON_SCHEMA_VERSION,
          conventionVersion: result.conventionVersion,
          command: "spec",
          errors: result.errors,
          warnings: result.warnings,
        };
        if (result.errors.length > 0) {
          emitJson({
            ...payload,
            error: {
              message: `spec validate failed with ${result.errors.length} error(s)`,
              code: "SPEC_FAILED",
            },
          });
          process.exitCode = 1;
          return;
        }
        emitJson(payload);
        return;
      }
      process.stdout.write(formatSpecValidateHuman(result));
      if (result.errors.length > 0) process.exitCode = 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "spec",
          message,
          code: "SPEC_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon spec", message);
      process.exitCode = 1;
    }
  });

spec
  .command("analyze")
  .description(
    "Checklist-driven ambiguity scan + spec/task consistency report (report-only, never edits; exit 0 with findings)",
  )
  .option("--spec <path>", "scan a single spec file (also outside the product-docs specs dir)")
  .option(
    "--save-baseline <file>",
    "write the findings snapshot to <file> (deterministic, committable JSON), then report as usual",
  )
  .option(
    "--baseline <file>",
    "compare against a saved snapshot; report only new/resolved findings",
  )
  .option(
    "--no-fail-on-new",
    "with --baseline: report-only — do not exit 1 when new findings exist",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      spec?: string;
      saveBaseline?: string;
      baseline?: string;
      failOnNew?: boolean;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      try {
        if (opts.saveBaseline && opts.baseline) {
          throw new Error(
            "--baseline and --save-baseline are mutually exclusive — a run either compares against a snapshot or writes one",
          );
        }
        if (opts.saveBaseline) {
          const saved = runSpecAnalyzeSaveBaseline({
            cwd: process.cwd(),
            spec: opts.spec,
            file: opts.saveBaseline,
          });
          if (json) {
            emitJson({
              ok: true,
              schemaVersion: JSON_SCHEMA_VERSION,
              conventionVersion: saved.result.conventionVersion,
              command: "spec",
              scanned: saved.result.scanned,
              findings: {
                ambiguity: saved.result.ambiguity,
                consistency: saved.result.consistency,
              },
              baseline: { file: saved.file, written: true, count: saved.snapshot.count },
            });
            return;
          }
          process.stdout.write(formatSpecBaselineSaveHuman(saved));
          return;
        }
        if (opts.baseline) {
          const cmp = runSpecAnalyzeCompareBaseline({
            cwd: process.cwd(),
            spec: opts.spec,
            file: opts.baseline,
          });
          const failed = cmp.added.length > 0;
          if (json) {
            // The gate rides on the exit code: a failing gate still emits a
            // success envelope (ok: true) with the additive baseline payload.
            emitJson({
              ok: true,
              schemaVersion: JSON_SCHEMA_VERSION,
              conventionVersion: cmp.result.conventionVersion,
              command: "spec",
              scanned: cmp.result.scanned,
              findings: { ambiguity: cmp.result.ambiguity, consistency: cmp.result.consistency },
              baseline: {
                file: cmp.file,
                total: cmp.total,
                unchanged: cmp.unchanged.length,
                added: cmp.added,
                resolved: cmp.resolved,
                failed,
              },
            });
            if (failed && opts.failOnNew !== false) process.exitCode = 1;
            return;
          }
          process.stdout.write(formatSpecBaselineCompareHuman(cmp));
          if (failed && opts.failOnNew !== false) process.exitCode = 1;
          return;
        }
        const result = runSpecAnalyze({ cwd: process.cwd(), spec: opts.spec });
        if (json) {
          emitJson({
            ok: true,
            schemaVersion: JSON_SCHEMA_VERSION,
            conventionVersion: result.conventionVersion,
            command: "spec",
            scanned: result.scanned,
            findings: { ambiguity: result.ambiguity, consistency: result.consistency },
          });
          return;
        }
        process.stdout.write(formatSpecAnalyzeHuman(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "spec",
            message,
            code: "SPEC_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon spec analyze", message);
        process.exitCode = 1;
      }
    },
  );

spec
  .command("audit")
  .description(
    "Pairwise duplication detection over the product-docs specs/*.md (Jaccard + shared titles) — report only, never edits",
  )
  .option(
    "--duplicate-threshold <n>",
    `similarity at/above this classifies a pair DUPLICATE (default ${SPEC_AUDIT_DEFAULTS.duplicateThreshold})`,
    Number.parseFloat,
  )
  .option(
    "--merge-threshold <n>",
    `similarity at/above this classifies a pair MERGE (default ${SPEC_AUDIT_DEFAULTS.mergeThreshold})`,
    Number.parseFloat,
  )
  .option(
    "--min-shared-titles <n>",
    `shared titles at/above this (with similarity >= --shared-title-floor) classify MERGE (default ${SPEC_AUDIT_DEFAULTS.minSharedTitles})`,
    Number.parseInt,
  )
  .option(
    "--shared-title-floor <n>",
    `minimum similarity for the shared-titles MERGE path (default ${SPEC_AUDIT_DEFAULTS.sharedTitleFloor})`,
    Number.parseFloat,
  )
  .option(
    "--report-floor <n>",
    `pairs below this similarity and with no shared titles are only counted (default ${SPEC_AUDIT_DEFAULTS.reportFloor})`,
    Number.parseFloat,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      duplicateThreshold?: number;
      mergeThreshold?: number;
      minSharedTitles?: number;
      sharedTitleFloor?: number;
      reportFloor?: number;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      try {
        const result = runSpecAudit({
          cwd: process.cwd(),
          thresholds: {
            duplicateThreshold: opts.duplicateThreshold,
            mergeThreshold: opts.mergeThreshold,
            minSharedTitles: opts.minSharedTitles,
            sharedTitleFloor: opts.sharedTitleFloor,
            reportFloor: opts.reportFloor,
          },
        });
        if (json) {
          emitJson({
            ok: true,
            schemaVersion: JSON_SCHEMA_VERSION,
            conventionVersion: readConventionVersion(result.root),
            command: "spec",
            specs: result.specs,
            pairs: result.pairs,
            thresholds: result.thresholds,
            findings: result.findings,
            counts: result.counts,
          });
          return;
        }
        process.stdout.write(formatSpecAuditHuman(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "spec",
            message,
            code: "SPEC_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon spec audit", message);
        process.exitCode = 1;
      }
    },
  );

spec
  .command("new")
  .description(
    "Scaffold ArggonManager/docs/specs/spec-<slug>-NNN.md (and ArggonManager/docs/plans/plan-<slug>-NNN.md with --plan); never overwrites",
  )
  .argument("<slug>", "kebab-case slug (^[a-z0-9]+(-[a-z0-9]+)*$)")
  .option("--title <title>", "spec title (defaults to the slug, hyphens as spaces)")
  .option("--plan", "also scaffold the matching implementation plan", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((slug: string, opts: { title?: string; plan?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runSpecNew({
        cwd: process.cwd(),
        slug,
        title: opts.title,
        plan: Boolean(opts.plan),
      });
      if (json) {
        successJson("spec", { files: result.files }, readConventionVersion(result.root));
        return;
      }
      console.log(`arggon spec new: created ${result.files.length} file(s)`);
      for (const file of result.files) {
        console.log(`  ${sanitizeHumanError(file)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "spec",
          message,
          code: "SPEC_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon spec new", message);
      process.exitCode = 1;
    }
  });

spec
  .command("import")
  .description(
    "Migrate a foreign spec corpus into Arggon spec docs with a per-file zero-loss assertion; all-or-nothing per run, never overwrites (formats: openspec)",
  )
  .argument("<format>", "corpus format (currently: openspec)")
  .argument("<path>", "corpus root (openspec: contains specs/<capability>/spec.md)")
  .option(
    "--dry-run",
    "inventory only: discover files and preview the mapping without writing",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((format: string, path: string, opts: { dryRun?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    const unsupported = () =>
      `unsupported corpus format '${format}' (supported: openspec) — add an adapter in cli/src/spec-import.ts`;
    if (format !== "openspec") {
      if (json) {
        emitJson(
          failEnvelope({
            command: "spec",
            message: unsupported(),
            code: "SPEC_IMPORT_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          }),
        );
        process.exitCode = 1;
        return;
      }
      console.error(sanitizeHumanError(`arggon spec import ${format}: ${unsupported()}`));
      process.exitCode = 1;
      return;
    }
    try {
      const result = runSpecImport({ cwd: process.cwd(), path, dryRun: Boolean(opts.dryRun) });
      if (json) {
        if (result.dryRun) {
          emitJson(successEnvelope("spec", { dryRun: true, inventory: result.inventory }));
          return;
        }
        successJson("spec", { created: result.created }, readConventionVersion(result.root));
        return;
      }
      if (result.dryRun) {
        console.log("arggon spec import openspec: dry run (nothing written)");
        for (const entry of result.inventory) {
          console.log(
            `  ${sanitizeHumanError(entry.file)} <- ${sanitizeHumanError(entry.source)} (${sanitizeHumanError(entry.specId)})`,
          );
        }
        return;
      }
      console.log(`arggon spec import openspec: created ${result.created.length} file(s)`);
      for (const entry of result.created) {
        console.log(
          `  ${sanitizeHumanError(entry.file)} <- ${sanitizeHumanError(entry.source)} (${sanitizeHumanError(entry.specId)})`,
        );
      }
    } catch (err) {
      const failures = err instanceof SpecImportError ? err.failures : undefined;
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        emitJson({
          ...failEnvelope({
            command: "spec",
            message,
            code: "SPEC_IMPORT_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          }),
          ...(failures ? { failures } : {}),
        });
        process.exitCode = 1;
        return;
      }
      printHumanError("arggon spec import openspec", message);
      process.exitCode = 1;
    }
  });

const stack = program
  .command("stack")
  .description(
    "Exploration records preceding stack decisions (product docs: ArggonManager/docs/explorations)",
  );

stack
  .command("explore")
  .description(
    "Scaffold ArggonManager/docs/explorations/exploration-<slug>-NNN.md (candidates, criteria, findings, recommendation); never overwrites",
  )
  .argument("<topic>", "topic to explore (slugified for the filename)")
  .option("--title <title>", "exploration title (defaults to the topic as given)")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((topic: string, opts: { title?: string; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runStackExplore({
        cwd: process.cwd(),
        topic,
        title: opts.title,
      });
      if (json) {
        successJson("explore", { files: result.files }, readConventionVersion(result.root));
        return;
      }
      console.log(`arggon stack explore: created ${result.files.length} file(s)`);
      for (const file of result.files) {
        console.log(`  ${sanitizeHumanError(file)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "explore",
          message,
          code: "EXPLORE_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon stack explore", message);
      process.exitCode = 1;
    }
  });

const playbook = program
  .command("playbook")
  .description(
    "Per-tech playbooks with version-freshness tracking (product docs: ArggonManager/docs/playbooks)",
  );

playbook
  .command("new")
  .description(
    "Scaffold ArggonManager/docs/playbooks/<tech>.md pinning the chosen version; never overwrites (research is the caller's job)",
  )
  .argument("<tech>", "technology slug (kebab-case)")
  .option("--version <version>", "chosen version to pin (default: unpinned)")
  .option("--title <title>", "playbook title (defaults to the tech slug, hyphens as spaces)")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((tech: string, opts: { version?: string; title?: string; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runPlaybookNew({
        cwd: process.cwd(),
        tech,
        version: opts.version,
        title: opts.title,
      });
      if (json) {
        successJson("playbook", { files: result.files }, readConventionVersion(result.root));
        return;
      }
      console.log(`arggon playbook new: created ${result.files.length} file(s)`);
      for (const file of result.files) {
        console.log(`  ${sanitizeHumanError(file)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "playbook",
          message,
          code: "PLAYBOOK_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon playbook new", message);
      process.exitCode = 1;
    }
  });

playbook
  .command("status")
  .description(
    "Report playbook freshness: age since `researched` vs the stale threshold (default 90, x-playbooks.max-age-days)",
  )
  .option("--max-age-days <days>", "stale threshold override in days (wins over x-playbooks)")
  .option(
    "--file-task <story-id>",
    "file one re-research task per stale playbook into the tracker (errors when the story does not exist)",
  )
  .option(
    "--now <iso-date>",
    "determinism hook: evaluate ages as of this date instead of now (test/determinism hook)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { maxAgeDays?: string; fileTask?: string; now?: string; json?: boolean }) => {
    const json = jsonEnabled(opts);
    let maxAgeDays: number | undefined;
    if (opts.maxAgeDays !== undefined) {
      const parsed = Number.parseInt(opts.maxAgeDays, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        const message = `invalid --max-age-days '${opts.maxAgeDays}' (expected a positive integer)`;
        if (json) {
          failJson({
            command: "playbook",
            message,
            code: "PLAYBOOK_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon playbook status", message);
        process.exitCode = 1;
        return;
      }
      maxAgeDays = parsed;
    }
    let now: Date | undefined;
    if (opts.now !== undefined) {
      now = new Date(opts.now);
      if (Number.isNaN(now.getTime())) {
        const message = `invalid --now '${opts.now}' (expected a parseable date)`;
        if (json) {
          failJson({
            command: "playbook",
            message,
            code: "PLAYBOOK_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon playbook status", message);
        process.exitCode = 1;
        return;
      }
    }
    try {
      const result = runPlaybookStatus({
        cwd: process.cwd(),
        maxAgeDays,
        fileTask: opts.fileTask,
        now,
      });
      if (json) {
        successJson(
          "playbook",
          {
            playbooks: result.playbooks,
            staleCount: result.staleCount,
            maxAgeDays: result.maxAgeDays,
            created: result.created,
            skipped: result.skipped,
          },
          result.conventionVersion,
        );
        return;
      }
      process.stdout.write(formatPlaybookStatusTable(result));
      for (const id of result.created) {
        console.log(`filed:   ${sanitizeHumanError(id)}`);
      }
      for (const id of result.skipped) {
        console.log(`skipped: ${sanitizeHumanError(id)} (re-research task already exists)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "playbook",
          message,
          code: "PLAYBOOK_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon playbook status", message);
      process.exitCode = 1;
    }
  });

playbook
  .command("refresh")
  .description(
    "After re-research: set version + researched: today + status: current (frontmatter-only, body untouched)",
  )
  .argument("<tech>", "technology slug (kebab-case)")
  .option("--version <version>", "the re-researched version (required)", "")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((tech: string, opts: { version: string; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runPlaybookRefresh({
        cwd: process.cwd(),
        tech,
        version: opts.version,
      });
      if (json) {
        successJson(
          "playbook",
          { path: result.path, version: result.version, researched: result.researched },
          readConventionVersion(result.root),
        );
        return;
      }
      console.log(
        `arggon playbook refresh: ${sanitizeHumanError(result.path)} → version ${sanitizeHumanError(result.version)}, researched ${result.researched}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "playbook",
          message,
          code: "PLAYBOOK_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon playbook refresh", message);
      process.exitCode = 1;
    }
  });

program
  .command("branch")
  .description("Check out the working branch for an item (generated from branch_patterns)")
  .argument("<id>", "work item id")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((id: string, opts: { json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runBranch({ cwd: process.cwd(), id });
      if (json) {
        successJson(
          "branch",
          {
            item: toContractWorkItem(result.item, result.root),
            branch: result.branch,
            created: result.created,
          },
          readConventionVersion(result.root),
        );
        return;
      }
      console.log(
        `arggon branch: ${result.item.type} ${sanitizeHumanError(result.id)} → ${sanitizeHumanError(result.branch)} (${result.created ? "created" : "attached"})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "branch",
          message,
          code: "BRANCH_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon branch", message);
      process.exitCode = 1;
    }
  });

program
  .command("start")
  .description("Claim an item, check out its branch, commit, push, and optionally open a draft PR")
  .argument("<id>", "work item id")
  .option("--assignee <login>", "claim as this login (default: GITHUB_USER / GITHUB_ACTOR)")
  .option("--open-pr", "open a draft PR after pushing", false)
  .option(
    "--worktree",
    "run the flow inside a linked git worktree at ../<repo-name>-<id> (recorded on the item as worktree_path; the worktree is prepared before the claim commit and kept on failure)",
    false,
  )
  .option(
    "--no-hook",
    "skip the x-worktree.post-start hook (it only runs when a new worktree is created)",
  )
  .option(
    "--post-start-shell <shell>",
    'shell for the x-worktree.post-start hook: "inherit" (default) or "login" ($SHELL -lc; overrides x-worktree.post-start-shell)',
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      opts: {
        assignee?: string;
        openPr?: boolean;
        worktree?: boolean;
        hook?: boolean;
        postStartShell?: string;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      if (
        opts.postStartShell !== undefined &&
        opts.postStartShell !== "inherit" &&
        opts.postStartShell !== "login"
      ) {
        const message = `--post-start-shell must be "inherit" or "login" (got ${JSON.stringify(opts.postStartShell)})`;
        if (json) {
          failJson({
            command: "start",
            message,
            code: "START_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon start", message);
        process.exitCode = 1;
        return;
      }
      try {
        const result = runStart({
          cwd: process.cwd(),
          id,
          assignee: opts.assignee,
          openPr: Boolean(opts.openPr),
          worktree: Boolean(opts.worktree),
          noHook: opts.hook === false,
          postStartShell: opts.postStartShell as "inherit" | "login" | undefined,
        });
        if (json) {
          successJson(
            "start",
            {
              item: toContractWorkItem(result.item, result.root),
              branch: result.branch,
              created: result.created,
              pushed: result.pushed,
              prUrl: result.prUrl,
              worktreePath: result.worktreePath,
              linkedNodeModules: result.linkedNodeModules,
              linkedWorkspaces: result.linkedWorkspaces,
              postStart: result.postStart,
            },
            readConventionVersion(result.root),
          );
          return;
        }
        console.log(
          `arggon start: ${result.item.type} ${sanitizeHumanError(result.id)} → ${sanitizeHumanError(result.branch)}`,
        );
        if (result.worktreePath) {
          console.log(
            `  worktree: ${sanitizeHumanError(result.worktreePath)} (${result.worktreeCreated ? "created" : "attached"})`,
          );
          if (result.linkedNodeModules) {
            console.log(
              `  node_modules: linked from the primary checkout (the project gate can run in the worktree)`,
            );
          }
          if (result.linkedWorkspaces.length > 0) {
            console.log(
              `  note: ${result.linkedWorkspaces.map((name) => sanitizeHumanError(name)).join(", ")} ` +
                `resolve(s) into the primary checkout through the linked install — build there, or run ` +
                `\`npm ci\` in the worktree (e.g. \`x-worktree.post-start: npm ci\`) for worktree-local resolution`,
            );
          }
        }
        if (result.postStart) {
          if (result.postStart.ok) {
            console.log(`  post-start: ${sanitizeHumanError(result.postStart.command)}`);
          } else {
            console.log(`  ${sanitizeHumanError(result.postStart.error ?? "")}`);
          }
        }
        if (result.prUrl) {
          console.log(`  draft PR: ${sanitizeHumanError(result.prUrl)}`);
        } else if (result.pushed) {
          console.log(`  pushed (no PR; pass --open-pr)`);
        } else {
          console.log(`  already started; nothing to publish`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "start",
            message,
            code: "START_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon start", message);
        process.exitCode = 1;
      }
    },
  );

program
  .command("cleanup")
  .description(
    "List worktrees of done/cancelled items whose branches are merged (--prune removes them)",
  )
  .option(
    "--prune",
    "remove removable worktrees (git worktree remove), delete their merged branches, and clear the worktree_path records",
    false,
  )
  .option(
    "--no-commit",
    "keep the tracker dirty: skip the tracker auto-commit of the cleared worktree_path records (default: on with --prune; x-tracker.auto-commit: false opts out tree-wide)",
  )
  .option(
    "--no-gh",
    "ancestry-only classification: skip the gh fallback that detects squash-merged PRs when the branch fails the ancestry check (offline/CI use)",
    true,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { prune?: boolean; commit?: boolean; gh?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runCleanup({
        cwd: process.cwd(),
        prune: Boolean(opts.prune),
        commit: opts.commit === false ? false : undefined,
        // Commander names a `--no-gh` option `gh` (default true, false when
        // the flag is passed); reading `noGh` made the flag a silent no-op
        // (bug-cleanup-no-gh-ignored).
        noGh: opts.gh === false,
      });
      if (json) {
        // Per-candidate prune failures are reported in the payload (each
        // pruned entry may carry action "failed" + error/leftoverBranch);
        // CLEANUP_FAILED is reserved for top-level errors (non-git tree,
        // undetectable default branch).
        successJson(
          "cleanup",
          {
            base: result.base,
            candidates: result.entries,
            pruned: result.pruned,
            failures: result.failures,
            ...(result.commit ? { commit: commitPayload(result.commit) } : {}),
          },
          readConventionVersion(result.root),
        );
        return;
      }
      const removable = result.entries.filter((e) => e.removable);
      console.log(
        `arggon cleanup: ${result.entries.length} tracked worktree(s), base ${sanitizeHumanError(result.base)}`,
      );
      for (const entry of result.entries) {
        if (entry.removable) {
          console.log(
            `  removable: ${sanitizeHumanError(entry.id)} -> ${sanitizeHumanError(entry.path)} (${entry.action})`,
          );
        } else {
          console.log(
            `  skipped:   ${sanitizeHumanError(entry.id)} (${sanitizeHumanError(entry.reason ?? "")})`,
          );
        }
      }
      for (const action of result.pruned) {
        if (action.action === "failed") {
          const leftover = action.leftoverBranch
            ? ` (leftover branch: ${action.leftoverBranch})`
            : "";
          console.error(
            sanitizeHumanError(`  failed:    ${action.id}: ${action.error}${leftover}`),
          );
        } else {
          console.log(`  pruned:    ${sanitizeHumanError(action.id)}: ${action.action}`);
        }
      }
      const commitLine = formatCommitLine(result.commit);
      if (commitLine) console.log(`  ${commitLine}`);
      for (const failure of result.failures) {
        console.error(sanitizeHumanError(`  failed:    ${failure}`));
      }
      if (!opts.prune && removable.length > 0) {
        console.log(`next: arggon cleanup --prune removes ${removable.length} worktree(s)`);
      }
      if (result.failures.length > 0) process.exitCode = 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "cleanup",
          message,
          code: "CLEANUP_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon cleanup", message);
      process.exitCode = 1;
    }
  });

program
  .command("board")
  .description(
    "Write a static read-only HTML board from the tracker (git files stay the source of truth)",
  )
  .option(
    "--out <file>",
    "output HTML file (default: board.html at the repo root; relative --out resolves from cwd)",
  )
  .option("--github", "overlay live GitHub PR state on cards with a branch (read-only)", false)
  .option(
    "--group-by <field>",
    "group cards within each column by milestone (ADR 0003) or parent story (story)",
  )
  .option(
    "--serve",
    "serve the board locally (127.0.0.1) with live reload; edits go through the update path",
    false,
  )
  .option("--port <port>", "port for --serve (default: a free ephemeral port)")
  .option(
    "--tui",
    "interactive read-only terminal kanban (raw ANSI, q quits; not combinable with --json)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      out?: string;
      github?: boolean;
      groupBy?: string;
      serve?: boolean;
      port?: string;
      tui?: boolean;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      const jsonFailed = (message: string) => {
        if (json) {
          failJson({
            command: "board",
            message,
            code: "BOARD_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon board", message);
        process.exitCode = 1;
      };
      if (opts.tui) {
        if (opts.serve) {
          jsonFailed("cannot combine --tui with --serve (both are interactive modes)");
          return;
        }
        if (opts.groupBy !== undefined) {
          jsonFailed(
            "cannot combine --tui with --group-by (the TUI groups by status column only; use the HTML board for --group-by)",
          );
          return;
        }
        if (json) {
          jsonFailed(
            "--tui is an interactive view and cannot be combined with --json (use plain `arggon list --json` for data)",
          );
          return;
        }
        runTuiBoard({ cwd: process.cwd() }).catch((err: unknown) => {
          jsonFailed(err instanceof Error ? err.message : String(err));
        });
        return;
      }
      if (opts.serve) {
        if (opts.github) {
          jsonFailed(
            "cannot combine --serve with --github (the served board renders fresh per request)",
          );
          return;
        }
        let port: number | undefined;
        if (opts.port !== undefined) {
          port = Number.parseInt(opts.port, 10);
          if (!Number.isInteger(port) || port < 0 || port > 65535) {
            jsonFailed(`invalid --port '${opts.port}' (expected 0-65535)`);
            return;
          }
        }
        try {
          const handle = startBoardServer({ cwd: process.cwd(), port, groupBy: opts.groupBy });
          void handle.ready.then(() => {
            if (json) {
              successJson(
                "board",
                { serving: true, url: handle.url, port: handle.port },
                readConventionVersion(handle.root),
              );
              return;
            }
            console.log(
              `arggon board: serving ${sanitizeHumanError(displayPath(handle.root, process.cwd()))} on ${sanitizeHumanError(handle.url)} (binds 127.0.0.1 only, Ctrl-C to stop)`,
            );
          });
        } catch (err) {
          jsonFailed(err instanceof Error ? err.message : String(err));
        }
        return;
      }
      try {
        const result = runBoard({
          cwd: process.cwd(),
          out: opts.out,
          github: opts.github,
          groupBy: opts.groupBy,
        });
        if (json) {
          successJson(
            "board",
            {
              path: displayPath(result.outPath, process.cwd()),
              itemCount: result.itemCount,
              ...(result.groupBy ? { groupBy: result.groupBy } : {}),
              ...(opts.github ? { github: true, prCount: result.prCount } : {}),
            },
            readConventionVersion(result.root),
          );
          return;
        }
        console.log(
          `arggon board: wrote ${sanitizeHumanError(displayPath(result.outPath, process.cwd()))} (${result.itemCount} item(s)${result.groupBy ? `, grouped by ${result.groupBy}` : ""}${opts.github ? `, ${result.prCount} PR(s) linked` : ""})`,
        );
        console.log(
          "  Open it in a browser. Re-run after tree changes — the tracker remains the source of truth.",
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (json) {
          failJson({
            command: "board",
            message,
            code: "BOARD_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
          return;
        }
        printHumanError("arggon board", message);
        process.exitCode = 1;
      }
    },
  );

/** JSON shape of the additive `proposals[]` payload (task-init-propose-acked-updates). */
function proposalPayload(proposals: ProposalEntry[]): unknown[] {
  return proposals.map((p) => ({
    dest: p.dest,
    proposalPath: p.proposalPath,
    decision: p.decision,
    template: p.template,
    basedOnVersion: p.basedOnVersion,
    ...(p.decision === "proposed"
      ? {
          added: p.added,
          removed: p.removed,
          // Additive (spec-propose-section-backports-007).
          mode: p.mode,
          ...(p.regions ? { regions: p.regions } : {}),
        }
      : {}),
    ...(p.note !== undefined ? { note: p.note } : {}),
  }));
}

/**
 * Human output for `init --propose` (task-init-propose-acked-updates): every
 * proposal with its compact diff summary, plus the flow hint.
 */
function printInitProposeHuman(result: InitResult): void {
  if (result.warning) {
    console.error(`arggon: warning: ${result.warning}`);
  }
  const proposals = result.proposals ?? [];
  console.log(
    `arggon init --propose: ${proposals.length} proposal(s) at ${sanitizeHumanError(result.root)}`,
  );
  for (const p of proposals) {
    if (p.decision === "proposed") {
      console.log(
        `  proposed  ${sanitizeHumanError(p.dest)}  ->  ${sanitizeHumanError(p.proposalPath)}  (${p.mode === "sections" ? `sections: ${p.regions?.length ?? 0} region(s)` : "whole file"}; +${p.added ?? 0}/-${p.removed ?? 0} lines vs current template)`,
      );
      // Section mode (spec-propose-section-backports-007): list each region.
      for (const [idx, r] of (p.regions ?? []).entries()) {
        console.log(`    region ${idx + 1}: ${r.kind} (+${r.added}/-${r.removed})`);
      }
    } else if (p.decision === "absorbed") {
      console.log(
        `  absorbed  ${sanitizeHumanError(p.dest)}  (matches upstream — removed ${sanitizeHumanError(p.proposalPath)})`,
      );
    } else if (p.decision === "informational") {
      console.log(
        `  info      ${sanitizeHumanError(p.dest)}  (${sanitizeHumanError(p.note ?? "nothing to backport")})`,
      );
    } else {
      console.log(
        `  stale     ${sanitizeHumanError(p.dest)}  (${sanitizeHumanError(p.proposalPath)} is from an older arggon version — delete it after checking)`,
      );
    }
  }
  if (proposals.length === 0) {
    console.log("  (nothing to propose — every doc matches its current template)");
  }
  console.log(
    "Originals untouched. Next: diff each proposal, merge what you want as normal work, then re-ack via `arggon adopt --ack` and delete the proposal file.",
  );
}

function printInitDryRun(result: InitDryRunResult): void {
  // bug-init-git-doctor-blindspot: same warning surface as a real run.
  if (result.warning) {
    console.error(`arggon: warning: ${result.warning}`);
  }
  console.log(
    `arggon init (dry run): ${result.alreadyInitialized ? "already initialized" : "fresh scaffold"} at ${sanitizeHumanError(result.root)}`,
  );
  const width = Math.max("decision".length, ...result.plan.map((e) => e.decision.length));
  console.log(`  ${"decision".padEnd(width)}  destination`);
  for (const e of result.plan) {
    console.log(
      `  ${e.decision.padEnd(width)}  ${sanitizeHumanError(e.dest)}  ${sanitizeHumanError(e.reason)}`,
    );
  }
  if (result.plan.length === 0) {
    console.log("  (nothing to do — tree already up to date)");
  }
  console.log("nothing was written (dry run)");
}

function printInitHuman(result: InitResult): void {
  // bug-init-git-doctor-blindspot: human path warns on stderr; the --json
  // envelope carries the same text as the additive `warning` field instead.
  if (result.warning) {
    console.error(`arggon: warning: ${result.warning}`);
  }
  if (result.alreadyInitialized && !result.force) {
    console.log(`arggon init: already initialized at ${sanitizeHumanError(result.conventionPath)}`);
    if (result.restored.length > 0) {
      const names = result.restored.map((p) => p.replace(/^templates\//, ""));
      console.log(
        `arggon init: restored missing templates: ${sanitizeHumanError(names.join(", "))}`,
      );
    } else {
      console.log("arggon init: templates/ already complete");
    }
    if (result.created.length > 0) {
      console.log(
        `arggon init: generated missing docs: ${sanitizeHumanError(result.created.join(", "))}`,
      );
    }
    if (result.updated.length > 0) {
      console.log(`arggon init: regenerated untouched docs: ${result.updated.length} file(s)`);
    }
    if (result.backedUp.length > 0) {
      console.log(
        `arggon init: archived modified docs: ${sanitizeHumanError(result.backedUp.join(", "))}`,
      );
    }
    if (result.skipped.length > 0) {
      console.log(
        `arggon init: kept adopter-modified docs: ${result.skipped.length} file(s) (--backup archives and regenerates)`,
      );
    }
    const commitLine = formatCommitLine(result.commit);
    if (commitLine && result.commit?.committed) console.log(`arggon init: ${commitLine}`);
    console.log("Next: create work with `arggon create` (coming soon), or copy from templates/.");
    return;
  }

  const commitLine = formatCommitLine(result.commit);
  if (commitLine) console.log(`arggon init: ${commitLine}`);
  console.log(`arggon init: ready in ${sanitizeHumanError(result.root)}`);
  const conventionRel = relative(result.root, result.conventionPath).split(sep).join("/");
  const trackerName = conventionRel.split("/")[0] ?? conventionRel;
  console.log(
    `  - ${sanitizeHumanError(conventionRel)} (version: ${readConventionVersion(result.root)})`,
  );
  console.log("  - templates/ (initiative, epic, story, task, bug)");
  if (result.created.some((p) => !p.startsWith("templates/"))) {
    const docs = result.created.filter((p) => p !== conventionRel && !p.startsWith("templates/"));
    console.log(`  - governing docs (${docs.length}): ${sanitizeHumanError(docs.join(", "))}`);
  }
  if (result.updated.length > 0) {
    console.log(`  - regenerated untouched docs: ${result.updated.length} file(s)`);
  }
  if (result.backedUp.length > 0) {
    console.log(`  - archived modified docs: ${sanitizeHumanError(result.backedUp.join(", "))}`);
  }
  if (result.skipped.length > 0) {
    console.log(
      `  - kept adopter-modified docs (never overwritten): ${sanitizeHumanError(result.skipped.join(", "))}`,
    );
  }
  console.log("Next:");
  console.log(
    `  1. Add an initiative under ${trackerName}/<slug>/<slug>.md (see ${trackerName}/docs/convention.md)`,
  );
  console.log("  2. Or use templates/ as stubs until `arggon create` lands");
}

program
  .command("sync")
  .description("Reconcile task branch fields with open GitHub PRs")
  .option("--check", "check mode: report matches without modifying (default)", false)
  .option("--write", "write mode: fill empty branch fields from PRs", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .option("--repo <owner/repo>", "GitHub repository (default: detected from origin remote)")
  .action((opts: { check?: boolean; write?: boolean; json?: boolean; repo?: string }) => {
    const json = jsonEnabled(opts);
    try {
      if (json) {
        const outcome = syncOperation({
          cwd: process.cwd(),
          check: opts.check,
          write: opts.write,
          repo: opts.repo,
        });
        emitJson(outcome.envelope);
        process.exitCode = outcome.exitCode;
        return;
      }
      const result = runSync({
        check: opts.check,
        write: opts.write,
        repo: opts.repo,
      });
      console.log(
        `arggon sync (${result.mode}): ${result.exit_code === 0 ? "in sync" : "sync needed"}`,
      );
      for (const id of result.matched) {
        console.log(`  matched:   ${sanitizeHumanError(id)}`);
      }
      for (const s of result.suggestions) {
        console.log(
          `  fillable:  ${sanitizeHumanError(s.id)} <- ${sanitizeHumanError(s.branch)} (#${s.pr})`,
        );
      }
      for (const id of result.pending) {
        if (!result.suggestions.some((s) => s.id === id)) {
          console.log(
            `  pending:   ${sanitizeHumanError(id)} (candidates disagree; pick a branch manually)`,
          );
        }
      }
      for (const id of result.unmatched) {
        console.log(`  unmatched: ${sanitizeHumanError(id)} (no open PR)`);
      }
      for (const amb of result.ambiguous) {
        console.log(`  ambiguous: ${sanitizeHumanError(amb.id)} (PRs ${amb.prs.join(", ")})`);
      }
      for (const [id, branch] of Object.entries(result.filled ?? {})) {
        console.log(`  filled:    ${sanitizeHumanError(id)} -> ${sanitizeHumanError(branch)}`);
      }
      if (result.suggestions.length > 0 && result.mode === "check") {
        console.log(
          `next: arggon sync --write fills ${result.suggestions.length} empty branch field(s)`,
        );
      }
      if (result.errors.length > 0) {
        console.error(sanitizeHumanError(`  errors: ${result.errors.join("; ")}`));
      }
      // CI gate: non-zero when sync is needed (--check) or sync could not finish.
      process.exitCode = result.exit_code;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "sync",
          message,
          code: "SYNC_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon sync", message);
      process.exitCode = 1;
    }
  });

program
  .command("instructions")
  .description("Print the agent wiring (install, pre-commit, CI) extracted from the agent playbook")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runInstructions({ cwd: process.cwd() });
      if (json) {
        successJson(
          "instructions",
          {
            source: result.source,
            snippets: result.snippets,
          },
          readConventionVersion(result.root),
        );
        return;
      }
      console.log(`arggon instructions: agent wiring from ${sanitizeHumanError(result.source)}\n`);
      const sections: Array<[string, { language: string; body: string }]> = [
        ["install", result.snippets.install],
        ["pre-commit gate (.git/hooks/pre-commit)", result.snippets.precommit],
        ["CI gate", result.snippets.ci],
        ["agent instructions snippet (AGENTS.md)", result.snippets.agent],
      ];
      for (const [label, snippet] of sections) {
        console.log(`## ${label}`);
        console.log("```" + snippet.language);
        console.log(snippet.body);
        console.log("```\n");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "instructions",
          message,
          code: "INSTRUCTIONS_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      printHumanError("arggon instructions", message);
      process.exitCode = 1;
    }
  });

program
  .command("mcp")
  .description(
    "Start the stdio MCP server exposing list/create/update with agent rules (JSON-RPC on stdin/stdout)",
  )
  .action(() => {
    runMcpServer({ cwd: process.cwd(), input: process.stdin, output: process.stdout });
  });

program.parse();
