import { spawn, spawnSync } from "node:child_process";
import type {
  ChildProcessWithoutNullStreams,
  SpawnOptions,
  SpawnSyncOptionsWithStringEncoding,
  SpawnSyncReturns,
} from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared helper for spawning the real CLI (or a TS helper script) from the
 * TypeScript sources in tests, labs and plugin contract tests.
 *
 * bug-row-table-flake: drive node's module-loader registration directly
 * (`--import <tsx loader>`) instead of the tsx wrapper CLI. The wrapper
 * (tsx/dist/cli.mjs) re-executes node as a second child process and hosts a
 * per-spawn IPC server (`/tmp/tsx-<uid>/<pid>.pipe`); its listen/rm/reject
 * path has no error handling, so any transient failure there exits the whole
 * chain 1 under load. One node process, no wrapper, no IPC socket: the
 * transient class is gone. Spawned stdout/stderr bytes are unchanged (same
 * CLI, same loader). Original single-file migration: cli/src/
 * row-table-stdout.test.ts (PR #513); this helper replaces that file's local
 * copy and every remaining per-suite copy (task-runcli-import-tsx-migration).
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Absolute path of the CLI's TypeScript entry inside `root`. */
export function cliEntryPath(root: string = repoRoot): string {
  return resolve(root, "cli/src/cli.ts");
}

/** Absolute path of tsx's loader (`--import` target; NOT the wrapper CLI). */
export function tsxLoaderPath(root: string = repoRoot): string {
  return resolve(root, "node_modules/tsx/dist/loader.mjs");
}

/**
 * argv that runs `entry` (the CLI or a spawned TS helper script) through
 * tsx's loader: `node --import <loader> <entry>`. Spread the result before
 * the entry's own arguments.
 */
export function nodeImportArgs(entry: string, root: string = repoRoot): string[] {
  return ["--import", tsxLoaderPath(root), entry];
}

export type RunCliOptions = Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> & {
  /** Defaults to (and stays) "utf8" — every migrated suite asserts strings. */
  encoding?: "utf8";
};

/**
 * Sync-spawn the real CLI: `node --import <tsx loader> cli/src/cli.ts <args>`
 * (bug-row-table-flake). `cwd` defaults to the vitest process cwd; `options`
 * are passed straight to `spawnSync` (env, input, timeout, …).
 */
export function runCli(
  args: string[],
  cwd?: string,
  options: RunCliOptions = {},
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [...nodeImportArgs(cliEntryPath()), ...args], {
    encoding: "utf8",
    cwd,
    ...options,
  });
}

/**
 * Async-spawn the real CLI with the same loader registration as
 * {@link runCli}. Streams are typed non-null: every caller pipes at least
 * stdout/stderr (asserted by the migrated suites' stdio tuples).
 */
export function spawnNodeCli(
  args: string[],
  options: SpawnOptions = {},
): ChildProcessWithoutNullStreams {
  return spawn(
    process.execPath,
    [...nodeImportArgs(cliEntryPath()), ...args],
    options,
  ) as ChildProcessWithoutNullStreams;
}
