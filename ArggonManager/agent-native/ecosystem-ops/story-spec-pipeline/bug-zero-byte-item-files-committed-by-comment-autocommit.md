---
type: bug
status: todo
id: bug-zero-byte-item-files-committed-by-comment-autocommit
title: "Four item files were committed 0 bytes on main — 3 emptied by tracker auto-commits (2 commented, 1 done) and 1 by a squash-merged PR commit (#521); every blamed commit has a non-empty parent, so each is where its file FIRST became 0 bytes"
parent: story-spec-pipeline
labels: [tracker-schema, cli]
created: "2026-10-03"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-zero-byte-item-files-committed-by-comment-autocommit.md
  Leaves live only under a story. id is the filename stem: bug-zero-byte-item-files-committed-by-comment-autocommit.
  CLI `arggon create bug zero-byte-item-files-committed-by-comment-autocommit` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Four item files were committed on main as 0-byte blobs — by two `chore(tasks): commented` commits, one `chore(tasks): done` commit and one squash-merged PR commit — and a zero-byte item silently un-claims it and drops its acceptance history

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @Arggon

Found by the worker on PR #619 (`bug-validate-does-not-check-frontmatter-present`), 2026-10-03. The read-side validator gap is being fixed there; **this is a writer-side regression and is NOT part of that fix.**

**What happened.** The moment PR #619's new rule landed locally, `validate` surfaced **4 item files committed on `main` as 0-byte blobs**. In every case, the commit that emptied the file is its own `chore(tasks): commented <id>` tracker auto-commit.

**Why it matters more than a corrupt file.** A zero-byte item has no frontmatter and no body. The tracker then treats it as _not an item_ rather than as a broken one, so it **silently un-claims a claimed item and drops its entire acceptance history and comment record** — the comment that emptied it is the last thing anyone wrote to it, and the evidence is gone. This is exactly the failure class PR #619 exposes on the read side, arriving from the write side.

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

| Item                                                     | Emptying commit            | Kind                                                   |
| -------------------------------------------------------- | -------------------------- | ------------------------------------------------------ |
| `task-record-exploration-016-worktree-runtime-isolation` | `16295623` → emptied later | tracker `chore(tasks): commented`                      |
| `task-derive-cli-spawn-loader`                           | `e470c86d`                 | `chore(auto): mark items done (PR #543 merged) (#550)` |
| `task-remove-diag-listener`                              | `0490dda1`                 | squash-merged PR commit (#540)                         |
| `bug-live-reload-sse-race`                               | `e52f33c3` → emptied later | tracker `chore(tasks): commented`                      |

**And the decisive finding: parent snapshots show three of the four were ALREADY 0 bytes before the commits listed above.** So the empty state exists in the parent and **travels between worktrees** — it is not created by the commit that appears to introduce it. That inverts the whole investigation: the question is not "which commit truncated this file" but **"how did a worktree end up with an empty file at all, and how did that empty state get merged forward"**.

`writeFileAtomic` (temp + rename) making in-place truncation impossible is therefore not merely unproven — it is insufficient as a theory, since the file is empty in snapshots that predate the blamed commits. Something produced a 0-byte file on some machine and that state propagated. `git merge` with a rename/delete interaction, a checkout conflict resolved by taking "ours" on a file whose other side was empty, and a worktree whose file was truncated by an external tool are all live hypotheses that `writeFileAtomic` does not exclude.

**Recovery has been done** in PR #622, byte-for-byte from each file's last non-empty blob (`16295623`/`e52f33c3`/`e470c86d`/`0490dda1`). Content is safe; **this item is now purely about the cause.**

Acceptance (rewritten — the original box 2 aimed at the wrong path):

- [ ] Explain how a working tree came to hold a 0-byte item file at all, given `writeFileAtomic` makes in-place truncation impossible. Start from all four equally: each blamed commit's own parent holds its file non-empty, so **all four** are where their file first became 0 bytes, and no case is downstream of an inherited empty state
- [ ] **Find the actor for each of the four commits, starting from the measured premise.** Each blamed commit is single-parent and that parent still holds its file NON-empty, so the 0-byte content was written and staged on that branch _before_ the commit — it is not inherited. Three candidates by kind: the `commented` auto-commit path (`8444d328`, `5e3efced`), the **`done` auto-commit path** (`9c5cce96` — a tracker auto-commit that the `commented`-only framing excluded), and `ac3fe3c6`, a plain squash-merged code PR (#521) whose branch evidently carried the item file empty. For the PR case the question is a review-and-merge question: how did a 0-byte item file get into a merged PR's diff at all, and would any gate have caught it? Keep the merge-resolution hypothesis (a conflicted item file resolved to 0 bytes) as a live secondary — it is cheap to test — but it is no longer the primary, because a non-empty parent rules out inheritance.
- [ ] ~~Find the commit where each FIRST became 0 bytes, walking back past the blamed commits~~ **RESOLVED 2026-10-06, do not redo:** measured by blob size, the four blamed commits _are_ the first-emptying commits — `9c5cce96` (rec016, 14037B→0B), `ac3fe3c6` (live-reload, 3463B→0B), `8444d328` (derive-cli, 8304B→0B), `5e3efced` (diag-listener, 5388B→0B), each with a non-empty parent. The larger gate question this box was reaching for survives in the box above: `ac3fe3c6` is a merged PR, so **one of the four entered through review and merge**
- [ ] `arggon validate` should raise a distinct code for a **0-byte item file**, separate from `MISSING_FRONTMATTER` (PR #619 covers the missing block). A missing block and an emptied file have different causes
- [ ] Swept: how many other tracker files have ever been committed 0-byte or truncated mid-body? Four instances is a class
- [ ] Check whether `arggon handoff`, `arggon update` and `arggon create` share the path — but per the finding above, **do not start from the comment auto-commit path**: two of four were not tracker commits at all

Do NOT re-investigate the comment auto-commit path as the primary suspect. That was my error and it is now disproven.

### 2026-10-06 @Arggon
**CORRECTION (2026-10-06, round-2 review of PR #619). The 2026-10-03 correction above is itself wrong in all four rows, and its central conclusion is disproven by measurement. It is left in place, unedited, as the record it is; this block supersedes it. Nothing in the earlier dated blocks was rewritten or removed.**

Measured from `origin/main` by blob size at every commit that touched each path (`git rev-parse <commit>:<path>` then `git cat-file -s`) — not taken from any prior account:

| item file | emptied by | parent's bytes | commit's bytes | kind |
| --- | --- | --- | --- | --- |
| `task-record-exploration-016-worktree-runtime-isolation.md` | `9c5cce96` `chore(tasks): done …` | 14037 | **0** | tracker auto-commit, but the **`done`** verb |
| `bug-live-reload-sse-race.md` | `ac3fe3c6` `fix(e2e): … (#521)` | 3463 | **0** | squash-merged code PR — **not a tracker commit at all** |
| `task-derive-cli-spawn-loader.md` | `8444d328` `chore(tasks): commented …` | 8304 | **0** | tracker `commented` auto-commit |
| `task-remove-diag-listener.md` | `5e3efced` `chore(tasks): commented …` | 5388 | **0** | tracker `commented` auto-commit |

So: **3 of 4** are tracker auto-commits (two `commented`, one **`done`**), and **exactly 1** of 4 is not a tracker commit at all — not "2 are squash-merged PR commits" as the title of this item previously said.

**Two corrections to the 2026-10-03 block.**

1. **The four shas it names are the last NON-empty commits, not the emptying commits.** `16295623` holds 14037B, `e52f33c3` 3463B, `e470c86d` 8304B, `0490dda1` 5388B — all non-zero. They are the last non-empty commit before the real culprit in each case, which is exactly why they were the *correct recovery sources* for `9c17ae6c` (whose restored sizes match those four byte counts precisely). Correct as recovery provenance, wrong as the emptying commit.

2. **"Parent snapshots show three of the four were ALREADY 0 bytes", and the "corruption travels between worktrees" conclusion built on it, are disproven.** Each blamed commit is **single-parent**, and that parent holds *its own* file non-empty: `9c5cce96^`=`ce5e855a` → 14037B, `ac3fe3c6^`=`a28b8bec` → 3463B, `8444d328^`=`1ab0993a` → 8304B, `5e3efced^`=`8444d328` → 5388B. Therefore **every one of the four commits is where its file first became 0 bytes**, and none of them inherits an empty state.

   The likely source of the mix-up: what *is* true at those snapshots is that **other** files were already empty there. At `ce5e855a`, live-reload/derive-cli/diag-listener are indeed 0; at `a28b8bec`, derive-cli and diag-listener are indeed 0. Emptiness persists forward once introduced, so "three of the four files are 0 at this snapshot" is not the same claim as "this file was already 0 before its blamed commit", and only the second one would have inverted the investigation.

**What this re-points the item at.** The write-side question is back in scope for **all four** cases and is broader than the comment path: three are tracker auto-commits but one of those is the `done` verb, and one (`ac3fe3c6`) is an ordinary squash-merged code PR whose branch evidently carried the item file empty — so at least one instance entered this repo through **review and merge of a code PR**, which no tracker-side fix would catch. The item's title and operative acceptance boxes are corrected above to match. The `done`-verb path and the PR-merge path are both in the checklist now; do not start from the `comment` path alone, and do not treat the merge hypothesis as the primary.

**Recovery is confirmed byte-for-byte** — recorded as evidence rather than ticked, since the boxes live inside dated blocks and the done/box decision is the delivery lead's: `9c17ae6c` restored 14037 / 3463 / 8304 / 5388 bytes, matching each file's last non-empty blob exactly. Main has since moved all four forward (`8e3e9214` marked two done, `f2214234` pruned all four), so the content is safe and this item is now purely about the cause.
