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
