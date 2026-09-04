#!/usr/bin/env node
import { Command } from "commander";
import { readConventionVersion } from "./convention.js";
import { toContractWorkItem } from "./contract.js";
import { runCreate } from "./create.js";
import { runInit, type InitResult } from "./init.js";
import { bindJsonProgram, failJson, jsonEnabled, successJson } from "./json.js";

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

program.parse();
