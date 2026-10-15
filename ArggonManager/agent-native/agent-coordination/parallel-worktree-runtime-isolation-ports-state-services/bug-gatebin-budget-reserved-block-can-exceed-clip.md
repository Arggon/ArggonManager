---
type: bug
status: done
id: bug-gatebin-budget-reserved-block-can-exceed-clip
title: "Gate-bin budget: the `≥1 name` override stops being safe when the reserved mandatory block alone exceeds MAX_HUMAN_ERROR_CHARS (~700+ char paths) — needs a defined behaviour, not silent loss"
assignee: arggon-delivery-lead
branch: fix/bug-gatebin-budget-reserved-block-can-exceed-clip
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cli, bounded-output]
created: "2026-10-03"
updated: "2026-10-15"
claimed_at: "2026-10-15T13:21:35.949Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-gatebin-budget-reserved-block-can-exceed-clip
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-gatebin-budget-reserved-block-can-exceed-clip.md
  Leaves live only under a story. id is the filename stem: bug-gatebin-budget-reserved-block-can-exceed-clip.
  CLI `arggon create bug gatebin-budget-reserved-block-can-exceed-clip` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Gate-bin budget: the `≥1 name` override stops being safe when the reserved mandatory block alone exceeds MAX_HUMAN_ERROR_CHARS (~700+ char paths) — needs a defined behaviour, not silent loss

## Context

Named as a residual edge by the reviewer of PR #608 (task-cli-start-remediation-tail-clipped-on-human-channel), 2026-10-03, after it approved the code. Filed rather than fixed there because the behaviour is a CONTRACT decision, not a tweak.

**The edge.** The budget-driven fix reserves every mandatory clause (kept-worktree note, generic fix, exact fix, attach re-run, discard hint, raw detail) against `MAX_HUMAN_ERROR_CHARS = 2000`, then fills the remainder with bin names — and always names ≥1 when there is evidence.

The reviewer proved the core identity: `composed = mandatory + readiness.length` with `budget = MAX − mandatory`, so the **discard hint survives for any fill** as long as the reserved block fits. The reserved block does NOT always fit: with `~700+` char worktree paths it alone can exceed the clip, and then the ≥1 override pushes a name in anyway — i.e. the exact regression this item set exists to remove (the remedy being the thing that gets eaten) reappears in a narrower window.

Two smaller edges from the same review, worth carrying:

- the fill's length comparison omits the `'; '` it appends (≤2 chars), which lands in the trailing detail rather than being lost — harmless, but unstated
- `104` vs `117`: the reviewer's own round-2 "structurally impossible" claim was withdrawn with a corrected derivation, and it explicitly called the remaining 104-vs-117 discrepancy "historical trivia" since the order is now ASSERTED rather than quoted

## Acceptance

- [x] A defined behaviour when the mandatory block alone exceeds the clip: either the mandatory clauses are themselves prioritised (exact fix first, raw detail dropped) with the truncation named, or the message refuses to grow and says so — never silently eat the remedy
- [x] The ≥1 override respects that decision (it must not reintroduce the clip by force)
- [x] A test with `~700+` char paths asserting the chosen behaviour, so the window is covered rather than documented
- [x] Note in the implementation comment which clause is guaranteed to survive and why, so the invariant is stated once at the place that enforces it

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

### 2026-10-15 @Arggon

### Evidence — completed by the delivery lead after the maker session died to a provider usage limit (work complete and green, uncommitted)

Decision (box 1): prioritise the exact fix with the truncation named — over-budget composition = notice → exact fix → kept-path lead → generic fix → discard hint → detail; the human clip eats the tail only, and every clause still rides the --json error. The ≥1 name override takes an overrideLimit and yields (null) past the room that keeps the actionable clauses whole; the observation rides startFailureReadiness instead. The fill measures its '; ' separator.

Box 4: the guaranteed clause is stated in the implementation comment at the enforcing point — the exact fix (the only clause the operator can act on without re-deriving; it leads, only the notice precedes), else the kept-path lead.

Gates: focused start 73/73; full suite 160 files / 3543; validate/lint/structure/prettier green. Lead review + merge pending.

### handoff 2026-10-15 @Arggon — next: Delivery lead: review + merge the PR when CI is green; then tick the four boxes and flip done.

- branch: fix/bug-gatebin-budget-reserved-block-can-exceed-clip

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx

verdict: approve

### Lead review + merge verification — 2026-10-15 (delivery lead; completed by the lead after the maker session died to a provider usage limit — the work was complete and green but uncommitted)

Merged as 7d68d2a4 (PR #845). Decision (box 1): prioritise the exact fix with the truncation named — over budget, the message leads notice → exact fix → lead → generic fix → discard hint → detail, so the head-kept clip eats only the tail while `--json` still carries every clause. The `≥1 name` override now takes an `overrideLimit` and YIELDS (`null`) past the room that keeps the actionable clauses whole (the regression this item named: pushing a name into a window that cannot show it, alive again in a narrower form); the observation is never lost — it rides `startFailureReadiness` for `--json`. The fill measures its own `'; '` separator (the unstated ≤2-char term). Box 4: the guaranteed clause is stated where it is enforced — the exact fix (the only clause the operator can act on without re-deriving; it leads, only the notice precedes), else the kept-path lead.

Evidence: two ~700+-char-path tests (override yields, the notice names the truncation at the head, the exact fix survives whole, `--json` keeps the tail) + the ~1250-char-path extreme; focused start 73/73; full suite 3543; validate/lint/structure/prettier green; CI green. The lead added box 4's note and ran the full gates. Branch hygiene: the branch inherited pre-rebase tracker commits (the very class this wave ships a fix for) — rebased onto main and force-pushed **with lease**, so the PR carries only in-scope files.
