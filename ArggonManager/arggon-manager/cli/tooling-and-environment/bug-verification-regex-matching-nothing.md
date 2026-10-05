---
type: bug
status: todo
id: bug-verification-regex-matching-nothing
title: "A verification regex that silently matches nothing reports success forever: a marker pattern missing one alternation branch reported \"0 markers\" before a fix that removed 439, so the check was blind in BOTH directions"
parent: tooling-and-environment
labels: [tests, verification]
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-verification-regex-matching-nothing.md
  Leaves live only under a story. id is the filename stem: bug-verification-regex-matching-nothing.
  CLI `arggon create bug verification-regex-matching-nothing` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A verification regex that silently matches nothing reports success forever: a marker pattern missing one alternation branch reported "0 markers" before a fix that removed 439, so the check was blind in BOTH directions

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @Arggon
Found by the worker on PR #605 (`task-zcode-goal-mode`), 2026-10-03, while repairing its own record — and it reported it against itself rather than letting a green check stand.

**The defect.** The worker's conflict-marker check used:

```
^(<{7}|={7}|>{7})(\s|$)
```

That pattern **silently misses `<<<OURS>>>`** (git's `rebase --ours`/`--merge` conflict style), because it requires a whitespace or end-of-line right after seven markers and `<<<OURS>>>` has a name attached. So the check reported **0 markers**.

Critically, it reported 0 markers **before the fix too** — when 439 existed. The check was blind in *both* directions: it could not detect the corruption it was written to detect, and it did not complain either. With the corrected pattern, before = 439, after = 0.

**Why this is worth an item of its own.** A gate that cannot fail is worse than no gate, because it converts "unverified" into "verified" in the reader's mind. Every verdict and merge decision that leaned on it was leaning on a null result. This is the same family as three other findings today, and the family is now large enough to name:

- `bug-vacuous-substring-ordering-assertions` (merged) — `indexOf` returns −1 for an absent substring, and `−1 < any positive` is always true
- PR #606's checksum test — rewrote `checksum: <hex>` when the recorded form is `sha256:<hex>`, so the substitution matched nothing
- `bug-vacuous-substring-ordering-assertions`'s ast-grep exemption (merged) — exempted all numeric right-hand sides while justifying itself with a rule that only held for two of them

And the failure mode is now precise: **a pattern that matches nothing produces the same output as a pattern that matches everything the author expected to be absent.** Both print `0`.

Acceptance:
- [ ] The item's own class: **every verification regex used by this repo's own checks has a positive control** — a fixture where the thing being searched for IS present, asserted to be found. A search-based check that cannot demonstrate it finds a known-present instance is not a check
- [ ] Candidate sweeps worth examining (report what you find; do not assume they are broken): conflict-marker scans, `git grep` guards in the workflows, the ast-grep rules under `tools/ast-grep/rules/`, `prettier`-related prose rules, the seam drift gate's `git grep --fixed-strings "arggon:generated"` marker probe, and any `assertOrder` / substring-presence helper (those are already presence-as-precondition, which is the right shape — check they were not regressed)
- [ ] A structural answer where possible: prefer assertions whose failure mode is *loud on absence* (presence-as-precondition, a required-count, a fixture that must match) over search-and-count-zero. `expectOrder`/`assertOrder` in this repo already model the right shape; check whether the same property can be expressed for searches
- [ ] **Check the CI seam-drift gate's marker probe specifically.** `git grep -q --fixed-strings "arggon:generated"` decides whether the gate applies at all — "no committed arggon seam yet" silently exits 0. If that marker string were ever renamed in the templates, the gate would quietly stop running on every repo. That is a gate protecting the seam, disabled by renaming a string
- [ ] Record the discipline: a check whose expected result is `0` must state *why* zero is expected and what a non-zero would mean, so a reader can tell a blind check from a correct one

Depends on nothing. Related, do not absorb: `bug-vacuous-substring-ordering-assertions` is merged and is about a different mechanism (presence of a needle before comparison), though it is the same family.
