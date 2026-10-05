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
