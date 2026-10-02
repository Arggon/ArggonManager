---
type: bug
status: todo
id: bug-contributing-github-issue-contradiction
title: "CONTRIBUTING.md contradicts itself on GitHub issues (line 13 'not used' vs line 269 'open an issue')"
parent: story-adopter-feedback
labels: [docs]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-contributing-github-issue-contradiction.md
  Leaves live only under a story. id is the filename stem: bug-contributing-github-issue-contradiction.
  CLI `arggon create bug contributing-github-issue-contradiction` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CONTRIBUTING.md contradicts itself on GitHub issues (line 13 'not used' vs line 269 'open an issue')

# CONTRIBUTING.md contradicts itself on GitHub issues (line 13 'not used' vs line 269 'open an issue')

## Context

`CONTRIBUTING.md` states the issue-tracking doctrine twice, in two incompatible
ways (read 2026-10-02):

- **Line 13**, under `## Issues and PRs`:

  > "Prefer a **work item in the tracker** (`arggon create task|bug`) for anything
  > beyond a typo — the tree is the issue tracker; GitHub issues are not used
  > (see `ArggonManager/docs/agents.md` §0)."

- **Line 269**, under `## Propose schema / convention changes`:
  > "1. Open an issue describing the change and why (agents + humans must share
  > one rule)."

Line 13 is authoritative (`docs/agents.md` §0 says the same, and the repo's own
history shows it: 21 GitHub issues, all closed, all 2026-09-03 → 2026-09-11 —
the pre-tracker era). Line 269 is pre-tracker residue that was never swept when
the tracker moved in-tree.

**Why it matters beyond tidiness.** This is exactly the finding class
[`docs/labs/adversarial-audit.md`](../../../../docs/labs/adversarial-audit.md) §2
exists to catch — "a sentence written as a promise that a later change silently
falsified". A human or agent reading §Propose schema / convention changes is
instructed to do the thing the doc says never happens. It is also load-bearing
for the reverse-feedback-channel decision tracked in
[`task-explore-adopter-feedback-channel`](task-explore-adopter-feedback-channel.md):
the repo cannot simultaneously assert "GitHub issues are not used" and ship a
doctrine for routing friction to GitHub.

`agents.md` §0 itself is unambiguous ("Do **not** open new GitHub issues"), so
the fix is confined to `CONTRIBUTING.md`. Note the parity requirement: if the
line-269 fix changes any **generated** doc statement, it is a **behavioral**
methodology-carrier change per `docs/agents.md` §Changing the methodology itself
and must state its impact class in the PR description and as an item comment.

## Acceptance

- [ ] `CONTRIBUTING.md:269` no longer instructs the reader to open a GitHub issue; it points at the tracker instead, consistent with line 13 and `docs/agents.md` §0
- [ ] `grep -n -i "open an issue\|github issue" CONTRIBUTING.md` shows no remaining contradiction — every remaining hit agrees with the "tracker is the issue tracker" doctrine
- [ ] The wording preserves the section's intent (schema/convention changes need
      a written rationale shared by humans and agents) without inventing a new
      intake rule
- [ ] If the edit changes any generated template or statement in `templates/` or `skills/`, the impact class is stated in the PR description and as a comment on this item, and `npm run skills:sync` + the parity tests are green
- [ ] Prettier clean (`npx prettier --check CONTRIBUTING.md`) — the repo has a
      history of formatter-glued Markdown spans (`bug-formatter-glues-markdown-spaces`)

## Notes

Scope is intentionally one file. This item does **not** touch `docs/agents.md`
§0 (already correct) and does **not** decide the reverse-channel doctrine — that
is
[`task-explore-adopter-feedback-channel`](task-explore-adopter-feedback-channel.md)
and
[`exploration-adopter-feedback-channel-018`](../../../../docs/explorations/exploration-adopter-feedback-channel-018.md).
It is filed independently because it is unambiguous and cheap, and because the
repo's own `adversarial-audit.md` demands a finding without a repro be treated as
a hunch — this one has line numbers.
