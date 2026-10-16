/**
 * Board footer friction indicator (task-board-footer-links-the-friction-report).
 *
 * The board footer shows a friction badge next to the build stamp, opening the
 * redacted friction report without devtools. The snapshot is baked at export
 * time (static) / captured once at server start (serve) — never a live
 * per-request read of the raw log. Absent/empty renders no indicator,
 * preserving the legacy bytes. Narratives are untrusted data rendered as plain
 * escaped text; only the redacted report surface is embedded, never the raw
 * jsonl and never a raw log path.
 */
import {
  mkdirSync,
  mkdtempSync as _mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readBoardFrictionSnapshot,
  renderBoardHtml,
  runBoard,
  wireBoardFriction,
} from "./board.js";
import { startBoardServer } from "./board-serve.js";
import type { FrictionReport } from "@arggondev/lib";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function mkdtempSync(prefix: string): string {
  const dir = _mkdtempSync(prefix);
  tmpDirs.push(dir);
  return dir;
}

const BUILD = "0.10.0 (abc1234, feat/task-board-footer-links-the-friction-report)";

function report(over: Partial<FrictionReport> = {}): FrictionReport {
  return {
    rows: [
      {
        fingerprint: "abcdef1234567890",
        count: 2,
        reporters: 1,
        reporterIds: ["a1b2c3d4e5f6"],
        firstSeen: "2026-10-01T00:00:00.000Z",
        lastSeen: "2026-10-02T00:00:00.000Z",
        narrative: "the board hid my friction",
        commandShape: "board",
        harness: "opencode",
        majorVersion: "0",
        arggonVersion: "0.10.0",
        os: "linux",
        arch: "x64",
        node: "v22.12.0",
      },
    ],
    count: 2,
    classes: 1,
    dropped: 0,
    skippedVersions: [],
    malformed: 0,
    optedOut: false,
    truncated: false,
    dedupeScope: "local-only",
    ...over,
  };
}

function emptyReport(): FrictionReport {
  return {
    rows: [],
    count: 0,
    classes: 0,
    dropped: 0,
    skippedVersions: [],
    malformed: 0,
    optedOut: false,
    truncated: false,
    dedupeScope: "local-only",
  };
}

function newTree(): string {
  const root = mkdtempSync(join(tmpdir(), "arggon-board-friction-"));
  mkdirSync(join(root, "tasks/launch"), { recursive: true });
  writeFileSync(join(root, "tasks/.convention.yml"), "version: 1\n", "utf8");
  writeFileSync(
    join(root, "tasks/launch/launch.md"),
    `---\ntype: initiative\nstatus: todo\nid: launch\ntitle: Launch\nlabels: []\ncreated: "2026-09-11"\nupdated: "2026-09-11"\n---\n\n# Launch\n`,
    "utf8",
  );
  return root;
}

describe("board footer friction indicator (task-board-footer-links-the-friction-report)", () => {
  it("shows a friction badge next to the build stamp, opening the redacted report without devtools", () => {
    const html = renderBoardHtml([], {
      generatedAt: "test",
      build: BUILD,
      friction: report(),
    });
    // Badge next to the build stamp, in the footer, with a stable id.
    expect(html).toContain('id="board-build"');
    expect(html).toContain(`build ${BUILD}`);
    expect(html).toContain('id="board-friction"');
    expect(html).toContain("friction 2");
    expect(html).toContain('aria-controls="board-friction-report"');
    // The redacted report panel ships baked, hidden at load.
    expect(html).toContain('id="board-friction-report"');
    expect(html).toContain("arggon friction report");
    expect(html).toContain("dedupe scope: local-only");
    expect(html).toContain("the board hid my friction");
    // Wiring is embedded so the badge opens without devtools.
    expect(html).toContain("wireBoardFriction");
    expect(wireBoardFriction.toString()).toContain("board-friction-report");
  });

  it("renders no indicator without a snapshot (legacy bytes)", () => {
    const html = renderBoardHtml([], { generatedAt: "test", build: BUILD });
    expect(html).toContain('id="board-build"');
    expect(html).not.toContain('id="board-friction"');
    expect(html).not.toContain('id="board-friction-report"');
    expect(html).not.toContain("wireBoardFriction");
  });

  it("renders no indicator for an empty report (no log on the host)", () => {
    const html = renderBoardHtml([], {
      generatedAt: "test",
      build: BUILD,
      friction: emptyReport(),
    });
    expect(html).toContain('id="board-build"');
    expect(html).not.toContain('id="board-friction"');
    expect(html).not.toContain('id="board-friction-report"');
  });

  it("renders narratives as plain escaped text, never raw markup or log paths", () => {
    const hostile = report({
      rows: [
        {
          fingerprint: "ffff000011112222",
          count: 1,
          reporters: 1,
          reporterIds: ["deadbeefcafe"],
          firstSeen: "2026-10-03T00:00:00.000Z",
          lastSeen: "2026-10-03T00:00:00.000Z",
          // Untrusted narrative: HTML/JS injection attempt. Redaction already
          // ran at write (paths/secrets are `<path>`/`<redacted>` by the time
          // they reach this report); the board's job is plain-text escaping.
          narrative: `</script><script>alert(1)</script> <img src=x onerror=alert(2)>`,
          commandShape: "board",
          harness: "opencode",
          majorVersion: "0",
          arggonVersion: "0.10.0",
          os: "linux",
          arch: "x64",
          node: "v22.12.0",
        },
      ],
      count: 1,
      classes: 1,
    });
    const html = renderBoardHtml([], {
      generatedAt: "test",
      build: BUILD,
      friction: hostile,
    });
    // Hostile markup stays literal text: no script breakout, no img tag.
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;/script&gt;&lt;script&gt;");
    expect(html).toContain("&lt;img");
    // Redacted surface only: the panel carries the human report text (which
    // names no filesystem path), never the raw jsonl path.
    expect(html).not.toContain("friction.jsonl");
    expect(html).toContain("arggon friction report");
  });

  it("readBoardFrictionSnapshot degrades to undefined on empty or opted-out logs", () => {
    const state = mkdtempSync(join(tmpdir(), "arggon-friction-empty-"));
    // Empty state dir: no log, no counter — empty report, so no indicator.
    expect(
      readBoardFrictionSnapshot("/nonexistent-tracker-dir", {
        ...process.env,
        ARGGON_STATE_DIR: state,
      }),
    ).toBeUndefined();
  });

  it("the static export bakes the injected snapshot at export time", () => {
    const root = newTree();
    const result = runBoard({
      cwd: root,
      out: "board.html",
      generatedAt: "test",
      me: null,
      build: BUILD,
      friction: report(),
    });
    const html = readFileSync(result.outPath, "utf8");
    expect(html).toContain('id="board-friction"');
    expect(html).toContain("friction 2");
    expect(html).toContain("the board hid my friction");
  });

  it("serve mode captures the injected snapshot at server start and matches the static shape", async () => {
    const root = newTree();
    const friction = report();
    const result = runBoard({
      cwd: root,
      out: "static.html",
      generatedAt: "test",
      me: null,
      details: true,
      build: BUILD,
      friction,
    });
    const staticHtml = readFileSync(result.outPath, "utf8");
    const handle = startBoardServer({ cwd: root, me: null, build: BUILD, friction });
    await handle.ready;
    try {
      const served = await (await fetch(`${handle.url}/`)).text();
      for (const needle of [
        'id="board-friction"',
        "friction 2",
        "the board hid my friction",
        'id="board-friction-report"',
      ]) {
        expect(served, needle).toContain(needle);
        expect(staticHtml, needle).toContain(needle);
      }
    } finally {
      await handle.close();
    }
  }, 30_000);
});
