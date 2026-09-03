#!/usr/bin/env node
import { Command } from "commander";
import { runInit, type InitResult } from "./init.js";
import { emitJson, failJson, jsonRequested, JSON_SCHEMA_VERSION } from "./json.js";

const program = new Command();

program
  .name("arggon")
  .description("Git-native task CLI for ArggonManager")
  .version("0.0.0")
  .option("--json", "emit one JSON object on stdout (agent contract)", false);

function useJson(cmdOpts?: { json?: unknown }): boolean {
  return jsonRequested(program.opts()) || jsonRequested(cmdOpts);
}

program
  .command("hello")
  .description("Sanity-check that the CLI runs")
  .option("--json", "emit one JSON object on stdout (agent contract)", false)
  .action((opts: { json?: boolean }) => {
    const message = "arggon: hello from Phase 1 scaffold";
    if (useJson(opts)) {
      emitJson({
        ok: true,
        schemaVersion: JSON_SCHEMA_VERSION,
        conventionVersion: 0,
        command: "hello",
        message,
      });
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
    const json = useJson(opts);
    try {
      const result = runInit({ dir, force: Boolean(opts.force) });
      if (json) {
        emitJson({
          ok: true,
          schemaVersion: JSON_SCHEMA_VERSION,
          conventionVersion: 0,
          command: "init",
          root: result.root,
          alreadyInitialized: result.alreadyInitialized,
          force: result.force,
          created: result.created,
          restored: result.restored,
          conventionPath: result.conventionPath,
        });
        return;
      }
      printInitHuman(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (json) {
        failJson({ command: "init", message });
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
