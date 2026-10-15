---
type: bug
status: in_progress
id: bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use
title: Force-push gate blocks the rebase path the lead must use
assignee: arggon-delivery-lead
branch: fix/bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [permissions, worktree, delivery-lead]
priority: p2
created: "2026-10-11"
updated: "2026-10-15"
claimed_at: "2026-10-15T10:14:55.642Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use.md
  Leaves live only under a story. id is the filename stem: bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use.
  CLI `arggon create bug force-push-gate-blocks-the-rebase-path-the-lead-must-use` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Force-push gate blocks the rebase path the lead must use

## Context

Found live during Wave A of `methodology-productization`, 2026-10-11. The delivery lead could not push a rebased item branch, which stopped the wave at the merge step. This is the second permission-surface failure found in the same wave as `bug-verifier-cannot-read-the-tracker-no-allow-side` — filed separately because the fix is a different rule in a different file, but the _class_ is identical.

**What happened, in order.**

1. The lead dispatched five makers, each into its own `start --worktree` claim. All five branches were cut from `14d2abc9`.
2. `origin/main` then advanced 48 commits, touching the same surfaces — `lib/src/convention.ts`, `ArggonManager/docs/convention.md`, `cli/src/init.test.ts`, `opencode/plugins/arggon/index.ts`, and the plugin bundle.
3. The lead rebased one branch (`feat/task-claude-adapter-spec`) onto `origin/main` and re-ran the gates — green.
4. The push failed:
   - `git push --force-with-lease -u origin <branch>` → `{"error":{"type":"permission.rejected","message":"Permission denied: shell"}}`
   - dispatched a maker to push from its own session → the identical rejection, three times (plain, retry, pipeline variant), so it is the session permission layer, not git, not auth, not the lease
   - `tools.arggon.start({ id, worktree: true, push: true })` as an attach → returns `ok: true` with `pushed: false`, because the attach path does not force-push an already-pushed branch, and `start` has no force flag

**The rule that blocks it, verbatim from `opencode.jsonc`:**

```jsonc
"permissions": [
  { "action": "shell", "resource": "git commit --no-verify*", "effect": "deny" },
  { "action": "shell", "resource": "git push --force*", "effect": "deny" },
  { "action": "shell", "resource": "git push -f*", "effect": "deny" },
  { "action": "shell", "resource": "git push *+*", "effect": "deny" },
]
```

That file's own comment calls these "Minimal workflow gates (W4, task-native-permissions-worktrees)" that "complement — never replace — the kernel invariants", and says "delete a rule here if your workflow needs it, this file is yours once edited". So the gate is intentional and its escape hatch is documented. The problem is not that the rule exists; it is that the rule's pattern matches a strictly safer operation than the one it names.

**Why this is a defect rather than a misconfiguration on one machine.**

The pattern is `git push --force*`. That glob matches `git push --force-with-lease`, which is the _recommended_ form — it refuses to overwrite a remote ref that someone else moved since the last fetch, which is precisely the protection bare `--force` lacks. So the gate denies the safe spelling and, if it were narrowed naively, would permit the unsafe one. The rule's intent is clearly "no history destruction"; its implementation cannot tell the two apart.

**The lead's documented workflow makes the blocked operation unavoidable.** The mismatch is structural, not incidental:

- `ArggonManager/docs/agents.md` §Cleanup and the `start` contract put the claim commit on the feature branch, so the item's own tracker file rides the branch.
- `ArggonManager/docs/agents.md` §Merge, don't squash: "**prevention beats recovery: when mutating the tracker from the primary checkout (auto-commits land on local main), push main immediately after every mutation** — before opening or merging any PR." Push is part of the loop, not an exception.
- Rebase-onto-main is the normal shape when a branch is cut from a base that later moves — and here every one of the five Wave A branches was 48 commits behind within the session.

So the gate sits directly on the path the lead is required to take, and the only alternatives are "don't rebase" (which is not a fix — the branches would be unmergeable against a main that moved across the same files) or "get a human to push" (which is what happened, correctly, via a `decide:` brief on `task-claude-adapter-spec`).

**What the lead did instead of routing around it.** No hand-edit of `opencode.jsonc` to widen the rule, no `--force`, no branch deletion, no `--no-verify`. The refusal was treated as evidence and taken to the owner as a bounded decision brief with three options (owner pushes / delete-and-repush / deliberately widen the rule), a recommendation (owner pushes), the strongest argument against it, and a default with an absolute date (2026-10-18). Per `ArggonManager/docs/engineering.md` §The decision brief's routing rule this is a hard-to-reverse call — widening a force-push protection cannot be undone once an agent session is running under it — so it owes a brief rather than a plain record.

## Acceptance

- [x] The `git push --force*` pattern no longer denies `--force-with-lease`, while bare `--force`, `-f`, and refspec-with-`+` stays denied. The safe spellings that must keep working: `--force-with-lease`, `--force-with-lease=<ref>:<expect>`, and `--force-if-includes`
- [x] A test pins the discriminator, with a negative control: the pattern BLOCKS `git push --force origin main`, `git push -f`, `git push origin +main`, and `git push --force-with-lease origin main:other` if that is judged unsafe, and ALLOWS `git push --force-with-lease origin <branch>`. The test must fail today (this is a TDD-shaped fix — write the red first and cite it)
- [x] The change lands in the **template** the adopter tree renders (`templates/docs/opencode.jsonc`, or wherever `opencode.jsonc`'s content is generated from) AND in this repo's own `opencode.jsonc`, with the `x-generated` provenance and never-overwrite semantics intact and `arggon doctor` honest about both
- [x] A lead-role probe proves the unblock end-to-end: a session holding the delivery-lead role rebases a scratch branch and pushes it with `--force-with-lease` successfully, reported as command / expected / observed / exit / does-NOT-prove
- [x] A negative control proves the protection survived: the same session attempting `git push --force` is still refused
- [x] `ArggonManager/docs/agents.md` states which force-push spellings the seam permits and which it refuses, so an agent reading the playbook knows before it attempts one (this is a methodology carrier → impact class stated; Behavioral if the permitted set changes, with the ADR 0016 upgrade-channel reference)
- [x] `arggon validate` green, `npm test` green, prettier clean, and any permission-block test that currently pins the old four-rule list is updated rather than deleted

## Notes

### 2026-10-11 @ses_ed6d9b22effexLQQ1jvoDJGIMi

## Context

Found live during Wave A of `methodology-productization`, 2026-10-11. The delivery lead
could not push a rebased item branch, which stopped the wave at the merge step. This is
the second permission-surface failure found in the same wave as
`bug-verifier-cannot-read-the-tracker-no-allow-side` — filed separately because the fix is
a different rule in a different file, but the _class_ is identical and is named below.

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
which is the _recommended_ form — it refuses to overwrite a remote ref that someone else
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
target is narrower than the pattern. The verifier bug is a _missing_ grant where the
config took care to deny both spellings of the write side; this one is an _over-broad_
deny that catches the safe spelling of the operation it means to forbid. Both are
discovered only by an agent trying to do its documented job and reporting the refusal
rather than working around it. The wave recorded both refusals verbatim, which is what
made them diagnosable.

**Fix shape to consider (for the maker to judge, not a mandate).** The rule is one line in
a JSON array; the honest fix is a pattern that matches the destructive forms and excludes
the lease-checked one — likely an explicit sequence covering `--force`, `--force=<ref>`,
`-f`, `-f<ref>` and the `+refspec` form, rather than a single `--force*` glob. Whether
`--force-with-lease origin main:other` (a lease-checked push of a _different_ ref, which
can still clobber someone else's branch) belongs in the denied set is a real judgement
call — it is lease-checked, so it is not blind, but it writes a ref the caller named
explicitly. Recommend denying it and stating why.

**Sequencing note.** This does not block the initiative's product work; it blocks the
lead's merge step. It should land before the next wave that needs a rebase, which is
any wave whose branches outlive a `main` commit.

### 2026-10-15 @Arggon
### 2026-10-15 @arggon-maker

**Red first (TDD, box 2).** `cli/src/opencode-force-push.test.ts` was written before the fix and run against the unchanged rules in both carriers (tree `b95edfa5`):

```
FAIL  cli/src/opencode-force-push.test.ts > force-push discriminator in opencode.jsonc > permits the lease-checked spellings the rebase path needs
FAIL  cli/src/opencode-force-push.test.ts > force-push discriminator in templates/docs/opencode.jsonc > permits the lease-checked spellings the rebase path needs
AssertionError: must be allowed: git push --force-with-lease origin fix/bug-x: expected 'deny' to be 'allow'
 Test Files  1 failed (1) | Tests  2 failed | 6 passed (8)
```

Both carriers failed on the first allowed spelling; the full run is kept at `/tmp/opencode/red-discriminator.txt`. The test reads the rules out of `opencode.jsonc` AND `templates/docs/opencode.jsonc` and evaluates them with the runtime's own matcher, ported from the installed `opencode` v2.0.29 binary (embedded `Q_` + `yC`): escape regex metacharacters — `[`/`]` included, so a rule has only `*` (`→ .*`) and `?` (`→ .`) — then `^…$` with the `s` flag, a trailing `" .*"` relaxed to `"( .*)?"`, rules selected with `findLast` over the flattened list (the project `permissions` array is appended after every agent's own rules), default allow.

**The fix (box 1, 3).** The broad deny stays byte-identical — that is what keeps `;` / `&&` / quoted forms refused, and narrowing it to `--force` + a delimiter is not expressible without character classes anyway — and the lease-checked spellings are re-allowed AFTER it (last match wins):

```
deny   git commit --no-verify*
deny   git push --force*
deny   git push -f*
allow  git push --force-with-lease *          ← the rebase path
allow  git push --force-with-lease=*
allow  git push --force-if-includes *
deny   git push *+*                            ← last: +refspec stays refused even next to a lease flag
```

**Judgement call (box 2's conditional control): the refname is not the discriminator.** `git push --force-with-lease origin main:other` is ALLOWED, and so is the colon-free `git push --force-with-lease origin main` — a colon deny would refuse legitimate spellings (`HEAD:<branch>`) while refusing nothing it means to refuse, which is this bug's own defect class. Pinned as an assertion in the test with that reasoning; if the lead wants it refused, it is one `deny` rule plus one case.

**Known limit, stated in the config comment and in `agents.md`.** An allowed lease flag is permitted with any tail, so `git push --force-with-lease --force …` (a second, bare force flag) is no longer caught, and neither is a form hidden behind `bash -c`/`&&`. The gate stops the accidental spelling; the kernel, the pre-commit gate and CI stay the enforcement of record.

**Lead-role probe, end-to-end (boxes 4-5)** — scratch repo + local bare remote under `/tmp/opencode/fp-probe`, seam scaffolded by this branch's CLI, so the session's `opencode.jsonc` is the fixed template. `opencode run --standalone --agent arggon-delivery-lead --model opencode-go/deepseek-v4.1-flash --auto --format json`; `session export` confirms `"agent": "arggon-delivery-lead"` (`ses_ec0e2e434ffeIWJv8UxJbmnLRG`):

| probe | command | expected | observed | exit |
| --- | --- | --- | --- | --- |
| red twin (pre-fix config) | `git push --force-with-lease -u origin fix/probe` (branch rebased, remote at `1e859c71`) | refused | `status: "error"`, `"Permission denied: shell"`, agent answered `PERMISSION_REFUSED`, remote stayed `1e859c71` while local was `b6dfda28` | 0 (session) |
| green (fixed config) | same command (remote at `a503040f`, rebased head `45989dbe`) | allowed | `status: "completed"`, `+ a503040...45989db fix/probe -> fix/probe (forced update)`, remote moved to `45989dbe` | 0 |
| negative control | `git push --force origin main` | refused | `status: "error"`, `"Permission denied: shell"`, `PERMISSION_REFUSED`, remote `main` unchanged (`7f3c63de`) | 0 (session) |
| control | `git push origin main` (ordinary) | allowed | remote `main` moved to `80ae08c4` | 0 |

Does NOT prove: that the layer is enforced in every client runtime (it is enforced in this OpenCode v2.0.29 session — `bug-task-permissions-enforcement-not-observed` is the other half), that a determined spelling (`bash -c …`) is stopped, or that the ZCode/Claude seams behave the same.

**Out of scope, for the lead to route (not touched):** the same over-match exists in `templates/docs/zcode/arggon/hooks/gate.mjs:108` and `templates/docs/claude/arggon/hooks/gate.mjs:143` — `re: /\bgit\b[^;&|]*\spush\b(?=[^;&|]*\s(?:--force\b|-f[a-z]*|\+\S))/`; `\b` matches between `e` and `-`, so `--force-with-lease` is denied there too. Stated as current behaviour in the new `agents.md` subsection; the fix is a separate item.

**Gates (worktree, all run after the change):** `npm run arggon -- validate` ok; focused `vitest run cli/src/opencode-force-push.test.ts cli/src/opencode-permissions.test.ts cli/src/init-opencode.test.ts` 63 passed; `npm run build` green; `npm test` 160 files / 3515 tests passed; `npm run lint` clean; `npm run test:structure` 5 passed; `npx prettier --check` clean on every touched file EXCEPT `templates/docs/opencode.jsonc`, whose only deviation is the pre-existing comma-less style (three trailing commas, identical complaint at HEAD, proven by diffing prettier's output on HEAD's bytes) — and that style is load-bearing: three tests in `cli/src/init-opencode.test.ts` parse the generated config as strict JSON after stripping comments, so adding the commas would redden them. Not touched.

**Doctor (box 3):** the template carries the rules (fresh `arggon init` renders them; the byte-equality + never-overwrite pins in `cli/src/init-opencode.test.ts` pass), this repo's own `opencode.jsonc` carries the same rules, `arggon doctor --agents` reports it `adopter-edited` (hand-edited generated file, never regenerated — the pre-existing status, unchanged by this change) and `arggon doctor` lists it in `outdated` (its bytes differ from the current render, which is true: it is the adopter-owned variant). `cli/src/provenance-audit.test.ts` (the repo-self ledger gate) passes.

### handoff 2026-10-15 @arggon-maker — next: Open the PR against main and hand it to the standards reviewer; the one judgement call to review is that the refname is NOT the discriminator (--force-with-lease origin main:other is allowed, like th…
- branch: fix/bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use
- open questions: Should the lease-with-named-ref form (origin main:other) be refused after all? It is one deny rule + one test case if the lead wants it; Does the residual (a second bare --force next to an allowed le…

### 2026-10-15 @Arggon
### 2026-10-15 @arggon-maker

**PR:** https://github.com/Arggon/ArggonManager/pull/836 — `fix(config): force-push gate discriminates on the lease, not the spelling`, open and MERGEABLE, branch `fix/bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use` (5 commits: claim, fix `2dd5dd8b`, evidence comment, handoff, judgement-call pin `f43f81c9`).

**CI on the head:** `cli` pass (6m43s), `tasks-validate` pass, `ui-smoke` pass.

**Final worktree gates (re-run on the head):** `arggon validate` ok · focused vitest 63 passed · `npm run build` green · `npm test` 160 files / 3515 tests passed · `npm run lint` clean · `npm run test:structure` 5 passed · prettier clean on every touched file except the pre-existing, load-bearing comma-less `templates/docs/opencode.jsonc` (documented above).

**Diff note:** two tracker files in the PR are not this item's — `bug-prover-agent-has-no-x-generated-entry.md` and `bug-start-claim-branch-inherits-unpushed-tracker-commits.md` rode in from the claim's base (the `inheritedCommits` shape); the lead's own commits, untouched by this branch, and they leave the diff once main is pushed. Flagged on the PR too.

**Acceptance:** all 7 boxes ticked; the one judgement call to review is the refname question (see the handoff), pinned as an assertion in the test so it cannot change silently.

### handoff 2026-10-15 @arggon-maker — next: PR #836 is open with all CI green: hand it to the standards reviewer; the one judgement call to review is that the refname is NOT the discriminator (--force-with-lease origin main:other is allowed, l…
- branch: fix/bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use
- open questions: Refuse the lease-with-named-ref form (origin main:other) after all? one deny rule + one test case if the lead wants it; Close the residual (a second bare --force next to an allowed lease flag) or kee…
