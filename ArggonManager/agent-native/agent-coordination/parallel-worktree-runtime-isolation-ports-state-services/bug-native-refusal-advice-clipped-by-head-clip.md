---
type: bug
status: todo
id: bug-native-refusal-advice-clipped-by-head-clip
title: "Native gate-bin and fresh-worktree-install refusals append their advice AFTER the kernel refusal, so MAX_NATIVE_ERROR_CHARS can clip the remedy away"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, parity]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-refusal-advice-clipped-by-head-clip.md
  Leaves live only under a story. id is the filename stem: bug-native-refusal-advice-clipped-by-head-clip.
  CLI `arggon create bug native-refusal-advice-clipped-by-head-clip` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native gate-bin and fresh-worktree-install refusals append their advice AFTER the kernel refusal, so MAX_NATIVE_ERROR_CHARS can clip the remedy away

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Found while reviewing PR #579: the native seam's other two refusals have the composition defect that #579 just fixed for the worktree-write refusal. Both build `failBeforeClaim(\`\${<kernel refusal>}\${advice}\`, …)` — kernel text first, advice last — while `startFailure` clips the composed message at `MAX_NATIVE_ERROR_CHARS = 2048` and `clip()` keeps the HEAD. The advice is therefore the first thing lost when the named file list is long. The CLI equivalents were already reordered in #573's round 2 for exactly this reason, and the project record treats it as a defect.

## Acceptance
- [ ] Both native refusals compose the actionable advice FIRST (kernel refusal last), keeping every existing clause verbatim — same shape #579 landed for `strict worktree-write gate refused`.
- [ ] A test per refusal with the worst-case named-list (10 long paths) asserting the advice (the `npm ci` remedy + the prep log for the fresh-worktree gate; the named bins + attach re-run for the gate-bin gate) survives the clip, with the ordering pinned (advice index precedes the first named path).
- [ ] Negative control: assert the message length is at the cap and the last named path is absent, so the test cannot pass on a merely longer message.
