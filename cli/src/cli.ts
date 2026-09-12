#!/usr/bin/env node
import { Command } from "commander";
import { displayPath, runBoard } from "./board.js";
import { startBoardServer } from "./board-serve.js";
import { runBranch } from "./branch.js";
import { runComment } from "./comment.js";
import { runStart } from "./start.js";
import { runCleanup } from "./cleanup.js";
import { readConventionVersion } from "./convention.js";
import { toContractWorkItem } from "./contract.js";
import { runCreate } from "./create.js";
import { runInit, type InitResult } from "./init.js";
import {
  bindJsonProgram,
  emitJson,
  failJson,
  JSON_SCHEMA_VERSION,
  jsonEnabled,
  successJson,
} from "./json.js";
import { formatListTable, runList } from "./list.js";
import { runImportIssues } from "./import-issues.js";
import { runInstructions } from "./instructions.js";
import { runMcpServer } from "./mcp-server.js";
import { runNext } from "./next.js";
import { formatReportMarkdown, formatReportTable, runReport } from "./report.js";
import {
  formatTrendMarkdown,
  formatTrendTable,
  runTrend,
  type TrendResult,
} from "./trend.js";
import {
  formatSpecValidateHuman,
  runSpecNew,
  runSpecValidate,
} from "./spec.js";
import { runSync } from "./sync-command.js";
import { runTuiBoard } from "./tui.js";
import { runUpdate } from "./update.js";
import { formatValidateHuman, runValidate } from "./validate.js";
const program = new Command();

program
  .name("arggon")
  .description("Git-native task CLI for ArggonManager")
  .version("0.0.0")
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
  .description("Scaffold tasks/ convention (+ templates) in a repo")
  .argument("[dir]", "target directory", ".")
  .option("-f, --force", "overwrite existing convention/templates", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((dir: string, opts: { force: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runInit({ dir, force: Boolean(opts.force) });
      if (json) {
        successJson(
          "init",
          {
            root: result.root,
            alreadyInitialized: result.alreadyInitialized,
            force: result.force,
            created: result.created,
            restored: result.restored,
            conventionPath: result.conventionPath,
          },
          readConventionVersion(result.root),
        );
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
      console.error(`arggon init: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("create")
  .description("Create a work item under tasks/")
  .argument("<type>", "initiative | epic | story | task | bug")
  .argument("<title>", "title (id is slugified; override with --id)")
  .option("-p, --parent <id>", "parent item id (required except initiative)")
  .option("--id <id>", "override id stem (CLI still adds task-/bug- for leaves)")
  .option("--assignee <login>", "assignee (omit when unassigned)")
  .option("--status <status>", "status (default: todo)", "todo")
  .option("--blocked-reason <text>", "required when --status blocked")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      type: string,
      title: string,
      opts: {
        parent?: string;
        id?: string;
        assignee?: string;
        status?: string;
        blockedReason?: string;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      try {
        const result = runCreate({
          cwd: process.cwd(),
          type,
          title,
          parent: opts.parent,
          id: opts.id,
          assignee: opts.assignee,
          status: opts.status,
          blockedReason: opts.blockedReason,
        });
        if (json) {
          successJson(
            "create",
            { item: toContractWorkItem(result.item, result.root) },
            readConventionVersion(result.root),
          );
          return;
        }
        console.log(`arggon create: ${result.item.type} ${result.id}`);
        console.log(`  ${result.path}`);
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
        console.error(`arggon create: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program
  .command("list")
  .description("List work items under tasks/ with optional filters")
  .option("--status <status>", "exact v0 status (todo | in_progress | blocked | done | cancelled)")
  .option("--type <type>", "exact v0 type (initiative | epic | story | task | bug)")
  .option(
    "--assignee <login>",
    "exact assignee login; @me resolves via GITHUB_USER, then GITHUB_ACTOR, then `gh api user`",
  )
  .option(
    "--filter <expr>",
    'compact filter (e.g. "status:todo !label:security"); fields status, type, assignee, label, parent, depends-on, blocked-by; ! negates; quotes allow spaces',
  )
  .option(
    "--view <name>",
    'saved view name from tasks/.convention.yml x-views; ANDed with the flags and --filter',
  )
  .option(
    "--stale",
    "list claimed items whose claimed_at lease is older than --older-than (claims from before claimed_at count as stale)",
    false,
  )
  .option(
    "--older-than <duration>",
    'stale threshold for --stale: <number><d|h|m> (e.g. 7d, 12h, 30m)',
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      status?: string;
      type?: string;
      assignee?: string;
      filter?: string;
      view?: string;
      stale?: boolean;
      olderThan?: string;
      json?: boolean;
    }) => {
      const json = jsonEnabled(opts);
      try {
        const result = runList({
          cwd: process.cwd(),
          status: opts.status,
          type: opts.type,
          assignee: opts.assignee,
          filter: opts.filter,
          view: opts.view,
          stale: opts.stale,
          olderThan: opts.olderThan,
        });
        if (json) {
          successJson(
            "list",
            { items: result.items.map((item) => toContractWorkItem(item, result.root)) },
            readConventionVersion(result.root),
          );
          return;
        }
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
        console.error(`arggon list: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program
  .command("next")
  .description(
    "Suggest the next claimable item (unclaimed todo, lexicographic by id; ready items rank first)",
  )
  .option(
    "--ready",
    "limit the pool to ready items (unclaimed todos whose depends_on are all done/cancelled)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { ready?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runNext({ cwd: process.cwd(), ready: Boolean(opts.ready) });
      const suggestion = result.suggestion
        ? {
            item: toContractWorkItem(result.suggestion.item, result.root),
            parentChain: result.suggestion.parentChain,
            reason: result.suggestion.reason,
            blockedBy: result.suggestion.blockedBy,
          }
        : null;
      if (json) {
        successJson("next", { suggestion }, readConventionVersion(result.root));
        return;
      }
      if (!result.suggestion) {
        console.log(
          opts.ready
            ? "arggon next: ready pool is empty — nothing unblocked to claim."
            : "arggon next: todo pool is empty — nothing claimable.",
        );
        console.log('  Create work with `arggon create task "<title>" --parent <story-id>`.');
        return;
      }
      const item = result.suggestion.item;
      console.log(`arggon next: ${item.id} — ${item.title ?? item.id}`);
      console.log(
        `  type: ${item.type} · parent: ${result.suggestion.parentChainDisplay.join(" > ") || "(none)"}`,
      );
      console.log(`  why: ${result.suggestion.reason}`);
      console.log(`  next: arggon start ${item.id} --assignee <login>`);
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
      console.error(`arggon next: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("report")
  .description("Aggregate leaf statuses per container, grouped by epic (display only)")
  .option("--format <format>", "output format: table (default) or markdown (standup summary)", "table")
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
      console.error(`arggon report: ${message}`);
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
      console.error(`arggon report: ${message}`);
      process.exitCode = 1;
      return;
    }
    const fail = (message: string, code: "REPORT_FAILED" | "TREND_FAILED"): void => {
      if (json) {
        failJson({
          command: "report",
          message,
          code,
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      console.error(`arggon report: ${message}`);
      process.exitCode = 1;
    };
    let trend: TrendResult | null = null;
    if (opts.trend) {
      try {
        trend = runTrend({ cwd: process.cwd(), since: opts.since });
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err), "TREND_FAILED");
        return;
      }
    }
    try {
      const result = runReport({ cwd: process.cwd() });
      if (json) {
        const payload: Record<string, unknown> = { groups: result.groups };
        if (trend) payload.trend = trend;
        successJson("report", payload, readConventionVersion(result.root));
        return;
      }
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
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({
          command: "report",
          message,
          code: "REPORT_FAILED",
          conventionVersion: readConventionVersion(process.cwd()),
        });
        return;
      }
      console.error(`arggon report: ${message}`);
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
  .option("--unassign", "clear assignee (in_progress -> todo does this by default)", false)
  .option("--labels <csv>", "replace the full labels list (comma-separated)")
  .option(
    "--depends-on <csv>",
    "replace the full depends_on list of item ids (comma-separated; empty clears)",
  )
  .option("--add-depends-on <id>", "append one depends_on id (no-op when already present)")
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
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      opts: {
        title?: string;
        status?: string;
        assignee?: string;
        branch?: string;
        unassign?: boolean;
        labels?: string;
        dependsOn?: string;
        addDependsOn?: string;
        blockedReason?: string;
        force?: boolean;
        steal?: boolean;
        reason?: string;
        cascade?: boolean;
        json?: boolean;
      },
    ) => {
      const json = jsonEnabled(opts);
      try {
        const result = runUpdate({
          cwd: process.cwd(),
          id,
          title: opts.title,
          status: opts.status,
          assignee: opts.assignee,
          branch: opts.branch,
          unassign: opts.unassign,
          labels: opts.labels,
          dependsOn: opts.dependsOn,
          addDependsOn: opts.addDependsOn,
          blockedReason: opts.blockedReason,
          force: Boolean(opts.force),
          steal: Boolean(opts.steal),
          reason: opts.reason,
          cascade: opts.cascade !== false,
        });
        if (json) {
          successJson(
            "update",
            { item: toContractWorkItem(result.item, result.root), autoCompleted: result.autoCompleted },
            readConventionVersion(result.root),
          );
          return;
        }
        const what = result.changed.length > 0 ? ` (${result.changed.join(", ")})` : "";
        console.log(`arggon update: ${result.item.type} ${result.id}${what}`);
        console.log(`  ${result.path}`);
        if (result.autoCompleted.length > 0) {
          console.log(`  auto-completed: ${result.autoCompleted.join(", ")}`);
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
        console.error(`arggon update: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program
  .command("comment")
  .description("Append a timestamped, author-attributed comment section to an item's body")
  .argument("<id>", "work item id")
  .argument("<text>", "comment text (multiline supported)")
  .option(
    "--author <login>",
    "comment author (default: @me resolution — GITHUB_USER, then GITHUB_ACTOR, then `gh api user`)",
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (id: string, text: string, opts: { author?: string; json?: boolean }) => {
      const json = jsonEnabled(opts);
      try {
        const result = runComment({
          cwd: process.cwd(),
          id,
          text,
          author: opts.author,
        });
        if (json) {
          successJson(
            "comment",
            { id: result.id, path: result.path, comment: result.comment },
            readConventionVersion(result.root),
          );
          return;
        }
        console.log(
          `arggon comment: ${result.id} (${result.comment.date} @${result.comment.author})`,
        );
        console.log(`  ${result.path}`);
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
        console.error(`arggon comment: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program
  .command("import-issues")
  .description("One-shot import of GitHub issues into tasks/ as tasks (idempotent)")
  .option("--repo <owner/repo>", "GitHub repository (default: gh's own resolution from cwd)")
  .option(
    "--parent <story-id>",
    "target story for imported tasks (default: story-imported-issues, created under the first epic when missing)",
  )
  .option("--dry-run", "print the mapping plan (would-create / would-skip) without writing", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: { repo?: string; parent?: string; dryRun?: boolean; json?: boolean }) => {
      const json = jsonEnabled(opts);
      try {
        const result = runImportIssues({
          cwd: process.cwd(),
          repo: opts.repo,
          parent: opts.parent,
          dryRun: Boolean(opts.dryRun),
        });
        if (json) {
          successJson(
            "import-issues",
            {
              dryRun: result.dryRun,
              story: result.story,
              entries: result.entries,
              created: result.created,
              skipped: result.skipped,
              labels: { mapped: result.labelsMapped, skipped: result.labelsSkipped },
            },
            readConventionVersion(result.root),
          );
          return;
        }
        console.log(
          `arggon import-issues${result.dryRun ? " (dry run)" : ""}: ${result.entries.length} issue(s), ${result.created} created, ${result.skipped} skipped`,
        );
        console.log(
          `  target story: ${result.story.id}${result.story.created ? " (created)" : result.dryRun ? " (would create when missing)" : ""}`,
        );
        for (const entry of result.entries) {
          console.log(`  ${entry.action.padEnd(13)} ${entry.id}  ${entry.title} [${entry.status}]`);
        }
        console.log(
          `  labels: ${result.labelsMapped} mapped, ${result.labelsSkipped} skipped (invalid)`,
        );
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
        console.error(`arggon import-issues: ${message}`);
        process.exitCode = 1;
      }
    },
  );

program
  .command("validate")
  .description("Validate tasks/ frontmatter and tree integrity")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runValidate({ cwd: process.cwd() });
      if (json) {
        const payload = {
          ok: result.errors.length === 0,
          schemaVersion: JSON_SCHEMA_VERSION,
          conventionVersion: result.conventionVersion,
          command: "validate",
          errors: result.errors,
          warnings: result.warnings,
        };
        if (result.errors.length > 0) {
          emitJson({
            ...payload,
            error: {
              message: `validate failed with ${result.errors.length} error(s)`,
              code: "VALIDATE_FAILED",
            },
          });
          process.exitCode = 1;
          return;
        }
        emitJson(payload);
        return;
      }
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
      console.error(`arggon validate: ${message}`);
      process.exitCode = 1;
    }
  });

const spec = program
  .command("spec")
  .description("Validate and scaffold feature specs and plans (docs/specs, docs/plans)");

spec
  .command("validate")
  .description("Validate spec/plan frontmatter and section structure (pure read)")
  .option("--file <path>", "validate a single file (also outside docs/specs / docs/plans)")
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
      console.error(`arggon spec: ${message}`);
      process.exitCode = 1;
    }
  });

spec
  .command("new")
  .description(
    "Scaffold docs/specs/spec-<slug>-NNN.md (and docs/plans/plan-<slug>-NNN.md with --plan); never overwrites",
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
        console.log(`  ${file}`);
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
      console.error(`arggon spec new: ${message}`);
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
        `arggon branch: ${result.item.type} ${result.id} → ${result.branch} (${result.created ? "created" : "attached"})`,
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
      console.error(`arggon branch: ${message}`);
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
    "run the flow inside a linked git worktree at ../<repo-name>-<id> (recorded on the item as worktree_path)",
    false,
  )
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (
      id: string,
      opts: { assignee?: string; openPr?: boolean; worktree?: boolean; json?: boolean },
    ) => {
      const json = jsonEnabled(opts);
      try {
        const result = runStart({
          cwd: process.cwd(),
          id,
          assignee: opts.assignee,
          openPr: Boolean(opts.openPr),
          worktree: Boolean(opts.worktree),
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
            },
            readConventionVersion(result.root),
          );
          return;
        }
        console.log(`arggon start: ${result.item.type} ${result.id} → ${result.branch}`);
        if (result.worktreePath) {
          console.log(
            `  worktree: ${result.worktreePath} (${result.worktreeCreated ? "created" : "attached"})`,
          );
        }
        if (result.prUrl) {
          console.log(`  draft PR: ${result.prUrl}`);
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
        console.error(`arggon start: ${message}`);
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
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { prune?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runCleanup({ cwd: process.cwd(), prune: Boolean(opts.prune) });
      if (json) {
        if (result.failures.length > 0) {
          failJson({
            command: "cleanup",
            message: result.failures.join("; "),
            code: "CLEANUP_FAILED",
            conventionVersion: readConventionVersion(result.root),
          });
          return;
        }
        successJson(
          "cleanup",
          {
            base: result.base,
            candidates: result.entries,
            pruned: result.pruned,
          },
          readConventionVersion(result.root),
        );
        return;
      }
      const removable = result.entries.filter((e) => e.removable);
      console.log(
        `arggon cleanup: ${result.entries.length} tracked worktree(s), base ${result.base}`,
      );
      for (const entry of result.entries) {
        if (entry.removable) {
          console.log(`  removable: ${entry.id} -> ${entry.path} (${entry.action})`);
        } else {
          console.log(`  skipped:   ${entry.id} (${entry.reason})`);
        }
      }
      for (const action of result.pruned) {
        console.log(`  pruned:    ${action.id}: ${action.action}`);
      }
      for (const failure of result.failures) {
        console.error(`  failed:    ${failure}`);
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
      console.error(`arggon cleanup: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("board")
  .description(
    "Write a static read-only HTML board from tasks/ (git files stay the source of truth)",
  )
  .option(
    "--out <file>",
    "output HTML file (default: board.html at the repo root; relative --out resolves from cwd)",
  )
  .option("--github", "overlay live GitHub PR state on cards with a branch (read-only)", false)
  .option(
    "--group-by <field>",
    "prototype (ADR 0003): group cards within each column by milestone",
  )
  .option("--serve", "serve the board locally (127.0.0.1) with live reload; edits go through the update path", false)
  .option("--port <port>", "port for --serve (default: a free ephemeral port)")
  .option("--tui", "interactive read-only terminal kanban (raw ANSI, q quits; not combinable with --json)", false)
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { out?: string; github?: boolean; groupBy?: string; serve?: boolean; port?: string; tui?: boolean; json?: boolean }) => {
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
      console.error(`arggon board: ${message}`);
      process.exitCode = 1;
    };
    if (opts.tui) {
      if (opts.serve) {
        jsonFailed("cannot combine --tui with --serve (both are interactive modes)");
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
        jsonFailed("cannot combine --serve with --github (the served board renders fresh per request)");
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
            `arggon board: serving ${displayPath(handle.root, process.cwd())} on ${handle.url} (binds 127.0.0.1 only, Ctrl-C to stop)`,
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
        `arggon board: wrote ${displayPath(result.outPath, process.cwd())} (${result.itemCount} item(s)${result.groupBy ? `, grouped by ${result.groupBy}` : ""}${opts.github ? `, ${result.prCount} PR(s) linked` : ""})`,
      );
      console.log(
        "  Open it in a browser. Re-run after tree changes — tasks/ remains the source of truth.",
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
      console.error(`arggon board: ${message}`);
      process.exitCode = 1;
    }
  });

function printInitHuman(result: InitResult): void {
  if (result.alreadyInitialized && !result.force) {
    console.log(`arggon init: already initialized at ${result.conventionPath}`);
    if (result.restored.length > 0) {
      const names = result.restored.map((p) => p.replace(/^templates\//, ""));
      console.log(`arggon init: restored missing templates: ${names.join(", ")}`);
    } else {
      console.log("arggon init: templates/ already complete");
    }
    console.log("Next: create work with `arggon create` (coming soon), or copy from templates/.");
    return;
  }

  console.log(`arggon init: ready in ${result.root}`);
  console.log("  - tasks/.convention.yml (version: 0)");
  console.log("  - templates/ (initiative, epic, story, task, bug)");
  console.log("Next:");
  console.log("  1. Add an initiative under tasks/<slug>/<slug>.md (see docs/convention.md)");
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
      const result = runSync({
        check: opts.check,
        write: opts.write,
        repo: opts.repo,
      });
      const payload = {
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
      if (json) {
        if (result.errors.length > 0) {
          failJson({
            command: "sync",
            message: result.errors.join("; "),
            code: "SYNC_FAILED",
            conventionVersion: readConventionVersion(process.cwd()),
          });
        } else {
          successJson("sync", payload, readConventionVersion(process.cwd()));
        }
      } else {
        console.log(
          `arggon sync (${result.mode}): ${result.exit_code === 0 ? "in sync" : "sync needed"}`,
        );
        for (const id of result.matched) {
          console.log(`  matched:   ${id}`);
        }
        for (const s of result.suggestions) {
          console.log(`  fillable:  ${s.id} <- ${s.branch} (#${s.pr})`);
        }
        for (const id of result.pending) {
          if (!result.suggestions.some((s) => s.id === id)) {
            console.log(`  pending:   ${id} (candidates disagree; pick a branch manually)`);
          }
        }
        for (const id of result.unmatched) {
          console.log(`  unmatched: ${id} (no open PR)`);
        }
        for (const amb of result.ambiguous) {
          console.log(`  ambiguous: ${amb.id} (PRs ${amb.prs.join(", ")})`);
        }
        for (const [id, branch] of Object.entries(result.filled ?? {})) {
          console.log(`  filled:    ${id} -> ${branch}`);
        }
        if (result.suggestions.length > 0 && result.mode === "check") {
          console.log(
            `next: arggon sync --write fills ${result.suggestions.length} empty branch field(s)`,
          );
        }
        if (result.errors.length > 0) {
          console.error(`  errors: ${result.errors.join("; ")}`);
        }
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
      console.error(`arggon sync: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("instructions")
  .description("Print the agent wiring (install, pre-commit, CI) extracted from docs/agents.md")
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
      console.log(`arggon instructions: agent wiring from ${result.source}\n`);
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
      console.error(`arggon instructions: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command("mcp")
  .description("Start the stdio MCP server exposing list/create/update with agent rules (JSON-RPC on stdin/stdout)")
  .action(() => {
    runMcpServer({ cwd: process.cwd(), input: process.stdin, output: process.stdout });
  });

program.parse();
