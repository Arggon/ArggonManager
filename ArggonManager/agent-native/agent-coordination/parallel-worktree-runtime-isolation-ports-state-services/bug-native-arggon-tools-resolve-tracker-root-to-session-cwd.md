---
type: bug
status: in_progress
id: bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
title: "Native `tools.arggon.*` resolve the tracker root from the process cwd, so a worker editing a worktree silently commits tracker mutations into the primary checkout (session_move does NOT rebind them)"
assignee: arggon-delivery-lead
branch: fix/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, worktree, hygiene]
created: "2026-10-02"
updated: "2026-10-05"
claimed_at: "2026-10-05T18:50:55.962Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd.md
  Leaves live only under a story. id is the filename stem: bug-native-arggon-tools-resolve-tracker-root-to-session-cwd.
  CLI `arggon create bug native-arggon-tools-resolve-tracker-root-to-session-cwd` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native `tools.arggon.*` resolve the tracker root from the process cwd, so a worker editing a worktree silently commits tracker mutations into the primary checkout (session_move does NOT rebind them)

## Context

**Cost of the bug**: 7 open PRs in this repo became invisible to the tracker.
Their items all sat at `todo` with no assignee, no `branch` and no
`worktree_path`, while finished work sat in orphaned worktrees. That is what a
silent wrong-checkout commit looks like from the tracker's side.

### The incident, twice, first-hand

On 2026-10-05, reconciling PR #612 while holding the claim for
`bug-mcp-parity-branch-test-json-parse-of-human-stdout` and working inside
`…/ArggonManager-bug-mcp-parity-branch-test-json-parse-of-human-stdout`, the
delivery lead called `tools.arggon.comment({ id: "bug-mcp-parity-…", … })`. The
returned `path` was
`/home/arggon/Projects/ArggonManager/ArggonManager/agent-native/…/bug-mcp-parity-….md`
— the **primary** checkout — and it produced a local commit on `main`
(`a7b3f063 chore(tasks): commented bug-mcp-parity-…`) that was never pushed.

### The premise, corrected against the real runtime

The item was filed claiming `opencode.session_move` **does not** rebind the
tracker root. **Verified false, in the session that wrote this fix.** One live
worker session, two reads:

| step                                             | `show` resolved                             | item reported                                                                                    |
| ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| session in the primary checkout                  | `/home/arggon/Projects/ArggonManager`       | `todo`, `assignee: null`, `branch: null`, `worktree_path: null`                                  |
| after `opencode.session_move` into this worktree | `…/ArggonManager-bug-native-arggon-tools-…` | `in_progress`, `assignee: arggon-delivery-lead`, `branch: fix/bug-native-…`, `worktree_path` set |

`session_move` **does** rebind. The per-call session-directory resolution added
by [`bug-native-tools-commit-to-primary-checkout`](../../../arggon-manager/opencode2-native/native-redesign/bug-native-tools-commit-to-primary-checkout.md)
is sound — and its handoff left exactly this question open, as untested against
a real runtime. It is now answered.

So the defect is **not** "the wrong directory is resolved". It is **"the wrong
directory is resolved and nothing says so"**. The lead's own incident is
consistent with the correct rule: the shell was in the worktree, but the
_session_ had never been moved, so the session's directory was genuinely the
primary — and the call answered `ok: true` with a commit hash. A rule that is
right can still fail silently, and this one did.

### The two concrete holes

1. **Silence.** Nothing in the envelope names the checkout that answered. The
   item `path` names the item file; the commit hash names a commit on whatever
   branch that checkout had. An agent cannot tell it bound to the wrong place
   without re-deriving it by hand.
2. **The env contract is written and never read.** `start --worktree` writes a
   gitignored `.arggon.env` carrying `ARGON_ITEM`, `ARGGON_WORKTREE_ID`,
   `ARGGON_WORKTREE_PATH`, `ARGGON_WORKTREE_BRANCH`, `ARGGON_STATE_DIR` /
   `ARGGON_CACHE_DIR` (spec [worktree-env-contract-016](../../docs/specs/spec-worktree-env-contract-016.md)).
   It is reported in the `env` receipt, reaped by `cleanup --prune`, and
   documented in three places — and **no resolution path ever read it**. The one
   artifact that states "I am this worktree" was never consulted, so the
   resolution had nothing to be held against.

### How it is reproduced, deterministically

A primary checkout with a real linked worktree on the item branch. The calling
session's directory is the **primary** (the state a worker that never moved is
in), while the worktree's `.arggon.env` — or the process environment sourced from
it — declares the worktree. Before this fix: `comment` reports `ok: true`, a
commit hash, and the commit lands on the primary's branch. After: the write is
refused with `TRACKER_ROOT_MISMATCH` naming both checkouts, a read reports the
mismatch instead of failing, and both checkouts are byte-identical afterwards.

### Read side, first-hand (the same hole, from a read)

Before the claim commit was read: `tools.arggon.show({ id, meta: true })` from
the **primary** answered `todo` / `assignee: null` / `branch: null`, because
`start`'s claim commit rides the item branch and the primary's working copy was
stale. The worktree's copy of the very same item file carried `in_progress` /
`arggon-delivery-lead` / the branch / the worktree path. Reads mis-resolve by
exactly the same rule writes do, which is why the fix makes the resolved root
visible on the read receipt rather than only on the refusal.

## Acceptance

- [ ] A tracker write issued from a session working in a worktree lands in that worktree's branch, or is refused with the resolved-vs-expected mismatch named — never silently commits to the primary checkout
- [ ] The resolved tracker root is visible in a read receipt (`show --json` and/or the native equivalent), so an agent can detect the mismatch without guessing
- [ ] `.arggon.env` per-worktree identity (`ARGGON_WORKTREE_PATH` / `ARGGON_STATE_DIR`) is consulted when resolving, so a worktree session cannot bind to the primary
- [ ] A regression test drives the native surface from a worktree cwd and asserts the write lands in the worktree's branch (and one that asserts the refusal/visibility path)
- [ ] `docs/agents.md` §Orchestration (and the worker's operating rules) no longer rely on `session_move` as the mitigation, since it demonstrably does not rebind the tracker root

## Notes
