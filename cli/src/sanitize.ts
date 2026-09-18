/**
 * Display sanitizers for untrusted values interpolated into human (terminal)
 * lines. Extracted from `doctor.ts` (bug-doctor-human-output-injection F2/F3)
 * so the CLI error channel shares exactly one policy
 * (bug-cli-error-output-injection F1): a hostile repo must not be able to forge
 * a stderr/stdout line or emit a raw control sequence through a value the CLI
 * echoes back.
 *
 * All sanitizers are display only: an ordinary value renders byte-identical,
 * while the JSON payload keeps the raw, uncapped value. Escaping covers C0
 * controls (ESC, BEL, newline, ...), DEL and the C1 block
 * (U+007F–U+009F — the 8-bit CSI/OSC introducers) and the Unicode
 * line/paragraph separators (U+2028/29). Bidi/zero-width format characters are
 * deliberately OUT of scope: they cannot emit a control sequence or forge a
 * line.
 */

/**
 * Raw-length cap for one untrusted report value on a human line (F3,
 * bug-doctor-human-output-injection): a hostile config key or remote URL can
 * be arbitrarily long, so the value is clipped to this many characters plus
 * an ellipsis before escaping. Escaping adds at most 6x, so the rendered
 * value stays bounded; the JSON payload always keeps the raw value.
 */
export const MAX_HUMAN_VALUE_CHARS = 200;

/**
 * Raw-length cap for a whole human error line (F1,
 * bug-cli-error-output-injection): error messages are composite diagnostics
 * (`<path>: <reason>`) rather than single short report values, so the tighter
 * report cap would routinely cut ordinary messages (the `start` dirty-tree
 * list, long absolute paths). 2000 bounds hostile output while keeping
 * realistic diagnostics readable; on truncation the `--json` envelope still
 * carries the full message.
 */
export const MAX_HUMAN_ERROR_CHARS = 2000;

/** Fast path for ordinary config keys: no escaping or quoting needed. */
const HUMAN_SAFE_TOKEN = /^[A-Za-z0-9._-]+$/;

/**
 * Code points that must never reach a terminal raw. `JSON.stringify` already
 * escapes C0, quotes and backslashes; `HUMAN_UNSAFE` catches the rest.
 */
const HUMAN_UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

function escapeUnsafeCodePoint(ch: string): string {
  return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
}

/**
 * Clip one untrusted value to `maxChars`; never split a surrogate pair at the
 * cut. The ellipsis is added after the cut, so the raw result is at most
 * `maxChars + 1` characters.
 */
function clipHumanValue(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  let end = maxChars;
  const last = value.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1; // high surrogate: the pair would be split
  return `${value.slice(0, end)}…`;
}

/**
 * JSON-escape the body of a value (C0/quotes/backslashes → inert `\n`/
 * `\uXXXX` text) without the surrounding quotes, then escape the code points
 * `JSON.stringify` leaves raw (DEL/C1, U+2028/29). Shared by every sanitizer
 * so they cannot drift.
 */
function escapeHumanText(value: string): string {
  return JSON.stringify(value).slice(1, -1).replace(HUMAN_UNSAFE, escapeUnsafeCodePoint);
}

/**
 * Sanitize one config-key-like token for a human (terminal) line. Values on
 * the `[A-Za-z0-9._-]` allowlist — every ordinary key — render unchanged;
 * anything else is JSON-quoted and escaped (C0/DEL/C1, U+2028/29) in one
 * bounded pass, and capped at `MAX_HUMAN_VALUE_CHARS`. This is display only:
 * the JSON payload keeps the raw key.
 *
 * Takes exactly one parameter so `keys.map(sanitizeHumanValue)` (the natural
 * call in doctor) cannot smuggle the array index in as a cap.
 */
export function sanitizeHumanValue(value: string): string {
  const clipped = clipHumanValue(value, MAX_HUMAN_VALUE_CHARS);
  return HUMAN_SAFE_TOKEN.test(clipped) ? clipped : `"${escapeHumanText(clipped)}"`;
}

/**
 * Sanitize one free-text untrusted report value (root path, git remote URL,
 * error message) for a human line: these legitimately contain punctuation, so
 * printable characters pass through unchanged — JSON-quoting every ordinary
 * path would be noise — while the same unsafe code points as
 * `sanitizeHumanValue` are escaped in place. A remote carrying a newline+ESC
 * therefore renders as one inert line (`\n`, `\u001b` as literal text).
 * Capped at `MAX_HUMAN_VALUE_CHARS`; display only, the JSON payload keeps the
 * raw value.
 */
export function sanitizeHumanText(value: string): string {
  return escapeHumanText(clipHumanValue(value, MAX_HUMAN_VALUE_CHARS));
}

/**
 * Sanitize a whole CLI failure message for the human stderr line (F1,
 * bug-cli-error-output-injection): same escaping as `sanitizeHumanText`, but
 * with the larger `MAX_HUMAN_ERROR_CHARS` raw cap because messages are
 * composite diagnostics. Display only: the `--json` `error.message` keeps the
 * raw text, byte for byte.
 */
export function sanitizeHumanError(message: string): string {
  return escapeHumanText(clipHumanValue(message, MAX_HUMAN_ERROR_CHARS));
}

/**
 * Escape-only sanitizer for the row/table human channels (list/show/report/
 * playbook status/spec audit/adopt/tui; task-row-table-stdout-sanitize): the
 * same unsafe code points as every sanitizer in this module (C0/DEL/C1,
 * U+2028/29) are escaped in place, but printable characters — including `"`
 * and `\`, which `sanitizeHumanText` re-escapes for its JSON-quoted contexts —
 * pass through unchanged, and there is NO length cap.
 *
 * Cap decision (deliberate, documented on the task): those channels render
 * repository content whose size is already bounded by the on-disk file, and
 * byte-identity for ordinary values is the display contract. The 200-char
 * report cap would clip ordinary long titles/`blocked_reason` prose and TUI
 * cards; a table cell is not a diagnostic value. The TUI additionally clips
 * each rendered line to the terminal width, so a hostile mega-title cannot
 * flood the screen there. Display only: the `--json` payload keeps the raw
 * value byte for byte.
 *
 * Note the rendering difference from `sanitizeHumanText`: without the
 * JSON.stringify pass every C0 code point renders as `\uXXXX` (a newline is
 * `\u000a`, not `\n`). Both forms are inert one-line text; this one keeps
 * printable `"`/`\` intact, which is the point here.
 */
export function sanitizeHumanTextUncapped(value: string): string {
  return value.replace(HUMAN_UNSAFE, escapeUnsafeCodePoint);
}
