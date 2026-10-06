---
type: bug
status: done
id: bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
title: "Native `tools.arggon.*` resolve the tracker root from the process cwd, so a worker editing a worktree silently commits tracker mutations into the primary checkout (session_move does NOT rebind them)"
assignee: arggon-delivery-lead
branch: fix/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, worktree, hygiene]
created: "2026-10-02"
updated: "2026-10-06"
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

- [x] A tracker write issued from a session working in a worktree lands in that worktree's branch, or is refused with the resolved-vs-expected mismatch named — never silently commits to the primary checkout
- [x] The resolved tracker root is visible in a read receipt (`show --json` and/or the native equivalent), so an agent can detect the mismatch without guessing
- [x] `.arggon.env` per-worktree identity (`ARGGON_WORKTREE_PATH` / `ARGGON_STATE_DIR`) is consulted when resolving, so a worktree session cannot bind to the primary
- [x] A regression test drives the native surface from a worktree cwd and asserts the write lands in the worktree's branch (and one that asserts the refusal/visibility path)
- [x] `docs/agents.md` §Orchestration (and the worker's operating rules) no longer rely on `session_move` as the mitigation — **the stated reason is corrected**: `session_move` demonstrably DOES rebind (measured in this fix's own session, §Context); what it is not is a guarantee, and the docs now carry the corrected finding plus a one-read verification step and the new guard.

## Notes


### Acceptance evidence — expected vs observed, per box

Fix: `opencode/plugins/arggon/index.ts` (+ regenerated bundle) and
`opencode/plugins/arggon/tools.test.ts`, plus docs. **No `lib/src` change**: the
kernel's `findTasksDir`/`repoRootFromTasks` already walk up from the `cwd` they
are handed, so the defect was entirely on the native side, as with
`bug-native-tools-commit-to-primary-checkout`.

**Box 1 — a write lands in the worktree's branch, or is refused with the
resolved-vs-expected mismatch named; never silently commits to the primary.**
Expected: from a session NOT in the worktree, `comment`/`update`/`handoff`/
`branch` are refused with both checkouts named, and both checktrees are
byte-identical afterwards. Observed: all four throw `ArgonToolError` with
`code: TRACKER_ROOT_MISMATCH` and envelope `{ok: false, error: {code:
TRACKER_ROOT_MISMATCH}}`; after the refused batch the primary HEAD is unchanged,
`git status --porcelain` is `""`, and `itemBytes()` in both the primary and the
worktree does not contain the comment text. The refusal message leads with the
code, then the resolved checkout, then every declared one with its source, then
both remedies. From a session correctly IN the worktree the same `comment`
reports a hash that is the worktree HEAD on `fix/task-rate-limit`, with the
primary HEAD and item bytes untouched. Tests: `"refuses a tracker write whose
resolved checkout is not the declared worktree"`, `"refuses every writing tool,
not just comment"`, `"names both the resolved and the expected checkout in the
refusal"`, `"reads .arggon.env at the resolved checkout and lands the write on
its branch"`.

**Box 2 — the resolved root is visible in a read receipt.** Expected: `show`
answers with the checkout it bound to, and a mismatch is observable without a
write. Observed: the read returns `trackerRoot: <resolved primary>` and
`trackerRootMismatch: {resolved, declared: [<worktree>], sources:
["process.env"]}` with `ok: true` — a read is never refused. In the correct
worktree case it returns `trackerRoot: <worktree>` plus the full
`trackerWorktree` identity read from disk (`source` = the `.arggon.env` path,
`path`, `id`, `item`, `branch`, `stateDir`, `cacheDir`). Deliberately additive
only when a worktree is involved: a plain checkout declares nothing, so the
envelope is byte-identical to the CLI's — which is what keeps the
`native tool outputs mirror the CLI --json envelopes` suite green (it pins 8
read cases plus 10 native-vs-CLI stdout byte comparisons; an always-on field
broke 24 tests on the first attempt and was the reason the rule is conditional).
Test: `"reports the mismatch on a READ instead of refusing it, and shows the
resolved root"`, `"never refuses a plain checkout that declares nothing, and
stays byte-identical to the CLI"`.

**Box 3 — `.arggon.env` per-worktree identity is consulted when resolving.**
Expected: the documented keys are read, from disk and from `process.env`, and a
worktree session cannot bind to the primary. Observed: `findWorktreeEnv` reads
at the resolved directory and up to 8 parents; `readWorktreeEnv` yields the
exact documented identity from a contract file and `undefined` for a missing,
oversized (>8 KB), malformed or identity-free one; `processWorktreeIdentity`
reads only the documented keys. The on-disk half refuses on its own with no
environment involved: a `.arggon.env` at the resolved directory naming
`/somewhere/else/repo-task-rate-limit` makes the write refuse with that path in
the message and the worktree HEAD unchanged. Tests: `"refuses a write when the
.arggon.env beside the session names another worktree"`, `"reads the documented
keys from an env file and ignores everything else"`, `"declares nothing for a
missing, oversized or identity-free file"`, `"finds the contract above the
directory it resolved, but stops at the walk's bound"`, `"reads the process
declaration only from the documented keys"`.

**Box 4 — a regression test driving the native surface from a worktree cwd.**
Expected: the write-lands-in-the-worktree case and the refusal/visibility case,
both over a real `git worktree add -b` checkout. Observed: the new describe
`"tracker-root binding against the declared worktree identity"` (8 tests) plus
`"worktree identity parsing"` (5 tests), 13 new tests, over a real linked
worktree whose `.arggon.env` is written in `lib/src/worktree.ts`'s exact key
order and unquoted format. **Negative control**: neutralizing
`trackerRootMismatch` (returning `undefined` early) fails 5 of the 8 — the
refusal tests, because the call then resolves `ok: true` into the primary
instead of throwing — and the 3 that still pass are precisely the ones pinning
deliberately unchanged behavior (plain checkout not refused, unreadable env
degrades, correct-worktree case unaffected). Restored and re-verified green.

**Box 5 — docs no longer rely on `session_move`.** Observed:
`docs/agents.md` §Orchestration previously said only "`opencode.session_move`
follows the session where the work lives". It now states that `session_move`
carries tracker writes onto the item branch AND that a moved session is not a
guarantee, with two worker rules: (1) after moving, one `show --meta` must
answer with the claimed state — if it answers `todo`/no assignee the session is
still on the primary; (2) never rely on the write to report where it landed, and
use `trackerRoot`/`trackerWorktree`/`trackerRootMismatch` to detect the
disagreement. `docs/opencode2.md` gains the corrected finding with the
two-read measurement table, the binding rule, both declaration sources, the
narrowness argument and the receipt-field table. `docs/json-output.md` gains the
native-only receipt rows. **The item's stated reason was wrong and is corrected
rather than repeated** — see §Context; writing "session_move does not rebind"
into the methodology would have been a durable false claim.

**Gates, all re-run after the final edit, from this worktree.**
`npm test` → **128 files / 2693 tests passed**; `npm run lint` → clean;
`npm run build` → lib build + tsc ×3 + `build:plugin` clean; `npm run
check:plugin` → bundle regenerated, `git diff --exit-code` exit 0;
`npm run test:structure` → 5/5 PASS (`acceptance-rows-use-kernel`,
`native-tools-use-shared-seam`, `ordering-assertions-use-assert-order`,
`tracker-mutations-use-kernel`, `tracker-rename-destination-use-kernel`);
`npm run lint:structure` → ast-grep scan clean; `npm run arggon -- validate
--json` → `{"ok":true,…,"errors":[],"warnings":[]}`.

Not verified, honestly: the **real-runtime leg** (`npm run smoke:opencode`,
`smoke:opencode:wave`, `smoke:native-start-cold`) was not run — they are
model-driven and timing-sensitive and must not run beside a loaded machine. The
in-process suite models the V2 tool context exactly. Note this change makes the
seam read `process.env`, so the plugin suite now clears and restores the five
worktree env keys for hermeticity (a developer who exported
`ARGGON_WORKTREE_PATH` by sourcing a `.arggon.env` would otherwise have made
every unrelated case bind to that worktree); the smoke harnesses would need the
same treatment before they are next run.

### 2026-10-05 @arggon-delivery-lead
verdict: approve on the change; merge currently blocked by a pre-existing gate flake, not by this diff

**The premise refutation was verified independently, not accepted.** The item asserted the seam resolves the tracker root from `process cwd` and that `session_move` "does NOT rebind". Both are false. `opencode/plugins/arggon/index.ts` resolves its directory from `ctx.session.get` → `Session.Info.location.directory`, with `options.cwd` only as a fallback when the host reports none; `session_move` updates exactly that field. My own incident is consistent with the correct rule — the shell was in a worktree while the **session** never moved, so the primary *was* the session's directory. Correcting box 5's reason in place rather than writing a false claim into a methodology carrier was the right call and is approved.

**Design review.** Reconcile-then-refuse is the right shape: reads are never refused (they carry `trackerRoot` / `trackerWorktree` / `trackerRootMismatch`), only the "declared a worktree, resolved elsewhere" state refuses, and identity is compared by **path** not by `ARGGON_WORKTREE_ID`. A correctly-moved session therefore never refuses — which is why this cannot fire on the happy path. Keeping the fields off the unconditional envelope was equally right: `native tool outputs mirror the CLI --json envelopes` (ADR 0011) is load-bearing (24 tests broke), and the catalog measures 12 162 B against a 12 288 B budget, so an unconditional field has no room. Additive, so no `schemaVersion` bump — correct per `json-output.md`.

**Honest limitation accepted, not waved through.** The guard is reconciling, so it is silent when nothing is declared — my exact incident class. The maker said so plainly instead of claiming closure; the residual is filed as `bug-native-guard-silent-without-worktree-declaration`, and `agents.md` now states that rule 1 is the only guard for the undeclared case rather than implying the hole is closed. Also filed: `bug-smoke-harness-env-hermeticity-worktree-keys` (the smoke harnesses clear only `ARGON_ITEM`, and the seam now reads `process.env`).

**Gates — executed by me in the item worktree:**
- `npm test` → **128 files / 2693 tests passed** (fully green; `cli/src/headless-ci.test.ts` did **not** reproduce here — it is load-sensitive, and it does fail on the primary checkout).
- `npm run lint:structure` → clean · `npm run test:structure` → 5/5 · `npm run build` → clean.
- `npm run check:plugin` → exit 0, bundle regenerated by `build:plugin`, not hand-edited.

**Why this is not merged yet — a pre-existing gate flake, evidenced not assumed:**
- CI was **green on this branch's earlier head** (runs 3736254693 / 3736254688: `cli`, `tasks-validate`, `ui-smoke` all pass).
- After merging `origin/main` in, `cli` failed in `cli/src/cli.test.ts:183` with the harness's own verdict: `kernel artifact drift: … another suite lane rebuilt lib/dist or dist in place; that child linked a half-written module. Fix the writer … not the reader`, plus `SyntaxError: './json.js' does not provide an export named 'compactWorkItem'`. `tasks-validate` was cancelled in the same pass and passed on re-run.
- That is `bug-test-suite-lib-dist-rebuild-race` (p1) verbatim, and it is what also red-lines PRs #618 and #586. It is **not** caused by this diff: the failing lane is a pre-existing parallel rebuild, and this branch's change touches no build path.
- Per the project's own rule an intermittent failure is **not chased by reruns** (`agents.md` §Review bar → flake reproduction harness), and green CI is necessary to merge. So the merge waits on `bug-test-suite-lib-dist-rebuild-race`, which is now the single gate blocking this PR, #618 and #586 at once — making it the highest-leverage item on the board.

**Not done here, deliberately:** `priority` untouched (product owner's field); no ADR proposed for the guard's design because the change is additive and reversible — the design question that *does* need a record (who declares the worktree) is carried on the filed residual item rather than smuggled into this PR.

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
**In flight — do not dispatch.** Work is complete and reviewed on branch `fix/bug-native-arggon-tools-resolve-tracker-root-to-session-cwd`, open as **PR #646**. The claim (`in_progress` / assignee / `worktree_path`) lives on that **branch**, not on `main`, so this item still reads as unclaimed `todo` here — the merge carries the frontmatter across.

Recorded so no wave re-claims it and opens a conflicting branch: a previous session produced 7 PRs that were invisible to the tracker for exactly this reason, and the fix for it (PR #646) is itself subject to it until it merges.

Merge is currently held by a **pre-existing** gate flake, not by this change: `cli` failed with the harness's own `kernel artifact drift … another suite lane rebuilt lib/dist in place` verdict plus `SyntaxError: './json.js' does not provide an export named 'compactWorkItem'` — `bug-test-suite-lib-dist-rebuild-race` (p1), the same defect red-lining PRs #618 and #586. CI was green on this branch's earlier head (runs 3736254693 / 3736254688). Full delivery-lead verdict and gate evidence are on the branch.

### 2026-10-05 @arggon-delivery-lead
Merge blockers resolved; closing out. Both reasons the previous entry recorded as holding this PR are gone:

- **`bug-test-suite-lib-dist-rebuild-race` is fixed and merged** (PR #647, `fa8b8072`). The `lib/dist` isolation landed: children load the kernel from source via a resolve hook, and the shared build is frozen so no suite can mutate it mid-run. The variable behind the flake was the **npm major** — `npm pack --ignore-scripts` runs `prepare > npm run build` on npm 10 (CI) and does no lifecycle at all on npm 12, which is why a warm local run could never see it. Verified in the item worktree: 5 consecutive full runs under npm 10.9.4, 0 race-class occurrences.
- **`main` is green.** I had recorded a separate `packed-bin` parity failure as a pre-existing blocker. **That was wrong and is retracted** (`bug-headless-ci-twin-init-nondeterministic`, retitled): the cause is a stale `dist/cli.js` in a worktree, not nondeterminism. Full `npm run build` → **129 files / 2692 passed** on the primary checkout.

Both corrections came from me reporting a worktree build-state artifact as a product defect, which sent two makers chasing a defect that does not exist. The lesson is on that item: check build state before filing a lane failure as a product bug.

The **residual limit is unchanged and still honest**: the guard is reconciling, so it is silent when nothing is declared — a worker that neither moved its session nor sourced `.arggon.env` is still unprotected, and `agents.md` rule 1 remains its only guard. Filed as `bug-native-guard-silent-without-worktree-declaration`.
