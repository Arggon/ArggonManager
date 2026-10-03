---
type: bug
status: todo
id: bug-zero-byte-item-files-committed-by-comment-autocommit
title: "Four item files are 0 bytes on main — the emptying commits are NOT all tracker auto-commits (2 are squash-merged PR commits) and three were already empty in the parent, so the corruption travels between worktrees"
parent: story-spec-pipeline
labels: [tracker-schema, cli]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-zero-byte-item-files-committed-by-comment-autocommit.md
  Leaves live only under a story. id is the filename stem: bug-zero-byte-item-files-committed-by-comment-autocommit.
  CLI `arggon create bug zero-byte-item-files-committed-by-comment-autocommit` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Four item files were committed on main as 0-byte blobs by their own 'chore(tasks): commented' auto-commit — a zero-byte item silently un-claims it and drops its acceptance history

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @Arggon
Found by the worker on PR #619 (`bug-validate-does-not-check-frontmatter-present`), 2026-10-03. The read-side validator gap is being fixed there; **this is a writer-side regression and is NOT part of that fix.**

**What happened.** The moment PR #619's new rule landed locally, `validate` surfaced **4 item files committed on `main` as 0-byte blobs**. In every case, the commit that emptied the file is its own `chore(tasks): commented <id>` tracker auto-commit.

**Why it matters more than a corrupt file.** A zero-byte item has no frontmatter and no body. The tracker then treats it as *not an item* rather than as a broken one, so it **silently un-claims a claimed item and drops its entire acceptance history and comment record** — the comment that emptied it is the last thing anyone wrote to it, and the evidence is gone. This is exactly the failure class PR #619 exposes on the read side, arriving from the write side.

**Why it is not yet a confirmed root cause.** Every item write funnels through `stringifyFrontmatter`, and every item writer uses `writeFileAtomic` (temp file + rename), so an in-place truncate should be impossible. The worker **could not reproduce it and did not fix it.** That honest non-reproduction is the reason this is filed rather than patched.

Acceptance:
- [ ] Root cause found, or the class ruled out with evidence — the fact that `writeFileAtomic` makes in-place truncation impossible is a strong claim and it is contradicted by four real zero-byte files on `main`, so one of the two is wrong
- [ ] Specifically investigate: does the tracker auto-commit path (`commentTrackerMutation` → `arggon comment`) read-modify-write the item file with a window between read and rename? Does any path write the file before the comment content is assembled? Is `git commit -a` or an index-level write involved rather than the filesystem path?
- [ ] **Recover the four items' content from git history** and confirm each recovery is byte-for-byte. Do this even if the root cause is never found — the content is recoverable now and will not be after a gc.
- [ ] A gate that catches this class: `arggon validate` should treat a **0-byte item file** as its own error code, distinct from `MISSING_FRONTMATTER`. A missing block and an emptied file are different failures with different causes, and PR #619's read-side fix only covers the first
- [ ] Swept: how many other tracker files have been committed 0-byte or truncated mid-body in history? Four instances of one shape is a class, not an accident
- [ ] Check whether the same auto-commit path is used by `arggon handoff`, `arggon update`, and `arggon create` — if one path is at fault, all three inherit it

Depends on nothing; can be worked immediately. PR #619 restores the four files in a separate, droppable commit so its validator can be reviewed on its own — **do not fold this investigation into that PR.**
