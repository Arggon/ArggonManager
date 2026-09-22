import { describe, expect, it } from "vitest";
import { missingFrameMarkers, TUI_STATUS_HEADERS } from "./tui-board-smoke.js";

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
