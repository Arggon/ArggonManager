import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  fstatSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { worktreeStateBase } from "./worktree.js";

/**
 * Adopter friction capture — stage 1 of ADR 0024, plan task T1 of
 * spec-friction-capture-020.
 *
 * `arggon friction "<observation>" --command <shape>` appends exactly ONE
 * record to a local, append-only JSONL log outside the work tracker:
 *
 *   <stateBase>/arggon/friction.jsonl
 *
 * `stateBase` honors `ARGGON_STATE_DIR` (the ADR 0019 worktree env contract,
 * spec-worktree-env-contract-016) and otherwise resolves per-OS through the
 * SAME `worktreeStateBase` mapping the contract uses (`XDG_STATE_HOME` /
 * `~/.local/state` on Linux, `~/Library/Application Support` on macOS,
 * `%LOCALAPPDATA%` on Windows). The kernel invents no new scheme: the per-OS
 * base is the established one, re-exported from `worktree.ts`.
 *
 * THE LOG IS NOT THE TRACKER. It lives outside the repo, is never staged,
 * never committed, never visible to `arggon validate`, and cannot become a
 * task by accident. The tracker mutation lock does not apply to it.
 *
 * Capture is local and offline by construction: one file write, no network
 * request, no `gh`, no auth, no token, no session — the only outbound anything
 * is a tier-B URL a HUMAN opens, which is stage 2 work (plan T4).
 *
 * Redaction (plan T2) lives IN this module, on the write path: every field a
 * caller can put arbitrary bytes into is redacted BEFORE it is capped and
 * before the line is persisted, so no unredacted byte exists on disk for a
 * renderer — or a later `--report` bug — to leak. T1 owns the caps, the
 * normalization and the append discipline; the redaction pass composes with
 * them: normalize → redact → cap → append.
 */

/** The format version every record carries; readers skip an unknown `v`. */
export const FRICTION_FORMAT_VERSION = 1;

/** Rotation bound: past this many lines the oldest are dropped on write. */
export const FRICTION_MAX_LINES = 5000;

/** The log file name under `<stateBase>/arggon/`. */
export const FRICTION_LOG_FILE_NAME = "friction.jsonl";

/** The per-machine salt file name under `<stateBase>/arggon/`. */
export const FRICTION_SALT_FILE_NAME = "machine-salt";

/**
 * The rotation-drop counter file name under `<stateBase>/arggon/`
 * (task-friction-dedupe-and-report, plan T3). Rotation physically REMOVES the
 * oldest lines, so the surviving log cannot tell a later reader how much
 * history was lost; this sidecar makes that drop observable so `--report` can
 * render `dropped: N` (spec §Limits: "the drop is reported by the next
 * --report"). The cap and the drop themselves stay owned by the capture task
 * (T1); this file is only the cumulative counter the report reads — the writer
 * increments it at the rotation site, `--report` (and a future `--clear`)
 * reads/resets it. A sidecar, not a line in the JSONL: `readFrictionLog` counts
 * a non-record line as `malformed`, and the log-is-not-the-tracker discipline
 * keeps it a plain data file beside the log.
 */
export const FRICTION_DROPPED_FILE_NAME = "friction.dropped";

/** Placeholder every normalized commandShape value collapses to. */
const SHAPE_PLACEHOLDER = "<arg>";

/** One complete JSONL line: the serialized record plus its terminator. */
const NEWLINE = "\n";
/** The truncation marker; counts against the cap. */
const MARKER = "…";

/** Lone/unpaired surrogates only — a valid pair is one astral code point. */
const LONE_SURROGATE = /\p{Cs}/gu;

/** Absent optional values (errorCode, evidence) serialize as this. */
const ABSENT = "";

// ---------------------------------------------------------------------------
// Caps (spec §The record) — a capped field is truncated, never silently dropped
// ---------------------------------------------------------------------------

/** `commandShape` cap (spec table). */
export const FRICTION_COMMAND_SHAPE_CAP = 200;
/** `errorCode` cap (spec table). */
export const FRICTION_ERROR_CODE_CAP = 64;
/** `harness` cap (spec table). */
export const FRICTION_HARNESS_CAP = 32;
/** `narrative` cap (spec table). */
export const FRICTION_NARRATIVE_CAP = 2000;
/** `evidence` cap (spec table: file CONTENTS, never a path). */
export const FRICTION_EVIDENCE_CAP = 4000;
/** `arggonVersion` / `os` / `arch` / `node` cap (spec table: "each capped"). */
export const FRICTION_ENV_FACT_CAP = 64;

/** Fingerprint length in hex chars (spec table). */
export const FRICTION_FINGERPRINT_CHARS = 16;
/** `reporterId` length in hex chars (spec table). */
export const FRICTION_REPORTER_ID_CHARS = 12;

/** `machineSalt` length in random bytes (spec table: 32 random bytes). */
export const FRICTION_SALT_BYTES = 32;

/** The state-dir subdirectory every friction artifact lives under. */
export const FRICTION_STATE_SUBDIR = "arggon";

/** Default `harness` when the caller names none (spec table). */
export const FRICTION_DEFAULT_HARNESS = "unknown";

// ---------------------------------------------------------------------------
// commandShape normalization
// ---------------------------------------------------------------------------

/** One argv token's classification: kept verbatim, or collapsed to a placeholder. */
const enum ShapeTokenKind {
  Keep,
  Value,
}

/** `--flag`, `--flag=value`, `-f` pass through. */
const FLAG_TOKEN = /^--?[A-Za-z][\w-]*(=\S*)?$/;

/**
 * Values: ids, paths, URLs, tokens and SHAs.
 *
 * Deliberately permissive on the shape side (a value is anything that is not a
 * flag and not a plain word) and deliberately narrow on the plain-word side, so
 * a subcommand (`report`, `spec`, `analyze`) or a meaningful enum value
 * (`table`, `markdown`, `in_progress`, `p1`) survives and the fingerprint
 * groups by class rather than by instance.
 */
const VALUE_TOKENS: readonly RegExp[] = [
  // Anything path/URL-shaped: absolute or relative POSIX, Windows, MSYS,
  // `owner/repo`, `scheme://host`, `git@host:path`.
  /[/\\]/,
  // Dotted bare names (v1.2.3, tsconfig.json, 0.6.0).
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/,
  // SHAs and long hex blobs, full or truncated.
  /^[0-9a-f]{7,64}$/i,
  // Opaque tokens: gh[pousr]_…, sk-…, npm_…, AKIA…, JWTs.
  /^(gh[pousr]_|npm_|sk-|AKIA)[A-Za-z0-9_-]{8,}$/,
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/,
  // Item-shaped ids (task-x, bug-y, story-z) and any kebab-case slug. This is
  // also what collapses dates (2026-10-02) and versions (0.5.0-rc1).
  /^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)+$/,
  // ISO-shaped dates and dashed digit groups (2026-10-02, 1-2-3): instance
  // values that must not put the DATE in the fingerprint.
  /^\d+(?:-\d+){2,}$/,
];

/** The binary name a caller may prefix; the spec's own shape example omits it. */
const BINARY_TOKEN = "arggon";

/**
 * An existing placeholder token (`<id>`, `<path>`, `<url>`, `<value>`, …) is
 * normalized to THIS module's placeholder. It matters for one reason: the spec's
 * own record example reads `"commandShape": "start --worktree <id>"` and the
 * trigger text tells agents to write `--command "<argv shape>"`, so a
 * hand-written shape and a pasted argv must converge on one fingerprint.
 */
const PLACEHOLDER_TOKEN = /^<[a-z][a-z0-9-]*>$/;
/** Classify one argv token as a kept flag/subcommand or a normalized value. */
function classifyShapeToken(token: string): ShapeTokenKind {
  if (FLAG_TOKEN.test(token)) return ShapeTokenKind.Keep;
  if (PLACEHOLDER_TOKEN.test(token)) return ShapeTokenKind.Value;
  return VALUE_TOKENS.some((re) => re.test(token)) ? ShapeTokenKind.Value : ShapeTokenKind.Keep;
}

/**
 * Normalize a raw command line into the persisted `commandShape`: the
 * subcommand and its flags are kept, every value that looks like a path, id,
 * URL, token or SHA collapses to one placeholder.
 *
 * Two decisions that exist for the fingerprint's sake:
 *
 *  1. A leading `arggon` binary token is dropped, so the shape an agent writes
 *     from the trigger text (`start --worktree <id>`) and the shape it pastes
 *     from argv (`arggon start --worktree task-foo`) land on ONE fingerprint.
 *  2. A run of adjacent values collapses into one placeholder (`update task-a
 *     task-b` is one operand slot), but a trailing placeholder is KEPT.
 *
 * Idempotent: `<arg>` is a placeholder token, and a placeholder normalizes to
 * itself, so re-shaping an already-shaped string is a no-op. Plain-word values
 * that are none of the value shapes (`table`, `markdown`, `in_progress`) stay —
 * collapsing them would merge classes that differ.
 */
export function normalizeCommandShape(raw: string): string {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "");
  if (tokens[0] === BINARY_TOKEN) tokens.shift();
  const kept: string[] = [];
  for (const token of tokens) {
    if (classifyShapeToken(token) === ShapeTokenKind.Value) {
      // Collapse a run of values into one placeholder.
      if (kept[kept.length - 1] === SHAPE_PLACEHOLDER) continue;
      kept.push(SHAPE_PLACEHOLDER);
      continue;
    }
    // `--flag=value` keeps the flag and normalizes the value it was fed.
    const eq = token.indexOf("=");
    if (eq > 0 && FLAG_TOKEN.test(token.slice(0, eq))) {
      const flag = token.slice(0, eq);
      const value = token.slice(eq + 1);
      kept.push(
        `${flag}=${classifyShapeToken(value) === ShapeTokenKind.Value ? SHAPE_PLACEHOLDER : value}`,
      );
      continue;
    }
    kept.push(token);
  }
  return kept.join(" ");
}

// ---------------------------------------------------------------------------
// Bounded capping (surrogate-safe; the marker counts against the cap)
// ---------------------------------------------------------------------------

/**
 * Cap one field to `cap` UTF-16 code units, marker included.
 *
 * Surrogate-safe exactly like the handoff kernel's `capUnits`: the two guards
 * keep a written value from ever manufacturing a lone surrogate (which cannot
 * round-trip through UTF-8 — the write would emit U+FFFD).
 *
 *   1. Lone surrogates are dropped BEFORE the cut, so every valid code point
 *      the caller sent survives.
 *   2. When the cut would land between the halves of a valid pair, it backs off
 *      one unit and drops the pair whole.
 *
 * A field under its cap is returned unchanged — that is what makes the RTL/CJK
 * round-trip verbatim rather than approximately verbatim.
 */
function capField(value: string, cap: number): string {
  const clean = value.replace(LONE_SURROGATE, "");
  if (clean.length <= cap) return clean;
  let end = cap - MARKER.length;
  const last = clean.charCodeAt(end - 1);
  // High surrogate at the cut: the low half is its pair (lone surrogates were
  // dropped above), so back off to drop both.
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return clean.slice(0, end) + MARKER;
}

// ---------------------------------------------------------------------------
// Redaction (at write, never at render) — spec §Redaction (at write, not at
// render). The pass runs here, before the caps and before the append, so the
// record that reaches the log — and therefore everything a renderer can ever
// print — is already redacted: there is no "capture now, scrub later" path and
// no renderer that applies redaction.
// ---------------------------------------------------------------------------

/**
 * The canonical placeholder every cross-OS path form collapses to (spec rule
 * 1): `C:\Users\a\b`, `c:/Users/a/b`, `\\?\C:\Users\a\b`, `/c/Users/a/b` and
 * `/private/var/folders/x` all become this one token.
 */
export const FRICTION_PATH_PLACEHOLDER = "<path>";

/** The placeholder every secret-shaped span collapses to (spec rule 2). */
export const FRICTION_SECRET_PLACEHOLDER = "<redacted>";

/**
 * A field whose SECRET-shaped material exceeds 50% of the field, or that
 * needed more substitutions than the bound allows, is replaced by THIS string
 * (spec rule 4): a field that is mostly secret is not safe to publish in any
 * part. Path normalization does not count toward the rate — a `<path>`
 * placeholder is already safe to publish.
 */
export const FRICTION_REDACTED_FIELD = "[redacted: >50% of field]";

/** At most this many substitutions per field (spec rule 4). */
export const FRICTION_REDACTION_MAX_SUBSTITUTIONS = 20;

// --- Rule 1: cross-OS path normalization -----------------------------------

/**
 * Every absolute path root across Windows, MSYS and POSIX, in ONE alternation
 * so the scan is leftmost-longest, which is what makes a CHILD path replace
 * before its parent: at a given start position the longest fitting root wins,
 * so `/home/u/repo/sub/secret.txt` is replaced whole and `/home/u/repo` later
 * on cannot consume the shared prefix and orphan the child's tail.
 *
 * The three guards at the head exist for the OTHER rules:
 *
 *  - `(?![A-Za-z][A-Za-z0-9+.-]+:)` — a multi-letter scheme (`https:`) is not
 *    a one-letter drive root, so a URL survives whole for rule 3;
 *  - `(?<![\w./\\-])` — a root inside a word, after a dot or after another
 *    separator (`and/or`, `example.com//x`) is not a path start; this is also
 *    what keeps every non-initial slash of a URL out of this rule;
 *  - `(?<![A-Za-z]:)` — a slash immediately after a scheme's colon belongs to
 *    the URL, not to this rule.
 *
 * Alternatives in order: extended-length Windows roots (`\\?\C:\…`), UNC roots
 * (`\\server\share\dir`), drive roots in both slash flavors (`C:\…`, `c:/…`),
 * POSIX absolute roots and MSYS mounts (`/home/u/…`, `/c/Users/…`) and
 * home-relative roots (`~/repo`). The POSIX lookahead keeps a bare `/` and a
 * protocol-relative `//host` from matching.
 */
const PATH_PATTERN =
  /(?![A-Za-z][A-Za-z0-9+.-]+:)(?<![\w./\\-])(?<![A-Za-z]:)(?:\\\\\?\\[A-Za-z]:[/\\](?:[\w.+@%~=-]+[/\\])*[\w.+@%~=-]*|\\\\[\w.$@%?-]+(?:\\[\w.+@%~=-]+)+|[A-Za-z]:[/\\](?:[\w.+@%~=-]+[/\\])*[\w.+@%~=-]*|\/(?=[\w.+@%~=-])(?:[\w.+@%~=-]+\/)*[\w.+@%~=-]*|~(?:\/[\w.+@%~=-]+)+)/g;

// --- Rule 2: secret shapes -------------------------------------------------

/**
 * The PEM shapes, on their OWN pass ahead of the token/assignment shapes: the
 * assignment rule's value class would otherwise match `key: -----BEGIN` at an
 * EARLIER position than the block's header, and the leftmost match would
 * consume the header, leaving the key body orphaned (and unredacted) behind
 * it. Longest, most specific secret first — the same "children before
 * parents" discipline as the path rule.
 *
 * Ordered full-block-first so a complete `-----BEGIN …-----` …
 * `-----END …-----` is replaced whole; a TRUNCATED paste (no END — cut off)
 * falls to header + base64 body lines, and a bare header alone still goes,
 * because the header by itself would leave the key material behind.
 */
const PEM_PATTERN =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----|-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----(?:[ \t]*\r?\n[A-Za-z0-9+/]{20,}={0,2})+|-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g;

/**
 * The spec's token and assignment shapes. The assignment rule matches the
 * spec's `key|token|secret|password|passwd|credential` names as substrings of
 * a longer identifier (`apiKey`, `auth_token`, `client_secret`), in `=`, JSON
 * and YAML spellings, with the spec's 8+ char value threshold. The
 * `github_pat_` continuation of the GitHub family is a conservative extension
 * of the spec's `gh[pousr]_` shape — the current fine-grained PAT prefix —
 * recorded on the item.
 */
const SECRET_PATTERN =
  /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{8,}|\bnpm_[A-Za-z0-9_-]{8,}|\bAKIA[A-Za-z0-9]{8,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*|[A-Za-z0-9_.-]*(?:key|token|secret|password|passwd|credential)[A-Za-z0-9_.-]*["']?[ \t]*[:=][ \t]*(?:[^\s"'`]{8,}|["'][^"'\n]{8,}["'])/gi;

// --- Rule 3: URLs ----------------------------------------------------------

/** A scheme URL: `https://…`, `file:/…` (the slashes are part of the match). */
const URL_PATTERN = /\b[a-zA-Z][a-zA-Z0-9+.-]*:\/+[^\s]+/g;

/**
 * Rewrite one URL per spec rule 3: host preserved, query and fragment dropped.
 * Two deliberate extensions, both conservative and both recorded on the item:
 *
 *  - `user:pass@` userinfo is dropped — a credential is not the host;
 *  - a `file:` URL is a path in disguise, so the whole thing collapses to the
 *    canonical path placeholder.
 */
function redactUrl(match: string): string {
  const colon = match.indexOf(":");
  const scheme = match.slice(0, colon + 1);
  if (scheme.toLowerCase() === "file:") return FRICTION_PATH_PLACEHOLDER;
  let rest = match.slice(colon + 1).replace(/^\/+/, "");
  // Query and fragment go first: a query is where tokens ride.
  const cut = rest.search(/[?#]/);
  if (cut >= 0) rest = rest.slice(0, cut);
  // Then userinfo: everything up to the last `@` in the authority is not host.
  const slash = rest.indexOf("/");
  const authority = slash < 0 ? rest : rest.slice(0, slash);
  const at = authority.lastIndexOf("@");
  const host = at >= 0 ? authority.slice(at + 1) : authority;
  return `${scheme}//${host}${slash < 0 ? "" : rest.slice(slash)}`;
}

/** Mutable accounting for one field's pass. */
type RedactionStats = { substitutions: number; redacted: number };

/** One rule: what it matches, what replaces a match, and what counts against the rate. */
type RedactionRule = {
  pattern: RegExp;
  replace: (match: string) => string;
  /**
   * Whether this rule's redacted material counts toward the field's 50% rate.
   * Path normalization is EXEMPT: a `<path>` placeholder is already safe to
   * publish, so the wholesale rule — which exists because "a field that is
   * mostly SECRET is not safe to publish in any part" — measures secret
   * material (secret shapes and dropped URL parts), never path spans.
   */
  countsTowardRate?: boolean;
  /**
   * How much of a match counts as redacted material. The default is the whole
   * matched span; the URL rule counts only what it actually drops, because the
   * preserved host is not redacted content.
   */
  redacted?: (match: string, replacement: string) => number;
};

const REDACTION_RULES: readonly RedactionRule[] = [
  { pattern: PATH_PATTERN, replace: () => FRICTION_PATH_PLACEHOLDER, countsTowardRate: false },
  // PEM before the token/assignment shapes: see the note on PEM_PATTERN — the
  // assignment rule's leftmost match can otherwise orphan a block's body.
  { pattern: PEM_PATTERN, replace: () => FRICTION_SECRET_PLACEHOLDER },
  { pattern: SECRET_PATTERN, replace: () => FRICTION_SECRET_PLACEHOLDER },
  {
    pattern: URL_PATTERN,
    replace: redactUrl,
    redacted: (match, replacement) => match.length - replacement.length,
  },
];

/**
 * Redact one field value: the spec's four rules, in the spec's order, with the
 * spec's bound. Idempotent — every placeholder this returns is inert under the
 * rules — so the append-time guard in {@link appendFrictionRecord} re-runs the
 * pass on an already-redacted record as a no-op.
 *
 * The bound is applied where the spec applies it: a field that needs more than
 * {@link FRICTION_REDACTION_MAX_SUBSTITUTIONS} substitutions (any rule), or
 * whose SECRET material exceeds half of the field, is replaced WHOLESALE —
 * skipping the 21st substitution would leak it.
 */
export function redactFrictionText(value: string): string {
  if (value === "") return value;
  const stats: RedactionStats = { substitutions: 0, redacted: 0 };
  let text = value;
  for (const rule of REDACTION_RULES) {
    const measure = rule.redacted ?? ((match: string) => match.length);
    const countsTowardRate = rule.countsTowardRate ?? true;
    text = text.replace(rule.pattern, (match) => {
      const replacement = rule.replace(match);
      if (replacement === match) return match; // already clean: not a substitution
      stats.substitutions += 1;
      if (countsTowardRate) stats.redacted += measure(match, replacement);
      return replacement;
    });
  }
  if (
    stats.substitutions > FRICTION_REDACTION_MAX_SUBSTITUTIONS ||
    stats.redacted * 2 > value.length
  ) {
    return FRICTION_REDACTED_FIELD;
  }
  return text;
}

/**
 * Re-apply the pass to a whole record. The write path redacts inside
 * {@link buildFrictionRecord} (before the caps, so a secret that straddles a
 * cap boundary is redacted whole rather than cut into a fragment no rule can
 * recognize); this second, idempotent application is what makes the log-level
 * invariant structural rather than procedural — an append is where bytes land
 * on disk, so a record that did NOT come from the builder (a test, a future
 * caller) cannot smuggle an unredacted field into the log.
 *
 * Only the caller-supplied free-text surfaces are covered; `v`, `ts`,
 * `fingerprint`, `reporterId`, `arggonVersion`, `os`, `arch`, `node` and
 * `majorVersion` are kernel-owned or derived, never arbitrary caller bytes.
 */
function redactFrictionRecord(record: FrictionRecord): FrictionRecord {
  return {
    ...record,
    commandShape: redactFrictionText(record.commandShape),
    ...(record.errorCode !== undefined ? { errorCode: redactFrictionText(record.errorCode) } : {}),
    harness: redactFrictionText(record.harness),
    narrative: redactFrictionText(record.narrative),
    ...(record.evidence !== undefined ? { evidence: redactFrictionText(record.evidence) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Fingerprint / reporterId
// ---------------------------------------------------------------------------

/** One hash helper, so the two derivations cannot drift. */
function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * The fingerprint's pre-image: every component **length-prefixed**, then
 * concatenated with no separator.
 *
 * WHY a length prefix and not a separator — the decision recorded for
 * task-friction-fingerprint-separator-not-length-prefixed (spec
 * §Fingerprint discipline). The first implementation joined the four stable
 * fields with U+001F, which stops the ORDINARY collision (a field containing a
 * space or a dash cannot shift a boundary) but is ambiguous by construction,
 * because a separator delimits by VALUE: `(a, US‖b, c, d)` and `(a‖US, b, c, d)`
 * encode to byte-identical material, so a `--command` carrying U+001F could
 * forge another tuple's digest. A length prefix delimits by COUNT instead, and
 * the parse of an encoded string is therefore deterministic — read the digits,
 * consume exactly that many characters — so no second tuple can encode to the
 * same material. Injective over tuples: only a hash collision can still merge
 * two classes, which is the honest boundary of a truncated digest.
 *
 * The length is UTF-16 code units: the unit `String.prototype.length` counts,
 * and the unit `capField` truncates in, so the prefix describes the value that
 * is actually hashed rather than an estimate of it. An empty component encodes
 * as `0:` and stays unambiguous next to the digits that follow it.
 *
 * Exported so the injective-encoding property can be asserted on the pre-image
 * itself — exactly, with no 16-hex truncation in the way.
 */
export function frictionFingerprintMaterial(components: readonly string[]): string {
  return components.map((component) => `${component.length}:${component}`).join("");
}

/**
 * `sha256` over the length-prefixed stable fields (see
 * {@link frictionFingerprintMaterial}) hex, truncated to 16 chars. NEVER derived
 * from `narrative`: an LLM-authored sentence is exactly the frequently-changing
 * value that produces bad groups (Sentry's `{{ error.value }}` rule) — two
 * observations with the same stable fields are the same class even if the prose
 * differs, and two with different error codes are not, however similar the
 * prose.
 *
 * The pre-image is injective over tuples, so a field value — including one
 * that carries the old U+001F separator — cannot forge a different tuple's
 * digest. `arggonVersion` feeds in as its major version only, so `0.6.0` and
 * `0.6.1` are one class and `0.x` and `1.x` are two.
 */
export function frictionFingerprint(args: {
  commandShape: string;
  /** Absent (no `--error`) hashes as the empty string. */
  errorCode: string | undefined;
  harness: string;
  majorVersion: string;
}): string {
  return sha256Hex(
    frictionFingerprintMaterial([
      args.commandShape,
      args.errorCode ?? ABSENT,
      args.harness,
      args.majorVersion,
    ]),
  ).slice(0, FRICTION_FINGERPRINT_CHARS);
}

/**
 * `sha256(machineSalt ‖ repoAbsPath)` hex, truncated to 12 chars. Identifies
 * "same machine, same repo" and never WHICH repo. The salt is 32 random bytes
 * generated once in the state dir and never leaves it.
 *
 * Unlike the fingerprint, this concatenation needs no length prefix: the salt is
 * fixed-width — exactly 64 hex chars, enforced by `SALT_HEX` — so where the salt
 * ends and the path begins is never in doubt.
 */
export function frictionReporterId(machineSalt: string, repoAbsPath: string): string {
  return sha256Hex(machineSalt + repoAbsPath).slice(0, FRICTION_REPORTER_ID_CHARS);
}

/** `0.6.0` → `0`; `1.2.3` → `1`; a non-numeric prefix → `unknown`. */
export function frictionMajorVersion(version: string): string {
  const first = version.trim().replace(/^v/, "").split(".")[0] ?? "";
  return /^\d+$/.test(first) ? first : "unknown";
}

// ---------------------------------------------------------------------------
// State base, log path and the machine salt
// ---------------------------------------------------------------------------

/**
 * The friction state base: `ARGGON_STATE_DIR` when set (the worktree env
 * contract), otherwise the established per-OS state base.
 *
 * Reuses `worktreeStateBase` rather than re-deriving the platform mapping —
 * the friction log must resolve exactly where the contract's `ARGGON_STATE_DIR`
 * points when a worktree session exports it, and where the same per-OS base
 * points otherwise. A second mapping would be a second thing to keep correct.
 */
export function frictionStateBase(env: NodeJS.ProcessEnv, home: string): string {
  const override = env.ARGGON_STATE_DIR?.trim();
  return override !== undefined && override !== "" ? override : worktreeStateBase(env, home);
}

/** `<stateBase>/arggon` — the directory every friction artifact lives in. */
export function frictionStateDir(env: NodeJS.ProcessEnv, home: string): string {
  return join(frictionStateBase(env, home), FRICTION_STATE_SUBDIR);
}

/** `<stateBase>/arggon/friction.jsonl` — the append-only log. */
export function frictionLogPath(env: NodeJS.ProcessEnv, home: string): string {
  return join(frictionStateDir(env, home), FRICTION_LOG_FILE_NAME);
}

/** `<stateBase>/arggon/machine-salt` — 32 random bytes, never leaves the dir. */
export function frictionSaltPath(env: NodeJS.ProcessEnv, home: string): string {
  return join(frictionStateDir(env, home), FRICTION_SALT_FILE_NAME);
}

/**
 * `<stateBase>/arggon/friction.dropped` — the cumulative rotation-drop counter
 * `--report` renders. Derivable from the log path too (it lives in the same
 * dir); the env/home form matches the other readers.
 */
export function frictionDroppedPath(env: NodeJS.ProcessEnv, home: string): string {
  return join(frictionStateDir(env, home), FRICTION_DROPPED_FILE_NAME);
}

/**
 * The cumulative lines rotation has dropped so far, or `0` when there is no
 * counter yet (a log that never rotated, or a fresh `--clear`d one). Tolerant:
 * a missing, blank or non-integer file reads as `0` — a counter the report
 * cannot parse must not fail the read, exactly like the log reader tolerates a
 * bad line.
 */
export function readFrictionDropped(droppedPath: string): number {
  let raw: string;
  try {
    raw = readFileSync(droppedPath, "utf8").trim();
  } catch {
    return 0; // no counter: nothing has been dropped (or the file is unreadable)
  }
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/**
 * Add `add` to the cumulative rotation-drop counter beside `dir` (the log's
 * directory). Best-effort and idempotent-by-read: it reads the current value,
 * adds, and rewrites one small file. A rotate already wrote the log atomically,
 * so this write is metadata — it must not turn a successful capture into a
 * `log-unwritable` failure, and it swallows its own error for exactly that
 * reason. The next `persistFrictionDropped` re-reads whatever is on disk, so a
 * swallow degrades to an under-counted `dropped`, never a corrupt counter.
 */
function persistFrictionDropped(dir: string, add: number): void {
  try {
    const path = join(dir, FRICTION_DROPPED_FILE_NAME);
    writeFileSync(path, `${readFrictionDropped(path) + add}\n`, "utf8");
  } catch {
    // Metadata only: the log is already safely rotated. Leave the counter as-is.
  }
}

/** A salt is exactly `FRICTION_SALT_BYTES` bytes of hex; anything else is not ours. */
const SALT_HEX = /^[0-9a-f]{64}$/;

/** First line of an error, for a bounded best-effort message. */
function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "unknown error";
}

/** A named friction failure: the reason a machine acts on, plus the path when one is involved. */
export class FrictionError extends Error {
  readonly reason: FrictionFailureReason;
  /** The path the failure names, when the failure is about a path. */
  readonly path?: string;

  constructor(reason: FrictionFailureReason, message: string, path?: string) {
    super(message);
    this.name = "FrictionError";
    this.reason = reason;
    if (path !== undefined) this.path = path;
  }
}

/** Every non-happy path names its reason (spec §Observability). */
export type FrictionFailureReason =
  | "no-observation"
  | "no-command-shape"
  | "log-unwritable"
  | "evidence-unreadable"
  | "report-and-capture-mutually-exclusive";

/** `mkdir -p` one directory, naming it on failure. */
function mkdirP(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    throw new FrictionError(
      "log-unwritable",
      `could not create the friction state directory ${dir}: ${errorMessage(error)}`,
      dir,
    );
  }
}

/**
 * Read the per-machine salt, generating and persisting it once when absent.
 *
 * `wx` (fail-if-exists) is the never-overwrite guarantee made race-safe: a
 * second writer that loses the creation race re-reads the winner's salt rather
 * than overwriting it, so one machine keeps exactly one salt. The file is
 * `0600` — it is the only secret-shaped byte on this path and it never leaves
 * the state dir, never reaches a record, never reaches the envelope.
 */
export function readOrCreateMachineSalt(saltPath: string): string {
  try {
    const existing = readFileSync(saltPath, "utf8").trim();
    if (SALT_HEX.test(existing)) return existing;
  } catch {
    // Missing or unreadable: fall through and create it.
  }
  const salt = randomBytes(FRICTION_SALT_BYTES).toString("hex");
  mkdirP(join(saltPath, ".."));
  try {
    const fd = openSync(saltPath, "wx", 0o600);
    try {
      writeSync(fd, salt + NEWLINE, 0, "utf8");
    } finally {
      closeSync(fd);
    }
    return salt;
  } catch (error) {
    // Lost the creation race (or a directory is squatting on the path): the
    // winner's salt is the one both writers must use.
    try {
      const existing = readFileSync(saltPath, "utf8").trim();
      if (SALT_HEX.test(existing)) return existing;
    } catch {
      // fall through to the failure below
    }
    throw new FrictionError(
      "log-unwritable",
      `could not create the per-machine friction salt at ${saltPath}: ${errorMessage(error)}`,
      saltPath,
    );
  }
}

/**
 * The absolute repo path `reporterId` is bound to: the git work tree's top
 * level when there is one, else the resolved cwd. Non-git trees are a
 * first-class arggon deployment, so a missing git is degradation, never a
 * failure. Bounded by `timeout` because this is one spawn on a write path.
 */
export function resolveRepoAbsPath(cwd: string): string {
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    if (top !== "") return resolve(top);
  } catch {
    // No git, no commits, or git hung: fall back to the resolved cwd.
  }
  return resolve(cwd);
}

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

/**
 * One persisted friction record (spec §The record), in the documented key
 * order. `v` is the format version a reader gates on; `ts` is ISO-8601 UTC
 * from the kernel clock; the stable structured fields feed `fingerprint`; the
 * narrative is data, never an instruction, and is NEVER hashed.
 */
export type FrictionRecord = {
  v: number;
  ts: string;
  fingerprint: string;
  reporterId: string;
  commandShape: string;
  errorCode?: string;
  harness: string;
  arggonVersion: string;
  majorVersion: string;
  os: string;
  arch: string;
  node: string;
  narrative: string;
  evidence?: string;
};

/** What a caller supplies; everything else is derived or read from the host. */
export type FrictionInput = {
  /** Required free text, capped 2000. Empty is `no-observation`. */
  observation: string;
  /** Required argv shape, capped 200. Empty is `no-command-shape`. */
  command: string;
  /** Optional `error.code` from the envelope the agent already holds. */
  error?: string;
  /** Optional harness id; `unknown` when absent. */
  harness?: string;
  /** Optional file whose CONTENTS (never its path) are captured, capped 4000. */
  evidencePath?: string;
};

/** Injectable seams (tests; every default is the real production behavior). */
export type FrictionOptions = {
  cwd: string;
  /** This arggon version (the CLI passes `arggonVersion()`; the kernel owns no manifest read). */
  version: string;
  /** Clock override for deterministic output/tests; defaults to now. */
  now?: Date;
  /** Environment for the state-base resolution; defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Home override for the state-base resolution; defaults to `os.homedir()`. */
  home?: string;
  /** Salt override so a test can pin a machine identity without the state dir. */
  machineSalt?: string;
  /** Repo path override so a test need not spawn git. */
  repoAbsPath?: string;
};

/** Read one evidence file's contents, bounded: never more than the cap's worth of bytes. */
const EVIDENCE_READ_BYTES = 16 * 1024;

function readEvidenceContents(path: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const size = fstatSync(fd).size;
    // Cap the READ, not just the store: a 4 GB log must not land in memory.
    const want = Math.min(size, EVIDENCE_READ_BYTES);
    const buffer = Buffer.allocUnsafe(want);
    const read = readSync(fd, buffer, 0, want, 0);
    return buffer.toString("utf8", 0, read);
  } catch (error) {
    throw new FrictionError(
      "evidence-unreadable",
      `could not read the --evidence file ${path}: ${errorMessage(error)}`,
      path,
    );
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Closing a descriptor we already failed on: nothing to recover.
      }
    }
  }
}

/**
 * Build the record for one capture: shape normalized, redacted, capped, and
 * fingerprint / reporterId derived from the stable fields only. Redaction runs
 * HERE, before the caps (a secret straddling a cap boundary must be redacted
 * whole, not cut into a fragment no rule can recognize) and before anything is
 * persisted — so the record this returns, and the line
 * {@link appendFrictionRecord} writes, is already redacted. Pure apart from
 * the two reads it names (`--evidence`, and the salt through
 * {@link readOrCreateMachineSalt}) — no write happens here, so a caller can
 * inspect a record before persisting.
 */
export function buildFrictionRecord(input: FrictionInput, opts: FrictionOptions): FrictionRecord {
  const observation = input.observation.replace(LONE_SURROGATE, "").trim();
  if (observation === "") {
    throw new FrictionError(
      "no-observation",
      'arggon friction requires an observation: friction "<one line about what broke>" --command "<argv shape>"',
    );
  }
  const commandShape = normalizeCommandShape(input.command);
  if (commandShape === "") {
    throw new FrictionError(
      "no-command-shape",
      'arggon friction requires --command "<argv shape>" (the command that failed; pass "help" if you cannot name it)',
    );
  }
  const env = opts.env ?? process.env;
  const home = opts.home ?? homedir();
  const stateDir = frictionStateDir(env, home);
  // `mkdir -p` before anything is written into the state dir: the salt is the
  // first artifact, so an unwritable state root must fail here with the named
  // path rather than deeper in the append.
  try {
    mkdirSync(stateDir, { recursive: true });
  } catch (error) {
    throw new FrictionError(
      "log-unwritable",
      `could not create the friction state directory ${stateDir}: ${errorMessage(error)}`,
      stateDir,
    );
  }
  const machineSalt =
    opts.machineSalt ?? readOrCreateMachineSalt(join(stateDir, FRICTION_SALT_FILE_NAME));
  const version = opts.version.trim() === "" ? "unknown" : opts.version;
  const majorVersion = frictionMajorVersion(version);
  // An absent, empty or whitespace-only error code is ABSENT — it hashes as the
  // empty string and never rides in the record. Anything else is redacted and
  // then capped (redaction FIRST, so a secret that straddles the cap boundary
  // is redacted whole rather than cut into a fragment no rule can recognize).
  const errorTrimmed = input.error?.trim();
  const errorCode =
    errorTrimmed === undefined || errorTrimmed === ""
      ? undefined
      : capField(redactFrictionText(errorTrimmed), FRICTION_ERROR_CODE_CAP);
  const harness = capField(
    redactFrictionText(input.harness?.trim() || FRICTION_DEFAULT_HARNESS),
    FRICTION_HARNESS_CAP,
  );
  const commandShapeCapped = capField(redactFrictionText(commandShape), FRICTION_COMMAND_SHAPE_CAP);
  const narrative = capField(redactFrictionText(observation), FRICTION_NARRATIVE_CAP);
  const evidence = input.evidencePath
    ? capField(redactFrictionText(readEvidenceContents(input.evidencePath)), FRICTION_EVIDENCE_CAP)
    : undefined;
  const ts = (opts.now ?? new Date()).toISOString();
  return {
    v: FRICTION_FORMAT_VERSION,
    ts,
    fingerprint: frictionFingerprint({
      commandShape: commandShapeCapped,
      errorCode,
      harness,
      majorVersion,
    }),
    reporterId: frictionReporterId(machineSalt, opts.repoAbsPath ?? resolveRepoAbsPath(opts.cwd)),
    commandShape: commandShapeCapped,
    ...(errorCode !== undefined ? { errorCode } : {}),
    harness,
    arggonVersion: capField(version, FRICTION_ENV_FACT_CAP),
    majorVersion,
    os: capField(process.platform, FRICTION_ENV_FACT_CAP),
    arch: capField(process.arch, FRICTION_ENV_FACT_CAP),
    node: capField(process.version, FRICTION_ENV_FACT_CAP),
    narrative,
    ...(evidence !== undefined ? { evidence } : {}),
  };
}

// ---------------------------------------------------------------------------
// The append: ONE write() of a complete record, under O_APPEND
// ---------------------------------------------------------------------------

/** What one append reports back (the log is never re-read to describe itself). */
export type FrictionAppendResult = {
  /** Absolute log path the record landed in. */
  path: string;
  /** Lines the log holds after this write. */
  lines: number;
  /** Lines rotation dropped on this write (0 unless the bound was crossed). */
  dropped: number;
};

/**
 * Append one record to the log, creating the state dir `mkdir -p` on the way.
 * The record is passed through the (idempotent) redaction guard first: an
 * append is where bytes land on disk, so the log-level invariant — what lands
 * in `<stateBase>/arggon/friction.jsonl` is already redacted — holds for every
 * caller, not only for records that came from {@link buildFrictionRecord}.
 *
 * The append itself is ONE `write()` of a complete, newline-terminated record
 * on an `O_APPEND` descriptor, which is what makes two concurrent writers in
 * two worktrees interleave at line granularity and never mid-record: the kernel
 * positions an `O_APPEND` write at the current end atomically with the write.
 * A record short enough for one `write()` is therefore whole or absent, never
 * torn (`POSIX` guarantees a single `write()` to a regular file is not
 * interleaved with another's).
 *
 * Rotation is a different transaction: past {@link FRICTION_MAX_LINES} lines the
 * oldest are dropped ON WRITE, through a temp file plus one `rename()` (atomic
 * on POSIX) that already contains the new record — so the rotation never
 * exposes a truncate window either.
 */
export function appendFrictionRecord(
  record: FrictionRecord,
  logPath: string,
): FrictionAppendResult {
  const dir = join(logPath, "..");
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    throw new FrictionError(
      "log-unwritable",
      `could not create the friction log directory ${dir}: ${errorMessage(error)}`,
      dir,
    );
  }
  const line = `${JSON.stringify(redactFrictionRecord(record))}${NEWLINE}`;
  const existing = readLogLines(logPath);
  // A crashed writer can leave a partial trailing line with no terminator. The
  // next append must NOT glue its own record onto that fragment: one `write()`
  // under O_APPEND would produce a single unparsable line and silently destroy
  // BOTH the fragment and the new record. Terminating the fragment first keeps
  // every record a reader can already parse parseable, and the fragment itself
  // ends up counted as malformed rather than silently eating the next capture.
  const terminate = logEndsPartial(logPath);
  let fd: number | undefined;
  try {
    fd = openSync(logPath, "a", 0o600);
    if (terminate) writeSync(fd, NEWLINE, null, "utf8");
  } catch {
    // Fall through to the append, which names the failure with the path.
  }
  if (existing.length + 1 > FRICTION_MAX_LINES) {
    // Rotation: keep the newest (bound - 1) lines and append the new record in
    // the same atomic rename, so the log never exceeds the bound and the drop
    // is reported rather than silent.
    const kept = existing.slice(existing.length + 1 - FRICTION_MAX_LINES);
    const rotated = `${kept.map((entry) => entry + NEWLINE).join("")}${line}`;
    try {
      writeFileSync(logPath, rotated, "utf8");
    } catch (error) {
      throw new FrictionError(
        "log-unwritable",
        `could not rotate the friction log at ${logPath}: ${errorMessage(error)}`,
        logPath,
      );
    }
    // Persist the cumulative drop so a LATER `--report` — a separate process
    // that cannot see what rotation removed — can render `dropped: N`. This is
    // additive to the cap (which stays T1's): it records the count, it does not
    // decide it. Best-effort: the rotation above already succeeded, so a
    // failing counter write must not fail the capture (T3 reviewer note N6b);
    // the log stays correct either way and only the reported count is stale.
    persistFrictionDropped(dir, existing.length - kept.length);
    return { path: logPath, lines: kept.length + 1, dropped: existing.length - kept.length };
  }
  if (fd === undefined) {
    throw new FrictionError(
      "log-unwritable",
      `could not append to the friction log at ${logPath}: the log could not be opened`,
      logPath,
    );
  }
  try {
    // `null` position = "the current position", which on an O_APPEND descriptor
    // is the end of file at write time; the mode 0o600 applies on creation.
    writeSync(fd, line, null, "utf8");
  } catch (error) {
    throw new FrictionError(
      "log-unwritable",
      `could not append to the friction log at ${logPath}: ${errorMessage(error)}`,
      logPath,
    );
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Nothing to recover from a close failure on a descriptor we are done with.
      }
    }
  }
  return { path: logPath, lines: existing.length + 1, dropped: 0 };
}

/** The log's existing lines, without terminators; `[]` when there is no log yet. */
function readLogLines(logPath: string): string[] {
  if (!existsSync(logPath)) return [];
  let raw: string;
  try {
    raw = readFileSync(logPath, "utf8");
  } catch {
    // Unreadable but present: the append below surfaces a named failure rather
    // than silently succeeding against a file it could not observe.
    return [];
  }
  if (raw === "") return [];
  const lines = raw.split(NEWLINE);
  // A trailing terminator leaves one empty element; a mid-line crash leaves a
  // partial record, which rotation drops and the append path never resurrects.
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * True when the log's last line has no terminator — the partial line a crashed
 * writer leaves behind. Only a NON-EMPTY log can end partial, so a log that
 * does not exist yet (or is empty, which this writer never produces) is false.
 */
function logEndsPartial(logPath: string): boolean {
  if (!existsSync(logPath)) return false;
  let raw: string;
  try {
    raw = readFileSync(logPath, "utf8");
  } catch {
    return false; // the append below names the failure instead
  }
  return raw !== "" && !raw.endsWith(NEWLINE);
}

// ---------------------------------------------------------------------------
// The reader: skip an unknown `v` rather than failing the file
// ---------------------------------------------------------------------------

/** What a tolerant read reports (spec §Persistence / migration / rollback). */
export type FrictionLogRead = {
  /** Every record this reader understands, in file order. */
  records: FrictionRecord[];
  /** Format versions seen and skipped — the reader's own honesty field. */
  skippedVersions: number[];
  /** Lines that carried no parsable JSON object at all. */
  malformed: number;
};

/**
 * Read the log tolerantly: a record whose `v` this reader does not know is
 * SKIPPED (and reported) rather than failing the whole file, so a newer arggon
 * and an older one can share one log without either losing what it understands.
 * A non-object or non-numeric `v` line counts as malformed, not a skipped
 * version — an unreadable line is not a future format.
 */
export function readFrictionLog(logPath: string): FrictionLogRead {
  const out: FrictionLogRead = { records: [], skippedVersions: [], malformed: 0 };
  if (!existsSync(logPath)) return out;
  let raw: string;
  try {
    raw = readFileSync(logPath, "utf8");
  } catch {
    return out; // unreadable: nothing to decide, nothing to fail over
  }
  for (const line of raw.split(NEWLINE)) {
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      out.malformed += 1;
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) {
      out.malformed += 1;
      continue;
    }
    const v = (parsed as { v?: unknown }).v;
    if (typeof v !== "number" || !Number.isFinite(v)) {
      out.malformed += 1;
      continue;
    }
    if (v !== FRICTION_FORMAT_VERSION) {
      if (!out.skippedVersions.includes(v)) out.skippedVersions.push(v);
      continue;
    }
    const candidate = parsed as FrictionRecord;
    if (typeof candidate.ts !== "string" || typeof candidate.fingerprint !== "string") {
      out.malformed += 1;
      continue;
    }
    out.records.push(candidate);
  }
  return out;
}
