---
type: task
status: in_progress
id: task-publish-auth-hint-review-observations
title: "publish-auth-hint (PR #741) review observations: message fallback is consulted when a non-auth code exists (docstring says otherwise); spawnSync maxBuffer edge exits 2 without re-emitting npm stderr"
assignee: arggon-delivery-lead
branch: feat/task-publish-auth-hint-review-observations
parent: story-release-pipeline
labels: [release, failure-mode, review-followup]
created: "2026-10-12"
updated: "2026-10-15"
claimed_at: "2026-10-15T01:21:16.370Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-publish-auth-hint-review-observations
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-publish-auth-hint-review-observations.md
  Leaves live only under a story. id is the filename stem: task-publish-auth-hint-review-observations.
  CLI `arggon create task publish-auth-hint-review-observations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# publish-auth-hint (PR #741) review observations: message fallback is consulted when a non-auth code exists (docstring says otherwise); spawnSync maxBuffer edge exits 2 without re-emitting npm stderr

## Context

Two non-blocking observations from the standards review of PR #741
(`bug-release-needs-auth-self-describing`, the `cli/publish-auth-hint.mjs`
wrapper), recorded so they outlive the parent item:

1. **Message fallback ordering vs the documented contract.** The module
   docstring says the message patterns are consulted "when the log carries no
   code line", but `classifyPublishFailure` falls through to `AUTH_MESSAGES`
   whenever no _auth_ code exists — including when a non-auth code (e.g.
   `E404`) is present. A log carrying `E404` plus an incidental
   "requires you to be logged in" substring would be annotated as auth. Low
   real-world risk (npm's 404 output does not usually carry those phrases), but
   the code and the docstring disagree.
2. **`spawnSync` maxBuffer edge.** npm stderr larger than the 1 MiB default
   buffer makes `spawnSync` fail; the wrapper then exits 2 via `usage()` without
   re-emitting the captured output. Pathological (npm error output is small),
   but the failure mode would hide the underlying npm error.

## Acceptance

- [ ] Either gate the message fallback on `codes.length === 0` (match the
      docstring) or amend the docstring to state the real contract — pick one
      and pin it with a test (a log with a non-auth code AND an auth-phrase
      substring must classify as `other`)
- [ ] Decide the maxBuffer edge: raise the buffer, or on `spawnSync` failure
      still re-emit whatever npm output was captured before exiting — a hidden
      npm error must not become a hidden wrapper error
- [ ] Existing behaviour pinned by `cli/publish-auth-hint.test.ts` stays green;
      `npm run test` green

## Notes

Filed 2026-10-12 by the delivery lead from the PR #741 standards review; the
parent item merged with these recorded as non-blocking.
