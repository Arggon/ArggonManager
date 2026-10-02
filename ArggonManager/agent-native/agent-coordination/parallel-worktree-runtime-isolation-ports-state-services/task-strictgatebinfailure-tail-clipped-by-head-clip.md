---
type: task
status: in_progress
id: task-strictgatebinfailure-tail-clipped-by-head-clip
title: "`strictGateBinFailure` still appends its own \"Fix:\" line at the message tail, so worst-case head-clip eats the remedy"
assignee: Arggon
branch: feat/task-strictgatebinfailure-tail-clipped-by-head-clip
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam]
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T22:27:43.772Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-strictgatebinfailure-tail-clipped-by-head-clip
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-methodology-carriers/task-strictgatebinfailure-tail-clipped-by-head-clip.md
  Leaves live only under a story. id is the filename stem: task-strictgatebinfailure-tail-clipped-by-head-clip.
  CLI `arggon create task strictgatebinfailure-tail-clipped-by-head-clip` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `strictGateBinFailure` still appends its own "Fix:" line at the message tail, so worst-case head-clip eats the remedy

## Context

Found while reviewing PR #595 (bug-native-refusal-advice-clipped-by-head-clip): that PR reordered the two native refusals so the actionable advice leads and the kernel refusal trails, but `strictGateBinFailure` composes its own trailing "Fix: run npm ci ..." line AFTER the kernel text — so at worst case (8 named bins, MAX_GATE_BINS) the head-clip at MAX_NATIVE_ERROR_CHARS still eats that line, leaving the agent without the remedy. The item acceptance for #595 did not cover it (it only required named bins + attach re-run for the gate-bin gate), so the worker correctly left it out rather than widening the PR.

## Acceptance

- [ ] `strictGateBinFailure` composes its "Fix:" remedy before the kernel refusal text (same shape #579/#595 landed), keeping every existing clause verbatim
- [ ] A test with the full `MAX_GATE_BINS` worst-case list asserts the `npm ci` remedy survives the clip, with ordering pinned
- [ ] Negative control: message at the cap and the last named bin absent

## Notes

### 2026-10-02 @Reviewer
### 2026-10-02 @Reviewer
verdict: approve (pure reorder; both test levels discriminate; bundle in sync; smoke lane covers the path)

Review of PR #597 (`feat/task-strictgatebinfailure-tail-clipped-by-head-clip`, head `16c2b87e`) against `ArggonManager/docs/engineering.md` §Review bar. **I ran no gates** — CI on this head is green (cli / tasks-validate / ui-smoke) and the local gate evidence is the worker's. Everything below is by reading, plus string-fixture arithmetic in `/tmp/opencode` (no repo code executed).

**1. Pure reorder — confirmed by reading.** `git show` of both revisions of the return expression in `lib/src/worktree.ts`: the three clause texts are byte-identical across the change and only position (plus which clause carries the single `" "` separator) moved — `Fix: run \`npm ci\` in ${worktreePath} for a worktree-local install.` / `x-tracker.strict-gate-bins is set: refusing the claim commit — gate binaries do not ` / `resolve inside the worktree: ${named}.` Nothing reworded, added or dropped. Independent arithmetic on the kernel test's own fixture: both orderings render 2768 chars total (pure permutation), pre-fix `indexOf("npm ci") = 2675`, post-fix `10`. The doc comment added as the ordering carrier states the invariant accurately and is accurate for BOTH channels: `cli/src/start.ts:994` is a second real caller and its wrapper (`cli/src/start.ts:815`) appends flow context before the human print, which `cli/src/cli.ts:117` → `sanitizeHumanError` clips head-kept. `startNotAttempted` (the strict gate-bin's actual entry) delegates to `startFailure` (`opencode/plugins/arggon/index.ts:2128`, `:2112`), so naming `startFailure`/2048 in the comment is exact.

**2. Red/green corroborated independently, without re-running.** The worker's red figure reproduces from the fixture arithmetic: pre-fix the remedy sat at 2675, i.e. 627 chars past the 2048 window. Native shape (`tools.test.ts` fixture, entry 266 chars): composed message 2595, pre-fix `indexOf("npm ci") ≈ 2520` → clipped; the 2048 cut lands mid-bin-6 (243 advice + ~110 lead + 1695/268 ≈ 6.3 entries), which is exactly the truncated payload quoted in the PR body. Post-fix the remedy sits at 253 and the first named entry at ~466, both inside the kept head, last entry outside it.

**3. Tests discriminate — per assertion, in `lib/src/worktree.test.ts`:** verbatim remedy clause (`toContain` with the interpolated path) and verbatim diagnosis clause kill a reword; `indexOf("npm ci") < indexOf(firstEntry)` kills a truncated list too (`indexOf(firstEntry) = -1` would fail); `endsWith(lastEntry + ".")` kills a dropped last bin; `length > 2048` kills a shortened message; `clipped` contains remedy + first entry and NOT lastEntry kills a remedy that merely moved but still fell outside the head; `message.slice(2048)` contains lastEntry is the anti-vacuity guard — the negative control cannot pass by naming nothing. Native level (`opencode/plugins/arggon/tools.test.ts`): the pre-existing #595 worst-case test drives the REAL seam end-to-end (`tool(defs,"start").execute` → `ArgonToolError` → `startFailure` → `boundedNativeText(2048)`), with `message.length === 2048` only producible by that clip — not a local re-implementation. `"npm ci"` occurs nowhere in the attach-re-run advice, so `toContain` pins the KERNEL remedy specifically. The kernel-level 2048 mirror is a local copy of `clip`, which is the right call: `MAX_NATIVE_ERROR_CHARS` is not exported by `@arggondev/lib`, and the real clip is covered one level up.

**4. Bundle + reachability.** `index.bundle.ts` diff is exactly 3+3 lines mirroring the kernel reorder, nothing else moved in the artifact. Sync is enforced in CI: the `cli` job runs `npm run build` → `check:plugin` (`build:plugin && git diff --exit-code -- opencode/plugins/arggon/index.bundle.ts`) before tests — green on this head is proof, not a claim. Reachable from the native seam: `ArgonKernel = typeof import("@arggondev/lib")` (`index.ts:1304`), so `kernel.strictGateBinFailure` (`index.ts:3654`) IS the edited `lib/src/worktree.ts` function (re-exported at `lib/src/index.ts:269`); the bundle inlines that same compiled kernel.

**5. Envelope/docs.** No JSON surface touched. `convention.md:489`, `json-output.md:432`, `agents.md:294/362` describe the refusal's CONTENT (bins, source, `npm ci`, attach re-run), never its order — nothing made false. No methodology carrier touched (`agents.md:462`), so no impact class is owed. No consumer parses by position: every assertion/consumer of `refusing the claim commit` uses `toContain`/`includes`.

**6. Scope.** 5 files. The 9 commits main is ahead by touch only tracker item files, none of them this item's file → clean merge, no conflict surface. Commits: claim / one fix commit (code+tests+bundle) / two tracker comments. Nothing out of scope.

**7. Smoke bar.** Applicable check for a native start refusal change is `npm run smoke:native-start-cold`, wired as the blocking last step of the green `cli` job (no `continue-on-error`/`|| true`). It exercises this exact function on the real seam (`smoke/native-start-cold-smoke.ts:2115-2131`, path + missing flavors, asserting `x-tracker.strict-gate-bins is set` / `refusing the claim commit` / the bin / `npm ci` / the worktree path) — order-agnostic, so unaffected by the reorder. It uses a 1-bin list, so it proves REACHABILITY, not the clip; the clip invariant is carried by the two test levels, which do pin it. No new CLI surface, flag, exit code or UI → no probe evidence outstanding, and I am not asking the prover for a redundant re-run of lanes CI already executed on this head.

**Non-blocking findings (none of these gate the merge):**

- **F1 (file as a follow-up item — the same family, CLI channel, outside this item's acceptance).** `cli/src/start.ts:815-822` still APPENDS `worktreeRemediation(...)` + the `To discard it instead` hint AFTER the kernel detail, and for the step `enforcing x-tracker.strict-gate-bins` that remediation is the generic `Fix the reported cause in the worktree, then re-run \`arggon start <id> --worktree\` …`. The human channel clips head-kept at `MAX_HUMAN_ERROR_CHARS = 2000`; at the 8-bin worst case the detail alone overruns it, so this PR fixes the kernel remedy but the CLI's own trailing remedy is still what the clip eats. This is precisely the residual #595 flagged and declined as out of scope — correct scope discipline here, and DoD §6 wants it tracked rather than left in code. Coordinator please file under the same story, e.g. `npm run arggon -- create task "CLI start wrapper still appends its own remediation after the kernel detail, so the 2000-char human clip eats it" --parent parallel-worktree-runtime-isolation-ports-state-services`.
- **F2 (nit, doc comment).** The new comment says `~270 chars an entry` (the native fixture's figure, 266 — correct there) while this PR's own kernel test comment says `~330` for its fixture (317 + separator = 319). Both defensible approximations of their own fixtures; the invariant does not depend on either. Also the parenthetical cites only the native 2048 cap while the rationale sentence attributes the clip to "both the human and native channel" (human cap is 2000) — substantively true, I verified the CLI channel loses the remedy pre-fix at 2000.
- **F3 (nit, test hardening).** In the native test `expect(message.indexOf("npm ci")).toBeLessThan(firstNamedIndex)` would pass VACUOUSLY on a clipped-away remedy (`indexOf → -1 < anything`); it is sound only because the adjacent `expect(message).toContain("npm ci")` precedes it. Optional tighten: `expect(message.indexOf("npm ci")).toBeGreaterThan(-1)`. The kernel-level twin has no such hole (it indexes the un-clipped message). Leaving as-is does not block.

**Process note:** this item is `in_progress` on the branch and must be flipped to `done` on merge (DoD). Also note the hazard the worker documented: `tools.arggon.*` resolved the tracker root to this primary checkout while in the worktree — this verdict comment therefore landed on the PRIMARY checkout's copy of the item file (status `todo`, pre-claim fields), not on the PR branch's copy; the branch's acceptance ticks + handoff live in the branch file. Already filed as `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd` (on main, ahead of this PR).

**Recommendation: MERGE** after the base is refreshed (or as-is — the branch is clean to rebase onto main). Then flip the item to `done`, and file F1 as its own task.
