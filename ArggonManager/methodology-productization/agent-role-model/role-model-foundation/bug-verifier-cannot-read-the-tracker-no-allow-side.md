---
type: bug
status: todo
id: bug-verifier-cannot-read-the-tracker-no-allow-side
title: "Verifier cannot read the tracker: no allow side"
parent: role-model-foundation
labels: [permissions, arggon-seam, verifier, docs]
priority: p2
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-verifier-cannot-read-the-tracker-no-allow-side.md
  Leaves live only under a story. id is the filename stem: bug-verifier-cannot-read-the-tracker-no-allow-side.
  CLI `arggon create bug verifier-cannot-read-the-tracker-no-allow-side` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Verifier cannot read the tracker: no allow side

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

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
   are *removed from its catalog* — the same role boundary enforced at the layer that
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
