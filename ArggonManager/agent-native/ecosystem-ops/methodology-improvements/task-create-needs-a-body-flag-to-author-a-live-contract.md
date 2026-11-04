---
type: task
status: done
id: task-create-needs-a-body-flag-to-author-a-live-contract
title: "`arggon create` has no `--body`, so the first write of a live acceptance contract is a hand-edit — and the done gate now refuses any item that has none"
assignee: arggon-superagent
branch: agent/create-validation-reporting-90eafb4534a9
parent: methodology-improvements
labels: [cli, tracker-schema]
created: "2026-10-06"
updated: "2026-11-04"
worktree_path: /home/arggon/.dsh/state/superagent/work/create-validation-reporting-90eafb4534a9
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-create-needs-a-body-flag-to-author-a-live-contract.md
  Leaves live only under a story. id is the filename stem: task-create-needs-a-body-flag-to-author-a-live-contract.
  CLI `arggon create task create-needs-a-body-flag-to-author-a-live-contract` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon create` has no `--body`, so the first write of a live acceptance contract is a hand-edit — and the done gate now refuses any item that has none

## Context

PR #656 makes the done gate refuse a claimable leaf whose live `## Acceptance` section publishes no criterion — otherwise a fresh `arggon create` scaffold would be the default flippable item. The reviewer independently tested the alternative (prefer the live section, else fall back to the comment record): it disagreed with the shipped kernel on 67 leaves, every one already `done` and zero open leaves. So the fallback buys nothing and re-opens exactly the door the rule closes.

But the rule leaves a mechanical gap: `arggon create` scaffolds a template placeholder comment, not a checklist, and there is no `--body` flag to author one. So the first write of a live contract is a hand-edit of a generated file. Measured cost: 7 open leaves with zero criterion rows anywhere, now un-flippable until someone hand-edits them.

This is the follow-up that makes the rule's cost proportionate. It was named as "the natural follow-up" in the maker's report and not filed, because makers report findings rather than filing them.

## Acceptance

- [x] `arggon create` accepts a body — at minimum `--body <file>`, and consider `--acceptance '<criterion>'` for seeding one criterion — so a live contract can be authored without hand-editing a generated file
- [x] The ADR 0025 rule and this affordance are recorded together: `convention.md`'s done-gate section says how a new item acquires its live contract, not only what happens when it has none
- [x] The authoring-vs-skeleton question is decided: authoring a body at creation versus having `create` emit a real `- [ ] <criterion>` skeleton row — a bare box is a scaffold, not a criterion (`convention.md:300`), so any skeleton must carry text to count
- [x] Covered at the command surface with a typed code in the stable JSON envelope, not only at library level — `task-validate-missing-frontmatter-command-surface-assertions` is the precedent for the sibling gap
- [x] A test proves a created-then-completed item flips `done` without a waiver and without a hand-edit — the end-to-end statement of this whole class

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q

Filed from the review of PR #656 (`bug-done-gate-counts-checkboxes-inside-comment-blocks`), which the maker correctly declined to file itself.

### Context

PR #656 makes the done gate refuse a claimable leaf whose **live `## Acceptance` section publishes no criterion**, reasoning that a fresh `arggon create` scaffold would otherwise be the _default_ flippable item. That rule is right — the reviewer independently tested the alternative (prefer the live section, else fall back to the comment record) and it disagreed with the shipped kernel on **67 leaves, every one already `done`, and zero open leaves**. So the fallback buys nothing and re-opens exactly the door the rule closes.

But the rule creates a mechanical problem with no cheap path: `arggon create` scaffolds a template placeholder comment, not a checklist, and there is **no `--body` flag** to author one. So the first write of a live contract is a hand-edit of a generated file. The reviewer measured the cost: **7 open leaves have zero criterion rows anywhere**, and they are now un-flippable until someone hand-edits them.

This is the follow-up that makes the rule's cost proportionate. It was named as "the natural follow-up" in the maker's report and not filed, because makers report findings rather than filing them.

### Acceptance

- [x] `arggon create` accepts a body — at minimum `--body <file>`, and consider `--acceptance '<criterion>'` for the common case of seeding one criterion — so a live contract can be authored without hand-editing a generated file
- [x] The ADR 0025 rule and this affordance are recorded together: `convention.md`'s done-gate section should say how a new item acquires its live contract, not only what happens when it has none
- [ ] Deciding between them is the real question: authoring a body at creation, versus having `create` emit a real `- [ ] <criterion>` skeleton row. A bare box is a scaffold, not a criterion (`convention.md:300`), so the skeleton must carry text to count
- [ ] Covered at the **command** surface with a typed code in the stable JSON envelope, not only at library level — `task-validate-missing-frontmatter-command-surface-assertions` records the same gap for a sibling feature and is the precedent
- [ ] A test that a created-then-completed item flips `done` **without** a waiver and without a hand-edit, which is the end-to-end statement of this whole class

### 2026-11-04 @arggon-superagent

Delivered on `agent/create-validation-reporting-90eafb4534a9` (issue #870):

- `create --body <file>` reads a complete Markdown body replacement; repeatable `--acceptance '<criterion>'` authors unchecked live rows (single-line, mutually exclusive with `--body`). MCP/native create take inline `body` content.
- Shipped task/bug templates now scaffold title-derived Context prose and one unchecked live criterion (title escaped as inline Markdown), so a fresh leaf validates and auto-commits under the validate pre-commit hook.
- `commitTrackerMutation` classifies actionable failures (`git-add-failed`, `git-commit-failed`, `git-index-locked`, `staged-entry-lost`) apart from benign skips. `createOperation`/CLI return `ok: false` + `CREATE_COMMIT_FAILED` with the created `path`, `item` and `commit` retained; the human path exits 1 and says to commit the existing file, never rerun create.
- Docs updated: convention authoring decision, agents §0, json-output envelope/body/failure contract, README, skill JSON contract, ADR 0025 dated amendment, reference/spec statements.
- Tests: kernel create/acceptance + commit classification; CLI end-to-end create → validate → hook commit → claim → done with no waiver or hand-edit; typed hook rejection with the item retained; MCP/native body parity; placeholder-guard updates.
