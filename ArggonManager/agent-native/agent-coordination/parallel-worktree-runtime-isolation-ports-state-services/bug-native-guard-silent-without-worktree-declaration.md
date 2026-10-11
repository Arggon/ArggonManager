---
type: bug
status: done
id: bug-native-guard-silent-without-worktree-declaration
title: "The native tracker-root guard is silent when no worktree is declared, so the incident that made 7 PRs invisible still reproduces for an unsourced session"
assignee: arggon-delivery-lead
branch: fix/bug-native-guard-silent-without-worktree-declaration
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, worktree, hygiene]
created: "2026-10-05"
updated: "2026-10-11"
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

- [x] The declaration is established by the **dispatch surface** (or `start`), not by the worker
      remembering to source it — so the expectation exists before the first tracker write
- [x] The undeclared-and-unmoved case is either refused or reported, decided explicitly and
      documented; "silently proceeds" is not an acceptable outcome
- [x] A regression test covers it: a write from a session bound to checkout A while a worktree
      B is the intended target, with **no** env sourced — today this is the silent case
- [x] The design decision (who declares, when, and what a legitimate unsourced primary-checkout
      write looks like) is recorded as an ADR or a doc line, not left implicit in code
- [x] `agents.md` rule 1 stops being load-bearing on its own once this lands, or says plainly
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

The silent-guard framing says the failure is _absent output_. This is **present, plausible, wrong output**, and it survived every check I ran. I built a wave plan on it. Two of the five "in-flight" items I identified were only caught because I happened to run `git worktree list` and `git show <branch>:<item>` by hand — nothing in the native surface prompted me to. Had I not cross-checked, I would have dispatched a maker into a worktree another writer already held, which is a claim conflict the kernel refuses but the maker would have walked into.

It also corrupts the ordinary read path: `next` returns `task-explore-adopter-feedback-channel` as the top claimable item, and `show` reports it unclaimed, while its worktree holds a two-round-reviewed PR on a branch claimed by `Arggon`.

### The three faces of one root, for whoever picks this up

I now think this item's scope should cover all three, because all three are "the tracker only learns about a worktree when a commit rides a branch, and `main` cannot read branch state":

1. **Pool** — `list`/`next` compute claimability from `main`, so 5 in-flight items read as unclaimed `todo`. Tracked separately as `bug-claim-pool-computed-from-main-misses-branch-claims`.
2. **Read path** — the native `show`/`list` resolve to the primary checkout, so a worktree's item state is unreachable. **This item.**
3. **Reap path** — `cleanup --prune` could only reap **1 of 9** stale worktrees today. The other 8 belong to `done` items whose `main` frontmatter records no `worktree_path` (the claim was released rather than landed), so the reaper is blind to them. 15 worktrees persist with no tracker footprint.

Face 3 has a cheap standalone check: a `done` item with a matching `../<repo>-<id>` directory on disk that `cleanup` does not list as a candidate. That is a report-only assertion and needs no behavioural change.

### One adjacent trap, in case it is in scope

The same session, `doctor` reported `vendored plugin STALE`, so the native catalog was whatever was on disk at session start. `tools.arggon.cleanup` exposed only `{prune, no_gh, no_commit}` — no `release`, no `take_over_worktree` — while the CLI has both and `cli/src/mcp-server.ts` declares both. I nearly filed that as a seam-drift defect. It is **not** one: `doctor` had already named the cause and the fix. Worth a line here only because the failure presents as "the tool is missing a flag" and the real answer is "restart the session".

### 2026-10-11 @arggon-maker

Landed. The guard gained a third declaration source — the **claim footprint** — and the
undeclared-and-unmoved case is now **reported**, not silent:

- `opencode/plugins/arggon/index.ts`: for an item-scoped call (`update`/`show`/`comment`/
  `handoff`) that declares nothing, the sibling worktrees of the resolved checkout are
  scanned (`git worktree list --porcelain`, at most 64 roots, one bounded `.arggon.env`
  read each) for one whose `ARGON_ITEM` names the call's item. That worktree becomes the
  expectation, so the envelope carries `trackerRoot` + `trackerRootMismatch` on every such
  call, read or write. A caller-declared disagreement still **refuses** a write (unchanged);
  the footprint reports, because the claim's own lifecycle legitimately writes from the
  canonical checkout (post-merge terminal flip, unclaim of a dropped claim). `start`/`branch`/
  `cleanup` are exempt by shape — they manage the claim from the primary by design.
- Decision recorded as a doc line in `ArggonManager/docs/opencode2.md` §The binding guard →
  Design decision (who declares, when, legitimate unsourced writes, bounds, exemptions).
- Regression: `opencode/plugins/arggon/tools.test.ts` → `"the claim footprint declares for an
unsourced session"` drives the incident state (session bound to checkout A, worktree B
  claiming the item, nothing sourced) and pins the report on write and read, the unchanged
  caller-declared refusal, the lifecycle exemption and the silent pool reads; neutralizing
  `trackerRootMismatch` fails 10 of the 22 binding tests.
- Impact class: **behavioral** (ADR 0016) — an agent's operating contract changes (a silent
  write now reports; docs change), no envelope schema change (`schemaVersion: 1` unchanged,
  no new fields).

### 2026-10-11 @ses_ed571bfafffe0DJ8dqvMYrw67y
Maker evidence (arggon-maker, 2026-10-11) — PR #706, branch fix/bug-native-guard-silent-without-worktree-declaration. Impact class: behavioral (ADR 0016) — an agent's operating contract changes; no envelope schema change (no new fields, schemaVersion 1).

WHAT LANDED
1. The claim footprint is a third declaration source: for an item-scoped call (update/show/comment/handoff) that declares nothing, the sibling worktrees of the resolved checkout are scanned (git worktree list --porcelain, ≤64 roots, one bounded .arggon.env read each) for one whose ARGON_ITEM names the call's item; that worktree becomes the expectation. Established by the dispatch surface — start --worktree already writes that .arggon.env at claim time — so the expectation exists before the worker's first write, nothing sourced.
2. Disposition (decided explicitly, recorded in docs/opencode2.md §The binding guard → Design decision): a CALLER-declared disagreement still REFUSES a write (TRACKER_ROOT_MISMATCH, unchanged); a claim-footprint disagreement is REPORTED on every item-scoped envelope, read or write (trackerRoot + trackerRootMismatch naming the claiming worktree and the file its declaration was read from). Why report and not refuse: the claim's own lifecycle legitimately writes from the canonical checkout — the post-merge terminal flip (/arggon-done) and the unclaim of a dropped claim both run update from the primary while the worktree still exists, and moving the session would land those on an already-merged branch. Measured, not assumed: with a refusing footprint, 26 of the repo's own lifecycle tests (W4 cleanup, native release, compose parity) fail on their arrange phase. Recovery path survives: reads never refuse, the CLI is native-guard-free and always complete, and a checkout with no claiming worktree anywhere stays byte-identical to the CLI. Exempt by shape: start/branch/cleanup are never held to the footprint; the pool reads name no item.
3. agents.md §Orchestration rule 1: no longer the ONLY protection (the write now reports), still load-bearing (a report informs, it does not reroute) — stated plainly in the doc.
4. Design decision recorded as a doc line in docs/opencode2.md (who declares, when, what a legitimate unsourced primary write looks like, bounds, exemptions) — the item's scope excludes a new ADR file, so the doc line is the chosen carrier.

GATES (command / expected / observed / exit)
- npm run build / 0 / 0 (postbuild rebuilt the bundle; then npm run check:plugin on the committed tree / bundle matches source / exit 0)
- npm test (vitest run) / green baseline 136 files 2949 tests / 136 files, 2958 tests passed / 0
- npm run smoke:native-start-cold / pass (start/worktree path touched by the guard) / passed — no smoke change needed: the move leg still commits in the worktree, the negative leg still refuses SESSION_ROOT_UNRESOLVED, start legs attach as before / 0
- npx prettier --check on every touched file / clean / clean / 0
- npm run lint / 0 / 0
- npm run arggon -- validate / ok / ok (0 warnings, convention v5) / 0

REGRESSION EVIDENCE
opencode/plugins/arggon/tools.test.ts → "the claim footprint declares for an unsourced session" (8 tests) drives the incident state — session bound to checkout A (primary), worktree B claiming the item, NOTHING sourced: the write reports trackerRoot + trackerRootMismatch (declared: [B], sources: [B/.arggon.env]) instead of proceeding silently, lands where the session resolved, never silently redirects into the worktree; the same read reports it; the caller-declared refusal is unchanged once a declaration IS sourced; the claim's own lifecycle still works from the canonical checkout (post-merge flip reported and landed; start attaches, never held to the footprint); pool reads (list/next) stay byte-identical; the scan pins the porcelain parser, hit/miss/skip-the-resolved-root, the 64-root bound and the degrade-when-git-cannot-answer path. Measured mutation signal: neutralizing trackerRootMismatch fails 10 of the 22 binding tests (5 caller-declared, 4 claim-footprint, 1 parsing); the survivors pin deliberately unchanged behavior.

NOT DONE / FINDINGS FOR THE LEAD
- docs/json-output.md §native receipt fields now under-describes the footprint case ("No declaration anywhere … means no expectation"; "on a write it is refused instead"): true for the CLI surface that file documents, incomplete for the native footprint. OUTSIDE this item's file scope (opencode2.md is the doc carrier here and is updated) — reported, not touched.
- repo-root README's sourced-.arggon.env pairing is documented as the way to declare; it stays supported but is no longer load-bearing. Not restated (README outside scope).
- The item body's "three faces" note (faces 1 and 3: claim pool from main, reap blind to worktree_path-less done items) is explicitly NOT covered here; face 2 (read path / this guard) is.

### handoff 2026-10-11 @ses_ed571bfafffe0DJ8dqvMYrw67y (session: ses_ed571bfafffe0DJ8dqvMYrw67y) — next: Delivery lead: review PR #706 (behavioral, ADR 0016) — the footprint reports rather than refuses; merge after standards review; the json-output.md drift noted on the item is a separate follow-up.
- branch: fix/bug-native-guard-silent-without-worktree-declaration
- open questions: Should a verdict find the report-only disposition sufficient, or does the lead want a follow-up item exploring a refusal for unmERGED-branch writes only?; does json-output.md get a footprint line in …

### 2026-10-11 @arggon-delivery-lead
verdict: approve (scope: PR #706 — the claim footprint, the report-not-refuse decision, the regression tests and the two carriers)

Delivery-lead review. I read the seam source myself rather than relying on the report, because this is a guard change: widening or flattening it either way is how a session gets wedged or a write gets redirected silently.

What I verified, myself:

- **The third signal closes the hole the two reconciling sources left, and it closes it at the dispatch surface.** `resolveToolCwd`/`trackerBinding` previously reconciled against caller-made declarations only (the `.arggon.env` beside the resolved checkout, the process environment) — an unsourced, unmoved session declared nothing and the guard stayed silent, which is the 2026-10-05 incident. For an item-scoped call that declares nothing, the seam now scans the sibling worktrees (`git worktree list --porcelain`, ≤64 roots, one bounded 8 KiB `.arggon.env` read per root, resolved root excluded) for one whose `ARGON_ITEM` names the call's item, and that worktree becomes the expectation. `start --worktree` writes that file at claim time, so the expectation exists before the worker's first tracker write — the item's criterion 1, met without the worker remembering anything.
- **The report-not-refuse decision is measured, not preferred.** Refusing would wedge the claim's own lifecycle: the post-merge terminal flip (`/arggon-done`) and the unclaim of a dropped claim both run `update` from the canonical checkout while the worktree still exists, and no native remedy would land them on the right branch. The maker's measurement is that **26 of this repo's own lifecycle tests fail on their arrange phase** under a refusing footprint. I accept that measurement as the argument: the alternative is a guard that blocks the legitimate writes the claim needs to finish. Caller-declared disagreements still refuse a write; the asymmetry is stated in the code, in the doc and in the verdict.
- **The scope of the scan is justified, not accidental.** `itemScoped` is on exactly `update`/`show`/`comment`/`handoff` — the specs whose input names an existing item — and off `create` (its id is a stem for an item that does not exist yet, so no footprint exists), off `start`/`branch`/`cleanup` (the worktree lifecycle manages the claim from the canonical checkout by design; an attach MUST work from the primary) and off the pool reads (`list`/`next`/`report`/`validate` name no item). Each exemption is written down; a blanket scan would have made every call pay for a footprint none of them can have.
- **Degradation is honest.** A failed git call, an empty listing, a worktree with no `.arggon.env` (the `x-worktree.env: false` opt-out, a pre-spec-016 worktree, a plain `git worktree add`) all degrade to the pre-existing behaviour — never to a false accusation, never to a refusal.
- **Bounded, per the bar's scalability row.** One process spawn, at most 64 roots, at most 8 KiB each, and the first match ends the scan. That is O(worktrees), declared, and capped — an unbounded crawl of a repo's worktrees on every tracker call would have been the review-bar failure here.
- **Docs travel with the change, and they are true.** `ArggonManager/docs/opencode2.md` gains the design decision (who declares, when, the bounds, the exemptions, what a legitimate unsourced primary-checkout write looks like), and `ArggonManager/docs/agents.md` §Orchestration says plainly that **rule 1 is still load-bearing** — a report tells you a write landed in the wrong place, it does not reroute it. Not overclaiming the fix is the right shape.
- **Methodology impact class: behavioral (ADR 0016)**, stated on the item and in the PR: an agent's operating contract changes (a silent write now reports) and a carrier's rule 1 was rewritten. No envelope schema change — no new fields, `schemaVersion: 1` unchanged — which is why the doc-contract suites stay green.

Gates, run by the lead on the branch: `npx vitest run opencode/plugins/arggon/tools.test.ts` → 135 tests passed; `npm run build` → ok; `npm run check:plugin` → the committed bundle matches the source after the merge; `npm run smoke:native-start-cold` → passed with no smoke change needed; `npm test` → 136 files / 2958 tests passed on the branch. CI on PR #706: `cli` SUCCESS, `tasks-validate` SUCCESS, `ui-smoke` SUCCESS.

One evidence point for a filed follow-up, not a defect in this PR: this diff normalised `*absent output*` → `_absent output_` **inside a historical comment** on the item file. That is `bug-session-formatter-normalizes-tracker-item-files` reproducing during this very wave — the second observation in two waves — and I am recording it here so that item's Context carries a live second data point rather than a single anecdote.

Item state: all five boxes in the live `## Acceptance` section are ticked and each is honest against the diff.

Merge call: **approved — merge as a merge commit** (tracker auto-commits ride this branch, so no squash).
