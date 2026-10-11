---
type: task
status: in_progress
id: task-plugin-bundle-near-byte-ceiling
title: "The OpenCode plugin bundle is at 523689/524288 MAX_BUNDLE_BYTES — the friction chain's remaining items (T4/T5/MCP surface) will cross it; raise the cap or split the module before it bites"
assignee: arggon-delivery-lead
branch: feat/task-plugin-bundle-near-byte-ceiling
parent: opencode2-hardening
labels: [tooling, plugin]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T15:43:39.582Z"
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

- [x] Measurement stated: on this branch (main + base) `npm run build:plugin` reports 513,592 bytes against the 524,288 bound (10,696 of headroom); PR #712 measured 523,689 (599 bytes) and PR #713 measured 524,472 — over the bound, so CI fails at `npm run build` with `plugin bundle: 524472 bytes > 524288 bound` (reproduced on this worktree by padding the graph to 524,636 bytes with the old bound still in place, scratch reverted).
- [x] Decision recorded: raise `MAX_BUNDLE_BYTES` 512 KiB → 640 KiB (655,360 bytes). Splitting rejected — the adopter shape is ONE vendored file and nothing in the graph is droppable; the bound protects against accidental dependency creep and an accidental runaway bundle, and 640 KiB keeps ~131 KiB (25%) of headroom past PR #713's measured 524,472 with the remaining planned growth (T4 opt-out keys, T5 MCP surface + json-output + doctor) additive to the same bundle.
- [x] The gate still bites: `cli/src/plugin-bundle.test.ts` builds a graph sized exactly to the bound (allowed) and one byte past it (throws `plugin bundle: 655361 bytes > 655360 bound`), plus pins the real artifact under the bound.
- [x] `npm test` (3005 passed / 138 files), `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok; `test:structure`, `lint:structure`, `spec analyze --baseline`, `smoke:native-start-cold`, `smoke:worktree-playwright` green too.
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
