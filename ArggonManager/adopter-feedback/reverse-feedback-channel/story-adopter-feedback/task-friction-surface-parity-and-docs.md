---
type: task
status: done
id: task-friction-surface-parity-and-docs
title: "Friction surface parity (native tool, MCP) and JSON contract docs"
assignee: arggon-delivery-lead
branch: feat/task-friction-surface-parity-and-docs
parent: story-adopter-feedback
labels: [method]
priority: p2
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-11T21:57:20.111Z"
depends_on: [task-friction-tier-b-url-and-optout]
worktree_path: /home/arggon/Projects/ArggonManager-task-friction-surface-parity-and-docs
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-surface-parity-and-docs.md
  Leaves live only under a story. id is the filename stem: task-friction-surface-parity-and-docs.
  CLI `arggon create task friction-surface-parity-and-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Friction surface parity (native tool, MCP) and JSON contract docs

## Context

Plan task T5 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md).

`docs/agents.md` §MCP keeps the CLI, the native tool surface and the MCP tool in
parity, and `cli/src/mcp-parity.test.ts` is the enforcement. A new command that
ships on one surface only is a convention violation, not a shortcut.

**Ownership (reviewer N1):** the additive `doctor --json` `friction` block is
owned **solely** by `task-friction-trigger-carrier` (T6), not by this task. This
task owns CLI/native/MCP parity for `arggon friction` itself and the
`docs/json-output.md` rows for it; T6 owns the block's semantics and tests. The
`doctor.friction` row in `json-output.md` is written here, but the code and its
acceptance criteria are T6's — one owner, one claim.

## Acceptance

- [x] `tools.arggon.friction` and the `arggon_friction` MCP tool take the same arguments and emit the same envelope fields as CLI `--json`.
- [x] `cli/src/mcp-parity.test.ts` green.
- [x] `ArggonManager/docs/json-output.md` documents the `friction` command surface **and** the additive `doctor.friction` block in this same PR (the block's code and tests are T6's; the doc row is this task's, so the two land together).
- [x] No `schemaVersion` bump is introduced by either surface (asserted in both tasks).
- [x] Every error path carries a typed `error.code` (`FRICTION_FAILED`) with the documented `reason` values: `no-observation`, `log-unwritable`, and the report/clear conflict.

### 2026-10-15 @Arggon
# Evidence — T5 friction surface parity (PR #849)

**Parity is asserted, not claimed.** `cli/src/mcp-parity.test.ts` gained a
`friction surface parity` describe: one tree carries both sides (the log lives
outside the tracker, so a twin tree would only change the `reporterId` digest),
`ARGGON_STATE_DIR` is pinned inside the tree, and the CLI child plus the
MCP-spawned CLI child both inherit it — so one variable pins both surfaces.

| Arm | What the new tests compare |
| --- | --- |
| `--report` (empty log) | `{ok, schemaVersion: 1, command: "friction", report: true, count: 0, classes: 0, dropped: 0, optedOut: false, dedupeScope: "local-only"}`, `rows: []`, `expectJsonOnly` on both surfaces |
| capture | one identical `record` — same `fingerprint`, same `reporterId`, `--error`/`--harness` carried |
| `--report` seeded | the same deduped `rows` (count desc) and the same tier-`b` `publish` doc |
| `--report --tier b` | `publish: { tier: "b" }` with the prefilled `issues/new` URL |
| `--clear` | `cleared: 1`, then idempotent `cleared: 0` on the already-empty log |
| failure arms | `error.code: "FRICTION_FAILED"` + the same `reason`: `no-observation`, `no-command-shape`, `report-and-clear-mutually-exclusive` (with both discriminants beside the error), `clear-and-capture-mutually-exclusive`, `unknown-tier`, `tier-without-report`, `log-unwritable` (with the named `path`) |

`--clear` is destructive, so its test re-seeds the log between the two reads
rather than comparing two clears of one file.

The third surface is compared against the CLI in
`opencode/plugins/arggon/tools.test.ts`: the same arms byte-for-byte after the
shared `normalize`, plus the typed tool error when the `arggon` binary is absent
(fake `arggon` shim on PATH — the existing `fakeGh` pattern).

**No `schemaVersion` bump** is introduced by either surface: asserted
(`schemaVersion: 1`) on every new parity arm and in the plugin failure tests.

**Doc split vs T6.** `ArggonManager/docs/json-output.md` gained the `friction`
command-payload rows (capture / report / clear / every failure `reason`) and one
`doctor.friction` row + `#### friction block` section naming `triggerPresent` /
`triggerVersion` per managed agent file. T6 (`task-friction-trigger-carrier`)
owns the block's code, semantics, tests and entry shape; nothing here asserts or
implements its behavior.

## Design decision worth a reviewer's eye

Both non-CLI surfaces **re-enter the CLI** (MCP `spawnSync`, native `execFile`,
argv array, no shell) instead of calling the kernel in-process. The whole
`friction --json` contract is CLI-side — the three mode conflicts, the `--tier`
validation, the `x-friction` / `ARGGON_NO_FRICTION` opt-out resolution and the
`arggonVersion()` every record carries. Two concrete reasons that is not a
shortcut:
1. re-implementing the conflict/tier/opt-out resolution in three places would
   drift; the parity test would catch an envelope mismatch but not a renamed
   `reason` string;
2. the native plugin has no manifest to read a version from, so an in-process
   capture would fingerprint the SAME class differently (`majorVersion`
   `"unknown"` vs `"0"`) and split one dedupe row in two on one machine.

Stated cost: both non-CLI surfaces need the `arggon` binary on `PATH` — the same
cost `arggon_start`/`arggon_branch`/`arggon_cleanup` already carry, and the
native tool names the CLI path in its typed `FRICTION_FAILED` error when it is
missing. All three surfaces reach parity; none silently degrades.

## Gate results (worktree, in order)

| Gate | Result |
| --- | --- |
| `npm run arggon -- validate` | ok (0 warnings, convention v5) |
| `npm test` | 143 files / **3122 passed** |
| `npm run build` | ok |
| `npm run check:plugin` | exit 0 (bundle matches source, deterministic) |
| `npm run lint` | clean |
| `npm run test:structure` | ast-grep 5/5 pass, scan clean |
| `npx prettier --check` (touched files) | clean; `smoke/context-report.ts` was already non-clean at `HEAD` and was left as-is rather than adding 54 lines of unrelated reformatting |

Expected vs observed: the only behaviours that existed before this PR are
unchanged — the three CLI friction suites (`cli/src/friction*.test.ts`, 204
tests) and the lib suites all still pass with no edit. New behaviour is confined
to the two new tool surfaces, their doc enumerations and the two advisory schema
budgets.

## Deliberate cost, named

Both surfaces registering a tool grows the two ADR-0006 advisory schema
payloads, so both bounds are raised with the delta in the comment, not silently:
MCP `tools/list` 16,384 → 20,480 B (live 18,054 B / 16 tools, `arggon_friction`
1,801 B — second-largest after `arggon_update`); native Code Mode catalog
12,288 → 13,312 B (live 13,113 B). The tool enumerations in `agents.md`,
`json-output.md`, `README.md` and the skill's `json-contract.md` reference move
to sixteen, and `ArggonManager/.convention.yml`'s `x-generated` checksum for the
regenerated skill copy is refreshed so `cli/src/provenance-audit.test.ts`
stays green.

### handoff 2026-10-15 @Arggon — next: Delivery lead: review PR #849 (three-surface friction parity + the doctor.friction doc row) and merge; T6 (task-friction-trigger-carrier) is unblocked and owns the block's code, fields and tests.
- branch: feat/task-friction-surface-parity-and-docs
- open questions: Should the two raised ADR-0006 advisory schema bounds (MCP 20 KiB, native catalog 13,312 B) be re-tightened once the surface stops growing, or is 20 KiB the standing bound?; Keep the CLI re-entry for…

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead review + merge verification — 2026-10-15 (delivery lead)
Merged as 9c39dee1 (PR #849). Parity verified on all three surfaces — same arguments, same envelope fields — with both non-CLI surfaces deliberately RE-ENTERING the CLI (`arggon_friction` spawns with an argv array; the native tool via `execFile`; never a shell): the whole `friction --json` contract (the mode conflicts, the tier validation, the opt-out resolution, the record's `arggonVersion`) lives CLI-side, and the native plugin has no manifest to read a version from — an in-process capture would fingerprint `majorVersion` `"unknown"` vs `"0"` and split one dedupe row in two. Stated cost: the `arggon` binary on `PATH`, with the native tool naming the CLI path in its typed `FRICTION_FAILED` error rather than degrading silently. The ownership boundary held — the `doctor --json` `friction` block is DOCUMENTED here and left for `task-friction-trigger-carrier` alone.

Advisory schema bounds raised with the delta named, never silently: MCP `tools/list` 16,384 → 20,480 B (live 18,054 B / 16 tools — the mandated sixteenth tool could not fit in the 126 B that remained), native catalog 12,288 → 13,312 B. The standing-bound question stays open on the item — recorded, not decided away.

Merge verification round 1 caught a REAL gate hit: the `init-claude` seam byte-equality lane — the friction skill template's committed `.claude-marketplace` copy and its `x-generated` ledger row had not been refreshed, so a stale skill would have shipped to this repo's own Claude sessions. Fixed in the merge resolution (copy + row re-synced; seam, provenance, skill-copy, mcp-parity, doctor and init suites 188 green; validate ok), and the merge carries a clean 16-file delta against main.
>>>>>>> a834ebff (chore(tasks): commented task-friction-surface-parity-and-docs)
