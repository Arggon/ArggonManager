---
type: bug
status: todo
id: bug-skill-exploration-reference-fails-prettier
title: "skills/arggon-cli/references/exploration.md fails `prettier --check` at HEAD — pre-existing, found while keeping a methodology diff on-item"
parent: methodology-improvements
labels: [docs, chore, skills]
priority: p3
created: "2026-10-04"
updated: "2026-10-04"
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

<!-- The real acceptance criteria; tick each box when met. -->

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
