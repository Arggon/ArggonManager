---
type: task
status: done
id: task-plugin-bundle-near-byte-ceiling
title: "The OpenCode plugin bundle is at 523689/524288 MAX_BUNDLE_BYTES — the friction chain's remaining items (T4/T5/MCP surface) will cross it; raise the cap or split the module before it bites"
assignee: arggon-delivery-lead
branch: feat/task-plugin-bundle-near-byte-ceiling
parent: opencode2-hardening
labels: [tooling, plugin]
created: "2026-10-11"
updated: "2026-10-11"
worktree_path: /home/arggon/Projects/ArggonManager-task-plugin-bundle-near-byte-ceiling
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2/opencode2-hardening/task-plugin-bundle-near-byte-ceiling.md
  Leaves live only under a story. id is the filename stem: task-plugin-bundle-near-byte-ceiling.
  CLI `arggon create task plugin-bundle-near-byte-ceiling` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The OpenCode plugin bundle is at 523689/524288 MAX_BUNDLE_BYTES — the friction chain's remaining items (T4/T5/MCP surface) will cross it; raise the cap or split the module before it bites

## Context

<!-- Why this task exists. -->

## Acceptance

- [x] Measurement stated: this branch (synced onto `origin/main`, PR #712 landed) builds at 523,689 bytes — the size PR #712 recorded — against the raised 655,360 bound (131,671 of headroom); its pre-sync base measured 513,592 bytes against the old 524,288 bound (10,696 of headroom); PR #713 measures 524,472 — over the old bound, which is what turned CI red at `npm run build` with `plugin bundle: 524472 bytes > 524288 bound` (reproduced on this worktree with the old bound still in place by padding the graph to 524,636 bytes, scratch reverted).
- [x] Decision recorded: raise `MAX_BUNDLE_BYTES` 512 KiB → 640 KiB (655,360 bytes). Splitting rejected — the adopter shape is ONE vendored file and nothing in the graph is droppable; the bound protects against accidental dependency creep and an accidental runaway bundle, and 640 KiB keeps ~131 KiB (25%) of headroom past PR #713's measured 524,472 with the remaining planned growth (T4 opt-out keys, T5 MCP surface + json-output + doctor) additive to the same bundle.
- [x] The gate still bites: `cli/src/plugin-bundle.test.ts` builds a graph sized exactly to the bound (allowed) and one byte past it (throws `plugin bundle: 655361 bytes > 655360 bound`), plus pins the real artifact under the bound.
- [x] `npm test` (3032 passed / 140 files), `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok; `test:structure`, `lint:structure`, `spec analyze --baseline`, `smoke:native-start-cold`, `smoke:worktree-playwright` green too.
- [x] Coupling recorded here, not as `depends_on` edges on filed items: the ceiling watch is now durable — the bound's rationale and arithmetic live in `cli/src/plugin-bundle.ts` and its boundary proof in `cli/src/plugin-bundle.test.ts` — so T4/T5 land against 640 KiB without a new tracker edge, and the next raise repeats the recorded arithmetic (~25% headroom above the measured size plus the growth still planned).

## Notes

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Recorded by the T2 (friction report) maker, PR #712: the generated plugin bundle sits at 523,689 of 524,288 `MAX_BUNDLE_BYTES` — 599 bytes of headroom. The remaining adopter-friction chain is additive to the same bundle: T4 (tier-B URL + opt-out keys), T5 (MCP surface `arggon_friction` + `json-output.md` + `doctor.friction`), then the trigger carrier. The next feature-sized commit likely fails `check:plugin` with a ceiling error rather than a code error — a confusing failure at the worst moment.

Acceptance:

- [ ] Reproduce the measurement (`check:plugin` reports the current size; state it)
- [ ] Decide and record: raise `MAX_BUNDLE_BYTES` to a bound with headroom (state the new number and why that is safe — what the bound protects), OR split the bundle (module boundary + what moves), OR another recorded option
- [ ] If the cap is raised: the new value carries the same protection intent (an accidental runaway bundle still fails); evidence that a deliberately oversized bundle still trips the gate
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
- [ ] This item does not gate the friction chain's other items — record that coupling where T4/T5 will see it (a note on the respective items or here suffices; do not add depends_on edges retroactively to filed items without their owners)

### 2026-10-11 @arggon-maker

Maker record — bound raised 512 KiB -> 640 KiB, boundary proof made durable.

**Decision.** `MAX_BUNDLE_BYTES` 512 * 1024 -> 640 * 1024 (524,288 -> 655,360 bytes). Splitting rejected: the adopter shape is ONE vendored file (`arggon init` vendors `opencode/plugins/arggon/index.bundle.ts` into a dependency-less tree, ADR 0011 section 5/6) and nothing in the graph is droppable — every module reachable from the plugin entry is the plugin's own tool surface plus the inlined kernel, so a second file would break the single-file contract, the `bundle.test.ts` dependency-less load, and `init`'s vendoring for zero benefit. The bound is a NOISE GATE, not an architecture constraint: it protects exactly what the single-file design cannot catch any other way — accidental dependency creep (an unmapped bare import builds fine and only fails at load time in a dependency-less adopter tree) and an accidental runaway bundle merging silently. 640 KiB keeps ~131 KiB (25%) of headroom past PR #713's measured 524,472 — about seven times the friction module's own 19.5 KiB share of today's 513,592-byte bundle — so the remaining planned growth (T4 opt-out keys, T5 MCP surface + json-output + doctor) cannot fail CI on a ceiling error, while a genuinely bloat-struck graph still does.

**Measurement (expected vs observed).** This branch is main + the item's base: `npm run build:plugin` reports "44 modules inlined, 513592 bytes" against the 524,288 bound (10,696 bytes of headroom) — green here, so the red failure is size-specific, not this branch's. Recorded by PR #712: 523,689 (599 bytes of headroom); by PR #713: 524,472 — over the bound, CI red at `npm run build` with `Error: plugin bundle: 524472 bytes > 524288 bound`. Reproduced on this worktree with the OLD bound still in place by padding the plugin source graph: observed `Error: plugin bundle: 524636 bytes > 524288 bound` (scratch padding reverted, tree re-verified clean and the rebuild byte-identical).

**Why the committed artifact is unchanged.** The bound lives in the CLI builder, never in the emitted bytes, so the rebuilt `opencode/plugins/arggon/index.bundle.ts` is byte-identical to the committed one (513,592 bytes) and `npm run check:plugin` reports no diff — the drift gate stays green and there is nothing to re-commit for the artifact.

**Bite evidence (durable, not a revert-and-forget scratch).** New `cli/src/plugin-bundle.test.ts`, three checks: the real artifact is at/under the bound; a synthetic two-module graph in os.tmpdir() positioned exactly ON the bound builds (the gate is not a blanket cap, because the emitted length moves 1:1 with the filler); one byte past it throws `plugin bundle: 655361 bytes > 655360 bound`.

**Gates.** `npm run build` green; `npm test` 3005 passed / 138 files; `npm run check:plugin` green; `npm run lint` exit 0; `arggon validate` ok (0 warnings). CI's other lanes re-run locally too: `test:structure`, `lint:structure`, `spec analyze --baseline` (0 new, 4 unchanged), `smoke:native-start-cold`, `smoke:worktree-playwright` all green. Honest note on the smoke: the FIRST `smoke:native-start-cold` invocation failed one leg ("the final text round preceded the tool round") — that leg drives the real OpenCode server through a scripted local provider, and it does not read this diff (the smoke loads the plugin SOURCE, untouched here); two further runs with the identical change were green and a run on the stashed base was green, so the flake is attributed to that smoke's round ordering, not to the bound.

**Acceptance lives in the live section.** The five criteria are transcribed and ticked in the live `## Acceptance` section; the dated comment block above is left as history (unticked) on purpose — `agents.md` section 5 is explicit that comment boxes are history and never the contract, and the gate is scoped to the live section (verified: `acceptanceGate` over the canonical body reports `gated: false`).

**Coupling for the rest of the chain.** No `depends_on` edge added to T4/T5 or their filed siblings: the ceiling watch is now durable in-tree — the bound's rationale and arithmetic live in `cli/src/plugin-bundle.ts` and its boundary proof in `cli/src/plugin-bundle.test.ts` — so those items land additive against 640 KiB without a new edge, and the next raise repeats the recorded arithmetic (~25% headroom above the measured size plus the growth still planned).

### handoff 2026-10-11 @arggon-maker — next: Delivery lead: review the raised 640 KiB bound and merge so PR #713 can rebase onto main; the durable bite proof is in cli/src/plugin-bundle.test.ts.

- branch: feat/task-plugin-bundle-near-byte-ceiling
- open questions: None blocking. Comment-filed acceptance boxes left unticked per agents.md §5 (the live section gates; verified). smoke:native-start-cold flaked one provider leg on run 1, green on both re-runs.

### 2026-10-11 @arggon-maker
Maker follow-up — branch synced onto main; measurement restated at main's real size.

**Sync.** The branch was cut before PR #712 merged, so it was a merge-base behind `origin/main` (which carries `lib/src/friction-report.ts`, the grown friction module/operations/cli and a regenerated 523,689-byte bundle). Rebase would need a force-push, and the session permission layer denies every force spelling (`git push --force*` also matches `--force-with-lease`) — the open `bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use`. Routing around the gate (delete the branch and re-push) was refused as the wrong fix, so `origin/main` was merged in instead (commit "merge: sync onto origin/main"), which also makes this PR's three-dot diff resolve against main's tip: the PR now shows exactly the bound raise, its test, the merged artifact and this item's body. The merge was a clean resolution — the item body conflict kept this branch's claimed/work state, the T2 item kept main's merged state.

**Measurement, restated.** Synced branch = `origin/main` + this change: `build:plugin` reports "45 modules inlined, 523689 bytes" — PR #712's size, now on the branch — against the raised 655,360 bound, i.e. 131,671 bytes (25%) of headroom. The artifact arrived with the merge and the regeneration is byte-identical to main's committed copy, so `check:plugin` reports no drift and the artifact diff on this PR is main's own, not a rewrite. PR #713's 524,472 fits the same ceiling with 130,888 bytes to spare, so it can rebase onto this merge.

**Gates, re-run on the merged tree.** `npm run build` green; `npm test` 3032 passed / 140 files (the 27 extra tests are PR #712's, arriving with the merge); `npm run check:plugin` green; `npm run lint` exit 0; `arggon validate` ok (0 warnings); `test:structure`, `lint:structure`, `spec analyze --baseline` (0 new), `smoke:native-start-cold`, `smoke:worktree-playwright` green. Note the pre-commit hook (`arggon validate`) needs the worktree's `lib/dist` rebuilt after a merge — `npm run build` does that, then the hook passes.

**Nothing about the decision changed.** 512 KiB -> 640 KiB stands: the bound is a noise gate protecting against accidental dependency creep and a runaway bundle, ~25% above the largest measured size in this chain, with the durable boundary proof in `cli/src/plugin-bundle.test.ts` (exactly-on-bound builds, one byte over throws `plugin bundle: 655361 bytes > 655360 bound`).

### handoff 2026-10-11 @arggon-maker — next: Delivery lead: review and merge PR #716 (bound 524288 -> 655360, durable bite proof in cli/src/plugin-bundle.test.ts); PR #713 then rebases onto it at its 524472 bytes.
- branch: feat/task-plugin-bundle-near-byte-ceiling
- open questions: None blocking; CI green on #716 (cli + ui-smoke + tasks-validate). Force-push stays seam-denied (bug-force-push-gate), so any later main sync is a merge, never a rebase.
