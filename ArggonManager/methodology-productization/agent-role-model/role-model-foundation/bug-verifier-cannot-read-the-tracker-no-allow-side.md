---
type: bug
status: in_progress
id: bug-verifier-cannot-read-the-tracker-no-allow-side
title: "Verifier cannot read the tracker: no allow side"
assignee: arggon-delivery-lead
branch: fix/bug-verifier-cannot-read-the-tracker-no-allow-side
parent: role-model-foundation
labels: [permissions, arggon-seam, verifier, docs]
priority: p2
created: "2026-10-11"
updated: "2026-10-13"
claimed_at: "2026-10-13T13:29:09.848Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-verifier-cannot-read-the-tracker-no-allow-side
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-verifier-cannot-read-the-tracker-no-allow-side.md
  Leaves live only under a story. id is the filename stem: bug-verifier-cannot-read-the-tracker-no-allow-side.
  CLI `arggon create bug verifier-cannot-read-the-tracker-no-allow-side` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Verifier cannot read the tracker: no allow side

## Context

Found live during Wave A of `methodology-productization`, 2026-10-11. The delivery lead dispatched `arggon-verifier` to run the execution probes a standards-reviewer verdict needed (`verdict: approve` on one lane, `verdict: request-changes` on another). The verifier could not complete the tracker-read part of its brief and reported that Code Mode was restricted. This is the root cause.

**The mechanism, verified by reading the shipped config rather than inferred.** The role's contract and its prompt both name tracker reads: `ArggonManager/docs/agents.md` §Orchestration → "Who proves, who reviews" states the verifier "runs the gates a review verdict needs and returns expected-vs-observed evidence", and its own generated contract (`templates/docs/opencode/agents/arggon-verifier.md`) says "Read-only inspections are in scope" while the brief asked it to read item bodies with `tools.arggon.show({ id, body: true })`. The permissions block in that same file denies, per entry, `edit`, `subagent`, the write-side `arggon_*` tools in BOTH spellings (`arggon_create` and `arggon_arggon_create`, etc.), and four `shell` write-shapes — but THE READS (`arggon_show`, `arggon_list`, `arggon_validate`, `arggon_next`, `arggon_report`) APPEAR NOWHERE: not denied, but not granted either. The permission model has no allow side for this role, so the whole `arggon` namespace is unreachable while the explicitly-granted `shell` works. The deny list blocks writes; the absence of any grant blocks reads; the two are conflated.

**Consequence, and why it is a defect rather than an inconvenience.** The role's read-only guarantee is enforced at the wrong layer — it holds only because the prompt says "never post to the tracker", not because the config forbids it. The verifier structurally cannot do the read half of its job (in this wave it worked around it by reading item state through the shell, an unplanned substitute), and a prompt edit, a compaction, or a different model could break the write guarantee with nothing in the configuration noticing. Compare the standards reviewer, where `edit`/`write`/`patch` are REMOVED FROM ITS CATALOG — the same boundary enforced at the layer that cannot drift. The asymmetry is sharpest in one observation: for the four mutating tools the config took care to deny both spellings, while the read tools got no entry at all — the author reasoned about the write-side surface only.

The reverse failure also exists: the review bar's "docs that travel with the change" is unenforceable for a role that cannot read the item it is reviewing. During Wave A two of five makers left the live `## Acceptance` section as boilerplate and put the real checklist in the dated comment record; the verifier could not independently confirm the checklist state on those items.

**Second finding, same session, recorded here (same "permission/tool surface fails silently" class — possibly a symptom, discriminator unknown).** Two `tools.arggon.comment` calls reported `ok: true`, but one brief body (~4 KB) never reached disk: verified three ways (`grep -rn`, `git log --all -S`, the file's back-to-back headings), the body is absent from every git object — named LOSS, not truncation. Controlled experiment on a scratch item (now `cancelled`) falsified size, fences, default author and nested headings; both failures share only that another `tools.arggon.*` write was in flight in the same session (a branch rebase; a `create` auto-commit landing in the same window), pointing at a concurrent-writer LOST UPDATE on the native path — consistent with the DONE `bug-comment-race-no-lock` / `bug-comment-torn-read` fixes, so either the reasoning is wrong or those fixes have a gap on the native surface. Reproducer: two foreground `tools.arggon.comment` calls to the same item fired concurrently, asserting both bodies survive. The loss is confined to superseded briefs (restated later), so no decision was lost — filed because the class repeats.

## Acceptance

- [x] An `effect: allow` entry exists for each read-only arggon tool the verifier role is contracted to use — at minimum `arggon_show`, `arggon_list`, `arggon_validate`, `arggon_next`, `arggon_report`, `arggon_branch` (read-side), and their `arggon_arggon_*` MCP spellings — in BOTH `.opencode/agents/arggon-verifier.md` (this tree's generated seam) and `templates/docs/opencode/agents/arggon-verifier.md` (the template every adopter tree renders), so the fix reaches new adopters and not only this repo
- [x] A probe proves the allow is real: a verifier-role session runs `tools.arggon.show({ id: "<any item>", meta: true })` and gets a successful envelope back, reported as command / expected / observed / exit / does-NOT-prove
- [x] A negative control proves the deny is also real and unchanged: the same session attempting `tools.arggon.update({ id, status: "done" })` is refused, and `tools.arggon.create(...)` is refused — the read grant does not open a write path
- [x] The generated seam bytes and the template are kept byte-consistent, and the provenance/never-overwrite semantics (`x-generated`, `arggon doctor --agents`) still hold on both
- [x] `ArggonManager/docs/agents.md` §Orchestration and the role table in `ArggonManager/docs/engineering.md` state the read-only boundary as config-enforced, not prompt-enforced — the wording change does not claim a guarantee the config does not actually deliver
- [x] Impact class stated (this is a generated agent seam shipped to adopters, so the class is likely Behavioral — role prompts change — and Behavioral requires the ADR 0016 upgrade-channel reference per `ArggonManager/docs/agents.md` §Changing the methodology itself)
- [x] `arggon validate` green, `npm test` green (the seam has permission/parity tests — find them and confirm they pin the new allow list), prettier clean, and `npm run lint:structure` / `test:structure` clean if the permission block is parsed by anything in `tools/ast-grep`

## Notes

### 2026-10-11 @ses_ed6d9b22effexLQQ1jvoDJGIMi

## Context

Found live during Wave A of `methodology-productization`, 2026-10-11. The delivery lead
dispatched `arggon-verifier` to run the execution probes a standards-reviewer verdict
needed (`verdict: approve` on one lane, `verdict: request-changes` on another). The verifier
could not complete the tracker-read part of its brief and reported that Code Mode was
restricted. This is the root cause.

**The mechanism, verified by reading the shipped config rather than inferred.**

The role's contract and its prompt both name tracker reads. `ArggonManager/docs/agents.md`
§Orchestration → "Who proves, who reviews" states the verifier "runs the gates a review
verdict needs and returns expected-vs-observed evidence". Its own generated contract
(`templates/docs/opencode/agents/arggon-verifier.md`) says "Read-only inspections are in
scope" and the delivery lead's brief asked it to read item bodies with
`tools.arggon.show({ id, body: true })`.

The permissions block in that same file denies, per entry: `edit`, `subagent`,
`arggon_create`, `arggon_update`, `arggon_handoff`, `arggon_start`, `arggon_branch`,
`arggon_cleanup`, `arggon_priority`, `arggon_sync`, `arggon_import_issues`,
`arggon_arggon_create`, `arggon_arggon_update`, `arggon_arggon_handoff`, and four
`shell` write-shapes (`git commit*`, `git push*`, `git merge*`, `git rebase*`).

**The reads — `arggon_show`, `arggon_list`, `arggon_validate`, `arggon_next`, `arggon_report` —
appear nowhere. Not denied, but not granted either.**

The permission model in play has no allow side for this role: a resource with no
`effect: allow` entry and no default-allow is refused. So the whole `arggon` namespace is
unreachable, while the explicitly-granted `shell` works. The deny list blocks writes;
the absence of any grant blocks reads; the two are conflated.

**Consequence, and why it is a defect rather than an inconvenience.**

The role's read-only guarantee is enforced at the wrong layer. It holds only because the
prompt says "never post to the tracker" — not because the config forbids it. Two things
follow:

1. The verifier structurally cannot do the read half of its job, which its reviewer-facing
   brief depends on. In this wave the verifier worked around it by reading item state
   through the shell (`npm run arggon -- show <id>`), which happened to be available.
   That is an unplanned substitute for a role that is supposed to have the read path.
2. The guarantee that matters is currently prose-protected rather than config-protected.
   A prompt edit, a compaction, or a different model could break it with nothing in the
   configuration noticing. Compare the standards reviewer, where `edit`/`write`/`patch`
   are _removed from its catalog_ — the same role boundary enforced at the layer that
   cannot drift.

The asymmetry is sharpest in one observation: for the four mutating tools the config took
care to deny **both** spellings (`arggon_create` and `arggon_arggon_create`, the MCP
alias), while the read tools got no entry at all. So the author of this block was reasoning
about write-side surface only, and the read side was simply never considered.

**Second, related finding recorded here rather than separately (same root cause, one fix).**
The reverse failure also exists: the review bar's "docs that travel with the change" is
unenforceable for a role that cannot read the item it is reviewing. A reviewer/verifier
that cannot see the acceptance checklist cannot check that "acceptance travels with the
change" — the check that would catch an unticked box before a PR opened. During Wave A
this surfaced concretely: two of five makers left the live `## Acceptance` section as the
boilerplate placeholder and put the real checklist in the dated comment record, because
`arggon` has no `--body` flag and comments are append-only. The verifier could not
independently confirm the checklist state on those items.

## Acceptance

- [ ] An `effect: allow` entry exists for each read-only arggon tool the verifier role is
      contracted to use — at minimum `arggon_show`, `arggon_list`, `arggon_validate`,
      `arggon_next`, `arggon_report`, `arggon_branch` (read-side), and their `arggon_arggon_*`
      MCP spellings — in BOTH `.opencode/agents/arggon-verifier.md` (this tree's generated
      seam) and `templates/docs/opencode/agents/arggon-verifier.md` (the template every
      adopter tree renders), so the fix reaches new adopters and not only this repo
- [ ] A probe proves the allow is real: a verifier-role session runs
      `tools.arggon.show({ id: "<any item>", meta: true })` and gets a successful envelope
      back, reported as command / expected / observed / exit / does-NOT-prove
- [ ] A negative control proves the deny is also real and unchanged: the same session
      attempting `tools.arggon.update({ id, status: "done" })` is refused, and
      `tools.arggon.create(...)` is refused — the read grant must not open a write path
- [ ] The generated seam bytes and the template are kept byte-consistent, and the
      provenance/never-overwrite semantics (`x-generated`, `arggon doctor --agents`) still
      hold on both
- [ ] `ArggonManager/docs/agents.md` §Orchestration and the role table in
      `ArggonManager/docs/engineering.md` state the read-only boundary as config-enforced,
      not prompt-enforced — the wording change must not claim a guarantee the config does
      not actually deliver
- [ ] Impact class stated (this is a generated agent seam shipped to adopters, so the
      class is likely Behavioral — role prompts change — and Behavioral requires the
      ADR 0016 upgrade-channel reference per `ArggonManager/docs/agents.md` §Changing the
      methodology itself)
- [ ] `arggon validate` green, `npm test` green (the seam has permission/parity tests —
      find them and confirm they pin the new allow list), prettier clean, and
      `npm run lint:structure` / `test:structure` clean if the permission block is
      parsed by anything in `tools/ast-grep`

## Notes

**Not fixed in the wave that found it.** This item is filed rather than fixed inline
because the fix touches a generated seam template — the same blast-radius reasoning that
made `bug-adopter-engineering-template-software-locked` its own item rather than a
side-effect of another PR. Wave A's scope is the initiative's own leaves.

**Suggested shape of the fix (for the maker to judge, not a mandate).** Two options:

- **Option A — explicit allow list for reads, keeping the existing deny list.** Lowest
  risk, most explicit, most consistent with how the file already reasons (one entry per
  resource per spelling). Cost: twelve-odd new lines, and the MCP-alias spelling must be
  repeated like the existing write entries do.
- **Option B — a default-allow for `arggon_*` reads with the deny list carefully
  preserved.** Shorter, but it inverts the file's reasoning pattern and a future edit
  that adds a tool to the namespace inherits the allow silently. Given the block's
  existing care about the two spellings, B is the riskier of the two.

Either way the negative controls in the acceptance list are what make the change safe:
the grant must be provably read-only.

**Sibling-risk note for whoever implements.** If the fix widens the verifier's read
access, the reviewer→verifier handoff gains a real read path for the first time — and
then the review bar's "acceptance checklist honest before merge" check becomes checkable
by a role other than the delivery lead. That is a capability the wave did not have, and
it should be used for the checklist-honesty finding noted in Context above (the two
makers who left placeholder `## Acceptance` sections), not left as an unused grant.

### 2026-10-11 @ses_ed6d9b22effexLQQ1jvoDJGIMi

### 2026-10-11 @arggon-delivery-lead

## A second finding from the same wave: a comment heading landed with no body

Not the same root cause as this item's bug — recorded here because it was found in the
same 12 hours by the same session and shares the "permission/tool surface fails silently"
class, and because I am not confident it is not a symptom.

**What happened.** Two of my own `tools.arggon.comment` calls in this session wrote
content to item bodies and reported `ok: true`:

- the follow-up record ("Push + merge path") landed **complete**;
- an earlier `decide:` brief text ("Unblocking needed — a permission decision, not work")
  reports `ok: true` in its response envelope, but the item now carries only a bare dated
  heading with **nothing beneath it**.

Verified three ways: `grep -rn "Unblocking needed" ArggonManager/` → no hit; `git log --all
-S "Unblocking needed"` across every ref → no hit; the file itself has a heading at line 72
immediately followed by the next heading at 73. So the body is not on disk and not in any
git object anywhere. This is named **loss**, not truncation, and it was silent.

**Why it is not obviously the same bug.** The calls differ in one respect only: the lost one
was ~4 KB of markdown with nested headings and code fences; the surviving one was similar in
size and shape. I have not found the discriminator, which is why this is filed as a finding
rather than a bug with a reproducer.

**The honest boundary.** I can prove the body is absent. I cannot prove from the evidence I
collected whether it was (a) never written, (b) written and overwritten by a later call, or
(c) written and lost in the auto-commit. The `ok: true` envelope is not evidence of
persistence, and this is the second time this wave has taught that lesson — the first was
the verifier's Code Mode refusal, where an agent reported a refusal rather than a success
and it was diagnosable only because the refusal was reported rather than swallowed.

**Why it matters beyond me.** `ArggonManager/docs/engineering.md` §Review bar → docs that
travel with the change, and the decision-brief convention, both assume a comment on an item
is durable. A silently-dropped comment body breaks both: a `decide:` brief that vanishes
leaves a heading an owner could answer into with nothing to answer, and a reviewer verdict
record that evaporates leaves an approvable change with no record. The append-only,
never-overwrite promise in `agents.md` §0 ("Comments are the agent handoff channel") is
load-bearing for the whole methodology, so its failure mode should be a named class rather
than three discovers per wave.

## Suggested work (whoever picks this up)

1. Reproduce: write a >2 KB comment body containing nested `##` headings and a fenced code
   block to a tracker item, then re-read the item and assert the body is byte-present. Run it
   against both surfaces (native `tools.arggon.comment` and headless `arggon comment <id>`).
2. If it reproduces, find the discriminator. My only working hypothesis is that a body whose
   first heading matches the comment's own heading marker (`## ...` immediately after
   `### <date> @<author>`) interacts badly with the section parser — the surviving comment
   had `## Push + merge path` directly under its heading and survived, so this hypothesis is
   already partly falsified and should not be trusted.
3. If it does not reproduce, instrument rather than guess: `arggon comment` should return a
   receipt that can be re-read and verified later, so a dropped body is detectable without a
   human re-reading the item.

**Not a blocker for the work already merged** — the two comments that mattered for the
merge decision (the verdict and the follow-up record) both persisted. The loss is confined
to a superseded brief whose content I restated in a later comment, so no decision is lost.
Filed because the class is what repeats, not this instance.

### 2026-10-11 @ses_ed6d9b22effexLQQ1jvoDJGIMi

### 2026-10-11 @arggon-delivery-lead

## Correction to the finding above - I now have the reproducer, and it is not what I guessed

My first write-up proposed two hypotheses and labelled both as untrusted. Both are now
falsified by controlled experiment, and the real pattern is different and simpler. Recording
the correction because a bug filed with a wrong mechanism wastes the maker's first hour.

**The actual pattern (both observed failures, identical shape).** A comment body is lost and
what remains in the item file is:

    <existing comment ends>
    ### 2026-10-11 @<session-id>          <-- heading written, body missing
    ### 2026-10-11 @arggon-delivery-lead   <-- heading written, body present, immediately after
    ## <real first line of the body I passed>

So the heading is written TWICE and the body lands only after the second one. Net effect on
disk: an empty heading pair with the body under the second.

**What the controlled experiment ruled out** (scratch item
`task-scratch-comment-persistence-probe`, now `cancelled` - do not resurrect it):

- large body (~54 KB, 400 paragraphs): persisted
- 5000-char fenced code block, inline: persisted
- default (session-id) author, used by both probes: persisted
- `##` heading as the body's first line: persisted

So size, fences, default author and nested headings are all innocent. The two failures share
a property I have NOT isolated, and I should not guess at it a third time.

**What the two failures share, descriptively.** Both were comments I made while another
`tools.arggon.*` write was in flight in the same session - in one case the branch rebase I was
driving by hand, in the other a `create` whose auto-commit landed in the same window. Both
times the item file was concurrently read-modified-written by more than one writer. That
points at the comment append being a LOST UPDATE, not a serialization failure of the text
itself - a different and more serious class, because it means the append is not atomic.

This is consistent with known sibling hazards: `bug-comment-race-no-lock` ("comment race:
unlocked read-modify-write loses concurrent comments") is marked `done`, and
`bug-comment-torn-read` ("comment initial loadItems can read a torn in-place write") is also
`done`. If those fixes are correct, a concurrent-writer race should be closed - so either my
reasoning is wrong or those fixes have a gap on the NATIVE surface (the MCP path via
`lib/src`, as opposed to the CLI's direct call). I do not know which, and that is the thing to
determine first.

**Recommended first step for the maker (revised).** Do NOT chase body size, fences or
authorship. Start from the concurrency angle - two writers appending to one item file through
the native `tools.arggon.comment` path - and check whether the lock `bug-comment-race-no-lock`
added is actually taken on that path. A reproducer is two foreground `tools.arggon.comment`
calls to the same item fired concurrently, asserting both bodies survive. Cheap, and it either
reproduces immediately or eliminates the whole concurrency family.

**Status of the loss.** Still a loss, still silent, still worth the bug - and now rated HIGHER
than I first wrote, not lower: if the append is not atomic then any concurrent pair of tracker
writes can lose one, and the methodology's "comments are the agent handoff channel" premise
carries the whole reviewer -> verifier -> owner decision chain on top of it. The two comments I
lost were superseded and recoverable by restatement, which is the only reason this did not
cost a decision.

### 2026-10-13 @ses_eca8380c1ffeQSEWbCVjqOL52V
## Evidence (maker) — fix landed as PR #774

Branch `fix/bug-verifier-cannot-read-the-tracker-no-allow-side`, commit
`d58d8503` (10 files). Scope stayed on this item; the Second finding
(concurrent-comment lost update) was NOT touched — it has its own item.

### What changed

- `templates/docs/opencode/agents/arggon-verifier.md` + `.opencode/agents/arggon-verifier.md`:
  `effect: allow` for `show`/`list`/`next`/`report`/`validate` in BOTH spellings
  (`arggon_<tool>` and `arggon_arggon_<tool>`), and `arggon_comment` /
  `arggon_arggon_comment` added to the deny side. `arggon_branch` **stays denied**:
  the acceptance names it "(read-side)", but the tool records the branch (a tracker
  write), and under the documented last-match-wins ordering an allow placed in the
  same block would OVERRIDE its deny and open a write path — which the same
  acceptance's negative control forbids. Reading the branch needs no tool: `show`
  returns the `branch` field.
- `ArggonManager/.convention.yml`: `x-generated[.opencode/agents/arggon-verifier.md]`
  checksum refreshed — without it `cli/src/provenance-audit.test.ts` fails and init
  would treat the seam as adopter-modified and stop propagating template edits.
- Guards: `cli/src/init-opencode.test.ts` pins the verifier's allow set, its deny set
  (`comment` included) and the seam↔template byte parity via `stampGeneratedContent`;
  `smoke/opencode-smoke.ts` gains a model-driven verifier probe + negative control
  (dev aid `OPENCODE_SMOKE_ONLY=verifier-permissions`).
- Carriers: `agents.md` §Orchestration, `engineering.md` §Roles and authority
  (boundary 2 + authority-map row), the OpenCode playbook's permission-probe
  section, `opencode2.md`'s Permissions bullet. The longer table row makes
  prettier re-flow the authority table's padding (padding-only diff).

### Probe 1 — the read is granted (real `arggon-verifier` session, opencode 2.0.26)

- command: `cd /tmp/opencode/verifier-probe/repo && opencode run --standalone --model opencode-go/deepseek-v4-flash --format json --agent arggon-verifier --auto "<script: show/list/validate + update/create/comment + search({namespace:'arggon'})>"`
- expected: `tools.arggon.show({ id: "task-probe-item", meta: true })` returns a
  successful envelope; `update`/`create`/`comment` refused.
- observed (after): ``show`` ok:true with the full frontmatter envelope; ``list`` /
  ``validate`` ok:true; `updateError` "Unknown tool 'arggon.update'.", `createError`
  "Unknown tool 'arggon.create'.", `commentError` "Unknown tool 'arggon.comment'.";
  catalog = exactly `list, next, report, show, validate` (remaining 0); the item file
  on disk unchanged (no comment body, status still todo).
- exit: 0 (both execute calls completed).
- does NOT prove: that the ALLOW entries are what make the read work on this runtime.

### Probe 2 — the correction: the item's mechanism does not reproduce

- command: same session, WITHOUT the fix (fixture restored to the shipped template, recorded as `baseline-verifier.jsonl`).
- expected per the item: the read is unreachable ("the whole arggon namespace is unreachable").
- observed: `show` returned the SAME `ok:true` envelope, and the catalog was the
  same five reads **plus `comment`**. The runtime's documented base policy
  (`{action:"*", resource:"*", effect:"allow"}`) resolves an unmatched resource to
  allow, so the missing allow entries were not what blocked reads; the deny entries
  are what remove write tools from the catalog.
- exit: 0.
- does NOT prove: what the 2026-10-11 live verifier actually hit. It rules out this
  permission block on 2.0.26; the historical cause is still unexplained (open
  question for the delivery lead, not silently closed).
- Consequence for the fix, kept honest: the allow entries PIN the read set so it is a
  stated contract (agent rules are appended last and win) instead of a runtime
  default, and the docs say config-enforced for the write side / as a stated read set
  — they do not claim reads were broken.

### Probe 3 — negative control (the deny is unchanged and complete)

- observed: `update({status:"done"})` and `create(...)` refused in BOTH runs;
  `comment` refused only after the change (that deny is the catalog-visible
  behavioural change); `edit`/`subagent`/`git commit|push|merge|rebase` denies untouched.
- does NOT prove: that `ask`-style prompts never appear for other resources; the
  probe covers the tracker namespace, not every runtime action.

### Gates (all in the worktree, green)

- `npm run build` (tsc x3 + `build:plugin`, bundle byte-stable) — exit 0
- `npm test` — 152 files / 3315 tests passed
- `npm run lint` — clean; `npm run test:structure` — 5/5 (ast-grep)
- `npm run arggon -- validate` — ok, 0 warnings
- `npx prettier --check` on every touched file — clean
- `OPENCODE_SMOKE_ONLY=verifier-permissions npm run smoke:opencode` — 11/11 checks
  (model-driven, run ALONE per §Orchestration)

### Pre-existing failures observed, NOT introduced here (report, not a diff)

The `w4` smoke group reports 4 failures: `second item done`, its two downstream
invariants checks, and `the reviewer's shell gate denies git push`. Reproduced on
the UNMODIFIED base commit (`72a79a0d`) in a scratch worktree: the same
`second item done` and `git push` failures (3 of 4; the reopen pair was skipped
because the model did not run the script there). Cause of the invariant trio: the
fixture's `update --status done` on a placeholder-body item is refused while the
lifecycle scenario ticks its boxes first — so "second item done" fails and the
reopen probe then legitimately succeeds on an item that was never done. The push
check is the documented model-dependent flake. Candidate follow-up for the delivery
lead to file if wanted; deliberately out of this diff.

### Impact class

**Behavioral** (ADR 0016): a generated agent seam shipped to adopters plus
methodology carriers (`agents.md`, `engineering.md`). Channel: re-run `arggon init`
— untouched seam files refresh, acked/modified ones surface as `--propose` side
files. No `skills/arggon-cli/**` change, so no skill-copy sync is required.

Acceptance boxes are ticked against the evidence above; bullet 2 is ticked for the
observed successful envelope, with the causality boundary stated in Probe 2.
