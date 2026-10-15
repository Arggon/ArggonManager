#!/usr/bin/env node
/**
 * Publish through a self-describing authentication failure
 * (bug-release-needs-auth-self-describing).
 *
 * `.github/workflows/release.yml` publishes both packages via npm OIDC trusted
 * publishing (lib first, then the root). That configuration is the one thing a
 * human must do once at npmjs.com — and npmjs.com does NOT validate a
 * trusted-publisher entry when it is saved, so a missing or wrong entry
 * (missing `@arggondev/lib` entry, lowercase-org repo string, stage-only
 * default, wrong workflow filename) only surfaces here, at publish time, as a
 * bare `ENEEDAUTH` that names no cause. Two release attempts were lost to
 * exactly that. The runbook (`release.md`) names the cause and the recovery in
 * "One-time setup: npm trusted publishers" and "Exception: publish fails with
 * an authentication error" — but nothing on the FAILURE PATH pointed there, so
 * the operator read an unexplained auth error with no idea which document to
 * open.
 *
 * This wrapper runs the publish command, re-emits npm's own stderr verbatim
 * (nothing is swallowed) and — ONLY on a genuine authentication failure —
 * prints the cause, which package failed and the pointer to the one-time
 * setup. Publish semantics are untouched: the exit status is the child's, so a
 * failing publish fails the step exactly as before and a passing publish
 * prints no annotation at all.
 *
 * The wrapper's own failures fail closed with exit 2 and still re-emit: when
 * `spawnSync` itself fails — the command cannot run, or npm's stderr exceeds
 * the 1 MiB `maxBuffer` (ENOBUFS: the child is killed and its output
 * truncated) — the output npm managed to write is re-emitted before the usage
 * line, so a hidden npm error cannot become a hidden wrapper error.
 *
 * WHAT COUNTS AS AN AUTHENTICATION FAILURE (deliberately narrow: a wrong hint
 * on a real failure is worse than none):
 *   - an `npm error code <CODE>` / `npm ERR! code <CODE>` line whose code is
 *     `ENEEDAUTH` — npm's "this command requires you to be logged in", the
 *     shape `release.md` names — or `E401`, the registry answering 401. This
 *     pipeline carries no `NPM_TOKEN` anywhere, so a 401 here is by definition
 *     the trusted-publisher path being refused.
 *   - the matching message text ONLY when the log carries no `code` line at
 *     all (a trimmed log, an older npm): "need auth", "requires you to be
 *     logged in", "authorize this machine using `npm adduser`", "401
 *     Unauthorized". Any code line — auth or not — is authoritative, so an
 *     incidental auth phrase cannot override a non-auth code.
 *
 * NOT auth, so NOT annotated (the original npm error stands on its own):
 * `E404` — a 404 on a name typo (npm can also mask a trusted-publisher
 * mismatch as a 404, npm/cli#9088, which is why it is not translated here),
 * `E403` — version already published / permission, `EPRIVATE` — `private: true`,
 * `ECONNRESET` / `ETIMEDOUT` / `ESOCKETTIMEDOUT` / `ENOTFOUND` / `EAI_AGAIN` —
 * every network error, `ELIFECYCLE` / `ENOENT` / `EPACK` — lifecycle or pack
 * failures, an unknown code, a log with no error line, and a zero exit status.
 *
 * Usage:
 *   # wrapper mode — what the workflow calls (replaces a bare `npm publish`)
 *   node cli/publish-auth-hint.mjs --package <name> [--version <V>] \
 *     [--repo <owner/repo>] [--workflow <file>] [--manifest <package.json>] \
 *     -- <cmd> [args...]
 *   # log mode — offline replay of a saved npm error log (no publish, no network)
 *   node cli/publish-auth-hint.mjs --package <name> --log <file> [--exit-code <n>]
 *
 * Exit codes: wrapper mode — the child's status, unchanged (the step still
 * fails the way npm failed it); log mode — 0, report-only; 2 — usage / IO
 * error, including a `spawnSync` failure after the captured output is
 * re-emitted (fail closed, the `cli/release-guard.mjs` precedent).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TAG = "publish-auth-hint";

/** npm error codes that mean "the registry rejected this machine's credentials". */
export const AUTH_CODES = ["ENEEDAUTH", "E401"];

/**
 * Unambiguous authentication messages, for logs whose `npm error code` line is
 * absent. npm emits these only on an authentication failure.
 */
export const AUTH_MESSAGES = [
  /\bneed auth\b/i,
  /requires you to be logged in/i,
  /authorize this machine using `npm adduser`/i,
  /\b401\s+Unauthorized\b/i,
];

/** `npm ERR! code E404` (npm 10) / `npm error code ENEEDAUTH` (npm 11). */
const CODE_LINE = /^[^\S\n]*npm\s+(?:ERR!|error)\s+code\s+([A-Za-z0-9_]+)[^\S\n]*$/gm;

/** The repo the trusted publisher must name, when no manifest supplies it. */
const FALLBACK_REPO = "Arggon/ArggonManager";
/** The workflow filename the trusted publisher must name — the binding. */
const FALLBACK_WORKFLOW = "release.yml";

/** The codes a log's `npm error code <CODE>` lines carry, in order, deduped. */
export function extractErrorCodes(log) {
  const codes = [];
  for (const match of String(log ?? "").matchAll(CODE_LINE)) {
    const code = match[1].toUpperCase();
    if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

/**
 * The verdict for one publish attempt:
 *   "success" — exit 0: never annotated, a passing publish needs no pointer;
 *   "auth"    — a genuine authentication failure: gets the pointer;
 *   "other"   — any other failure: no pointer, npm's own error stands.
 */
export function classifyPublishFailure({ exitCode = 0, stderr = "" } = {}) {
  const log = String(stderr ?? "");
  const codes = extractErrorCodes(log);
  if (Number(exitCode) === 0) return { verdict: "success", codes, evidence: "" };
  const authCode = codes.find((code) => AUTH_CODES.includes(code));
  if (authCode) return { verdict: "auth", codes, evidence: `npm error code ${authCode}` };
  if (codes.length === 0) {
    // Message matching is for a log with no `code` line at all: any code line —
    // auth or not — is authoritative, so an incidental auth phrase must not
    // override a non-auth code (a wrong hint on a real failure is worse than
    // none).
    const message = AUTH_MESSAGES.find((pattern) => pattern.test(log));
    if (message) return { verdict: "auth", codes, evidence: `message ${message.source}` };
  }
  return {
    verdict: "other",
    codes,
    evidence: codes.length > 0 ? `npm error code ${codes.join(", ")}` : "no npm error code line",
  };
}

/** True only for a genuine authentication failure. */
export function isAuthFailure(input) {
  return classifyPublishFailure(input).verdict === "auth";
}

/** `git+https://github.com/Arggon/ArggonManager.git` -> `Arggon/ArggonManager`. */
export function repoFromRepositoryUrl(url) {
  const value = String(url ?? "").trim();
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(value);
  return match ? `${match[1]}/${match[2]}` : null;
}

/** Owner/repo from a package.json's `repository` field, or null when unreadable. */
export function repoFromManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
  const field = manifest?.repository;
  const url = typeof field === "string" ? field : field?.url;
  return repoFromRepositoryUrl(url);
}

/**
 * The self-describing failure an operator reads on the release step's failure
 * path: cause, package, the fastest check, the exact binding, the
 * case-sensitivity warning and where the full recovery lives.
 */
export function formatAuthHint({
  packageName,
  version = null,
  repo = FALLBACK_REPO,
  workflow = FALLBACK_WORKFLOW,
  evidence = "",
}) {
  const target = version ? `${packageName}@${version}` : packageName;
  const settings = `https://www.npmjs.com/package/${packageName}/access`;
  return [
    `${TAG}: npm publish for ${target} failed with an AUTHENTICATION error (${evidence}).`,
    "",
    "  CAUSE: npm OIDC trusted-publishing authentication failed. npmjs.com does not",
    "  validate a trusted-publisher entry when it is saved, so a missing or wrong",
    "  binding surfaces only here, at publish time. This workflow carries no NPM_TOKEN",
    "  anywhere, so the trusted publisher is the only credential it has.",
    "",
    `  FASTEST CHECK (a 2FA-protected read): npm trust list ${packageName}`,
    "  It prints the configured publisher: whether an entry exists and what it says.",
    "",
    "  REQUIRED BINDING — every field must match EXACTLY:",
    `    repository        ${repo}`,
    `    workflow filename ${workflow}`,
    "                       ^ the binding is to the FILENAME; renaming the workflow",
    "                         file is a breaking ops change",
    "    environment       (none)",
    "    publish           direct npm publish ALLOWED — entries created after",
    "                       2026-09-03 default to STAGE-ONLY publishing",
    "",
    "  Every field is CASE-SENSITIVE. The org is `Arggon`, capital A: a lowercase-org",
    "  repo string is a failed publish. An existing entry cannot be edited — delete it",
    "  and create a new one. A new entry expires if its first successful publish does",
    "  not land within 2 days.",
    "",
    `  FIX: ${settings}`,
    '  RECOVERY: fix the entry, then re-run this workflow ("Re-run failed jobs" on the',
    "  same push) — the release guard classifies it as an idempotent re-run and",
    "  completes the remaining steps.",
    '  FULL DETAIL: release.md, "One-time setup: npm trusted publishers" and',
    '  "Exception: publish fails with an authentication error".',
  ].join("\n");
}

const VALUE_FLAGS = new Map([
  ["--package", "package"],
  ["--version", "version"],
  ["--repo", "repo"],
  ["--workflow", "workflow"],
  ["--manifest", "manifest"],
  ["--log", "log"],
  ["--exit-code", "exitCode"],
]);

/** Options plus the command after `--`. Throws on an unknown flag or missing value. */
export function parseArgs(argv) {
  const opts = {};
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index];
    if (arg === "--") return { opts, command: argv.slice(index + 1) };
    const key = VALUE_FLAGS.get(arg);
    if (key === undefined) throw new Error(`unknown argument: ${arg}`);
    const value = argv[index + 1];
    if (value === undefined || value === "") throw new Error(`${arg} needs a value`);
    opts[key] = value;
    index += 2;
  }
  return { opts, command: null };
}

function usage(message) {
  process.stderr.write(
    `${TAG}: ${message}\n` +
      "usage: node cli/publish-auth-hint.mjs --package <name> [--version <V>] [--repo <owner/repo>]\n" +
      "         [--workflow <file>] [--manifest <package.json>] -- <cmd> [args...]\n" +
      "       node cli/publish-auth-hint.mjs --package <name> --log <file> [--exit-code <n>]\n",
  );
  // exitCode, not process.exit (the release-guard.mjs precedent): the CI step's
  // stderr is a PIPE, and process.exit can drop a pending write — including the
  // npm output re-emitted just before this line on a spawnSync failure.
  process.exitCode = 2;
}

function writeStderr(text) {
  if (text) process.stderr.write(text.endsWith("\n") ? text : `${text}\n`);
}

/** The hint, when and only when the verdict is a genuine authentication failure. */
function annotate(verdict, options) {
  if (verdict.verdict === "auth")
    writeStderr(formatAuthHint({ ...options, evidence: verdict.evidence }));
}

function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    return usage(err instanceof Error ? err.message : String(err));
  }
  const { opts, command } = parsed;
  if (!opts.package) return usage("--package is required (which package failed)");
  const packageName = opts.package;
  const workflow = opts.workflow ?? FALLBACK_WORKFLOW;
  const manifestRepo = repoFromManifest(resolve(opts.manifest ?? "package.json"));
  const options = {
    packageName,
    version: opts.version ?? null,
    repo: opts.repo ?? manifestRepo ?? FALLBACK_REPO,
    workflow,
  };

  if (opts.log !== undefined) {
    // Log mode: replay a saved npm error log. Offline by construction — no
    // publish, no network, no registry.
    let log;
    try {
      log = readFileSync(resolve(opts.log), "utf8");
    } catch (err) {
      return usage(`cannot read ${opts.log}: ${err instanceof Error ? err.message : String(err)}`);
    }
    writeStderr(log);
    annotate(
      classifyPublishFailure({ exitCode: Number(opts.exitCode ?? 1), stderr: log }),
      options,
    );
    return;
  }

  if (!command || command.length === 0) return usage("nothing to run: pass `-- <cmd> [args...]`");
  const program = command[0];
  const child = spawnSync(program, command.slice(1), {
    stdio: ["ignore", "inherit", "pipe"],
    encoding: "utf8",
  });
  if (child.error) {
    // spawnSync failed before the child could finish: the program is missing,
    // or npm's stderr exceeded the 1 MiB maxBuffer (ENOBUFS — the child is
    // killed and its output truncated). Re-emit whatever npm managed to write
    // before failing closed: a hidden npm error must not become a hidden
    // wrapper error. usage() keeps exit 2 and returns, so Node flushes this
    // write.
    writeStderr(child.stderr ?? "");
    return usage(`cannot run ${program}: ${child.error.message}`);
  }
  const stderr = child.stderr ?? "";
  writeStderr(stderr);
  const status = child.status ?? 1;
  annotate(classifyPublishFailure({ exitCode: status, stderr }), options);
  // exitCode, not process.exit: the CI step's stderr is a PIPE, and process.exit
  // can drop a pending write. Returning lets Node flush the hint before it goes.
  process.exitCode = status;
}

if (process.argv[1] !== undefined && process.argv[1].endsWith("publish-auth-hint.mjs")) {
  main(process.argv.slice(2));
}
