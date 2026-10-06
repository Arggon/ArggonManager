---
type: bug
status: todo
id: bug-native-guard-silent-without-worktree-declaration
title: "The native tracker-root guard is silent when no worktree is declared, so the incident that made 7 PRs invisible still reproduces for an unsourced session"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, worktree, hygiene]
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-guard-silent-without-worktree-declaration.md
  Leaves live only under a story. id is the filename stem: bug-native-guard-silent-without-worktree-declaration.
  CLI `arggon create bug native-guard-silent-without-worktree-declaration` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The native tracker-root guard is silent when no worktree is declared, so the incident that made 7 PRs invisible still reproduces for an unsourced session

## Context

Found while delivering `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd` (merged 2026-10-05).

That change made the native seam read the documented `.arggon.env` worktree identity and **refuse** a write (`TRACKER_ROOT_MISMATCH`) whose resolved checkout is none of the declared worktrees, and **report** the mismatch on reads (`trackerRoot` / `trackerWorktree` / `trackerRootMismatch`).

**The residual hole, stated by the maker and confirmed by the delivery lead:** the guard is _reconciling_ — it compares the resolved checkout against a **declaration**. A worker that never moved its session **and** never sourced `.arggon.env` **declares nothing**, so there is no expectation to hold the resolution against, and the guard stays silent.

That is exactly the incident that made **7 open PRs** invisible to the tracker on 2026-10-05: a session whose shell was in a worktree while the session itself was still bound to the primary, committing tracker mutations into the primary and reporting `ok: true` with a commit hash. `agents.md` §Orchestration rule 1 ("move the session, then confirm the binding") is currently the ONLY thing protecting that case — a documentation rule, with no enforcement behind it.

## Acceptance

- [ ] The declaration is established by the **dispatch surface** (or `start`), not by the worker
      remembering to source it — so the expectation exists before the first tracker write
- [ ] The undeclared-and-unmoved case is either refused or reported, decided explicitly and
      documented; "silently proceeds" is not an acceptable outcome
- [ ] A regression test covers it: a write from a session bound to checkout A while a worktree
      B is the intended target, with **no** env sourced — today this is the silent case
- [ ] The design decision (who declares, when, and what a legitimate unsourced primary-checkout
      write looks like) is recorded as an ADR or a doc line, not left implicit in code
- [ ] `agents.md` rule 1 stops being load-bearing on its own once this lands, or says plainly
      that it still is

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Measured reproduction from a delivery-lead session on 2026-10-05, offered as evidence for this item rather than as a new report. **This is the same guard and the same `ARGGON_WORKTREE_PATH` root — I did not open a separate item.**

### What happens

Two native calls, both made while my session was working inside `/home/arggon/Projects/ArggonManager-task-adr-index-parity-does-not-check-titles`:

- `tools.arggon.show({ id: "task-adr-index-parity-does-not-check-titles", meta: true })` → `status: todo, assignee: null, branch: null, claimed_at: null, worktree_path: null`
- the branch's own item file at that same moment → `status: in_progress, assignee: Arggon, branch: feat/…, claimed_at: "2026-10-03T12:48:04.010Z"`

Same item, same moment, two different answers. The native tool read the **primary checkout**; the claim lived in the worktree. No error, no warning, no degraded flag — just a confident, wrong item state.

### Why this is worse than "the guard is silent"

The silent-guard framing says the failure is *absent output*. This is **present, plausible, wrong output**, and it survived every check I ran. I built a wave plan on it. Two of the five "in-flight" items I identified were only caught because I happened to run `git worktree list` and `git show <branch>:<item>` by hand — nothing in the native surface prompted me to. Had I not cross-checked, I would have dispatched a maker into a worktree another writer already held, which is a claim conflict the kernel refuses but the maker would have walked into.

It also corrupts the ordinary read path: `next` returns `task-explore-adopter-feedback-channel` as the top claimable item, and `show` reports it unclaimed, while its worktree holds a two-round-reviewed PR on a branch claimed by `Arggon`.

### The three faces of one root, for whoever picks this up

I now think this item's scope should cover all three, because all three are "the tracker only learns about a worktree when a commit rides a branch, and `main` cannot read branch state":

1. **Pool** — `list`/`next` compute claimability from `main`, so 5 in-flight items read as unclaimed `todo`. Tracked separately as `bug-claim-pool-computed-from-main-misses-branch-claims`.
2. **Read path** — the native `show`/`list` resolve to the primary checkout, so a worktree's item state is unreachable. **This item.**
3. **Reap path** — `cleanup --prune` could only reap **1 of 9** stale worktrees today. The other 8 belong to `done` items whose `main` frontmatter records no `worktree_path` (the claim was released rather than landed), so the reaper is blind to them. 15 worktrees persist with no tracker footprint.

Face 3 has a cheap standalone check: a `done` item with a matching `../<repo>-<id>` directory on disk that `cleanup` does not list as a candidate. That is a report-only assertion and needs no behavioural change.

### One adjacent trap, in case it is in scope

The same session, `doctor` reported `vendored plugin STALE`, so the native catalog was whatever was on disk at session start. `tools.arggon.cleanup` exposed only `{prune, no_gh, no_commit}` — no `release`, no `take_over_worktree` — while the CLI has both and `cli/src/mcp-server.ts` declares both. I nearly filed that as a seam-drift defect. It is **not** one: `doctor` had already named the cause and the fix. Worth a line here only because the failure presents as "the tool is missing a flag" and the real answer is "restart the session".
