---
type: bug
status: todo
id: bug-convention-parser-rejects-valid-yaml-force-rescaffolds
title: "`parseConventionConfig`'s strict line-parser rejects valid YAML (`allow-steal: true # armed`, a `post-start: |` block scalar, a quoted top-level key), so `init --force` re-derives the file wholesale and discards the adopter's configuration — the loss is reported, but it should not happen"
parent: methodology-improvements
labels: [cli, convention, safety]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-convention-parser-rejects-valid-yaml-force-rescaffolds.md
  Leaves live only under a story. id is the filename stem: bug-convention-parser-rejects-valid-yaml-force-rescaffolds.
  CLI `arggon create bug convention-parser-rejects-valid-yaml-force-rescaffolds` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `parseConventionConfig`'s strict line-parser rejects valid YAML (`allow-steal: true # armed`, a `post-start: |` block scalar, a quoted top-level key), so `init --force` re-derives the file wholesale and discards the adopter's configuration — the loss is reported, but it should not happen

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
