/**
 * JSON stdout formatter for `--json`.
 * Serializes domain objects; does not read the filesystem or walk tasks/.
 */

export const JSON_SCHEMA_VERSION = 1;

export type JsonEnvelope = {
  ok: boolean;
  schemaVersion: number;
  conventionVersion: number;
  command: string;
};

export function jsonRequested(opts: { json?: unknown } | null | undefined): boolean {
  return Boolean(opts && opts.json);
}

/** Write one JSON object plus a trailing newline on stdout. */
export function emitJson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/**
 * Emit an `ok: false` envelope and set `process.exitCode = 1`.
 * Writes stdout only (no stderr).
 */
export function failJson(args: {
  command: string;
  message: string;
  code?: string;
  conventionVersion?: number;
}): void {
  process.exitCode = 1;
  const payload: Record<string, unknown> = {
    ok: false,
    schemaVersion: JSON_SCHEMA_VERSION,
    conventionVersion: args.conventionVersion ?? 0,
    command: args.command,
    message: args.message,
  };
  if (args.code !== undefined) {
    payload.code = args.code;
  }
  emitJson(payload);
}
