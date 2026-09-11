#!/usr/bin/env node
import { Command } from "commander";
import { displayPath, runBoard } from "./board.js";
import { startBoardServer } from "./board-serve.js";
import { runBranch } from "./branch.js";
import { runStart } from "./start.js";
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
import { runInstructions } from "./instructions.js";
import { runMcpServer } from "./mcp-server.js";
import { runNext } from "./next.js";
import { formatReportMarkdown, formatReportTable, runReport } from "./report.js";
import { runSync } from "./sync-command.js";
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
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action(
    (opts: {
      status?: string;
      type?: string;
      assignee?: string;
      filter?: string;
      view?: string;
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
  .action((opts: { format?: string; json?: boolean }) => {
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
    try {
      const result = runReport({ cwd: process.cwd() });
      if (json) {
        successJson("report", { groups: result.groups }, readConventionVersion(result.root));
        return;
      }
      if (format === "markdown") {
        process.stdout.write(formatReportMarkdown(result));
        return;
      }
      process.stdout.write(formatReportTable(result.groups));
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
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((id: string, opts: { assignee?: string; openPr?: boolean; json?: boolean }) => {
    const json = jsonEnabled(opts);
    try {
      const result = runStart({
        cwd: process.cwd(),
        id,
        assignee: opts.assignee,
        openPr: Boolean(opts.openPr),
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
          },
          readConventionVersion(result.root),
        );
        return;
      }
      console.log(`arggon start: ${result.item.type} ${result.id} → ${result.branch}`);
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
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { out?: string; github?: boolean; groupBy?: string; serve?: boolean; port?: string; json?: boolean }) => {
    const json = jsonEnabled(opts);
    if (opts.serve) {
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
