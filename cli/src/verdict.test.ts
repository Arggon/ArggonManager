import { describe, expect, it } from "vitest";
import { classifyVerdicts, latestVerdict, parseVerdicts } from "@arggondev/lib";

/**
 * Unit tests for the review-verdict convention parser
 * (task-review-verdict-checker): verdict comments follow the bounded header
 * convention in docs/engineering.md §Review bar — `verdict: approve` or
 * `verdict: request-changes` (optional scope after it) as the comment's first
 * line, under a `### <date> @<author>` heading written by `arggon comment`.
 */
describe("verdict classifier (task-review-verdict-checker)", () => {
  const comment = (date: string, lines: string[], author = "Reviewer"): string =>
    `\n### ${date} @${author}\n${lines.join("\n")}\n`;

  it("approve-only comment classifies approved", () => {
    const body = [
      "# fix the thing",
      "",
      "## Acceptance",
      "- [x] done",
      comment("2026-09-28", ["verdict: approve", "- probed `arggon sync --json`: expected field, observed"]),
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("approved");
  });

  it("request-changes after approve classifies changes-requested", () => {
    const body = [
      comment("2026-09-27", ["verdict: approve", "- looks good"]),
      comment("2026-09-29", ["verdict: request-changes (smoke evidence missing)", "- rerun the fixture"]),
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("changes-requested");
  });

  it("approve after request-changes flips back to approved", () => {
    const body = [
      comment("2026-09-27", ["verdict: request-changes", "- no smoke evidence"]),
      comment("2026-09-29", ["verdict: approve", "- smoke evidence appended"]),
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("approved");
  });

  it("mixed prose comments without verdict header lines classify none", () => {
    const body = [
      comment("2026-09-27", ["looks fine to me, nice work"]),
      comment("2026-09-28", ["please double-check the exit code in check mode"]),
      comment("2026-09-29", ["the verdict: approve was discussed offline"]), // mention, not a header line
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("none");
    expect(parseVerdicts(body)).toEqual([]);
  });

  it("a body with no comments classifies none", () => {
    expect(classifyVerdicts("# task\n\n## Context\n\nNothing to see.\n")).toBe("none");
    expect(classifyVerdicts("")).toBe("none");
  });

  it("orders by comment date, not body position", () => {
    // The older verdict is appended LAST — it must not win.
    const body = [
      comment("2026-09-29", ["verdict: approve"]),
      comment("2026-09-28", ["verdict: request-changes"]),
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("approved");
  });

  it("same-date comments order by comment position in the body", () => {
    const body = [
      comment("2026-09-29", ["verdict: request-changes"]),
      comment("2026-09-29", ["verdict: approve"]),
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("approved");
  });

  it("is case-insensitive on the verdict token and value", () => {
    expect(classifyVerdicts(comment("2026-09-29", ["Verdict: APPROVE"]))).toBe("approved");
    expect(classifyVerdicts(comment("2026-09-29", ["VERDICT: Request-Changes"]))).toBe(
      "changes-requested",
    );
    expect(classifyVerdicts(comment("2026-09-29", ["verdict:approve"]))).toBe("approved");
  });

  it("captures the optional scope without affecting classification", () => {
    const parsed = parseVerdicts(
      [
        comment("2026-09-28", ["verdict: request-changes (smoke evidence missing)"]),
        comment("2026-09-29", ["verdict: approve"]),
      ].join("\n"),
    );
    expect(parsed).toEqual([
      {
        date: "2026-09-28",
        order: 0,
        value: "request-changes",
        scope: "(smoke evidence missing)",
        reviewed: null,
      },
      { date: "2026-09-29", order: 1, value: "approve", scope: null, reviewed: null },
    ]);
  });

  it("ignores verdict-looking lines outside dated comments", () => {
    // Top-level prose and undated headings are not comments; verdicts live
    // under `### <date> @<author>` only.
    const body = [
      "verdict: approve",
      "#### Notes",
      "verdict: request-changes",
      "### handoff 2026-09-29 @Arggon — next: merge",
      "verdict: approve",
    ].join("\n");
    expect(classifyVerdicts(body)).toBe("none");
  });

  it("only the first verdict line of a comment counts (the header line)", () => {
    const body = comment("2026-09-29", [
      "verdict: request-changes",
      "- evidence quote: verdict: approve",
    ]);
    expect(classifyVerdicts(body)).toBe("changes-requested");
  });

  it("does not match near-miss tokens like `approved` or `approvals`", () => {
    const body = comment("2026-09-29", ["verdict: approved", "verdict: approvals"]);
    expect(classifyVerdicts(body)).toBe("none");
  });
});

/**
 * Reviewed-revision binding (issue #872): a verdict comment may carry a bounded
 * `reviewed: <sha>` line. The parser round-trips it; legacy verdicts stay
 * readable with `reviewed: null` (unbound); malformed/reviewed-looking lines
 * outside the comment header do not bind.
 */
describe("verdict reviewed-revision binding (issue #872)", () => {
  const comment = (date: string, lines: string[], author = "Reviewer"): string =>
    `\n### ${date} @${author}\n${lines.join("\n")}\n`;

  it("round-trips a reviewed revision on the latest verdict", () => {
    const body = [
      comment("2026-09-28", ["verdict: approve", "reviewed: abc1234", "- evidence"]),
      comment("2026-10-02", [
        "verdict: approve",
        "reviewed: 0123456789abcdef0123456789abcdef01234567",
        "- re-reviewed the new head",
      ]),
    ].join("\n");
    expect(parseVerdicts(body)).toEqual([
      { date: "2026-09-28", order: 0, value: "approve", scope: null, reviewed: "abc1234" },
      {
        date: "2026-10-02",
        order: 1,
        value: "approve",
        scope: null,
        reviewed: "0123456789abcdef0123456789abcdef01234567",
      },
    ]);
    expect(latestVerdict(body)?.reviewed).toBe("0123456789abcdef0123456789abcdef01234567");
  });

  it("keeps a legacy verdict readable as unbound", () => {
    const body = comment("2026-09-29", ["verdict: approve", "- no revision line"]);
    expect(parseVerdicts(body)[0]?.reviewed).toBeNull();
    expect(latestVerdict(body)?.reviewed).toBeNull();
  });

  it("accepts the reviewed line before the verdict line and normalizes case", () => {
    const body = comment("2026-09-29", ["Reviewed: ABC1234", "verdict: approve"]);
    expect(parseVerdicts(body)[0]?.reviewed).toBe("abc1234");
  });

  it("only the first reviewed line in a comment counts", () => {
    const body = comment("2026-09-29", [
      "verdict: approve",
      "reviewed: abc1234",
      "reviewed: def5678",
    ]);
    expect(parseVerdicts(body)[0]?.reviewed).toBe("abc1234");
  });

  it("binds reviewed across comments, never to a different one", () => {
    const body = [
      comment("2026-09-28", ["verdict: approve", "reviewed: abc1234"]),
      comment("2026-09-29", ["verdict: request-changes"]),
    ].join("\n");
    expect(parseVerdicts(body).map((v) => v.reviewed)).toEqual(["abc1234", null]);
  });

  it("ignores malformed or out-of-comment reviewed lines", () => {
    for (const bad of ["reviewed: abc12", "reviewed: not-a-sha", "- reviewed: abc1234"]) {
      expect(parseVerdicts(comment("2026-09-29", ["verdict: approve", bad]))[0]?.reviewed).toBeNull();
    }
    const body = [
      "reviewed: abc1234",
      "### handoff 2026-09-29 @Arggon — next: merge",
      "reviewed: def5678",
      "verdict: approve",
    ].join("\n");
    expect(parseVerdicts(body)).toEqual([]);
  });

  it("does not let an inline evidence mention bind a revision", () => {
    const body = comment("2026-09-29", [
      "verdict: approve",
      "- reviewer said reviewed: abc1234 in chat",
    ]);
    expect(parseVerdicts(body)[0]?.reviewed).toBeNull();
  });
});
