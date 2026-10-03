import { describe, expect, it } from "vitest";
import { assertOrder, type OrderNeedle } from "../../test/assert-order.js";

/**
 * The contract of `assertOrder` (bug-vacuous-substring-ordering-assertions).
 *
 * Two properties matter, and the second is the one every bare `indexOf`
 * comparison lacks:
 *
 * 1. **Order is asserted** — a reversal fails.
 * 2. **Presence is a precondition** — an absent needle fails INSTEAD OF being
 *    compared at -1, which is what made `expect(msg.indexOf(a)).toBeLessThan(
 *    msg.indexOf(b))` pass vacuously the moment a message was reworded.
 *
 * The "absent" cases below are the regression proofs: each one is the exact
 * shape that shipped green in the wild.
 */
describe("assertOrder (bug-vacuous-substring-ordering-assertions)", () => {
  const message = "Fix: run `npm ci` in /repo — the diagnosis trails. git: wrote 3 files.";

  it("passes when every needle is present and in order", () => {
    expect(() =>
      assertOrder(message, "npm ci", "the diagnosis trails", "git: wrote 3 files"),
    ).not.toThrow();
  });

  it("FAILS when the order is reversed (the red-on-reversal proof)", () => {
    // The exact defect shape, with both needles genuinely present: the
    // comparison is not "absent vs present", it is a real inversion.
    expect(() => assertOrder(message, "the diagnosis trails", "npm ci")).toThrow(/out of order/);
  });

  it("FAILS when a needle is absent instead of comparing -1 (the vacuity proof)", () => {
    // This is what PR #608's reworded message did to a lowercase search: the
    // needle stopped matching, `indexOf` answered -1, and `-1 < n` passed.
    // The bare idiom for the same subject is asserted here too, so the
    // regression this helper closes is visible in the suite rather than only
    // described in it.
    expect(() =>
      assertOrder(message, "if this is an identity error", "git: wrote 3 files"),
    ).toThrow(/ABSENT/);
    expect(message.indexOf("if this is an identity error")).toBe(-1);
    // The unguarded idiom this helper replaces: vacuously green.
    expect(message.indexOf("if this is an identity error")).toBeLessThan(
      message.indexOf("git: wrote 3 files"),
    );
  });

  it("names the missing needle and the subject it looked in", () => {
    expect(() => assertOrder(message, "npm ci", "sha256:abc123")).toThrow(
      /needle #2 is ABSENT[\s\S]*"sha256:abc123"/,
    );
  });

  it("truncates a long subject in the report instead of dumping the whole line", () => {
    const long = `${"x".repeat(2000)} needle-a needle-b`;
    expect(() => assertOrder(long, "needle-a", "absent-needle")).toThrow(
      new RegExp(`subject: x{400}… \\(2018 chars total\\)`),
    );
  });

  it("rejects two needles that resolve to the SAME index (equal is not before)", () => {
    // "npm ci" appears once, but a needle that is a substring of another can
    // alias: `-1 < 0` style slack must not survive as a silent pass.
    expect(() => assertOrder(message, "npm ci", "npm ci")).toThrow(/out of order/);
  });

  it("rejects a single needle: one clause cannot be out of order", () => {
    expect(() => assertOrder(message, "npm ci")).toThrow(/at least two needles/);
  });

  describe("the explicit 'may be absent' form", () => {
    it("tolerates an absent OPTIONAL needle", () => {
      expect(() =>
        assertOrder(
          message,
          "npm ci",
          { text: "and 1 more", optional: true },
          "git: wrote 3 files",
        ),
      ).not.toThrow();
    });

    it("still orders an optional needle that IS present", () => {
      const conditional = "advice. (and 7 more) tail.";
      expect(() =>
        assertOrder(conditional, "advice.", { text: "(and 7 more)", optional: true }, "tail."),
      ).not.toThrow();
      expect(() =>
        assertOrder(conditional, { text: "(and 7 more)", optional: true }, "advice."),
      ).toThrow(/out of order/);
    });

    it("never grants optionality by inference: a bare string is REQUIRED", () => {
      // The whole point of requiring `optional: true` to be spelled out — a
      // plain string that happens to be absent must fail, not pass.
      expect(() =>
        assertOrder(
          message,
          "npm ci",
          { text: "and 1 more", optional: true },
          "absent-but-required",
        ),
      ).toThrow(/needle #3 is ABSENT/);
    });

    it("refuses an `optional: false` spelling at the TYPE level", () => {
      // `optional?: true` is deliberate: the only way to grant optionality is
      // the affirmative flag, and there is no object form that LOOKS like an
      // opt-in while quietly meaning required. Required is the bare string.
      const text = "and 1 more";
      // @ts-expect-error `optional: false` is not expressible — use a bare string.
      const denied: OrderNeedle = { text, optional: false };
      expect(denied).toEqual({ text, optional: false });
      // …and at runtime it still means required, so a cast cannot smuggle the
      // same vacuity back in either.
      expect(() =>
        assertOrder(message, "npm ci", denied as OrderNeedle, "git: wrote 3 files"),
      ).toThrow(/needle #2 is ABSENT/);
    });
  });
});
