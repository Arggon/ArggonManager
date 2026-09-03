#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./init.js";

const program = new Command();

program
  .name("arggon")
  .description("Git-native task CLI for ArggonManager")
  .version("0.0.0");

program
  .command("hello")
  .description("Sanity-check that the CLI runs")
  .action(() => {
    console.log("arggon: hello from Phase 1 scaffold");
  });

program
  .command("init")
  .description("Scaffold tasks/ convention (+ templates) in a repo")
  .argument("[dir]", "target directory", ".")
  .option("-f, --force", "overwrite existing convention/templates", false)
  .action((dir: string, opts: { force: boolean }) => {
    try {
      runInit({ dir, force: Boolean(opts.force) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`arggon init: ${message}`);
      process.exitCode = 1;
    }
  });

program.parse();
