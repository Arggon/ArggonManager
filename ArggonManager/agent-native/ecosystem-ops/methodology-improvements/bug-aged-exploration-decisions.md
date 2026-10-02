---
type: bug
status: todo
id: bug-aged-exploration-decisions
title: Aged explorations 012/013 record no Decision section link
parent: methodology-improvements
labels: [spec-analyze]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-aged-exploration-decisions.md
  Leaves live only under a story. id is the filename stem: bug-aged-exploration-decisions.
  CLI `arggon create bug aged-exploration-decisions` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Aged explorations 012/013 record no Decision section link

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] Each exploration links its ADR or records "No ADR required — <reason>" per agents.md §Specs and plans
- [ ] `spec analyze` vs baseline shows 0 new findings

## Notes

### 2026-10-02 @Arggon-reviewer
### 2026-10-02 @Arggon-reviewer
verdict: request-changes (docs-only, but the record must be true: one wrong count, one stale "recorded nowhere" claim, one imprecise ADR gloss, and a red `cli` CI job at head)

Read-only review against `ArggonManager/docs/engineering.md`. Head `e1f883da`, base `17091702`, 3 files, +171/−13. No gates were run by me; execution evidence is in **Probes needed** at the end.

#### Blocking findings

**1. Wrong count in exploration 012 — "21 items" (there are 20).** `exploration-ui-improvements-012.md:169`: "all **21** items in the filed-work table below are `done`". The filed-work table names **20** items (`ui-web-board-v2` 9 + `ui-tui-v2` 7 + `ui-native-panel-v2` 2 + `ui-foundation` 2), and the union of the wave lists above it is the same 20. The substance holds — I checked all 20 ids individually and every one is `done` (`bug-tui-selection-offscreen`, `task-board-*` ×9, `task-tui-*` ×6, `task-native-panel-*` ×2, `task-ui-shared-viewmodel`, `task-ui-browser-smoke-ci`), and `arggon report` gives epic `ui` = **39 done / 0 todo / 0 in_progress / 0 blocked** exactly as written. So the claim is right and the number is not. Fix: "20" (or drop the number). In a PR whose entire value is "the record is now true", a checkable integer that does not match the table undercuts the rest.

**2. CI is red at this head.** `gh pr view 599`: `cli` = **FAILURE**, `tasks-validate` SUCCESS, `ui-smoke` SUCCESS. The failure is `cli/src/cli.test.ts` → `SpawnHarnessError: [arggon-test-spawn] CLI spawn produced no result`, `kind: child-boot-failed`, with the harness's own diagnosis: *"kernel artifact drift: the repo's built artifacts were REWRITTEN while this child ran — another suite lane rebuilt lib/dist or dist in place … Fix the writer (see cli/src/headless-ci.test.ts), not the reader"*. A docs-only diff cannot cause that, and `main`@`396a5121` CI is **success**, so this is very likely the known spawn/artifact-drift class (`bug-spawn-lanes-load-flake` is `done`; PR #600 `chore/shuffle-safe-headless-ci` is in flight). But engineering.md's bar is "green CI is necessary" and this job is not green. Merge must wait for a green rerun or for evidence that the same job flakes on `main`. Do not merge on my reading of the log.

**3. Exploration 013 rec 3 asserts "recorded nowhere" while a tracker item now records it.** `exploration-open-source-agent-tooling-013.md:807`: "**not adopted in this repository.** No ADR, playbook, **item** or repo doc names it (`AGENTS.md` included), so it stayed a developer-local tool and there is no repository decision to record." As of `main`@`396a5121` (`chore(tasks): file codebase-memory decision task`, `292293b9`) that is false on arrival: `task-decide-codebase-memory-default-discovery` exists, filed *from this PR's own review*, and `grep -rl codebase-memory` over the tracked tree now hits a third file. Worse, as written the bullet reads as a rejection while §C's `Verdict: Adopt as an already-compatible developer standard` and the matrix row `**Adopt as dev standard**` still stand un-cross-referenced — two dispositions, no pointer. Fix (small, one bullet): say the recommendation is **not adopted here and still open**, name the item, and leave §C alone as dated research. "No repository decision exists" stays true and is the honest framing; "no item names it" does not.

**4. The ADR 0019 gloss inverts a decision point.** Same file, `:833`: "the env contract is the default and a per-worktree **dev container** stays the escape hatch." `adr/0019-worktree-runtime-isolation.md` decision point 3 **rejects** "full dev-environment containers per worktree" as a default (re-pays installs, VM-backed Docker worst); its opt-in layer 2 is *ephemeral per-worktree **service** containers* (Compose); `Nix/devbox` is "an optional, per-project complement outside arggon's scope"; `mise` is not mentioned anywhere in ADR 0019. Net effect as written: it reads as permission to add a per-worktree dev container, which is the option ADR 0019 rejected. Also worth a half-sentence of honesty: ADR 0019 is still `- Status: Proposed` (product-owner acceptance recorded in `Deciders`), so "decided later" is stronger than the file. Fix: restate what 0019 actually decided (env contract by default; service containers opt-in; Nix/devbox optional per project; dev containers rejected as a default) and mark the status.

#### Verified clean (by reading, no gates)

- **Marker grammar is exactly the scanner's.** `cli/src/spec.ts:744-748`: `/^(?:[-*]\s+)?No ADR required\s*[—:-]\s*\S/`, line-anchored on the trimmed line, mandatory rationale. Both new markers sit at column 0 on their own line with a real em dash (U+2014) and a reason: 012 `:167`, 013 `:773`. Both files also carry numbered `adr/NNNN-*.md` link targets, so `decisionSectionHasAdrRef` would resolve them independently — the markers are not doing load-bearing silence.
- **The detector is not weakened.** `git diff 17091702..HEAD -- cli/` is **empty**; `spec.ts` is byte-identical; the finding text at `spec.ts:779` is unchanged, so the finding still *can* fire. Diff touches only the two explorations + this item. No `superseded` status was used anywhere.
- **`status: open → decided` is the convention, and the precedent holds.** `decided` is 10 of 19 exploration frontmatters (others: 7 `open`, 2 `resolved`); commit `a36c5445` flipped 002/003/005/008 the same way in the same kind of edit. Nothing schema-enforces exploration `status` (no `explorations` reference in `lib/src`/`cli/src` validate code), so this is practice, not a fork.
- **Pilot 2 really failed, on the stated date, in the stated PR.** `git log`: `99b2c683` "Merge pull request #423 from Arggon/feat/task-pilot-opencode2-shell-tasks-server-only", merged 2026-09-28T22:44:59Z (`gh pr view 423`); `task-pilot-opencode2-shell-tasks-server-only` and `task-record-shell-tasks-pilot-negative-result` both `done`; the negative-result item's gate table (G1/G2 fail) is intact.
- **Dependency and CI-lane claims check out.** Root `dependencies` = `@arggondev/lib`, `commander`; `lib` declares none; devDependencies include `@ast-grep/cli`, `fast-check`, `@playwright/test`, `@axe-core/playwright`; `sgconfig.yml` + `tools/ast-grep/rules/*.yml` exist; `.github/workflows/ci.yml:76` runs `smoke:native-start-cold` in the blocking `cli` job and the `ui-smoke` job runs `npx playwright test --grep @smoke` — so ADR 0008's item-3 "optional CI tier" is genuinely implemented, which is what 012 claims for `task-ui-browser-smoke-ci`. `opencode-chromium` and `@playwright/mcp` appear in no manifest.
- **ADR links resolve and say what 012/013 say they say.** 0001 (single root package, commander only — the "dependency-light" gloss is established repo wording, used that way by ADR 0019 itself and by 012's own findings), 0002 `:32` (the new-top-level-package trigger stays deferred), 0008 item 3, 0010/0011 (native surface), 0019. `agents.md:309` carries the "Native `start` dependency contract" 013 rec 1 points at.

#### Rulings on the two judgment calls you flagged

**(a) Rec 1 adopted with no ADR — defensible, I concur.** `agents.md:428` fires an ADR for "cross-cutting decision (stack, identity, schema model, new top-level package)", and the worktree-readiness fix changed none of those. More decisively, the contract was already decided before the fix: ADR 0010/0011 own the native surface and `agents.md:209` already said the native path must use the kernel preparation path before its claim commit — 012's own §0 quotes the generated `/arggon-start` command promising the claim commit, i.e. the fix aligned behavior with a standing contract rather than choosing one (engineering.md "when not to": choices that don't change external contracts). Honest counterweight, for the record: the native `start` result *did* gain an external surface (`preparation`/`claimCommit` receipts). PR #419 carried the full review; ADR 0019 later took the genuinely cross-cutting part. No ADR owed from this exploration.

**(b) Rec 3 "not adopted in this repository" — honest in substance, but it does not close the question, and shouldn't pretend to.** A true statement about the record is not the same as a disposition; a reader who greps the tracker for this recommendation finds a live `todo` item created after this PR. My ruling: keep the framing "no repository decision exists", do **not** write "rejected", and cross-reference the open item — which is finding 3. What you did right: you did not invent an adoption to close it, you did not file the follow-up inside this bug's scope, and DoD #6 is satisfied (the item exists). One bookkeeping bug in that item, not this PR's diff: its placement comment says `ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/…` while the file lives under `agent-native/ecosystem-ops/methodology-improvements/` — nothing validates that line today, but whoever picks it up will be misled.

**Baseline deliberately not refreshed — right call, but one sentence of your rationale is wrong (advisory).** Leaving `ArggonManager/spec-analyze-baseline.json` alone is correct: `agents.md:439` documents `--baseline` only as the multi-wave NEW-findings gate ("non-zero exit = NEW findings vs the committed snapshot"), there is no documented refresh-on-resolution workflow, and both baselines were committed once and never refreshed (`50de2786`, `74749bbf`). The item's acceptance is "0 new findings", which the stale baseline satisfies. What does *not* hold: "refreshing it would delete the evidence that these two findings existed" — `findingKey` (`spec.ts:976-979`) includes the full message, and the age is embedded in it ("after 9 day(s)"), so the committed 012 entry was **already** reporting `resolved` before this PR purely from 9→10 day drift, and it would have kept rotating regardless. That baseline entry was never a durable record of the finding; treat the remaining `resolved` line as fingerprint churn, not proof, and correct the rationale in the item note rather than letting a future reader trust it.

#### Probes needed (not run by me)

Run in the PR worktree `/home/arggon/Projects/ArggonManager-bug-aged-exploration-decisions` (Node 22), except (4):

1. `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` — expect `0 new, 1 resolved, 5 unchanged, 5 total` and **exit 0**. Demonstrates the two DECISION-PENDING-EXPLORATION findings actually resolve via the markers (not via a text edit), which is acceptance box 2. If exit is 1 or any finding is `new`, the change does not land.
2. `npm run arggon -- validate` — expect `ok` (0 warnings, convention v5). Rules out a frontmatter/scope break from the `decided` flips and the item-file edits.
3. `npx vitest run cli/src/prose-format.test.ts cli/src/spec-decision-gaps.test.ts` — expect green. The first proves the new prose survives prettier (the 6 marker cases in the second prove the grammar still rejects bare tokens and out-of-section markers, i.e. this PR cannot have loosened it).
4. Re-run the failed job: `gh run rerun 37073594139 --failed` in `/home/arggon/Projects/ArggonManager`, and for comparison the same job on `main` (`gh run list --branch main --workflow CI`). Determines whether finding 2 is the tracked spawn/artifact-drift flake or a real regression. A green rerun clears it; a reproducible red on `main` too means it is not this PR's problem but must be tracked; red only on #599 stops the merge.
5. After the three edits land, re-read `exploration-ui-improvements-012.md:169` and `exploration-open-source-agent-tooling-013.md:805-812,828-840` and confirm the count is 20, the rec-3 bullet names `task-decide-codebase-memory-default-discovery`, and the 0019 gloss matches decision points 1–3.

Nothing else is unverified: I read the full diff, both explorations' surrounding sections (§0/§A/§B/§C/§D/§E/§G, the matrix, the recommendation list, `task-record-shell-tasks-pilot-negative-result`'s full body and both comments), the scanner grammar and baseline logic in `cli/src/spec.ts`, the 5 linked ADRs, `agents.md:209/309/428/439`, all 26 named tracker items, both manifests, `ci.yml`, the committed baseline and its git history, and PR #599's check rollup + failed-job log.

### 2026-10-02 @Arggon-reviewer
### 2026-10-02 @Arggon-reviewer (round 2)
verdict: approve (all four blocking findings closed by reading; one mechanical merge-gate condition remains — the `cli` job at the current head was still running at review time)

Re-read the branch as it stands: head `b95c6c31`, base `e0789cfe`, 3 files, +267/−13, worktree clean. Fix commit `d3640d5d` ("docs: correct three review findings"), plus tracker-comment commits `211771e0`, `a730f49d`, `a68cb529`, `b95c6c31`. I verified the fixes against their sources rather than against the worker's summary.

#### 1. Wrong count — closed

`exploration-ui-improvements-012.md:169` now reads **20**. My own parse at the branch head: filed-work table = **20 ids, 20 unique**, per row `ui-web-board-v2` 9, `ui-tui-v2` 7, `ui-native-panel-v2` 2, `ui-foundation` 2; the Recommendation section's id union is **the same 20** (set equality, no dupes). Spot-checked six ids live now — `task-ui-browser-smoke-ci`, `bug-tui-selection-offscreen`, `task-native-panel-refresh-filter`, `task-tui-actions-parity`, `task-ui-shared-viewmodel`, `task-board-serve-hardening` — all `done` (round 1 checked all 20 individually). `arggon report` for epic `ui` = `todo 0 / in_progress 0 / blocked 0 / done 39 / cancelled 0`, so "39 done, 0 todo, 0 in_progress" still stands.

Integer sweep of both Decision sections at the branch head, each traced to source: 012 → {20 ✓, 39 ✓, ADR 0001/0002/0008 ✓, "candidate 2" ✓}. 013 → {ADR 0008/0010/0011/0019 ✓, spec `spec-worktree-env-contract-016` exists ✓, `exploration-worktree-env-isolation-017` exists ✓, 2026-09-28 + PR #423 ✓, recommendations 1–7 contiguous with no gap or dupe ✓, "layer 2"/"point 3" ✓}. Re-checked the dependency claims at the *branch* head rather than round-1 main, since main advanced: root `dependencies` = `@arggondev/lib`, `commander`; `lib` declares none; devDependencies still carry `@ast-grep/cli`, `fast-check`, `@playwright/test`, `@axe-core/playwright` — byte-identical to `origin/main`, so the main merge did not invalidate them.

#### 2. Stale rec 3 — closed, and now honest in both directions

The bullet reads "**undecided, and deliberately left that way**": §C's verdict and the matrix's "Adopt as dev standard" row are named as this document's *dated research position*; the repository has recorded **no decision either way** (no ADR, no playbook, no repo doc, `AGENTS.md` included); the open question is tracked as `task-decide-codebase-memory-default-discovery` (`todo`, filed 2026-10-02), "read that item for the disposition… this bullet deliberately does not close it."

I verified the residual claim rather than taking it: `git grep -l codebase-memory` at the branch head returns **4 files**, and the only one under `ArggonManager/docs/` is the exploration itself — nothing in `AGENTS.md`, `CONTRIBUTING.md`, any ADR, playbook or spec names it. "Not adopted" is gone from rec 3 only; **not** replaced by anything stronger, and recs 4–7 keep their independently verified dispositions (4 measured FAIL, 5 hold stands, 6 decided by ADR 0008, 7 honored) unchanged by the diff. Also noted: `main`@`822e70b5` ("correct placement path in task-decide-codebase-memory-default-discovery") fixed the bookkeeping bug I flagged in round 1 — that follow-up item is now correctly placed.

#### 3. ADR 0019 gloss — closed, and now tighter than my finding demanded

The new gloss matches 0019 clause for clause: **layer 1** env contract default (`.arggon.env` + per-OS state/cache dirs, spec 016) = decision point 1; **layer 2** ephemeral per-worktree **service** containers (Compose) opt-in, never a kernel feature = point 2; **rejected as defaults** per-worktree dev-environment containers, distrobox/toolbox, per-worktree VMs = point 3. The escape-hatch clause is not an invented permission — it is 0019's own alternatives table, `:130`: "Rejected as default … **Kept as the escape hatch for toolchains that genuinely cannot run on the host**" — and the sentence now puts "rejected as default" first, which is the half the old gloss dropped. Nix/devbox as "optional, per-project complement outside arggon's scope" = `:63-64` and table `:133` ✓. "ADR 0019 does not mention `mise` at all" ✓ (`mise` appears in 013, `convention.md`, `opencode2.md`; not in 0019). The still-`Proposed` status is explicit with the acceptance attributed to the `Deciders` line ✓, the intro softened to "taken up later — partially", and the toolchain half of §0's thread is no longer implied answered.

#### 4. CI — finding closed, and declining to claim the rerun was the right call

Verified run by run: `37073594139` at `e1f883da` is **attempt 2 = failure** on the identical tree (`cli` only; `ui-smoke` success both attempts), so the rerun genuinely did not pass. The worker's refusal to claim it did is the correct call: the harness itself classifies the failure as `child-boot-failed` — "this is not an assertion failure" — with the artifact-drift diagnosis naming the writer, it reproduced twice on the same tree, and a docs-only diff cannot reach that code. Attributing the red→green flip to the main merge rather than to a retry also checks out: `eea4266f` (the shuffle-safe fix) is already an ancestor of **both** bases (`17091702` and `e0789cfe`), so it cannot explain the difference — the only intervening tree change is the main merge plus the three doc corrections. Green on the fixes tree: `37078281306`/`37078281310` at `d3640d5d` (`cli`, `ui-smoke`, `tasks-validate` all SUCCESS) and `37079240558`/`37079240561` at `a68cb529` (all three SUCCESS). Hazard record verified too: `git branch -a --contains d3640d5d` lists only this branch, and `origin/main` does not contain it.

**Merge gate, stated plainly:** the current head is `b95c6c31` = `a68cb529` + 5 lines in this item's file, docs byte-identical. At review time `tasks-validate` (37079642072) and `ui-smoke` were SUCCESS on it and `cli` (run 37079642052) was **still in_progress**. That is the only thing left, it is not the worker's to fix, and it landed green on the docs-identical head two commits earlier — so I approve the change and leave the merge to the coordinator once that job reports green.

#### 5. Retracted baseline rationale — present and correct; leaving the baseline unrefreshed is still right

The retraction appears in both places that mattered: the item note ("### Baseline rationale corrected (reviewer advisory)" — the sentence "would delete the evidence that these two findings existed" "was **wrong**, and it is retracted") and the PR body, which now says `findingKey` embeds the message and the age is inside it, so the committed 012 entry "was already reporting `resolved` from 9→10 day drift alone", and calls the surviving `resolved` line "fingerprint churn, not proof of closure". That is exactly right against `cli/src/spec.ts:976-979`, and I confirmed the baseline file itself is untouched: `git diff e0789cfe..HEAD -- ArggonManager/spec-analyze-baseline.json` is empty, as are `docs/specs/`, `docs/adr/`, `docs/agents.md`, `docs/convention.md`, `docs/engineering.md` and `README.md`. Leaving it unrefreshed still stands on the convention argument: `agents.md:439` documents `--baseline` only as the NEW-findings wave gate, no refresh-on-resolution workflow exists, and both baselines were committed once and never refreshed (`50de2786`, `74749bbf`).

#### 6. Detector not silenced — re-confirmed

`git diff e0789cfe..HEAD -- cli/` is **empty** (`spec.ts` byte-identical, 0 diff lines), and nothing changed under `lib/`, `smoke/`, `e2e/`, `.github/`, `package.json`, `lib/package.json`. Both Decision sections satisfy the grammar at `spec.ts:744-748` — marker on a column-0 line, real em dash (U+2014), rationale present — and each also carries numbered ADR targets (`012` → 0001/0002/0008; `013` → 0008/0010/0011/0019), so either signal resolves them and neither is load-bearing silence. Section headings are still at lines 165 and 771, matching the worker's own probe. One structural corroboration for the "0 new" claim I could make without running anything: the ambiguity and consistency analyzers scan only `docs/specs` and `docs/plans` (`spec.ts:323/326/532/560`); explorations are read solely by `decisionFindings` (`:755`), so new prose in these two files cannot manufacture a new finding kind — the five surviving findings are the spec findings the committed baseline already carries.

#### Probes needed (not run by me)

1. `gh run view 37079642052 --json status,conclusion,jobs` in `/home/arggon/Projects/ArggonManager` — expect `cli` SUCCESS, i.e. the merge gate green at the actual merging head `b95c6c31`. Nothing else is outstanding; `ui-smoke` and `tasks-validate` already passed on it.
2. `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` in `/home/arggon/Projects/ArggonManager-bug-aged-exploration-decisions` — expect `0 new, 1 resolved, 5 unchanged, 5 total`, exit 0, on the *post-fix* tree (the worker's recorded run is from `d3640d5d`; the docs have not changed since, so this is confirmation rather than doubt).

Unverified by me, and I want that on the record: I ran no gate, no smoke and no browser drive. Everything above is reading — diffs, file contents, tracker items and statuses, `arggon report`, `ci.yml`, both manifests, the committed baseline, ADR 0019 line by line, the run history and failed-job log, and the PR body. The smoke bar is exempt here: ADR 0008 records "docs-only PRs are exempt" and nothing in this diff touches board HTML, the TUI renderer or the native start path.
