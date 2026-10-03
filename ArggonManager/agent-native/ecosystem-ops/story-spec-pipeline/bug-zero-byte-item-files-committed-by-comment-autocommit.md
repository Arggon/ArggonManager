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

### 2026-10-03 @Arggon
**CORRECTION (2026-10-03, round-1 review of PR #619). My first diagnosis was wrong in 2 of 4 cases, and this item's original title pointed the next worker at the wrong path. The reviewer checked git history directly; I had taken the PR #619 worker's account, which had itself failed to reproduce the write.**

**What is actually true**, per the reviewer and confirmed by me independently against `origin/main`:

All four files are 0 bytes on `origin/main` right now. But the emptying commits are NOT all tracker auto-commits:

| Item | Emptying commit | Kind |
| --- | --- | --- |
| `task-record-exploration-016-worktree-runtime-isolation` | `16295623` → emptied later | tracker `chore(tasks): commented` |
| `task-derive-cli-spawn-loader` | `e470c86d` | `chore(auto): mark items done (PR #543 merged) (#550)` |
| `task-remove-diag-listener` | `0490dda1` | squash-merged PR commit (#540) |
| `bug-live-reload-sse-race` | `e52f33c3` → emptied later | tracker `chore(tasks): commented` |

**And the decisive finding: parent snapshots show three of the four were ALREADY 0 bytes before the commits listed above.** So the empty state exists in the parent and **travels between worktrees** — it is not created by the commit that appears to introduce it. That inverts the whole investigation: the question is not "which commit truncated this file" but **"how did a worktree end up with an empty file at all, and how did that empty state get merged forward"**.

`writeFileAtomic` (temp + rename) making in-place truncation impossible is therefore not merely unproven — it is insufficient as a theory, since the file is empty in snapshots that predate the blamed commits. Something produced a 0-byte file on some machine and that state propagated. `git merge` with a rename/delete interaction, a checkout conflict resolved by taking "ours" on a file whose other side was empty, and a worktree whose file was truncated by an external tool are all live hypotheses that `writeFileAtomic` does not exclude.

**Recovery has been done** in PR #622, byte-for-byte from each file's last non-empty blob (`16295623`/`e52f33c3`/`e470c86d`/`0490dda1`). Content is safe; **this item is now purely about the cause.**

Acceptance (rewritten — the original box 2 aimed at the wrong path):
- [ ] Explain how a worktree came to hold a 0-byte item file at all, given `writeFileAtomic` makes in-place truncation impossible. The three already-empty-in-parent cases are the priority; the two auto-commit cases may be downstream of the same state
- [ ] **Check the worktree/merge hypotheses specifically**: can a conflicted item file be resolved to 0 bytes by a merge? This repo resolves item-file conflicts constantly — scripted union resolution, `--ours`/`--theirs`, worktrees created from branches whose file was already empty. PR #619's worker restored four files by hand from a detached worktree; that path must not itself produce an empty file
- [ ] The three already-empty-in-parent cases: find the commit where each FIRST became 0 bytes, walking back past the blamed commits. If that commit is in a **merged PR**, the corruption entered through review and merge, which is a different (and larger) gate question
- [ ] `arggon validate` should raise a distinct code for a **0-byte item file**, separate from `MISSING_FRONTMATTER` (PR #619 covers the missing block). A missing block and an emptied file have different causes
- [ ] Swept: how many other tracker files have ever been committed 0-byte or truncated mid-body? Four instances is a class
- [ ] Check whether `arggon handoff`, `arggon update` and `arggon create` share the path — but per the finding above, **do not start from the comment auto-commit path**: two of four were not tracker commits at all

Do NOT re-investigate the comment auto-commit path as the primary suspect. That was my error and it is now disproven.
