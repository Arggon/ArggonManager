---
type: bug
status: todo
id: bug-wave-probe-file-check-model-dependent
title: "`smoke:opencode:wave`'s \"probe file never created\" check is model-dependent — the standards reviewer is designed to have shell, so `edit: deny` is not a filesystem sandbox"
parent: methodology-improvements
labels: [tests, smoke, tooling]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-wave-probe-file-check-model-dependent.md
  Leaves live only under a story. id is the filename stem: bug-wave-probe-file-check-model-dependent.
  CLI `arggon create bug wave-probe-file-check-model-dependent` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `smoke:opencode:wave`'s "probe file never created" check is model-dependent — the standards reviewer is designed to have shell, so `edit: deny` is not a filesystem sandbox

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

Found reviewing PR #641. `smoke:opencode:wave` asserts that a reviewer dispatch **did not
create a probe file**, as evidence the reviewer is read-only. That inference is unsound: the
standards reviewer's contract **grants shell on purpose** (it may run read-only inspections —
`git log`, `git diff`, `cat`/`grep`), and `edit: deny` is a **tool permission, not a filesystem
sandbox**. A reviewer that shells `touch` would violate the spirit of the role while passing
every permission probe.

So the check measures the model's behaviour, not the seam's enforcement — and a future model
that happens to shell out makes CI red for no real regression. That is the mirror image of the
silent-failure class the rename's AC 2 guards against.

## Acceptance

- [ ] The check either asserts something **structural** (the reviewer's permission set denies
      the mutating tools — which is deterministic) or is explicitly labelled advisory and moved
      out of the blocking set
- [ ] If kept as behavioural evidence, its failure message says what a real regression would
      look like versus a model that simply used its shell
- [ ] Cross-checked against the OpenCode permission probe already in the harness (reviewer edit
      denied, maker cannot nest) — the structural assertion probably already exists and this is
      a duplicate signal
- [ ] `smoke:opencode:wave` green; note the harness is model-driven and must be run alone
- [ ] Also recorded: the harness's pinned **default model was out of quota** during PR #641's
      run (13 transcripts failed `AI.Error.QuotaExceeded`, green on a different model). Either the
      default should be overridable by env or the failure message should name quota as the likely
      cause, so a quota wall is not read as a product failure
