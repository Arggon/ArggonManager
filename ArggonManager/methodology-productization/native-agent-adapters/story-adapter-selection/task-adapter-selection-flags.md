---
type: task
status: todo
id: task-adapter-selection-flags
title: init --agents/--no-agents + doctor --agents (plan T2)
parent: story-adapter-selection
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-methodology-carriers]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/task-adapter-selection-flags.md
  Leaves live only under a story. id is the filename stem: task-adapter-selection-flags.
  CLI `arggon create task adapter-selection-flags` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init --agents/--no-agents + doctor --agents (plan T2)

## Context

Add `arggon init --agents <list>` / `--no-agents` (default: detected agents) and `arggon doctor --agents` (per-agent files present/stale/adopter-edited + gap rows)

## Acceptance

- [ ] fixture matrix test over init flag combinations
- [ ] `--json` reports written/skipped per artifact; adopter edits never overwritten
- [ ] doctor output snapshot test
- [ ] README + agents.md §init updated in same PR

## Notes

### 2026-10-03 @Reviewer
### 2026-10-03 @Reviewer
verdict: request-changes (classification honesty: `stale` claims a refresh init refuses; acked folded into `present`)

Reading only; no gate run by the reviewer. Evidence and probes are in the reviewer's report (`## Probes needed` lists the exact commands).

Verified by reading:
- F1 (fresh path) genuinely fixed: `cli/src/init.ts:376` carries the selection; both `planGenerateDocs` call sites (`:296` re-init, `:376` fresh) do, `generateDocs` keeps the `undefined` = "every agent" default, and `docs.ts` is the only writer of adapter dests — no third path missed. The matrix test discriminates (8 rows red without it).
- F2 genuinely fixed: `doctor.ts:613`/`:616` both precede the checksum compare at `:621`, matching init's own precedence in `docs.ts:962/1005/1017`. The vendored-plugin regression test cannot be vacuous (asserts the `sha256:` replacement actually changed the file). The acknowledged half has no test (F2b).
- Matrix: one read, tally before the detail cap, matrix JSON + its false-absence lint untouched, `gapsByAgent` additive within schemaVersion 1.
- Budgets: no template / `opencode/plugins/**` / `mcp-server.ts` / `lib/` change, so none of the three figures can move; native ownership is `smoke/context-report.ts:475` (bound `:84`), and `measure.ts` has no native row, as claimed.
- Unknown names refused by name; an empty `--agents ""` throws (no silent "all").

Blocking:
- F1 `stale` is reported for a present file with NO provenance state, documented as "init would refresh it" — init treats exactly that case as adopter-modified and never refreshes (`docs.ts:1013`). Operator is sent to a command that cannot work.
- F2 `present` must mean "byte-equal to the current render" only. Decision: acked gets its own status — `acknowledged` / `acknowledged-drifted`, mirroring `docs.acknowledged` / `docs.acknowledgedDrifted` — not `present` (false at `doctor.ts:502`) and not `adopter-edited` (a hand edit that did not happen, with no un-ack path). `arggon adopt --ack` acks every state entry, so this is the normal adopter state, and today one envelope says `present` while the `docs` block says `acknowledged` + outdated.
- F3 `modified-backup` (init --backup) is reported `skipped` with a reason that says "regenerated".
- F4 the re-init path's selection is untested: deleting `init.ts:302` keeps all 36 tests green.
- F5 `init --propose --agents <unknown>` writes the `.proposed-*` side files (`init.ts:1046`) before refusing at `:1050`, contradicting the documented "refused before anything is written".
- F6 `--agents` and `--no-agents` are not mutually exclusive at the CLI (commander 13.1.0 writes both to the same option key; last token wins silently), so the shipped "does not combine" error is unreachable from the CLI while README + json-output.md assert refusal.

Decisions handed down: the no-marker default (every KNOWN agent) is right and the SPEC §S2 sentence "Default: every detected agent" is the thing that must be amended in this PR — flag help, README, agents.md and tests are propagation, not the record. `doctor --agents` may keep the narrow `present` plus the added statuses; no label may imply a protection or a refresh init does not provide.

Should fix: the always-generated SKILL.md/AGENTS.md still assert the OpenCode plugin surface under `--no-agents` (decide: selection-aware render or a documented caveat); `.mcp.json` gating is undocumented in `agents.md:410/556` and README:205; a test comment claims `--backup` coverage the test lacks; `printInitAdapters`' "does not grow" comment is wrong; the new `--agents` sample says the rows name 12 `docs.modified` entries (they name 8).

### 2026-10-03 @Reviewer
### 2026-10-03 @Reviewer
verdict: approve (round 1: all six blocking findings closed and verified; five non-blocking doc/test nits)

Reading only; no gate run by the reviewer. Round-1 verdict: request-changes (F1–F6 blocking, F11 sample number).

Blocking, re-verified by reading the branch:
- F1 `doctor.ts:657` — `stale` now requires state-backed + checksum match + render diff; a present file with NO state entry is `adopter-edited` (what `docs.ts:1013` does). Test builds the pre-init adopter tree, asserts `stale == 0`, and asserts a re-run really keeps the bytes. Fires on this repo too: `.opencode/agents/arggon-prover.md` has no `x-generated` entry.
- F2 `present` = byte-equal to the current render only; `acknowledged` / `acknowledged-drifted` added and decided by the acked baseline's own checksum, mirroring `docs.*`. `AdapterFileStatus` docstring rewritten to name the action init takes, `--backup` exception included; `Object.keys(counts)` pinned to all eight counters. No status promises a protection or refresh init does not provide.
- F2b acked-then-EDITED test — the only case where the two orders diverge; also cross-checks the `docs` buckets, so the convention edit is proven to parse.
- F3 `outcomeForDecision`: `modified-backup` -> `replaced`; `total = written + replaced + skipped`; archive path in the reason; `replaced` present in `--json` and in the human line.
- F4 re-init test: deleted zcode dest stays missing under `--agents opencode` and `--no-agents`, widening materializes it; removing `init.ts:302` turns it red.
- F5 selection resolved before `planProposals`/`applyProposals`; full recursive listing asserted unchanged.
- F6 both tokens recorded from commander's `option:agents` / `option:no-agents`; refused in either order, inside the action's try, before any write; either token alone still works.
- Discrimination spot-check: each new test provably fails against the reviewed code (re-derived by reading, not re-run).

Design judgements:
- The AGENTS.md/SKILL.md caveat is accepted; the provenance reason recorded for it is wrong (a selection-dependent render would be an ordinary `updated` decision, state refreshed) — correct the sentence in the item note. 2,031/2,048 (17 B) is accepted: the bound is CI-enforced exact-bytes, so the next editor fails loudly.
- Spec §S2 amended with the two-part rule AND its reason; both S2 acceptance boxes ticked with pointers.
- Merge, not squash (docs/agents.md §0: tracker auto-commits) — and note: `6423ed49` on main comments THIS item's file, so the merge conflicts on it. Resolve the item file as a union in a normal merge commit (no force-push); then prune the worktree/branch. `backup/rebased-round1` is a valid recovery path.

Should-fix: all five closed (.mcp.json gating in agents.md:410/:556 + README:205; the false --backup test comment; printInitAdapters' "does not grow"; the sample's 9-vs-12 caption). The regenerated sample's per-agent counts were reproduced independently from this tree's own state file and are correct.

Non-blocking, fix here or file as items: README:292-294 still shows the pre-round-2 human line; json-output.md:236 has a duplicated half-merged `adopter-edited` clause that keeps "never overwrites it" next to the new `--backup` wording; json-output.md:237 omits `acknowledged`/`acknowledged-drifted` from the `counts` row; the sample caption calls all 9 rows `docs.modified` (8 are; the 9th is the no-provenance-state case); the matrix assertion at adapter-selection.test.ts:274 omits `replaced`. Informational, still open: runAdapterReport re-reads the convention file the docs block already read.

Merge recommendation: merge commit; no squash, no force-push.
