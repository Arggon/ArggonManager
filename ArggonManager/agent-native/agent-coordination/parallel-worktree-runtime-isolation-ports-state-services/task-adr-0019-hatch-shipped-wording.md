---
type: task
status: in_progress
id: task-adr-0019-hatch-shipped-wording
title: "ADR 0019 decision point 4: record the shipped dead-owner take-over (and the native surface's take-over input)"
assignee: Arggon
branch: feat/task-adr-0019-hatch-shipped-wording
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, adr]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T22:27:47.227Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-0019-hatch-shipped-wording
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adr-0019-hatch-shipped-wording.md
  Leaves live only under a story. id is the filename stem: task-adr-0019-hatch-shipped-wording.
  CLI `arggon create task adr-0019-hatch-shipped-wording` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0019 decision point 4: record the shipped dead-owner take-over (and the native surface's take-over input)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Owed by the task-adr-0019-amendment-claim-stamp verdict and confirmed by the PR #579 review: ADR 0019's decision point 4(b) still says the recovery hatch "is tracked in `task-strict-attach-dead-owner-hatch`". It has since shipped in two parts — `arggon start <id> --worktree --take-over-worktree` (#573, kernel-owned `WorktreeClaimRequest.takeOver`, default OFF, bounded `takeovers` chain, the fired evidence moved out of `claim.foreignWrites` so both strict gates needed no change) and the native seam's `takeOverWorktree` input (#579). The stale-stamp window stays a recorded **rejected** alternative, and the raw-porcelain detection fix (#573) is worth a clause in the same place since it is a decision-relevant implementation fact, not trivia.

## Acceptance
- [x] ADR 0019 decision point 4 names the shipped hatch (flag + native input), the anti-unlock invariant, and the dead-owner recovery order (flag, then the manual `rm`, then the modelled hatch in task-strict-attach-dead-owner-hatch).
- [x] The rejected stale-window row and the accepted explicit-hatch row stay consistent with what shipped.
- [x] No ADR status change (0019 is still Proposed); wording-only, and `validate` + prettier green.

### 2026-10-02 @Reviewer
verdict: approve (docs-only ADR amendment; two non-blocking nits, one scope observation)

Reviewed branch `feat/task-adr-0019-hatch-shipped-wording` (PR #598, 4 commits, diff vs `main` = 2 files: `ArggonManager/docs/adr/0019-worktree-runtime-isolation.md` + this item). Worktree `/home/arggon/Projects/ArggonManager-task-adr-0019-hatch-shipped-wording` at `728c169c`. Verified by reading only — no gate re-run by this reviewer (Probes at the bottom).

**1. Every shipped claim checks out against the code (line numbers drifted on `main`; behavior is what I checked).**

- `lib/src/worktree.ts` — `WorktreeClaimRequest.takeOver` with the doc comment "Default OFF … never a time-based or silent expiry" (branch-base 1831-1841; on `main` the same block sits ~12 lines later). Anti-unlock branch `if (request.takeOver !== true) return { stamped: true, foreignWrites }` — branch-base 1927, `main` 1939. Dated receipt built at 1933-1941 (`at/by/replacedIdentity/replacedClaimedAt/replaced/files/total`). Chain at 1948-1961: one entry per taker (`filter((entry) => entry.by !== takeOver.by)`), carried forward otherwise, persisted only when non-empty, sliced `-MAX_CLAIM_TAKEOVERS`; `MAX_CLAIM_TAKEOVERS = 5`. Unrecorded-take-over degradation at 1982-1985 (`stamped: false` + warning, never a throw). `strictWorktreeWriteFailure` (1780-1797) really does order the remedies coordinate → `--take-over-worktree` → manual `rm`, with the named-file list last. So: "re-stamps with the calling identity", "dated take-over", "newest 5, one entry per taker", "adds no `takeovers` key to a stamp that has never seen one", "invariant (a) … one SANCTIONED exception, taken explicitly or not at all" are all literally true.
- `cli/src/start.ts` — 573 refusal without `--worktree`, 936 threading into `deps.claim`, 784 the `note: single-writer take-over` line, 961 the strict gate reading `prepared.claim?.foreignWrites`; `cli/src/cli.ts:2226` declares the flag, 2492 the release-arm twin. So "the field both surfaces' gates already read" is exact — and the kernel returns *either* `foreignWrites` *or* `takeOver`, never both.
- `opencode/plugins/arggon/index.ts` — 3413 reads `input.takeOverWorktree === true`, 3440 refuses it without `worktree`, 3613 threads it into the kernel `claim`, 3692 the native gate reads `preparation?.claim?.foreignWrites`; the tool schema property is at 4543 and `take_over_worktree` at 4585/4097/4385. `boundedPreparation`/`boundedClaimReceipt` project `claim.takeOver` (`NativeClaimReceipt.takeOver`), so `preparation.claim.takeOver` is real, not aspirational.
- Release arm — `lib/src/cleanup.ts:400-405, 437-438`: an armed hatch "records the replaced stamp on the entry" and "does NOT bypass the still-claimed refusal". So "the audited hatch for a presumed-dead owner on an UNCLAIMED item … never bypasses the refusal while the item is still claimed" is accurate (and matches `agents.md:203`).
- Raw-porcelain clause — `StartGit.statusPorcelain` returns `String(result.stdout ?? "")` untrimmed (`start.ts:346-355`) and the native `claim` object passes no `status` override, so "the native surface … was never affected" holds. `gh pr view 573` corroborates the provenance: round 2 replaced the trimming `fileStatus` "after the smoke bar caught" the silent disarm. `convention.md:491` does carry the RAW clause verbatim in spirit. #573 merged 2026-10-02T05:27:12Z, #579 2026-10-02T15:12:43Z — both dates/PR numbers in the ADR are right.
- The `Deferred → Rejected (2026-10-02, PR #573)` flip is sourced: #573's own body records "Decision: (a) an explicit take-over flag — NOT (b) a stale-stamp window … must never have a clock-based self-unlock". The new `Accepted` row is consistent with the shipped mechanism.

**2. ADR discipline holds.** Closing decision point 4 by dated additive amendment — not superseding — is the right move: the decision itself is unchanged, only the fate of its open hatch is recorded, so a superseding record or a new ADR number would be wrong. The #568 amendment paragraph is preserved verbatim and still readable directly above the new one; nothing was rewritten in place, and the history of the record (including "(b) … is tracked in `task-strict-attach-dead-owner-hatch`") survives for a reader who wants to see the earlier state. `- Status: Proposed` untouched, and the new front-matter bullet states *why* (closing one decision point ≠ accepting the record). No test reads ADR 0019's content (`adopt.test.ts:382` builds its own fixture ADRs; `spec-decision-gaps.test.ts` matches a literal string), so no fixture coupling is missed.

**3. The "ADR 0019 was the only stale surface" claim survives spot-checking.** `agents.md` §4 (170-190) already gives both recovery paths in order, names the native input and its `preparation.claim.takeOver` ride, and frames the manual `rm` as the escape hatch when the flag is unavailable — which is exactly the framing the ADR now reuses. `agents.md:203` and `json-output.md:429` document the release arm and the full `claim.takeOver` shape (`{ at, by, replacedIdentity, replacedClaimedAt, replaced, files, total }`, exactly-one-of, newest-5 chain). `convention.md:491-493` carries the take-over bullet, the RAW-probe clause and the refused-flag rule. `README.md:316/322` and `CHANGELOG.md:32-36` describe it. I grepped the whole tracked prose corpus: `skills/arggon-cli/references/**` never names the claim receipt or the take-over at all (`json-contract.md` does not enumerate `preparation`), and `.opencode/` + `.zcode-marketplace/` contain no `arggon-claim.json` / `strict-worktree-writes` wording — so nothing in them became false and nothing there is missing a claim it never made. `claim.md` and `worktree-services.md` carry none of this wording. The sweep claim is honest.

**4. Formatting delta: prettier's output, not hand churn — but optional.** The re-pad is mechanically correct: every row now shares column content widths 85 / 36 / 408 with matching divider rows, i.e. the exact per-column maxima (measured), which is what prettier emits. The two `*em*` → `_em_` lines are prettier's emphasis normalization. Two things to note, neither blocking: (a) no prettier step exists in CI (`grep -rn prettier .github/workflows` → no matches) and `cli/src/prose-format.test.ts` states outright that "these docs are not byte-clean (prettier re-pads tables) and need not become so", with 0019 absent from `REPAIRED_FILES` — so the delta buys nothing enforced and inflates a wording-only diff; (b) it is honestly disclosed in the PR body and the item evidence. Leaving it is fine; reverting it would also be fine.

**5. The two observations — both correctly filed rather than folded in.**
- `docs/opencode2.md` §Payload contract: the `start` row enumerates `preparation?` with ready/install/linkedNodeModules/builtWorkspaces/linkedWorkspaces/manifestCoverage/missingDependencies/gateBins/`truncated` and omits `preparation.claim` and `preparation.env` — confirmed. It is a pre-existing incompleteness (it predates #573; `claim` arrived with #568), it is an omission rather than a false statement, and nothing this PR ships makes it worse. Fixing it here would widen a scoped wording-only PR into a second doc's contract edit. `task-opencode2-payload-contract-preparation-fields` is the right home. Same for the unrelated index gap.
- `docs/adr/README.md`: confirmed no row for 0020 — but the index is also missing **0005, 0006, 0007, 0008 and 0009** (it jumps 0004 → 0010 → 0019, and `0020-methodology-first-productization.md` exists). `task-adr-readme-index-missing-adr-0020` is right to file but is under-scoped: broaden it to the seven missing rows or restate it as "ADR index incomplete (0005-0009, 0020)", otherwise the next reviewer will file the same finding again.

**Findings, in severity order (none blocking).**
- F1 (accuracy in the record, nit): the PR body and the item's acceptance evidence both say the #568 amendment "is left byte-identical". It is not — two lines inside that blockquote changed (`*isolation*` → `_isolation_`, `*concurrency*` → `_concurrency_`). Rendered text is identical and the discipline (additive, prior text preserved) is honored, but the byte-identity claim is contradicted by the PR's own diff. Worth correcting in the record rather than leaving a precise-sounding falsehood on the item.
- F2 (evidence nit): "`git diff -w` shows the wording alone" is not exact — `-w` does hide the table re-pad but still shows the two `_em_` lines (I ran it). Everything else the diff carries is wording.
- F3 (precision nit in the new consequence bullet): "it can be reconstructed after the fact (`by`, `replacedIdentity`, the replaced stamp, the newer paths)" lumps the persisted chain entry with the receipt-only fields. `worktree.ts:1442-1444` is explicit that the evidence "is NOT persisted here — it rides the run's receipt": the chain holds `at/by/replacedIdentity/replacedClaimedAt`, while `replaced` (the full stamp) and `files` exist only in that run's receipt. `convention.md:492` draws exactly that line ("in the receipt … and in the new stamp as a bounded `takeovers` chain"). Not false, but looser than the rest of the record; naming the storage per field would keep it unambiguous for the next reader.
- F4 (coordinator-level, out of scope here): ADR 0019 is now substantially implemented (layer 0 #568, take-over #573/#579, gate bins, Compose reaping #569/#574) and still reads `Status: Proposed`. The record now says that deliberately, which is the honest state — but the flip decision should be tracked by whoever owns the ADR, not smuggled into a wording PR.

**Gate reasoning: confirmed sound.** Docs-only, no `cli/`/`lib/`/`opencode/`/`e2e/` file touched; the only tests that read these exact bytes are `prose-format` (its `proseDocs()` covers every tracked markdown under `ArggonManager/docs/`, i.e. this ADR), `init-docs` and `layout` — all three run, 53 passed. Skipping `npm test`/`build` is defensible: nothing compiles against this file, and `build` would only regenerate a plugin bundle this PR does not touch. Smoke is exempt (docs-only, per `engineering.md` §Smoke test) and impact class **Advisory** is correct (ADR + item only; no carrier changed, so no ADR 0016 behavioral claim).

**Recommendation: merge.** No false claim in the ADR body itself, no doc left stale, no scope creep. Then flip the item to `done`, and let the coordinator take F1/F2/F3 (one-line doc/record tweaks) plus the broadened ADR-index item.

## Probes needed
Ran none of these (prover's job). cwd for all: `/home/arggon/Projects/ArggonManager-task-adr-0019-hatch-shipped-wording`.
1. `git show origin/main:ArggonManager/docs/adr/0019-worktree-runtime-isolation.md | npx prettier --check --stdin-filepath ArggonManager/docs/adr/0019-worktree-runtime-isolation.md` — expect non-zero / "Code style issues found" (unpadded table, `*em*`). Demonstrates the formatting delta is pre-existing dirt the worker inherited, not hand-made churn; if `main` were already clean, F/§4 becomes a change request.
2. `npx prettier --check ArggonManager/docs/adr/0019-worktree-runtime-isolation.md ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adr-0019-hatch-shipped-wording.md` — expect "All matched files use Prettier code style!". I verified the table geometry by measurement (column maxima 85/36/408 with matching dividers), not by running prettier.
3. `npm test` and `npm run build` in the worktree — expect green; the worker deliberately skipped them. Only needed to make the skip auditable end-to-end; a red lane would change nothing about the wording itself but would move the verdict.
