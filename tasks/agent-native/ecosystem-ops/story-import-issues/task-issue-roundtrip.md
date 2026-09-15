---
type: task
status: todo
id: task-issue-roundtrip
title: "issue round-trip: done flips close/annotate the linked GitHub issue"
parent: story-import-issues
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/task-issue-roundtrip.md
  Leaves live only under a story. id is the filename stem: task-issue-roundtrip.
  CLI `arggon create task issue-roundtrip` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# issue round-trip: done flips close/annotate the linked GitHub issue

## Context

Candidate #7 of [product discovery](docs/explorations/exploration-product-discovery-002.md): `import-issues` is one-shot — items carry the linked GitHub issue in the additive `issue` frontmatter field but never push status back, so dual-tracker teams drift. Linear×Copilot issue→PR→status flows are now the norm (github.blog, 2026-07-23). Effort S; principle: same-rules, repo-is-truth (the issue id is already in frontmatter).

## Acceptance

- [ ] Opt-in round-trip lands: on `update --status done`, items with `issue:` frontmatter close/annotate the linked issue via gh (config-gated, e.g. x-github round-trip flag, or explicit `--close-issue` — decide and document)
- [ ] gh absent/unauthenticated → clean skip, never blocks the done flip
- [ ] Tests with a mocked gh path; docs (README + json-output additive note)

## Notes
