---
type: bug
status: in_progress
id: bug-wave-smoke-retired-model-pin
title: smoke/opencode-wave.ts still pins the retired opencode-go/deepseek-v4-flash model — same mass failure the full smoke just fixed
assignee: arggon-delivery-lead
branch: fix/bug-wave-smoke-retired-model-pin
parent: story-opencode-adapter
labels: [opencode-seam, tests]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T10:58:26.051Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-wave-smoke-retired-model-pin
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/bug-wave-smoke-retired-model-pin.md
  Leaves live only under a story. id is the filename stem: bug-wave-smoke-retired-model-pin.
  CLI `arggon create bug wave-smoke-retired-model-pin` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# smoke/opencode-wave.ts still pins the retired opencode-go/deepseek-v4-flash model — same mass failure the full smoke just fixed

## Context

Found while landing `bug-full-smoke-scenarios-precede-newer-gates` (PR #799): the provider retired `opencode-go/deepseek-v4-flash`. The full smoke (`smoke/opencode-smoke.ts`) failed en masse until its default pin moved to `opencode-go/deepseek-v4.1-flash` (commit 36225d2d, canaried with the focused verifier probe 11/11). `smoke/opencode-wave.ts:96` still pins the retired model, so the scripted wave smoke will fail the same way until it moves. The two smokes should not drift apart on the model pin again.

## Acceptance

- [x] `smoke/opencode-wave.ts` no longer pins the retired model; the replacement is canaried (a focused run, or the full wave run alone) or the reason it cannot be is documented
- [x] the model pin has one source or a documented reason to differ between `opencode-smoke.ts` and `opencode-wave.ts`
- [x] evidence recorded on the item (command/expected/observed); `arggon validate` green; prettier clean on touched files

## Notes
