/**
 * Shared ordering-assertion helper (bug-vacuous-substring-ordering-assertions).
 *
 * WHY THIS EXISTS. The ordering idiom this repository keeps adding — "this
 * clause comes before that one" — was written as an `indexOf` comparison:
 *
 * ```ts
 * expect(msg.indexOf("if this is an identity error")).toBeLessThan(msg.indexOf("something"))
 * ```
 *
 * `String.prototype.indexOf` answers **-1** for an absent needle, and `-1` is
 * less than every non-negative index, so that assertion passes when the
 * ordering is correct, when it is REVERSED, and when the clause was renamed
 * out from under it entirely. It reads like a guard and is a no-op.
 *
 * The live instance was exactly that: PR #608 reworded a refusal message to
 * `If this is an identity error, set …. <git detail>`, the test kept searching
 * the old lowercase `"if this is an identity error"`, and the assertion went
 * vacuous at the precise moment the behavior it was supposed to pin changed.
 * The reorder was real; nothing held it there.
 *
 * So the rule this module encodes: **a clause an ordering assertion depends on
 * must be PRESENT, or the assertion has proved nothing.** `assertOrder` makes
 * presence a precondition of the comparison, so the next message rename fails
 * loudly on the missing clause instead of silently disarming its own guard.
 *
 * It is a `throw`, not a `expect`, so it reports the offending needle and where
 * it was looked for instead of a bare `-1 < 3` diff. Tests call it directly;
 * the structural guard `ordering-assertions-use-assert-order` (tools/ast-grep)
 * is what stops the bare `indexOf` comparison from coming back.
 */

/**
 * One clause in an order assertion.
 *
 * A bare string is REQUIRED: `assertOrder` throws if it is absent. Optionality
 * is only ever granted by spelling it out as `{ text, optional: true }` at the
 * call site — there is no inference, no heuristic and no positional reading, so
 * optionality can never be granted by accident. That is deliberate: an
 * "optional" needle that nobody declared is precisely how this defect came
 * back, and making it verbose means a reader of the call site can see which
 * clauses are load-bearing for the ordering and which are not.
 *
 * An optional needle that IS present must still respect the order. Optional
 * means "may be missing", never "may be anywhere".
 */
export type OrderNeedle = string | { readonly text: string; readonly optional?: true };

/** The needle's text and whether its absence is tolerated. */
function resolve(needle: OrderNeedle): { text: string; optional: boolean } {
  return typeof needle === "string"
    ? { text: needle, optional: false }
    : { text: needle.text, optional: needle.optional === true };
}

/** How much of the subject an absence report quotes, so the failure is readable. */
const SUBJECT_EXCERPT_CHARS = 400;

/** Render the subject for an error message without dumping a whole 2048-char line. */
function excerpt(subject: string): string {
  return subject.length > SUBJECT_EXCERPT_CHARS
    ? `${subject.slice(0, SUBJECT_EXCERPT_CHARS)}… (${subject.length} chars total)`
    : subject;
}

/** Quote a needle for an error message, with newlines made visible. */
function quoted(text: string): string {
  return JSON.stringify(text);
}

/**
 * Assert that `subject` contains every needle in the given order.
 *
 * Throws when:
 *
 * - a **required** needle is absent (the vacuity this helper exists to close —
 *   `indexOf` would answer -1 and the ordering comparison would pass anyway);
 * - the needles are present but out of order, or two needles resolve to the
 *   same index (equal indices are not "before", so they fail);
 * - fewer than two needles are given, which asserts nothing and is almost
 *   always a caller mistake (use `toContain` for presence); or
 * - fewer than TWO REQUIRED needles are given, which is the same "asserts
 *   nothing" defect reached the other way round — a call whose every clause is
 *   optional returns silently whether or not any clause is present. See
 *   REQUIRED_NEEDLES below.
 *
 * Optional needles (`{ text, optional: true }`) may be absent; when present
 * they must still sit in their declared slot relative to the required ones.
 *
 * @param subject The text the clauses were searched for in.
 * @param needles Clauses in the expected order; bare strings are required.
 */
export function assertOrder(subject: string, ...needles: readonly OrderNeedle[]): void {
  if (needles.length < 2) {
    throw new Error(
      "assertOrder: needs at least two needles — one clause cannot be out of order. " +
        "For presence alone use expect(subject).toContain(text).",
    );
  }

  // At least two clauses must be REQUIRED. An order is a claim about two
  // things, so optional clauses may REFINE a required order but may never be
  // the whole of it: `assertOrder(msg, {a, optional}, {b, optional})` asserts
  // nothing at all and used to return silently, which is the same defect this
  // helper exists to kill, wearing a different hat.
  //
  // The floor is checked against the CALL, not against the DATA, on purpose. A
  // weaker "at least one clause present" rule would make the guard's meaning
  // depend on the message the test happens to produce: the same assertion would
  // pass on one input and throw on another, so reading the test would not tell
  // you whether it can assert anything. Requiring two REQUIRED needles makes
  // that a static property visible in the source, which is what lets a reviewer
  // check it without running anything.
  if (needles.filter((needle) => !resolve(needle).optional).length < 2) {
    throw new Error(
      "assertOrder: needs at least two REQUIRED needles — an order is a claim about two " +
        "clauses. Optional needles can refine a required order but cannot be the whole of " +
        "it: a call whose clauses are all optional asserts nothing at all, which is the " +
        "defect this helper exists to prevent. Mark at least two needles required (a bare " +
        `string) and pass the genuinely conditional ones as { text, optional: true }. ` +
        `Got ${needles.length} needle(s), all optional or fewer than two required.`,
    );
  }

  const found = needles.map((needle) => {
    const clause = resolve(needle);
    return { ...clause, index: subject.indexOf(clause.text) };
  });

  for (const [position, clause] of found.entries()) {
    if (clause.index === -1 && !clause.optional) {
      throw new Error(
        `assertOrder: needle #${position + 1} is ABSENT from the subject, so the ordering ` +
          `around it could not be asserted (a bare indexOf comparison would have passed ` +
          `vacuously against -1).\n` +
          `  needle: ${quoted(clause.text)}\n` +
          `  subject: ${excerpt(subject)}\n` +
          "  If this clause is genuinely optional here, say so explicitly: " +
          `{ text: ${quoted(clause.text)}, optional: true }.`,
      );
    }
  }

  // Compare each PRESENT clause against the previous PRESENT one. An absent
  // optional needle contributes no position at all — it is a hole in the
  // sequence, not an anchor — so `{ a, optional: b, c }` still proves a < c.
  let previous: { position: number; text: string; index: number } | undefined;
  for (const [position, clause] of found.entries()) {
    if (clause.index === -1) continue;
    if (previous !== undefined && clause.index <= previous.index) {
      throw new Error(
        `assertOrder: needles #${previous.position + 1} and #${position + 1} are out of order.\n` +
          `  #${previous.position + 1}: ${quoted(previous.text)} at index ${previous.index}\n` +
          `  #${position + 1}: ${quoted(clause.text)} at index ${clause.index}\n` +
          `  subject: ${excerpt(subject)}`,
      );
    }
    previous = { position, text: clause.text, index: clause.index };
  }
}
