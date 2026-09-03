#!/usr/bin/env node
import { Command } from "commander";

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

program.parse();
