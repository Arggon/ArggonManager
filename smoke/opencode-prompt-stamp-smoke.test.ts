/**
 * Unit tests for the T4 smoke harness's pure predicates — the same split as
 * `smoke/native-start-cold-smoke.test.ts`: the runtime legs need a real
 * `opencode` binary, a scripted provider and a disposable worktree (driven by
 * `npx tsx smoke/opencode-prompt-stamp-smoke.ts`), while what decides each check
 * is the logic pinned here. An empty array means "the observation held".
 */
import { describe, expect, it } from "vitest";
import {
  admissionStampFaults,
  compactionMessageFaults,
  compactionRetentionFaults,
  idleFaults,
  promptPayloadFaults,
  scriptedSummary,
  type ProviderRequest,
} from "./opencode-prompt-stamp-smoke.js";

/** One provider request in the shape the recording provider reports. */
function request(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    call: 1,
    at: 1_000,
    roles: ["system", "user"],
    system: "harness instructions",
    compaction: false,
    ...overrides,
  };
}

const ITEM_BLOCK = [
  "<arggon-item>",
  "arggon: tracked work item (advisory; pre-commit/CI stay authoritative)",
  "id: task-prompt-stamp-smoke",
  "type: task",
  "status: in_progress",
  "branch: feat/task-prompt-stamp-smoke",
  "</arggon-item>",
].join("\n");

const EXPECTED = {
  item: "task-prompt-stamp-smoke",
  branch: "feat/task-prompt-stamp-smoke",
  worktreePath: "/w/repo-task-prompt-stamp-smoke",
  worktreeId: "repo-task-prompt-stamp-smoke",
};

describe("opencode-prompt-stamp-smoke: admissionStampFaults", () => {
  it("accepts a stamp carrying the env contract's declared values", () => {
    expect(
      admissionStampFaults(
        {
          item: EXPECTED.item,
          branch: EXPECTED.branch,
          worktreePath: EXPECTED.worktreePath,
          worktreeId: EXPECTED.worktreeId,
          source: "/w/repo-task-prompt-stamp-smoke/.arggon.env",
        },
        EXPECTED,
      ),
    ).toEqual([]);
  });

  it("reports a missing stamp outright, not an empty fault list", () => {
    expect(admissionStampFaults(undefined, EXPECTED)).toEqual([
      "the admitted payload carries no stamp",
    ]);
    expect(admissionStampFaults(null, EXPECTED)).toEqual(["the admitted payload carries no stamp"]);
    expect(admissionStampFaults("nope", EXPECTED)).toEqual([
      "the admitted payload carries no stamp",
    ]);
  });

  it("names every field that disagrees with the contract", () => {
    const faults = admissionStampFaults(
      {
        item: "task-other",
        branch: "feat/task-other",
        worktreePath: "/w/elsewhere",
        worktreeId: "other-id",
        source: "process.env",
      },
      EXPECTED,
    );
    expect(faults).toEqual([
      'stamp item "task-other"',
      'stamp branch "feat/task-other"',
      'stamp worktreePath "/w/elsewhere"',
      'stamp worktreeId "other-id"',
      'stamp source "process.env" is not the env-contract file',
    ]);
  });
});

describe("opencode-prompt-stamp-smoke: promptPayloadFaults", () => {
  it("accepts an admitted prompt whose text is byte-identical", () => {
    expect(promptPayloadFaults({ text: "go", delivery: "steer" }, "go", undefined)).toEqual([]);
  });

  it("reports a rewritten prompt text (the rewrite contract's one prohibition)", () => {
    expect(promptPayloadFaults({ text: "go [stamped]" }, "go", undefined)).toEqual([
      'text rewritten: "go [stamped]"',
    ]);
  });

  it("reports caller metadata the stamp dropped", () => {
    expect(promptPayloadFaults({ text: "go", metadata: { keep: 1 } }, "go", { keep: 1 })).toEqual(
      [],
    );
    expect(promptPayloadFaults({ text: "go", metadata: {} }, "go", { keep: 1 })).toEqual([
      "caller metadata keep was not preserved",
    ]);
    expect(promptPayloadFaults(undefined, "go", undefined)).toEqual([
      "the host persisted no payload for the prompt",
    ]);
  });
});

describe("opencode-prompt-stamp-smoke: compactionRetentionFaults", () => {
  it("accepts exactly one compaction request carrying the block once", () => {
    expect(
      compactionRetentionFaults(
        [request(), request({ call: 2, compaction: true, system: `harness\n${ITEM_BLOCK}` })],
        EXPECTED.item,
      ),
    ).toEqual([]);
  });

  it("reports a host that never compacted", () => {
    expect(compactionRetentionFaults([request()], EXPECTED.item)).toEqual([
      "the host issued no compaction request",
    ]);
  });

  it("reports a compaction request without the block", () => {
    const faults = compactionRetentionFaults([request({ compaction: true })], EXPECTED.item);
    expect(faults).toEqual([
      "the compaction request carries 0 item blocks, expected exactly 1",
      "the compaction request's system does not name the item",
      "the compaction request's system does not carry the item block header",
    ]);
  });

  it("reports a stacked duplicate block", () => {
    expect(
      compactionRetentionFaults(
        [request({ compaction: true, system: `${ITEM_BLOCK}\n${ITEM_BLOCK}` })],
        EXPECTED.item,
      ),
    ).toEqual(["the compaction request carries 2 item blocks, expected exactly 1"]);
  });

  it("reports more than one compaction request", () => {
    expect(
      compactionRetentionFaults(
        [
          request({ compaction: true, system: ITEM_BLOCK }),
          request({ call: 2, compaction: true, system: ITEM_BLOCK }),
        ],
        EXPECTED.item,
      ),
    ).toEqual(["2 compaction requests, expected 1"]);
  });
});

describe("opencode-prompt-stamp-smoke: idleFaults", () => {
  it("accepts requests that all landed inside the drive window", () => {
    expect(idleFaults([request({ at: 1_000 }), request({ call: 2, at: 2_500 })], 2_400)).toEqual(
      [],
    );
  });

  it("reports a request that arrived after the drive finished (polling)", () => {
    const faults = idleFaults([request({ at: 1_000 }), request({ call: 2, at: 5_000 })], 2_400);
    expect(faults).toEqual(["1 provider request(s) arrived after the drive finished (call 2)"]);
  });

  it("tolerates the in-flight tail of the last drive step", () => {
    // The 250 ms grace is the harness's own race window, not a polling excuse.
    expect(idleFaults([request({ at: 2_600 })], 2_400)).toEqual([]);
  });
});

describe("opencode-prompt-stamp-smoke: compactionMessageFaults", () => {
  it("accepts a completed compaction carrying a summary", () => {
    expect(
      compactionMessageFaults({ status: "completed", summary: "## Objective\n- go on" }),
    ).toEqual([]);
  });

  it("reports a compaction the hook recorded itself (no message) or one that failed", () => {
    expect(compactionMessageFaults(undefined)).toEqual(["no compaction message was persisted"]);
    expect(compactionMessageFaults({ status: "failed", error: "boom" })).toEqual([
      'compaction message status is "failed", expected completed',
    ]);
    expect(compactionMessageFaults({ status: "completed", summary: "   " })).toEqual([
      "the compaction message carries no summary",
    ]);
  });
});

describe("opencode-prompt-stamp-smoke: scriptedSummary", () => {
  it("fills the host's summary template so the compaction completes", () => {
    const summary = scriptedSummary(EXPECTED.item);
    for (const heading of [
      "## Objective",
      "## Requirements",
      "## Decisions",
      "## Work State",
      "### Completed",
      "### Active",
      "### Blocked",
      "## Next Move",
      "## Relevant Files",
      "## Important Context",
    ]) {
      expect(summary).toContain(heading);
    }
    expect(summary).toContain(EXPECTED.item);
    // The retry the host issues when the template is unused must not trigger.
    expect(summary).not.toContain("<template>");
  });
});
