import type { Command } from "commander";
import { CONVENTION_VERSION } from "./convention.js";

export type { Issue, ItemType, Status, WorkItem } from "./types.js";

/** JSON stdout contract version (docs/json-output.md). Not the task-tree convention version. */
export const JSON_SCHEMA_VERSION = 1;

export type JsonError = {
  message: string;
  code?: string;
};

export type JsonEnvelopeBase = {
  ok: boolean;
  schemaVersion: number;
  conventionVersion: number;
  command: string;
};

let boundProgram: Command | undefined;

/** Bind the root commander program so `jsonEnabled()` can read global opts. */
export function bindJsonProgram(program: Command): void {
  boundProgram = program;
}

/**
 * Whether `--json` is set. Reads `program.opts()`.
 * Pass command-local opts so `arggon hello --json` also works.
 */
export function jsonEnabled(cmdOpts?: { json?: unknown }): boolean {
  if (cmdOpts && cmdOpts.json) return true;
  return Boolean(boundProgram?.opts<{ json?: boolean }>().json);
}

/** Write one JSON object + newline to stdout (stable; no pretty-print). */
export function emitJson(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

export type FailJsonOptions = {
  command: string;
  message: string;
  code?: string;
  conventionVersion?: number;
};

/** Emit `ok: false` envelope and set `process.exitCode = 1`. */
export function failJson(opts: FailJsonOptions): void {
  const error: JsonError = { message: opts.message };
  if (opts.code !== undefined) {
    error.code = opts.code;
  }
  emitJson({
    ok: false,
    schemaVersion: JSON_SCHEMA_VERSION,
    conventionVersion: opts.conventionVersion ?? CONVENTION_VERSION,
    command: opts.command,
    error,
  });
  process.exitCode = 1;
}

/** Emit `ok: true` envelope with command-specific payload fields. */
export function successJson(
  command: string,
  payload: Record<string, unknown> = {},
  conventionVersion = CONVENTION_VERSION,
): void {
  emitJson({
    ok: true,
    schemaVersion: JSON_SCHEMA_VERSION,
    conventionVersion,
    command,
    ...payload,
  });
}
