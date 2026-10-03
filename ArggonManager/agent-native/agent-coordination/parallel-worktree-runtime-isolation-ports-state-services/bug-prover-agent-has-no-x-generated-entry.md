---
type: bug
status: todo
id: bug-prover-agent-has-no-x-generated-entry
title: "`.opencode/agents/arggon-prover.md` is committed with NO `x-generated` entry, so `init` classifies it adopter-modified and skips it — invisible to both seam gates"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, hygiene]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-prover-agent-has-no-x-generated-entry.md
  Leaves live only under a story. id is the filename stem: bug-prover-agent-has-no-x-generated-entry.
  CLI `arggon create bug prover-agent-has-no-x-generated-entry` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `.opencode/agents/arggon-prover.md` is committed with NO `x-generated` entry, so `init` classifies it adopter-modified and skips it — invisible to both seam gates

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #607 (bug-seam-drift-gate-blocks-new-generated-seam-content), 2026-10-03, while making the seam drift gate branch-aware. Independently confirmed twice: the reviewer of PR #606 also identified this exact file as the live example of the no-provenance-state case it had to fix classification for.

**The gap.** `.opencode/agents/arggon-prover.md` exists in the tree but has **no `x-generated` entry** in `ArggonManager/.convention.yml` — it was added after v0.5.0 (by d0aba5ef / #583) without a regenerated state file. So:

- `arggon init` classifies it **adopter-modified** and skips it. If its template ever drifts, nobody is told.
- The seam drift gate cannot see it either: it compares committed bytes against what the generator produces, and this file is in the skipped set, so it is neither verified nor reported.

This is a genuine blind spot in BOTH enforcement layers: the file is unverified and unreported, and it looks like ordinary committed content. Note the irony worth recording — it is also the one file that PR #606's classification fix was *proven against* (a present dest with no provenance state must be `adopter-edited`, not `stale`), so the bug that made it invisible is the same bug that class caught.

Two possible remedies, and the choice is not obvious: (a) run a full seam regeneration and commit the resulting state entry, accepting the known 15-stamp drift sweep; or (b) make the gates report "a committed file under a managed path has no provenance entry" as a finding, which would catch the whole CLASS rather than this instance — the same false-absence lint shape the capability matrix adopted for gap notes.
