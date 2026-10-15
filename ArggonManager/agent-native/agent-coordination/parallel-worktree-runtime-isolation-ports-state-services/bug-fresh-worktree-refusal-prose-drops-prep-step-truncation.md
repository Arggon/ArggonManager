---
type: bug
status: in_progress
id: bug-fresh-worktree-refusal-prose-drops-prep-step-truncation
title: '`freshWorktreeInstallRefusal` composes "Preparation ran: …" from the capped log without saying entries were dropped — a prose instance of the stepsTruncated defect both surfaces inherit'
assignee: arggon-delivery-lead
branch: fix/bug-fresh-worktree-refusal-prose-drops-prep-step-truncation
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, bounded-output]
created: "2026-10-03"
updated: "2026-10-15"
claimed_at: "2026-10-15T01:53:32.221Z"
depends_on: [bug-native-steps-truncated-flag-dropped]
worktree_path: /home/arggon/Projects/ArggonManager-bug-fresh-worktree-refusal-prose-drops-prep-step-truncation
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-fresh-worktree-refusal-prose-drops-prep-step-truncation.md
  Leaves live only under a story. id is the filename stem: bug-fresh-worktree-refusal-prose-drops-prep-step-truncation.
  CLI `arggon create bug fresh-worktree-refusal-prose-drops-prep-step-truncation` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `freshWorktreeInstallRefusal` composes "Preparation ran: …" from the capped log without saying entries were dropped — a prose instance of the stepsTruncated defect both surfaces inherit

## Context

Found by the worker on PR #617 (bug-native-steps-truncated-flag-dropped), 2026-10-03, reported rather than fixed.

`freshWorktreeInstallRefusal` (`lib/src/worktree.ts:990-995`) composes `Preparation ran: …` **from the capped log without saying entries were dropped**. So the refusal text presents a truncated preparation log as complete — the PROSE version of the very defect #617 fixed in the native projection.

That matters more than a missing `truncated` flag usually would, because this string is what a human reads when a fresh worktree claim is refused: the preparation log is the evidence for _why_ the install was judged unusable, and a silently shortened evidence list reads as "these are all the steps that ran".

It is also the third distinct surface for the same fact: the kernel decides, the native projection now mirrors, the CLI never carried it (`task-cli-surface-never-carries-steps-truncated`), and the refusal PROSE independently re-presents it. Four surfaces, one decision.

## Acceptance

- [ ] The refusal text says how many preparation entries were dropped when the log is capped — an explicit count, never a silent truncation
- [ ] Consistent with the kernel's own decision (mirror it; do not re-derive from a cap)
- [ ] A test at > `MAX_PREP_STEPS` asserting the refusal names the dropped count
- [ ] Swept: any other user-facing text that renders the preparation log without its truncation state
- [ ] Depends on PR #617 landing, so the native-side precedent is settled first

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the worker on PR #617 (bug-native-steps-truncated-flag-dropped), 2026-10-03, reported rather than fixed.

`freshWorktreeInstallRefusal` (`lib/src/worktree.ts:990-995`) composes `Preparation ran: …` **from the capped log without saying entries were dropped**. So the refusal text presents a truncated preparation log as complete — the PROSE version of the very defect #617 fixed in the native projection.

That matters more than a missing `truncated` flag usually would, because this string is what a human reads when a fresh worktree claim is refused: the preparation log is the evidence for _why_ the install was judged unusable, and a silently shortened evidence list reads as "these are all the steps that ran".

It is also the third distinct surface for the same fact: the kernel decides, the native projection now mirrors, the CLI never carried it (`task-cli-surface-never-carries-steps-truncated`), and the refusal PROSE independently re-presents it. Four surfaces, one decision.

Acceptance:

- [ ] The refusal text says how many preparation entries were dropped when the log is capped — an explicit count, never a silent truncation
- [ ] Consistent with the kernel's own decision (mirror it; do not re-derive from a cap)
- [ ] A test at > `MAX_PREP_STEPS` asserting the refusal names the dropped count
- [ ] Swept: any other user-facing text that renders the preparation log without its truncation state
- [ ] Depends on PR #617 landing, so the native-side precedent is settled first

### 2026-10-15 @ses_ec2bb8c73ffeBOeT0vbCObokPz

PR #833 (`fix/bug-fresh-worktree-refusal-prose-drops-prep-step-truncation`, head 89ef011f). Kernel-side fix complete, gates green.

**What shipped.** `prepareWorktreeDependencies` now counts the entries its `MAX_PREP_STEPS` cap drops (`stepsDropped`, incremented in the same `record()` branch that sets `stepsTruncated`; the receipt emits both together or not at all). `freshWorktreeInstallRefusal(gateBins, worktreePath, steps, stepsDropped = 0)` quotes that count verbatim beside the list — never a length-vs-cap comparison (a 16-entry log can be complete, and a length comparison cannot see a kernel-side drop; the class #617 fixed in the native projection).

**Before/after at the cap** (over-cap fixture: 16 shown, 2 dropped — the 16th build decision and the gate-bin verdict):

- before: `… Preparation ran: build:no-build-script (@scope/pkg-0), … (@scope/pkg-15). Fix: run `npm ci` …`
- after: `… Preparation ran: … (@scope/pkg-15). 2 entries were dropped (the preparation log is capped at 16). Fix: run `npm ci` …`
  Uncapped log: byte-identical to before (no count invented); singular: `1 entry was dropped`.

**Evidence (commands run, expected vs observed).**

- `npx vitest run lib/src/worktree.test.ts` → 72 passed. The over-cap kernel test now asserts `stepsDropped === 2`; the new refusal test drives a real over-cap `prepareWorktreeDependencies` receipt and asserts `2 entries were dropped` + the cap, with `assertOrder` pinning the count beside the list and ahead of the remedy; plus singular and uncapped (no `dropped`) controls.
- `npm test` → 158 files / 3484 passed.
- `npm run arggon -- validate` → ok, 0 warnings; `npm run lint` → clean; `npm run test:structure` → 5 passed; `npx prettier --check lib/src/worktree.ts lib/src/worktree.test.ts` → clean.
- `npm run build` regenerates the committed plugin bundle byte-exact (CI `check:plugin`); the PR carries 3 files: `lib/src/worktree.ts`, `lib/src/worktree.test.ts`, `opencode/plugins/arggon/index.bundle.ts` (generated, comments stripped — no plugin source edited).

**Sweep — surfaces rendering the preparation log without its truncation state (reported, not fixed: out of this item's file scope).**

1. `cli/src/start.ts:1166` — refusal called without `stepsDropped` (`prepared.stepsDropped` is in scope at that line).
2. `opencode/plugins/arggon/index.ts:4594` — same for the native seam; `boundedPreparation` must mirror the count first (whitelist projection carries only `stepsTruncated`). Owned by `task-cli-surface-never-carries-steps-truncated`.
3. `cli/src/cli.ts:2763-2785` — the human note `dependency prep — <outcomes>` renders the filtered capped log with no truncation state.
4. Docs tables (`docs/opencode2.md`, `docs/json-output.md`) document no log-truncation count; same sibling item.
   Kernel sweep: `freshWorktreeInstallRefusal` is the only prose consumer of `steps` in `lib/src` (grep for `entry.step`/`steps.map`), so no fifth surface exists there.

**Open question.** The two refusal call sites are not wired to the kernel count (explicitly out of scope per the dispatch), so the human-visible refusal on the CLI/native surfaces still omits the count until they pass it. Decide: extend this item, route to the sibling item, or file a follow-up.

### handoff 2026-10-15 @ses_ec2bb8c73ffeBOeT0vbCObokPz (session: ses_ec2bb8c73ffeBOeT0vbCObokPz) — next: Review + merge PR #833 (kernel fix green); then decide the two refusal call sites (cli/src/start.ts:1166, opencode/plugins/arggon/index.ts:4594) that do not yet pass the kernel's stepsDropped.

- branch: fix/bug-fresh-worktree-refusal-prose-drops-prep-step-truncation
- open questions: Call sites out of scope per dispatch — extend this item, route to task-cli-surface-never-carries-steps-truncated, or file a follow-up; regenerated index.bundle.ts included because CI check:plugin dri…

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx

verdict: approve

### Lead review + merge verification — 2026-10-15 (delivery lead)

Merged as 8c1fcd11 (PR #833). The kernel now counts dropped preparation entries (`stepsDropped`, incremented in the same branch that sets `stepsTruncated`, so the two can never disagree) and the refusal quotes the count verbatim — never a length-vs-`MAX_PREP_STEPS` comparison (a capped log can be complete, and a length check cannot see a kernel-side drop). Uncapped logs are byte-identical; no truncation is invented. The regenerated bundle was verified byte-identical to a fresh build after merging main.

Evidence: the kernel test at > MAX_PREP_STEPS asserts `stepsDropped === 2` and the refusal names "2 entries were dropped"; singular and uncapped controls; full suite 3484 green; CI green on the refreshed head. **Routing:** the maker's sweep found the two refusal CALL SITES still omit the count (`cli/src/start.ts:1166`, the native `boundedPreparation`) — routed to `task-cli-surface-never-carries-steps-truncated` (new acceptance box + comment on it), which owns the surfaces carrying the kernel's truncation decision.
