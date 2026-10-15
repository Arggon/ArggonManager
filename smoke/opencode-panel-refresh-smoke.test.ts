/**
 * Unit tests for the panel-refresh smoke harness's pure predicates — the same
 * split as `smoke/opencode-prompt-stamp-smoke.test.ts`: the runtime leg needs a
 * real `opencode` binary and a real PTY (driven by
 * `npm run smoke:opencode:panel-refresh`), while what decides each check is the
 * logic pinned here. An empty array means "the observation held".
 */
import { describe, expect, it } from "vitest";
import {
  artifactFaults,
  observePanel,
  panelHeaderCount,
  refreshFaults,
  type PanelObservation,
} from "./opencode-panel-refresh-smoke.js";

function observation(overrides: Partial<PanelObservation> = {}): PanelObservation {
  return {
    headers: ["arggon board · 4 item(s)", "arggon board · 5 item(s)"],
    createdSeen: true,
    silentSeen: false,
    ...overrides,
  };
}

const EXPECTED = {
  before: 4,
  after: 5,
  createdId: "task-live-refresh",
  silentId: "task-silent-write",
};

describe("opencode-panel-refresh-smoke: panelHeaderCount", () => {
  it("parses the panel header the panel draws", () => {
    expect(panelHeaderCount("arggon board · 4 item(s) · next: task-x")).toBe(4);
    expect(panelHeaderCount("arggon board · 12 item(s)")).toBe(12);
  });

  it("ignores every other line (sidebar, tree, empty)", () => {
    expect(panelHeaderCount("arggon · 3 ready · next task-o")).toBeUndefined();
    expect(panelHeaderCount("❯ ▸ I launch — Launch")).toBeUndefined();
    expect(panelHeaderCount("")).toBeUndefined();
    expect(panelHeaderCount("arggon board · tracker unreadable: Duplicate id 'x'")).toBeUndefined();
  });
});

describe("opencode-panel-refresh-smoke: refreshFaults", () => {
  it("accepts a stale open refreshed by an event, silently written item absent", () => {
    expect(refreshFaults(observation(), EXPECTED)).toEqual([]);
  });

  it("reports a panel that opened already fresh (the refresh has no cause)", () => {
    expect(
      refreshFaults(
        observation({ headers: ["arggon board · 5 item(s)"], createdSeen: false }),
        EXPECTED,
      ),
    ).toEqual([
      "the panel opened on 5 item(s), expected the stale 4",
      "the panel opened already fresh — the refresh cannot be attributed to an event",
      "the refresh never drew task-live-refresh",
    ]);
  });

  it("reports a panel that never refreshed at all", () => {
    expect(
      refreshFaults(
        observation({ headers: ["arggon board · 4 item(s)"], createdSeen: false }),
        EXPECTED,
      ),
    ).toEqual([
      'no header ever named 5 item(s): ["arggon board · 4 item(s)"]',
      "the refresh never drew task-live-refresh",
    ]);
  });

  it("reports a polling fallback: the silently written item was drawn", () => {
    expect(
      refreshFaults(
        observation({ silentSeen: true, headers: ["arggon board · 6 item(s)"] }),
        EXPECTED,
      ),
    ).toEqual([
      "the panel opened on 6 item(s), expected the stale 4",
      'no header ever named 5 item(s): ["arggon board · 6 item(s)"]',
      "the panel drew task-silent-write, written with no event — that is a polling fallback",
    ]);
  });
});

describe("opencode-panel-refresh-smoke: artifactFaults", () => {
  it("accepts an event-driven entry carrying the allow-list", () => {
    expect(
      artifactFaults(
        'export const BOARD_REFRESH_EVENTS = ["session.shell.ended"];\nconst on = context.data.on;\n',
      ),
    ).toEqual([]);
  });

  it("reports a timer, a missing allow-list and a missing subscription", () => {
    expect(artifactFaults("setInterval(() => {}, 1000)")).toEqual([
      "the vendored TUI entry declares a timer: setInterval",
      "the vendored TUI entry does not carry the refresh allow-list",
      "the vendored TUI entry does not subscribe to the host event stream",
    ]);
    expect(artifactFaults("const x = setTimeout;")).toContain(
      "the vendored TUI entry declares a timer: setTimeout",
    );
  });
});

describe("opencode-panel-refresh-smoke: observePanel", () => {
  const ids = { createdId: "task-live-refresh", silentId: "task-silent-write" };

  it("dedupes headers in first-seen order and tracks the drawn ids", () => {
    const frames = [
      [
        "arggon board · 4 item(s) · next: task-panel-task",
        "       ▶· T task-panel-task — Panel task",
      ],
      [
        "arggon board · 4 item(s) · next: task-panel-task",
        "       ▶· T task-panel-task — Panel task",
      ],
      [
        "arggon board · 5 item(s) · next: task-live-refresh",
        "       ▶· T task-live-refresh — Live",
      ],
    ];
    expect(observePanel(frames, ids)).toEqual({
      headers: ["arggon board · 4 item(s)", "arggon board · 5 item(s)"],
      createdSeen: true,
      silentSeen: false,
    });
  });

  it("flags the silently written item and ignores unrelated frames", () => {
    expect(observePanel([["no panel here", "task-silent-write.md"]], ids)).toEqual({
      headers: [],
      createdSeen: false,
      silentSeen: true,
    });
  });
});
