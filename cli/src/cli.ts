#!/usr/bin/env node
import { Command } from "commander";
import { runInit, type InitResult } from "./init.js";
import { bindJsonProgram, failJson, jsonEnabled, successJson } from "./json.js";

const HELLO_MESSAGE = "arggon: hello from Phase 1 scaffold";

const program = new Command();

program
  .name("arggon")
  .description("Git-native task CLI for ArggonManager")
  .version("0.0.0")
  .option("--json", "machine-readable JSON on stdout", false);

bindJsonProgram(program);

program
  .command("hello")
  .description("Sanity-check that the CLI runs")
  .option("--json", "machine-readable JSON on stdout", false)
  .action((opts: { json?: boolean }) => {
    if (jsonEnabled(opts)) {
      successJson("hello", { message: HELLO_MESSAGE }, 0);
      return;
    }
    console.log(HELLO_MESSAGE);
  });

program
  .command("init")
  .description("Scaffold tasks/ convention (+ templates) in a repo")
  .argument("[dir]", "target directory", ".")
  .option("-f, --force", "overwrite existing convention/templates", false)
  .option("--json", "machine-readable JSON on stdout", false)
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
          },
          0,
        );
        return;
      }
      printInitHuman(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({ command: "init", message, code: "INIT_FAILED" });
        return;
      }
      console.error(`arggon init: ${message}`);
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

program.parse();
