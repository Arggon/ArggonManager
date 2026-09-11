---
type: story
status: todo
id: story-spec-pipeline
title: Spec pipeline (validate + templates)
parent: ecosystem-ops
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/story-spec-pipeline.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Spec pipeline (validate + templates)

## Context

The repo already writes specs and plans (spec-sync-001); formalize them so agents can trust and check them: a template, `arggon spec validate` (frontmatter, required sections, status enum), and statuses that flip on landing.

## Acceptance

- [ ] `arggon spec validate [--file <path>]` checks spec/plan structure; template scaffolded under `templates/`
- [ ] Sync spec/plan remain valid under the validator
