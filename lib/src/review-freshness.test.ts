import { describe, expect, it, vi } from "vitest";
import {
  isTrackerPath,
  readCompareChangedFiles,
  resolveReviewFreshness,
  revisionMatches,
  type ChangedFilesResult,
} from "./review-freshness.js";

const HEAD = "def4567890abcdef1234567890abcdef12345678";

describe("revisionMatches", () => {
  it("matches exact and short-vs-full revisions", () => {
    expect(revisionMatches("abc1234", "abc1234")).toBe(true);
    expect(revisionMatches("abc1234", HEAD)).toBe(false);
    expect(revisionMatches("def4567", HEAD)).toBe(true);
    expect(revisionMatches(HEAD.toUpperCase(), HEAD)).toBe(true);
  });

  it("does not match different same-length revisions or empty strings", () => {
    expect(revisionMatches("abc1234", "abc1235")).toBe(false);
    expect(revisionMatches("", HEAD)).toBe(false);
    expect(revisionMatches(HEAD, "")).toBe(false);
  });
});

describe("isTrackerPath", () => {
  it("matches the tracker root and its children only", () => {
    expect(isTrackerPath("ArggonManager", "ArggonManager")).toBe(true);
    expect(isTrackerPath("ArggonManager/arggon-manager/x/task.md", "ArggonManager")).toBe(true);
    expect(isTrackerPath("lib/src/verdict.ts", "ArggonManager")).toBe(false);
    expect(isTrackerPath("ArggonManager-notes.md", "ArggonManager")).toBe(false);
    expect(isTrackerPath("ArggonManager\\x", "ArggonManager")).toBe(true);
    expect(isTrackerPath("lib/src/verdict.ts", "")).toBe(false);
  });
});

describe("resolveReviewFreshness", () => {
  const tracker = "ArggonManager";
  const reader = (result: ChangedFilesResult | null) => () => result;

  it("is unbound when the verdict recorded no revision", () => {
    expect(
      resolveReviewFreshness({ reviewed: null, head: HEAD, trackerPath: tracker, readChangedFiles: reader(null) }),
    ).toEqual({
      reviewed_revision: null,
      head_revision: HEAD,
      freshness: "unbound",
      reason: "no reviewed revision recorded",
    });
  });

  it("is fresh without a comparison when the reviewed revision is the head", () => {
    const readChangedFiles = vi.fn(() => ({ paths: ["lib/src/x.ts"], truncated: false }));
    expect(
      resolveReviewFreshness({
        reviewed: "def4567",
        head: HEAD,
        trackerPath: tracker,
        readChangedFiles,
      }),
    ).toEqual({
      reviewed_revision: "def4567",
      head_revision: HEAD,
      freshness: "fresh",
      reason: null,
    });
    expect(readChangedFiles).not.toHaveBeenCalled();
  });

  it("is fresh when only tracker paths changed after the review", () => {
    expect(
      resolveReviewFreshness({
        reviewed: "abc1234",
        head: HEAD,
        trackerPath: tracker,
        readChangedFiles: reader({
          paths: [
            "ArggonManager/arggon-manager/cli/x/task.md",
            "ArggonManager/.convention.yml",
          ],
          truncated: false,
        }),
      }),
    ).toMatchObject({ freshness: "fresh", reason: null });
  });

  it("is stale when any non-tracker path changed after the review", () => {
    expect(
      resolveReviewFreshness({
        reviewed: "abc1234",
        head: HEAD,
        trackerPath: tracker,
        readChangedFiles: reader({
          paths: ["ArggonManager/x/task.md", "lib/src/verdict.ts"],
          truncated: false,
        }),
      }),
    ).toMatchObject({ freshness: "stale", reviewed_revision: "abc1234", head_revision: HEAD });
  });

  it("is unbound, never fresh, when the comparison is unavailable", () => {
    expect(
      resolveReviewFreshness({
        reviewed: "abc1234",
        head: HEAD,
        trackerPath: tracker,
        readChangedFiles: reader(null),
      }),
    ).toEqual({
      reviewed_revision: "abc1234",
      head_revision: HEAD,
      freshness: "unbound",
      reason: "reviewed..head comparison unavailable",
    });
  });

  it("is unbound when the PR head is unknown", () => {
    expect(
      resolveReviewFreshness({
        reviewed: "abc1234",
        head: null,
        trackerPath: tracker,
        readChangedFiles: reader(null),
      }),
    ).toMatchObject({ freshness: "unbound", reason: "PR head revision unavailable" });
  });

  it("treats a truncated tracker-only comparison as stale, not fresh", () => {
    expect(
      resolveReviewFreshness({
        reviewed: "abc1234",
        head: HEAD,
        trackerPath: tracker,
        readChangedFiles: reader({ paths: ["ArggonManager/x.md"], truncated: true }),
      }),
    ).toMatchObject({ freshness: "stale", reason: expect.stringContaining("truncated") });
  });
});

describe("readCompareChangedFiles", () => {
  it("reads repo-relative filenames from the compare payload", () => {
    const execGh = vi.fn(() =>
      JSON.stringify({
        files: [{ filename: "ArggonManager/x/task.md" }, { filename: "lib/src/verdict.ts" }],
      }),
    );
    const out = readCompareChangedFiles("owner", "repo", "abc1234", HEAD, execGh as never);
    expect(out).toEqual({
      paths: ["ArggonManager/x/task.md", "lib/src/verdict.ts"],
      truncated: false,
    });
    expect(execGh).toHaveBeenCalledWith(
      "gh",
      ["api", `repos/owner/repo/compare/abc1234...${HEAD}`],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("returns null when gh fails or the payload is unparseable", () => {
    const failing = (() => {
      throw new Error("gh failed");
    }) as never;
    expect(readCompareChangedFiles("owner", "repo", "abc1234", HEAD, failing)).toBeNull();
    expect(
      readCompareChangedFiles("owner", "repo", "abc1234", HEAD, (() => "not json") as never),
    ).toBeNull();
  });

  it("flags a full 300-row compare payload as truncated", () => {
    const files = Array.from({ length: 300 }, (_, i) => ({ filename: `ArggonManager/f${i}.md` }));
    const out = readCompareChangedFiles(
      "owner",
      "repo",
      "abc1234",
      HEAD,
      (() => JSON.stringify({ files })) as never,
    );
    expect(out?.truncated).toBe(true);
  });
});
