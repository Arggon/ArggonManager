---
type: task
status: todo
id: task-spec-analyze-naming-and-skill-mirror
title: "`spec analyze` is silent on non-conforming doc filenames, and the collision rule is not mirrored into `skills/arggon-cli/references/methodology.md`"
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-03"
updated: "2026-10-03"
depends_on: [bug-spec-analyze-does-not-detect-duplicate-doc-numbers]
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-analyze-naming-and-skill-mirror.md
  Leaves live only under a story. id is the filename stem: task-spec-analyze-naming-and-skill-mirror.
  CLI `arggon create task spec-analyze-naming-and-skill-mirror` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `spec analyze` is silent on non-conforming doc filenames, and the collision rule is not mirrored into `skills/arggon-cli/references/methodology.md`

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Two findings from the reviewer of PR #603 (bug-spec-analyze-does-not-detect-duplicate-doc-numbers), 2026-10-03, both advisory:

1. **Non-conforming filenames are silent.** `docNumberCollisions` buckets what it can parse and ignores the rest, so a doc named outside the conventions (`NNNN-<slug>.md`, `exploration-<slug>-NNN.md`, `spec-<slug>-NNN.md`, `plan-<slug>-NNN.md`) is never counted, never reported, and never collided. In the live corpus the only unmatched file is `docs/adr/README.md`, which is correct — but a typo'd spec (`spec-foo-9.md`) would silently escape both the collision rule and `spec new`'s numbering.

2. **The rule is not mirrored into the agent skill.** `skills/arggon-cli/references/methodology.md` (and its byte-equal copy under `.agents/skills/`) documents the spec/plan/exploration pipeline but never says a number must be unique, or that `spec new` picks the next free number. An agent authoring docs from the skill alone can still collide — the exact failure this bug exists to stop. Per `docs/agents.md` §Changing the methodology this is a **Behavioral** change if it lands (agents must re-learn something), and the skill copies must stay byte-equal in the same PR.

Acceptance:
- [ ] Non-conforming doc filenames are reported (report-only is fine — consistent with the collision rule's own contract), not silently skipped
- [ ] `spec new` cannot allocate a number already used by a non-conforming file
- [ ] The uniqueness rule and `spec new`'s next-free-number behavior are documented in `skills/arggon-cli/references/methodology.md` AND its byte-equal `.agents/skills/` copy, with the ADR 0016 impact statement
- [ ] Depends on the detector landing so the doc text matches the shipped behavior
