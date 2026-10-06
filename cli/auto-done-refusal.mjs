#!/usr/bin/env node
/**
 * auto-done refusal classifier: is a refused `arggon update --status done` the
 * EXPECTED done-gate refusal, or an unexpected failure?
 *
 * Why this exists as code rather than a `grep` in the workflow
 * (bug-done-gate-counts-checkboxes-inside-comment-blocks, review finding 1):
 * `.github/workflows/auto-done.yml` classified refusals with
 * `grep -q "unchecked boxes"`. ADR 0025 added a SECOND refusal reason to the
 * gate (`no-live-contract`, whose message contains no such substring), so those
 * refusals silently fell into the `else` branch and annotated as "update failed
 * unexpectedly" — the exact opposite of the truth. Nothing tested the
 * classifier, so the suite stayed green over a backwards annotation.
 *
 * Mechanism: the kernel's own `error.code` on the wire, NOT prose. A refusal
 * from the gate is `UPDATE_FAILED` whose message starts with the gate's own
 * prefix `cannot mark '<id>' done:`; every OTHER `UPDATE_FAILED` (unknown id,
 * an illegal transition, a refused steal, an agent `--waive`) does not. Matching
 * on the code plus that single shared prefix means a THIRD refusal reason added
 * to the gate later is classified correctly without touching this file, which is
 * the failure mode a per-message substring list guarantees to repeat.
 *
 * `error.code` is the load-bearing half because `message` is human prose the
 * kernel is free to reword. `UPDATE_FAILED` alone is too coarse (it also covers
 * every unrelated update failure), so the code narrows to "this is a kernel
 * refusal" and the gate's shared `cannot mark '<id>' done:` prefix — a shape
 * both reasons share — narrows to "…and it is the done gate".
 *
 * Usage: `node cli/auto-done-refusal.mjs --output <file|->` reads the command's
 * captured output (stdout+stderr) and prints one word: `expected` or
 * `unexpected`. Exit 0 either way — the caller decides what to annotate; a
 * non-zero exit would collide with "the classifier itself failed", which is not
 * a decision this file is entitled to make for the caller.
 *
 * Unparseable input is `unexpected`, never `expected`: an unreadable refusal
 * must not be reported as a recognised gate refusal.
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `error.code` the CLI puts on every kernel refusal (`operations.ts` `fail`). */
export const UPDATE_FAILED_CODE = "UPDATE_FAILED";

/**
 * The gate's shared message prefix. Both refusal reasons open with it
 * (`cannot mark '<id>' done: the acceptance checklist …` /
 * `… has no acceptance criteria …`), so it is the one substring that survives a
 * reword of either half. Deliberately NOT the id: the classifier is handed the
 * envelope, not the loop's `$id`, and matching the id would tie it to a
 * variable it does not receive.
 */
export const DONE_GATE_PREFIX = "cannot mark '";

/** `error.message` of a refusal envelope, or null when there is not one. */
function errorMessage(envelope) {
  const error = envelope && typeof envelope === "object" ? envelope.error : undefined;
  return error && typeof error === "object" && typeof error.message === "string"
    ? error.message
    : null;
}

/**
 * Classify a captured `arggon update --status done` output.
 *
 * @param {string} raw the command's captured stdout+stderr.
 * @returns {"expected" | "unexpected"} `expected` ONLY for a done-gate refusal.
 */
export function classifyUpdateRefusal(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return "unexpected";
  let envelope;
  try {
    // The CLI emits ONE json object; a human-path run has none. Tolerate the
    // trailing newline and any surrounding log noise by scanning lines.
    const line = raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("{") && l.includes('"ok":'));
    if (line === undefined) return "unexpected";
    envelope = JSON.parse(line);
  } catch {
    return "unexpected";
  }
  if (!envelope || envelope.ok !== false) return "unexpected";
  const error = envelope.error;
  if (!error || error.code !== UPDATE_FAILED_CODE) return "unexpected";
  const message = errorMessage(envelope);
  if (message === null || !message.includes(DONE_GATE_PREFIX)) return "unexpected";
  return "expected";
}

export function run(argv) {
  const outputIndex = argv.indexOf("--output");
  const target = outputIndex === -1 ? undefined : argv[outputIndex + 1];
  let verdict = "unexpected";
  if (target === undefined) {
    process.stderr.write("auto-done-refusal: --output <file|-> is required\n");
  } else {
    try {
      verdict = classifyUpdateRefusal(readFileSync(target === "-" ? 0 : target, "utf8"));
    } catch (err) {
      process.stderr.write(`auto-done-refusal: cannot read output (${err.message})\n`);
    }
  }
  // Always exactly one word on stdout, so the caller can compare it even when
  // the input was unusable.
  process.stdout.write(`${verdict}\n`);
  return verdict;
}

// Direct-run guard: the test suite imports the pure parts above.
const invokedDirectly = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) run(process.argv.slice(2));
