---
type: bug
status: todo
id: bug-gatebin-budget-reserved-block-can-exceed-clip
title: "Gate-bin budget: the `≥1 name` override stops being safe when the reserved mandatory block alone exceeds MAX_HUMAN_ERROR_CHARS (~700+ char paths) — needs a defined behaviour, not silent loss"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, bounded-output]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-gatebin-budget-reserved-block-can-exceed-clip.md
  Leaves live only under a story. id is the filename stem: bug-gatebin-budget-reserved-block-can-exceed-clip.
  CLI `arggon create bug gatebin-budget-reserved-block-can-exceed-clip` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Gate-bin budget: the `≥1 name` override stops being safe when the reserved mandatory block alone exceeds MAX_HUMAN_ERROR_CHARS (~700+ char paths) — needs a defined behaviour, not silent loss

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Named as a residual edge by the reviewer of PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel), 2026-10-03, after it approved the code. Filed rather than fixed there because the behaviour is a CONTRACT decision, not a tweak.

**The edge.** The budget-driven fix reserves every mandatory clause (kept-worktree note, generic fix, exact fix, attach re-run, discard hint, raw detail) against `MAX_HUMAN_ERROR_CHARS = 2000`, then fills the remainder with bin names — and always names ≥1 when there is evidence.

The reviewer proved the core identity: `composed = mandatory + readiness.length` with `budget = MAX − mandatory`, so the **discard hint survives for any fill** as long as the reserved block fits. The reserved block does NOT always fit: with `~700+` char worktree paths it alone can exceed the clip, and then the ≥1 override pushes a name in anyway — i.e. the exact regression this item set exists to remove (the remedy being the thing that gets eaten) reappears in a narrower window.

Two smaller edges from the same review, worth carrying:
- the fill's length comparison omits the `'; '` it appends (≤2 chars), which lands in the trailing detail rather than being lost — harmless, but unstated
- `104` vs `117`: the reviewer's own round-2 "structurally impossible" claim was withdrawn with a corrected derivation, and it explicitly called the remaining 104-vs-117 discrepancy "historical trivia" since the order is now ASSERTED rather than quoted

Acceptance:
- [ ] A defined behaviour when the mandatory block alone exceeds the clip: either the mandatory clauses are themselves prioritised (exact fix first, raw detail dropped) with the truncation named, or the message refuses to grow and says so — never silently eat the remedy
- [ ] The ≥1 override respects that decision (it must not reintroduce the clip by force)
- [ ] A test with `~700+` char paths asserting the chosen behaviour, so the window is covered rather than documented
- [ ] Note in the implementation comment which clause is guaranteed to survive and why, so the invariant is stated once at the place that enforces it
