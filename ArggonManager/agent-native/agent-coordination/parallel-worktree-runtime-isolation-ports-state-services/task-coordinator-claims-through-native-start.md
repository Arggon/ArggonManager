---
type: task
status: in_progress
id: task-coordinator-claims-through-native-start
title: The coordinator contract never tells the coordinator to claim through `tools.arggon.start` — live worktrees on items that are still `todo`/unclaimed
assignee: Arggon
branch: feat/task-coordinator-claims-through-native-start
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, methodology, worktree]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T15:37:33.470Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-coordinator-claims-through-native-start
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-coordinator-claims-through-native-start.md
  Leaves live only under a story. id is the filename stem: task-coordinator-claims-through-native-start.
  CLI `arggon create task coordinator-claims-through-native-start` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The coordinator contract never tells the coordinator to claim through `tools.arggon.start` — live worktrees on items that are still `todo`/unclaimed

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f03213cdbffeJ4RqV9JXfur867

Found by a 0.5.0 adoption audit (2026-10-02, coordinator session).

## Context

`ArggonManager/docs/agents.md` §Orchestration documents the native claim path —
`tools.arggon.start({ id, assignee, worktree: true })` — and says the manual
`git worktree add ../<repo>-<id> -b <branch>` step "can be folded into the claim". The generated
coordinator contract never says so: `templates/docs/opencode/agents/arggon-coordinator.md` mentions
only "the worktree path" in the worker-launch duty, with no claim step anywhere. A coordinator that
follows only its own contract hand-rolls worktrees and never claims.

That is not hypothetical — it is the current tree:

- `task-native-start-take-over-input`: `todo`/unclaimed on `origin/main`, `branch: null`,
  `worktree_path: null` — while PR #579 is **open** and the worktree holds 3 unpushed commits.
- `bug-release-notes-extraction-breaks-on-linked-header` (p1): `todo`/unclaimed on `origin/main`,
  `branch: null` — while its worktree carries 5 changed files, 1 commit ahead of main, and **no PR**,
  including the untracked new `cli/src/release-notes.ts` + `cli/src/release-notes.test.ts`.

Every 0.5.0 worktree guarantee is inert for work claimed this way: no claim stamp (so no
foreign-writer detection), no recorded `worktree_path` (so `cleanup` cannot classify or reap it),
no install link farm or gate-bin readiness receipt, no `.arggon.env`, no draft PR.

## Acceptance

- [x] `templates/docs/opencode/agents/arggon-coordinator.md` states the claim step explicitly:
      claim through the native `start` with `worktree: true` before dispatching a worker; never
      hand-roll `git worktree add` for a claim; the worktree path comes from the item's recorded
      `worktree_path`, not from a convention guess.
- [ ] Both drifted items reconciled and the outcome recorded on each: `bug-release-notes-…` gets a
      claim (and its uncommitted work committed + PR'd) or its abandoned work is explicitly
      dispositioned; `task-native-start-take-over-input` gets its claim recorded so PR #579's head
      matches a claimed item.
- [x] A seam test pins the coordinator contract on the native-claim step, so a regenerated template
      cannot quietly drop it again (the same failure mode the prover agent had: shipped in the
      template, missing from the pinned expectation).
- [ ] Evidence on the item: the reconciled frontmatter for both items + the passing seam test.

## Notes

### 2026-10-02 @Arggon — contract + pin lane (branch `feat/task-coordinator-claims-through-native-start`)

Scope actually delivered here (the two unticked boxes are **not** mine — see below):

- Template duty 2 is new: **Claim before dispatch** — `tools.arggon.start({ id, assignee,
worktree: true })` **before** launching the worker, because that call is what creates
  `../<repo>-<id>` and records `branch` + `worktree_path`; never hand-roll `git worktree add`, never
  dispatch a worker as the first claimant, never claim an item you are not dispatching, and a start
  refusal is evidence, not a retry. Duty 3 (worker launch) now names the recorded path. Duties
  renumbered 3→4, 4→5.
- `ArggonManager/docs/agents.md` §Orchestration stays the carrier: the **Flow** bullet now says the
  claim comes first (it said "each worker claims its item"), a **Claim before dispatch** coordinator
  duty holds the full rules (ordering, the three prohibitions, refusal-is-evidence with the
  `strict-gate-bins` remedy and the never-list), **Per-item worktrees** points at that claim, and the
  subagent rule no longer tells a dispatched worker to claim its own (already-claimed item → verify,
  never re-claim/take over/hand-roll). The template summary cross-links the section and duplicates no
  rule that can drift.
- Pinned by two tests in `cli/src/init-opencode.test.ts` (whitespace-flattened so re-wrapping prose
  cannot break them): the generated coordinator file must carry the claim duty, the native
  `start({ … worktree: true })` call (and no `arggon start <id>` CLI spelling), the claim duty **before**
  the worker-launch duty, the recorded-path wording, all three prohibitions, refusal-is-evidence and
  the §Orchestration cross-link; a second test pins the playbook carrier (claim-before-dispatch duty
  present, "each worker claims its item" and "Claim **your** item (`in_progress` + assignee)" gone).
- Regenerated the vendored `.opencode/agents/arggon-coordinator.md` with `npm run arggon -- init`
  (from source, not by hand): `arggon doctor` → `vendored plugin current`, `0 stale`,
  `docs: 57 managed, 41 untouched`. `npm run check:plugin` clean (bundle byte-identical — no
  `opencode/plugins/arggon/**` change).

**Unticked, and why:** box 2 and box 4's "reconciled frontmatter for both items" are tracker
ownership on _other_ items (`bug-release-notes-extraction-breaks-on-linked-header`,
`task-native-start-take-over-input`) — out of this lane's file fence and the coordinator's call. The
seam-test half of box 4 is delivered (above). Noted rather than silently ticked.

**Findings for the coordinator (not fixed here, out of lane):**

- `skills/arggon-cli/references/orchestration.md` (generated → `.agents/skills/…/orchestration.md`)
  still tells subagents "Claim **your** item (`in_progress` + assignee)" and gives the coordinator a
  bare "**Per-item worktrees**" duty with no claim step — the same drift class as the coordinator
  template, in the skill the coordinator is told to load first. Same for the repo-root
  `templates/docs/AGENTS.md` ("create one per item with `git worktree add ../<repo>-<item-id> -b
<branch>`") and `templates/docs/opencode/agents/arggon-worker.md` ("Claim your item … only if it is
  unclaimed"). Both carriers need the claim-before-dispatch wording or they will keep contradicting
  `ArggonManager/docs/agents.md` §Orchestration.
- Pre-existing provenance staleness surfaced by the regeneration: `ArggonManager/.convention.yml`
  recorded checksums that no longer matched their committed sources for
  `.agents/skills/arggon-cli/SKILL.md` and `.opencode/plugins/arggon/index.ts` (`opencode/plugins/
arggon/index.bundle.ts` is unchanged in this branch, and `check:plugin` reports no diff). Init
  refreshed both stamps — stamp-only, no source change. Worth a look at whatever commit last
  regenerated this tree, since a fresh clone would have shown the same drift.

### 2026-10-02 @ses_f02bcc476ffes6LrJvCQylx0li
## Delivered (branch `feat/task-coordinator-claims-through-native-start`, PR #589)

Claimed through the native start as the contract now requires: `tools.arggon.start({ id, assignee: "Arggon", worktree: true })` → `/home/arggon/Projects/ArggonManager-task-coordinator-claims-through-native-start`, all 8 `gateBins` `source: worktree`, `ready: true`, claim committed (`051ef984`). No start refusal, so no install-ordering evidence to record.

### Contract text added

**`templates/docs/opencode/agents/arggon-coordinator.md`** — new duty 2, duties renumbered (3→4, 4→5):

> 2. **Claim before dispatch.** The claim is what creates the worktree: before launching a worker, claim the item through the native start — `tools.arggon.start({ id, assignee: "<login>", worktree: true })` — and only then launch. That call takes the single-writer claim stamp, creates `../<repo>-<id>` and records `branch` + `worktree_path` on the item, which is the only source of the path your worker prompt can name. Never hand-roll `git worktree add` for a claim, never dispatch a worker as the first claimant, and never claim an item you are not dispatching (an idle claim keeps the item out of the pool and records a writer that is not writing — unclaim it instead). A start **refusal is evidence, not a retry**: read the named cause, never retry with `--force` and never route around it by hand; the remedies (`npm ci` in the returned worktree, then re-run `start` to attach) are in `ArggonManager/docs/agents.md` §Orchestration.

Duty 3 now says the launch prompt carries the worktree path **as recorded on the item** (never a `../<repo>-<id>` guess).

**`ArggonManager/docs/agents.md` §Orchestration** stays the carrier: Flow bullet changed from "each worker claims its item" to the claim coming first; new **Claim before dispatch** coordinator duty holds the full contract (why the claim *is* the worktree step, the ordering, the three prohibitions, and the refusal taxonomy incl. the armed `x-tracker.strict-gate-bins` remedy); **Per-item worktrees** points at it; the subagent rule now tells a dispatched worker to verify an already-claimed item (`tools.arggon.show({ id, meta: true })`) and never re-claim / take over / hand-roll. The template cross-links the section and duplicates no rule that can drift.

### Where it is pinned

Two tests in `cli/src/init-opencode.test.ts` (both whitespace-flattened so prose re-wrapping cannot break them):
- *"the coordinator contract claims through native start BEFORE dispatch (task-coordinator-claims-through-native-start)"* — runs a real `init` and asserts on the generated `.opencode/agents/arggon-coordinator.md`: the claim duty exists; the native `start({ id, assignee: … worktree: true })` call (and **no** `arggon start <id>` CLI spelling); **ordering** (claim duty index < worker-launch duty index); the recorded-path wording; all three prohibitions; "refusal is evidence, not a retry"; the `§Orchestration` cross-link.
- *"the docs carrier keeps the claim duty the coordinator template summarizes"* — the playbook carries the claim-before-dispatch duty and no longer contains "each worker claims its item" or "Claim **your** item (`in_progress` + assignee)".

### Regeneration

`npm run arggon -- init` from source (auto-commit `bf45e29a`, only `.opencode/agents/arggon-coordinator.md` + `.convention.yml` stamps differ). `arggon doctor` → `vendored plugin current`, `0 stale`, `docs: 57 managed, 41 untouched` (was 38 untouched at HEAD). `npm run check:plugin` clean — `opencode/plugins/arggon/index.bundle.ts` byte-identical, no plugin-lane touch.

### Gates (all green in the worktree)

- `npm test` → 118 files / 2165 tests passed
- `npm run lint` → clean · `npm run build` → clean · `npm run check:plugin` → no diff
- `npm run arggon -- validate` → `{"ok":true,…,"errors":[],"warnings":[]}`
- `npx prettier --check` clean on all five touched files

### Findings (reported, not fixed — out of lane)

1. **Same drift in the other carriers**: `skills/arggon-cli/references/orchestration.md` (→ `.agents/skills/arggon-cli/references/orchestration.md`) still tells subagents "Claim **your** item (`in_progress` + assignee)" and gives the coordinator a bare "Per-item worktrees" duty; `templates/docs/opencode/agents/arggon-worker.md` says "Claim your item … only if it is unclaimed"; the repo-root `templates/docs/AGENTS.md` still tells agents to hand-roll `git worktree add ../<repo>-<item-id> -b <branch>`. The skill reference is the doc the coordinator is told to load **first**, so it will keep contradicting §Orchestration. Filed-worthy follow-up.
2. **Pre-existing provenance staleness**: at HEAD, `.convention.yml` checksums for `.agents/skills/arggon-cli/SKILL.md` and `.opencode/plugins/arggon/index.ts` no longer matched their committed sources (the bundle is unchanged and `check:plugin` shows no diff). This regeneration refreshed both stamps — stamp-only.
3. **Item boxes 2 / 4 left unticked**: reconciling `bug-release-notes-extraction-breaks-on-linked-header` and `task-native-start-take-over-input` is tracker ownership on other items (outside my file fence). The seam-test half of box 4 is delivered.

### handoff 2026-10-02 @ses_f02bcc476ffes6LrJvCQylx0li (session: ses_f02bcc476ffes6LrJvCQylx0li) — next: Review PR #589 (coordinator) and merge; then reconcile the two drifted items and tick the remaining boxes
- branch: feat/task-coordinator-claims-through-native-start
- open questions: Should the skill reference + worker template + root AGENTS.md get the same claim-before-dispatch wording (file a follow-up); who owns reconciling the two drifted items
