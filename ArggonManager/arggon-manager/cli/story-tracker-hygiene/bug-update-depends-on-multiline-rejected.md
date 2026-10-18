---
type: bug
status: in_progress
id: bug-update-depends-on-multiline-rejected
title: update --depends-on serializes multi-line flow YAML that validate rejects as BROKEN_YAML
assignee: arggon-delivery-lead
branch: fix/bug-update-depends-on-multiline-rejected
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-18"
claimed_at: "2026-10-18T20:21:15.069Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-update-depends-on-multiline-rejected
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

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
**Second producer observed (2026-10-15, delivery lead), recorded here so the fix covers all producers.** While closing `task-cli-start-remediation-tail-clipped-on-human-channel`'s sweep item the standard close-out path (acceptance tick → `npx prettier --write <item.md>` → validate) produced the same unparseable shape from a THIRD producer — the repo's own formatter reflowing a long INLINE list:
```yaml
depends_on: [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
```
becomes
```yaml
depends_on:
  [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
```
and the strict single-line parser then refuses `invalid frontmatter line: "  [task-…, task-…]"` — `arggon validate` red and `arggon update --status done` refuses, so the close-out flow itself can make an item un-flippable. So the producers are: the `update` writer (block form, this item) and the formatter (two-line inline, plus `bug-start-claim-commit-frontmatter-fails-prettier`'s `title:` quoting hunk and `bug-session-formatter-normalizes-tracker-item-files`'s body normalisation). One parser/writer-side fix that accepts the wrapped-list shape — scoped so a genuinely broken line is still refused — closes my instance; my filed instance (`bug-prettier-reflow-breaks-item-frontmatter`) is being closed as a duplicate so the fix is not split across two items on the same parser line.
