---
type: bug
status: todo
id: bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use
title: Force-push gate blocks the rebase path the lead must use
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [permissions, worktree, delivery-lead]
priority: p2
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use.md
  Leaves live only under a story. id is the filename stem: bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use.
  CLI `arggon create bug force-push-gate-blocks-the-rebase-path-the-lead-must-use` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Force-push gate blocks the rebase path the lead must use

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @ses_ed6d9b22effexLQQ1jvoDJGIMi
## Context

Found live during Wave A of `methodology-productization`, 2026-10-11. The delivery lead
could not push a rebased item branch, which stopped the wave at the merge step. This is
the second permission-surface failure found in the same wave as
`bug-verifier-cannot-read-the-tracker-no-allow-side` — filed separately because the fix is
a different rule in a different file, but the *class* is identical and is named below.

**What happened, in order.**

1. The lead dispatched five makers, each into its own `start --worktree` claim. All five
   branches were cut from `14d2abc9`.
2. `origin/main` then advanced 48 commits, touching the same surfaces — `lib/src/convention.ts`,
   `ArggonManager/docs/convention.md`, `cli/src/init.test.ts`, `opencode/plugins/arggon/index.ts`,
   and the plugin bundle.
3. The lead rebased one branch (`feat/task-claude-adapter-spec`) onto `origin/main` and
   re-ran the gates — green.
4. The push failed:
   - `git push --force-with-lease -u origin <branch>` → `{"error":{"type":"permission.rejected","message":"Permission denied: shell"}}`
   - dispatched a maker to push from its own session → the identical rejection, three times
     (plain, retry, pipeline variant), so it is the session permission layer, not git,
     not auth, not the lease
   - `tools.arggon.start({ id, worktree: true, push: true })` as an attach → returns
     `ok: true` with `pushed: false`, because the attach path does not force-push an
     already-pushed branch, and `start` has no force flag

**The rule that blocks it, verbatim from `opencode.jsonc`:**

```jsonc
"permissions": [
  { "action": "shell", "resource": "git commit --no-verify*", "effect": "deny" },
  { "action": "shell", "resource": "git push --force*", "effect": "deny" },
  { "action": "shell", "resource": "git push -f*", "effect": "deny" },
  { "action": "shell", "resource": "git push *+*", "effect": "deny" },
]
```

That file's own comment calls these "Minimal workflow gates (W4,
task-native-permissions-worktrees)" that "complement — never replace — the kernel
invariants", and says "delete a rule here if your workflow needs it, this file is yours
once edited". So the gate is intentional and its escape hatch is documented. The problem
is not that the rule exists; it is that the rule's pattern matches a strictly safer
operation than the one it names.

**Why this is a defect rather than a misconfiguration on one machine.**

The pattern is `git push --force*`. That glob matches `git push --force-with-lease`,
which is the *recommended* form — it refuses to overwrite a remote ref that someone else
moved since the last fetch, which is precisely the protection bare `--force` lacks. So the
gate denies the safe spelling and, if it were narrowed naively, would permit the unsafe
one. The rule's intent is clearly "no history destruction"; its implementation cannot tell
the two apart.

**The lead's documented workflow makes the blocked operation unavoidable.** The mismatch
is structural, not incidental:

- `ArggonManager/docs/agents.md` §Cleanup and the `start` contract put the claim commit
  on the feature branch, so the item's own tracker file rides the branch.
- `ArggonManager/docs/agents.md` §Merge, don't squash: "**prevention beats recovery: when
  mutating the tracker from the primary checkout (auto-commits land on local main), push
  main immediately after every mutation** — before opening or merging any PR." Push is
  part of the loop, not an exception.
- Rebase-onto-main is the normal shape when a branch is cut from a base that later moves —
  and here every one of the five Wave A branches was 48 commits behind within the session.

So the gate sits directly on the path the lead is required to take, and the only
alternatives are "don't rebase" (which is not a fix — the branches would be unmergeable
against a main that moved across the same files) or "get a human to push" (which is what
happened, correctly, via a `decide:` brief on `task-claude-adapter-spec`).

**What the lead did instead of routing around it.** Recorded here because it is the
behaviour the methodology wants and it held: no hand-edit of `opencode.jsonc` to widen
the rule, no `--force`, no branch deletion, no `--no-verify`. The refusal was treated as
evidence and taken to the owner as a bounded decision brief with three options (owner
pushes / delete-and-repush / deliberately widen the rule), a recommendation (owner
pushes), the strongest argument against it, and a default with an absolute date
(2026-10-18). Per `ArggonManager/docs/engineering.md` §The decision brief's routing rule
this is a hard-to-reverse call — widening a force-push protection cannot be undone once
an agent session is running under it — so it owes a brief rather than a plain record.

## Acceptance

- [ ] The `git push --force*` pattern no longer denies `--force-with-lease`, while bare
      `--force`, `-f`, and refspec-with-`+` stays denied. The safe spellings that must
      keep working: `--force-with-lease`, `--force-with-lease=<ref>:<expect>`, and
      `--force-if-includes`
- [ ] A test pins the discriminator, with a negative control: the pattern BLOCKS
      `git push --force origin main`, `git push -f`, `git push origin +main`, and
      `git push --force-with-lease origin main:other` if that is judged unsafe, and ALLOWS
      `git push --force-with-lease origin <branch>`. The test must fail today (this is a
      TDD-shaped fix — write the red first and cite it)
- [ ] The change lands in the **template** the adopter tree renders
      (`templates/docs/opencode.jsonc`, or wherever `opencode.jsonc`'s content is
      generated from) AND in this repo's own `opencode.jsonc`, with the `x-generated`
      provenance and never-overwrite semantics intact and `arggon doctor` honest about both
- [ ] A lead-role probe proves the unblock end-to-end: a session holding the delivery-lead
      role rebases a scratch branch and pushes it with `--force-with-lease` successfully,
      reported as command / expected / observed / exit / does-NOT-prove
- [ ] A negative control proves the protection survived: the same session attempting
      `git push --force` is still refused
- [ ] `ArggonManager/docs/agents.md` states which force-push spellings the seam permits
      and which it refuses, so an agent reading the playbook knows before it attempts one
      (this is a methodology carrier → impact class stated; Behavioral if the permitted
      set changes, with the ADR 0016 upgrade-channel reference)
- [ ] `arggon validate` green, `npm test` green, prettier clean, and any permission-block
      test that currently pins the old four-rule list is updated rather than deleted

## Notes

**The class, for the record.** Both bugs filed from this wave share one shape: a rule
written against a coarse surface (tool namespace, command family) where the intended
target is narrower than the pattern. The verifier bug is a *missing* grant where the
config took care to deny both spellings of the write side; this one is an *over-broad*
deny that catches the safe spelling of the operation it means to forbid. Both are
discovered only by an agent trying to do its documented job and reporting the refusal
rather than working around it. The wave recorded both refusals verbatim, which is what
made them diagnosable.

**Fix shape to consider (for the maker to judge, not a mandate).** The rule is one line in
a JSON array; the honest fix is a pattern that matches the destructive forms and excludes
the lease-checked one — likely an explicit sequence covering `--force`, `--force=<ref>`,
`-f`, `-f<ref>` and the `+refspec` form, rather than a single `--force*` glob. Whether
`--force-with-lease origin main:other` (a lease-checked push of a *different* ref, which
can still clobber someone else's branch) belongs in the denied set is a real judgement
call — it is lease-checked, so it is not blind, but it writes a ref the caller named
explicitly. Recommend denying it and stating why.

**Sequencing note.** This does not block the initiative's product work; it blocks the
lead's merge step. It should land before the next wave that needs a rebase, which is
any wave whose branches outlive a `main` commit.
