---
type: bug
status: todo
id: bug-update-depends-on-multiline-rejected
title: update --depends-on serializes multi-line flow YAML that validate rejects as BROKEN_YAML
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-update-depends-on-multiline-rejected.md
  Leaves live only under a story. id is the filename stem: bug-update-depends-on-multiline-rejected.
  CLI `arggon create bug update-depends-on-multiline-rejected` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# update --depends-on serializes multi-line flow YAML that validate rejects as BROKEN_YAML

## Context

Found 2026-10-12 by the delivery lead while wiring `depends_on` on `task-validate-refuses-placeholder-bodies`: `tools.arggon.update({ id, depends_on: [6 ids] })` returned `ok:true` and auto-committed a frontmatter block of the form `depends_on:\n  [\n    a,\n    ...,\n  ]` — which `arggon validate` rejects with `BROKEN_YAML: invalid frontmatter line: "  ["`. The kernel frontmatter parser (`lib/src/frontmatter.ts`) is strictly single-line `key: value`; any continuation line throws. So the write path produces bytes the read path refuses, and the failure surfaces only at the next `validate` (here, the pre-commit hook), not at the `update` call that caused it. Hand-repair to single-line flow style passes validate but trips `prettier --check` (printWidth 100); block `- ` style passes prettier but fails validate the same way. There is no serialization that satisfies both — the write path must emit what the read path accepts.

## Acceptance

- [ ] `update --depends-on` / `--add-depends-on` (CLI + native) emits single-line frontmatter the kernel parser accepts, for any entry count — a round-trip test pins write→validate→read
- [ ] The fix covers `labels` and any other list field sharing the serializer, or states why depends_on is the only one
- [ ] `npm test` green; prettier clean; `arggon validate` green; PR opened

## Notes
