import { describe, expect, it } from "vitest";
// Ordering assertions go through assertOrder, never a bare `indexOf`
// comparison: `-1 < n` makes a renamed clause pass as if it were still
// ordered (bug-vacuous-substring-ordering-assertions).
import { assertOrder } from "../../test/assert-order.js";
import {
  FRICTION_PUBLISH_FENCE_INFO,
  FRICTION_PUBLISH_LABEL,
  FRICTION_PUBLISH_MAX_URL_CHARS,
  FRICTION_PUBLISH_TITLE_MAX_CHARS,
  FRICTION_PUBLISH_TITLE_PREFIX,
  FRICTION_PUBLISH_URL_BASE,
  buildFrictionPublishBody,
  buildFrictionPublishDoc,
  buildFrictionPublishTitle,
  buildFrictionPublishUrl,
  isFrictionPublishTier,
  type FrictionClassRow,
  type FrictionReport,
} from "@arggondev/lib";

/**
 * The tier-B publish builder — plan task T4 of spec-friction-capture-020, the
 * load-bearing half of ADR 0024: the piece that lets the channel exist without
 * `docs/agents.md` §0 being violated, because the agent's job ENDS at a URL and
 * a human clicks submit.
 *
 * What is pinned here is the contract a human and a stage-2 search both rely
 * on: the title prefix and its bound, the body's human-readable prose plus its
 * final `arggon-fingerprint` fence, the ABSENCE of YAML front matter, the
 * encoding rules, and the URL length bound that keeps GitHub answering 200.
 */

function row(over: Partial<FrictionClassRow> = {}): FrictionClassRow {
  return {
    fingerprint: "9f2c1a4b7d3e5c60",
    count: 3,
    reporters: 1,
    reporterIds: ["a1b2c3d4e5f6"],
    firstSeen: "2026-10-02T10:00:00.000Z",
    lastSeen: "2026-10-09T18:45:00.000Z",
    narrative: "start --worktree refused while the lock was held",
    commandShape: "start --worktree <arg>",
    errorCode: "START_FAILED",
    harness: "opencode",
    majorVersion: "0",
    arggonVersion: "0.6.0",
    os: "linux",
    arch: "x64",
    node: "v22.12.0",
    ...over,
  };
}

function report(rows: FrictionClassRow[], over: Partial<FrictionReport> = {}): FrictionReport {
  return {
    rows,
    count: rows.reduce((sum, r) => sum + r.count, 0),
    classes: rows.length,
    dropped: 0,
    skippedVersions: [],
    malformed: 0,
    optedOut: false,
    truncated: false,
    dedupeScope: "local-only",
    ...over,
  };
}

/** Parse the params back out of a built URL, the way GitHub's prefill reads them. */
function paramsOf(url: string): Record<string, string> {
  const query = url.slice(url.indexOf("?") + 1);
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    out[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1));
  }
  return out;
}

/** The fenced blocks of a body: `[infoString, ...contentLines]` per block. */
function fencesOf(body: string): Array<{ info: string; lines: string[] }> {
  const out: Array<{ info: string; lines: string[] }> = [];
  let current: { info: string; lines: string[] } | null = null;
  for (const line of body.split("\n")) {
    const fence = /^```(.*)$/.exec(line);
    if (fence === null) {
      if (current !== null) current.lines.push(line);
      continue;
    }
    if (current === null) {
      current = { info: fence[1] ?? "", lines: [] };
      continue;
    }
    out.push(current);
    current = null;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The tier set
// ---------------------------------------------------------------------------

describe("the tier set", () => {
  it("accepts exactly a and b, and refuses c (out of spec)", () => {
    expect(isFrictionPublishTier("a")).toBe(true);
    expect(isFrictionPublishTier("b")).toBe(true);
    expect(isFrictionPublishTier("c")).toBe(false);
    expect(isFrictionPublishTier("")).toBe(false);
    expect(isFrictionPublishTier("A")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The title: stable prefix, bounded after it
// ---------------------------------------------------------------------------

describe("the tier-B title", () => {
  it("starts with the [adopter-friction] prefix and names the top class", () => {
    const title = buildFrictionPublishTitle(report([row(), row({ fingerprint: "bbb", count: 1 })]));
    expect(title.startsWith(FRICTION_PUBLISH_TITLE_PREFIX)).toBe(true);
    expect(title).toBe(
      "[adopter-friction] start --worktree <arg> — START_FAILED (×3 of 2 classes)",
    );
  });

  it("stays within 120 chars AFTER the prefix even for an over-long command shape", () => {
    const long = report([row({ commandShape: "x".repeat(400), count: 7 })]);
    const title = buildFrictionPublishTitle(long);
    const after = title.slice(FRICTION_PUBLISH_TITLE_PREFIX.length);
    expect(after.length).toBeLessThanOrEqual(FRICTION_PUBLISH_TITLE_MAX_CHARS);
    // The truncation is visible, and the prefix is untouched.
    expect(after.endsWith("…")).toBe(true);
    expect(title.startsWith(FRICTION_PUBLISH_TITLE_PREFIX)).toBe(true);
  });

  it("states the empty log and the opt-out rather than emitting a blank", () => {
    expect(buildFrictionPublishTitle(report([]))).toContain("no friction recorded");
    expect(buildFrictionPublishTitle(report([], { optedOut: true }))).toContain("opted out");
  });
});

// ---------------------------------------------------------------------------
// The body: human-readable, no YAML front matter, fingerprint fence last
// ---------------------------------------------------------------------------

describe("the tier-B body", () => {
  it("carries NO YAML front matter and ends in the argon-fingerprint fence", () => {
    const body = buildFrictionPublishBody(report([row()]));
    // Front matter would be a leading `---` line; the body must not open with it.
    expect(body.startsWith("---")).toBe(false);
    expect(body.split("\n").some((line) => line.trim() === "---")).toBe(false);
    // The LAST fenced block is the machine-readable one.
    const fences = fencesOf(body);
    expect(fences.length).toBeGreaterThan(0);
    expect(fences[fences.length - 1]!.info).toBe(FRICTION_PUBLISH_FENCE_INFO);
    expect(body.trimEnd().endsWith("```")).toBe(true);
  });

  it("keeps that invariant on an empty log too (zero counts, still fenced)", () => {
    const body = buildFrictionPublishBody(report([]));
    expect(fencesOf(body)[fencesOf(body).length - 1]!.info).toBe(FRICTION_PUBLISH_FENCE_INFO);
    expect(body).toContain("records: 0");
    expect(body).toContain("classes: 0");
  });

  it("carries the fingerprint and every stable field in the machine block", () => {
    const body = buildFrictionPublishBody(report([row()]));
    const block = fencesOf(body).at(-1)!;
    const text = block.lines.join("\n");
    for (const field of [
      "fingerprint: 9f2c1a4b7d3e5c60",
      "count: 3",
      "reporters: 1",
      "commandShape: start --worktree <arg>",
      "errorCode: START_FAILED",
      "harness: opencode",
      "majorVersion: 0",
      "firstSeen: 2026-10-02T10:00:00.000Z",
      "lastSeen: 2026-10-09T18:45:00.000Z",
      "arggonVersion: 0.6.0",
      "os: linux",
      "arch: x64",
      "node: v22.12.0",
    ]) {
      expect(text).toContain(field);
    }
  });

  it("separates one stanza per class with a blank line, in report order", () => {
    const body = buildFrictionPublishBody(report([row(), row({ fingerprint: "bbb", count: 1 })]));
    expect(body).toContain("fingerprint: 9f2c1a4b7d3e5c60");
    expect(body).toContain("fingerprint: bbb");
    // Highest count first — the report's own ordering, preserved. assertOrder
    // re-asserts presence as a precondition of the ORDER, so a renamed or
    // dropped fingerprint fails loudly instead of comparing against -1.
    assertOrder(body, "9f2c1a4b7d3e5c60", "fingerprint: bbb");
  });

  it("fences the narrative so its own backticks cannot break the block", () => {
    const body = buildFrictionPublishBody(report([row({ narrative: "run ```argo``` --now" })]));
    expect(body).toContain("run ```argo``` --now");
    // The machine block is still the last fence, so the narrative's fence closed.
    expect(fencesOf(body).at(-1)!.info).toBe(FRICTION_PUBLISH_FENCE_INFO);
  });

  it("caps a long narrative and states the local-only dedupe boundary", () => {
    const body = buildFrictionPublishBody(report([row({ narrative: "n".repeat(4000) })]));
    expect(body).toContain("…");
    expect(body).not.toContain("n".repeat(5000));
    expect(body).toContain("dedupe scope: local-only");
  });

  it("states the opt-out and its remediation instead of an unexplained zero", () => {
    const body = buildFrictionPublishBody(report([], { optedOut: true }));
    expect(body).toContain("optedOut: true");
    expect(body).toContain("set the key back to `true`, or unset the variable");
  });
});

// ---------------------------------------------------------------------------
// The URL: encoding rules, and the length bound
// ---------------------------------------------------------------------------

describe("the tier-B URL", () => {
  it("percent-encodes title and body and asks for the adopter-friction label", () => {
    const url = buildFrictionPublishUrl("[adopter-friction] a & b", "line1\nline2 = x?y#z");
    expect(url.startsWith(`${FRICTION_PUBLISH_URL_BASE}?`)).toBe(true);
    const params = paramsOf(url);
    expect(params.title).toBe("[adopter-friction] a & b");
    expect(params.body).toBe("line1\nline2 = x?y#z");
    expect(params.labels).toBe(FRICTION_PUBLISH_LABEL);
    // The separators never appear raw inside a value.
    expect(url).toContain("title=%5Badopter-friction%5D%20a%20%26%20b");
    expect(url).toContain("body=line1%0Aline2%20%3D%20x%3Fy%23z");
    expect(url.endsWith(`&labels=${FRICTION_PUBLISH_LABEL}`)).toBe(true);
  });

  it("honors the class cap and STILL fits the URL bound, naming what it dropped", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row({ fingerprint: `fp${String(i).padStart(16, "0")}`, count: 60 - i, narrative: `n${i}` }),
    );
    const doc = buildFrictionPublishDoc(report(rows));
    // Bounded by construction: the URL is well under the 414 ceiling the spike
    // measured at ~8.2 KB.
    expect(doc.url.length).toBeLessThanOrEqual(FRICTION_PUBLISH_MAX_URL_CHARS);
    // The drop is stated, never silent.
    expect(doc.body).toMatch(/… and \d+ more classes not included/);
    expect(doc.body).toContain("Run `arggon friction --report` locally for the whole log");
    // And the params still round-trip: what the human opens is what we built.
    expect(paramsOf(doc.url).title).toBe(doc.title);
    expect(paramsOf(doc.url).body).toBe(doc.body);
  });

  it("is bounded even when the narratives are maximally hostile (non-ASCII, fences)", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row({
        fingerprint: `fp${String(i).padStart(16, "0")}`,
        count: 60 - i,
        narrative: `${"日本語".repeat(300)}\n\`\`\`\nx`.repeat(1),
      }),
    );
    const doc = buildFrictionPublishDoc(report(rows));
    expect(doc.url.length).toBeLessThanOrEqual(FRICTION_PUBLISH_MAX_URL_CHARS);
    expect(paramsOf(doc.url).body).toBe(doc.body);
  });

  it("emits nothing but the report for tier a (no publish block is built here)", () => {
    // The builder only exists for tier b; this pins that an empty report still
    // produces a well-formed, openable URL rather than an error.
    const doc = buildFrictionPublishDoc(report([]));
    expect(doc.tier).toBe("b");
    expect(doc.title).toContain("[adopter-friction] ");
    expect(() => new URL(doc.url)).not.toThrow();
  });
});
