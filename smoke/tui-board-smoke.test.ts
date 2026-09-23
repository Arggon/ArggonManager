import { describe, expect, it } from "vitest";
import {
  isBoardFrame,
  lastFrame,
  missingDetailMarkers,
  missingFrameMarkers,
  panePosition,
  SEEDED_DETAIL_MARKERS,
  TUI_STATUS_HEADERS,
} from "./tui-board-smoke.js";

// Unit tests for the harness's frame predicate — the pty run itself needs
// util-linux `script` (skipped where unavailable) and is driven by
// `npm run smoke:tui-board` locally/CI. The predicate is what decides the
// check, so it is pinned here (same pattern as smoke/opencode-smoke.test.ts).

/** A minimal capture carrying all five headers and one card line. */
function frame(itemId: string): string {
  return [
    "arggon board --tui · 4 item(s)",
    TUI_STATUS_HEADERS.map((status) => `${status} (1)`).join(""),
    `> T ${itemId} Board task`,
    "←/→ column · ↑/↓ card · / search · enter path · q quit",
  ].join("\n");
}

describe("tui-board-smoke: missingFrameMarkers", () => {
  it("accepts a frame with the five status headers and the seeded item id", () => {
    expect(missingFrameMarkers(frame("task-board-task"), "task-board-task")).toEqual([]);
  });

  it("reports every status header the frame does not render", () => {
    expect(
      missingFrameMarkers("todo (1)\n> T task-board-task Board task", "task-board-task"),
    ).toEqual(["in_progress", "blocked", "done", "cancelled"]);
  });

  it("reports a missing item id", () => {
    expect(missingFrameMarkers(frame("task-other"), "task-board-task")).toEqual([
      "task-board-task",
    ]);
  });

  it("partitions exactly the five v0 statuses", () => {
    expect(TUI_STATUS_HEADERS).toEqual(["todo", "in_progress", "blocked", "done", "cancelled"]);
  });
});

// ---------- detail-pane predicates (task-tui-detail-pane) ----------

/** A minimal detail frame carrying the pane header and the seeded markers. */
function detailFrame(itemId: string): string {
  return [
    `arggon detail · ${itemId} · esc back`,
    `T ${itemId} Board task`,
    "type: task · status: todo · priority: (none) · assignee: (none)",
    "acceptance 1/2:",
    "  [x] seeded acceptance row",
    "  [ ] pending acceptance row",
    "body:",
    "  ## Detail",
    "row 1/56 · ↑/↓ line · PgUp/PgDn page · home/end · esc back · q quit",
  ].join("\n");
}

/** The capture of a pty session that drew `frames` in order. */
function capture(...frames: string[]): string {
  return frames.map((frame) => `\x1b[H\x1b[2J${frame}`).join("");
}

describe("tui-board-smoke: lastFrame", () => {
  it("returns everything after the final clear", () => {
    expect(lastFrame(capture("one", "two"))).toBe("two");
    expect(lastFrame("no clear at all")).toBe("no clear at all");
  });
});

describe("tui-board-smoke: isBoardFrame", () => {
  it("requires the board header and the seeded card highlighted", () => {
    const frame = ["arggon board --tui · 4 item(s)", "> T task-board-task Board task"].join("\n");
    expect(isBoardFrame(frame, "task-board-task")).toBe(true);
    expect(isBoardFrame(frame, "task-other")).toBe(false);
    expect(isBoardFrame(detailFrame("task-board-task"), "task-board-task")).toBe(false);
  });
});

describe("tui-board-smoke: missingDetailMarkers", () => {
  it("accepts a frame with the pane header and every seeded marker", () => {
    expect(missingDetailMarkers(detailFrame("task-board-task"), "task-board-task")).toEqual([]);
  });

  it("accepts a color-on frame (the header is bold-wrapped, not a prefix)", () => {
    const colored = `\x1b[1marggon detail · task-board-task · esc back\x1b[0m\n${detailFrame(
      "task-board-task",
    )}`;
    expect(missingDetailMarkers(colored, "task-board-task")).toEqual([]);
  });

  it("reports the detail header and every seeded marker that is missing", () => {
    expect(missingDetailMarkers(detailFrame("task-other"), "task-board-task")).toEqual([
      "detail header (task-board-task)",
    ]);
    expect(missingDetailMarkers("arggon detail · task-board-task", "task-board-task")).toEqual(
      SEEDED_DETAIL_MARKERS,
    );
  });
});

describe("tui-board-smoke: panePosition", () => {
  it("reads the footer position and takes the last match", () => {
    expect(panePosition(detailFrame("task-board-task"))).toEqual({ row: 1, total: 56 });
    expect(panePosition("row 3/9 · esc back\nrow 39/56 · esc back")).toEqual({
      row: 39,
      total: 56,
    });
    expect(panePosition("no position here")).toBeNull();
  });
});
