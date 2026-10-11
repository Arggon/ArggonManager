---
type: bug
status: in_progress
id: bug-skill-exploration-reference-fails-prettier
title: "skills/arggon-cli/references/exploration.md fails `prettier --check` at HEAD — pre-existing, found while keeping a methodology diff on-item"
assignee: arggon-delivery-lead
branch: fix/bug-skill-exploration-reference-fails-prettier
parent: methodology-improvements
labels: [docs, chore, skills]
priority: p3
created: "2026-10-04"
updated: "2026-10-11"
claimed_at: "2026-10-11T04:23:44.958Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-skill-exploration-reference-fails-prettier
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-skill-exploration-reference-fails-prettier.md
  Leaves live only under a story. id is the filename stem: bug-skill-exploration-reference-fails-prettier.
  CLI `arggon create bug skill-exploration-reference-fails-prettier` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# skills/arggon-cli/references/exploration.md fails `prettier --check` at HEAD — pre-existing, found while keeping a methodology diff on-item

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [x] `npx prettier --check skills/arggon-cli/references/exploration.md` passes
- [x] Semantically identical — formatting fix only, no sentence changes
- [x] `cli/src/skill-copy.test.ts` green (the `.agents/skills/` copy stays byte-equal modulo the generated marker)
- [ ] `npx prettier --check` over the whole `skills/` tree passes, so this is not the last one

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

`skills/arggon-cli/references/exploration.md` fails `npx prettier --check` at HEAD —
pre-existing, found while keeping PR #636's diff on-item. The worker deliberately did
not fix a pre-existing formatting failure inside a methodology PR, which is right.

It matters beyond cosmetics: `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**`
must stay byte-equal, and a file that cannot pass the repo's own formatter is one the
next agent either reformats silently or leaves forever.

## Acceptance

- [ ] `npx prettier --check skills/arggon-cli/references/exploration.md` passes
- [ ] Semantically identical — formatting fix only, no sentence changes
- [ ] `cli/src/skill-copy.test.ts` green (the `.agents/skills/` copy stays byte-equal modulo the generated marker)
- [ ] `npx prettier --check` over the whole `skills/` tree passes, so this is not the last one

### handoff 2026-10-11 @ses_ed66601e2ffeHpdTuTzlHO1MJx (session: ses_ed66601e2ffeHpdTuTzlHO1MJx) — next: Delivery lead: review PR #687 (format-only fix + x-generated checksum refresh + acceptance ticks); file the 3 sibling skills/ prettier failures as their own items.
- branch: fix/bug-skill-exploration-reference-fails-prettier
- open questions: One item per sibling (EVALS.md, evals/run.mjs, argonne-upgrade/SKILL.md) or one chore?; headless-ci.test.ts fails in fresh worktrees without dist/ — confirm the CI lane is green on the PR.
