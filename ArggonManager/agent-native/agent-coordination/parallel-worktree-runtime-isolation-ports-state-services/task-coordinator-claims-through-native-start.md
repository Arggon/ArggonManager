---
type: task
status: done
id: task-coordinator-claims-through-native-start
title: The coordinator contract never tells the coordinator to claim through `tools.arggon.start` — live worktrees on items that are still `todo`/unclaimed
assignee: Arggon
branch: feat/task-coordinator-claims-through-native-start
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, methodology, worktree]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
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
- [x] Both drifted items reconciled and the outcome recorded on each. Evidence: `bug-release-notes-extraction-breaks-on-linked-header` — `status: done`, `assignee: Arggon`, `branch: fix/bug-release-notes-extraction-breaks-on-linked-header`, `worktree_path` recorded, PR #585 merged; its abandoned-at-the-time work was dispositioned as the shipped fix, not dropped. `task-native-start-take-over-input` — `status: done`, `assignee: Arggon`, `branch: feat/task-native-start-take-over-input`, PR #579 merged. Stated honestly rather than papered over: that item has no `claimed_at` / `worktree_path` because its filing was lost mid-flight (a coordinator `reset --hard` before the create was pushed) and the worker then worked in a manually created worktree — exactly the hand-rolled pattern this item exists to close, so it is recorded here as the first instance of the defect rather than hidden.
      claim (and its uncommitted work committed + PR'd) or its abandoned work is explicitly
      dispositioned; `task-native-start-take-over-input` gets its claim recorded so PR #579's head
      matches a claimed item.
- [x] A seam test pins the coordinator contract on the native-claim step, so a regenerated template
      cannot quietly drop it again (the same failure mode the prover agent had: shipped in the
      template, missing from the pinned expectation).
- [x] Evidence on the item: the reconciled frontmatter for both items + the passing seam test. Evidence: frontmatter as printed above (both `done` with `branch`); `cli/src/init-opencode.test.ts` carries the coordinator-claim pin plus the five carrier pins from round 2 (skill reference, worker template, ZCode coordinator + ZCode worker, repo-root AGENTS.md) and is green in the merged head's CI (`cli` pass).

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

### 2026-10-02 @ses_f02bcc476ffes6LrJvCQylx0li
## Review round 2 addressed (same branch, still a draft, not merged, item not flipped)

### B1 — `.convention.yml` stamps dropped (decision recorded, not a silent pass)

`ArggonManager/.convention.yml` is byte-identical to `origin/main` again (`git diff --quiet origin/main -- ArggonManager/.convention.yml` → clean). The vendored agent copies stay regenerated from source.

Reviewer's probe, run verbatim on the committed tree in this worktree:

```
$ npx --yes arggon-manager@0.5.0 init --no-commit
arggon init: kept adopter-modified docs: 21 file(s) (--backup archives and regenerates)
$ git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml'
<EMPTY>
```

Expected: empty — released 0.5.0 finds the regenerated copies' checksums (recorded from origin/main) mismatched, classifies them **adopter-modified** and skips them, so no tracked file is rewritten. Observed: empty. **B1 fixed.**

**Recorded decision + trade-off:** the provenance state file no longer describes the committed bytes of the regenerated generated artifacts until a release regenerates them. Same posture as #583. Consequences accepted knowingly:
- `arggon doctor` now reports those copies as adopter-modified rather than `untouched`, and `vendored plugin current` is no longer the reported state for the plugin copy (the stamps were stale at HEAD anyway — see round-1 finding 2).
- The round-1 acceptance line "doctor must report `vendored plugin current`" is **superseded** by this review decision. The vendor-copy requirement itself is still met: every `.opencode/` and `.zcode-marketplace/` copy is a byte-for-byte `arggon init` render of its committed template (verified by `npm test` parity tests + the round-1 pin).

### B2 — all four carriers fixed (plus a fifth the list missed)

| carrier | before → after |
|---|---|
| `skills/arggon-cli/references/orchestration.md` (loaded before the first tool call by BOTH agent templates) | "Per-item worktrees … each in its own worktree (`../<repo>-<item-id>`)" + "Claim **your** item (`in_progress` + assignee)" → **Claim before dispatch** coordinator duty (native `start` with `worktree: true`, recorded path, three prohibitions, refusal-is-evidence) + subagent rule is now verify-an-already-claimed-item |
| `templates/docs/opencode/agents/arggon-worker.md` | "Claim your item (`tools.arggon.update` with status `in_progress` + assignee) only if it is unclaimed" + description "claims exactly one item" → "Your item is **already claimed** … never re-claim, never take over the stamp, never hand-roll a worktree" + §Orchestration cross-link + description "owns exactly one already-claimed item" |
| `templates/docs/zcode/arggon/agents/arggon-coordinator.md` | no claim step → duty 2 "Claim before dispatch" in MCP spelling (`arggon_start({ id, assignee, worktree: true })`), duties renumbered |
| `AGENTS.md` (repo root, loaded at the top of every session here) | "Claim before starting: `npm run arggon -- update <id> --status in_progress --assignee <login>`" + "create one per item with `git worktree add ../<repo>-<item-id> -b <branch>`" → native `tools.arggon.start({ id, assignee, worktree: true })` (`/arggon-start`, or `arggon start <id> --worktree`) + "work in the worktree your claim recorded on the item's `worktree_path`" |

**Fifth carrier (not in the review's list, found by grepping the drift phrase repo-wide):** `templates/docs/zcode/arggon/agents/arggon-worker.md` — identical stale claim bullet ("Claim your item (`arggon_update` with status `in_progress` + assignee) only if it is unclaimed") and the same "claims exactly one item" description. Fixed the same way; vendored copy regenerated.

Vendored copies regenerated with `npm run arggon -- init`; `.agents/skills/**` refreshed with `npm run skills:sync`; `.convention.yml` reverted after every regen.

### In-lane review notes, folded in (prose)

- `agents.md`: "convention guess that drifts silently" + a repeated guess in the next bullet → **Per-item worktrees** now names the item's **recorded `worktree_path`** (`../<repo>-<id>` is the naming convention `start` follows, not a path to re-derive).
- Subagent-rule tail: "only when you are the one who works it" → "only when **you picked the item up yourself and no claim exists**" (a dispatched worker *does* work it).
- Spelling consistency: the native duties no longer mix CLI syntax — `start` has no `--force` (the `--force` on `update` is human-only and never the remedy), and the unclaim step is `tools.arggon.update({ id, status: "todo" })`.
- Refusal taxonomy: the `npm ci` remedy is attributed to **both** arms — the **unconditional** fresh-worktree install gate (`bug-start-install-ordering`) and `x-tracker.strict-gate-bins` on an attach; a single-writer refusal is the same shape (coordinate first; `--take-over-worktree` only for a dead owner).
- Coordinator template duty-3 drift: "foreground or background" → **foreground** (a background child outlives a headless `opencode run`), and duty 4 now routes the reviewer's `## Probes needed` blocks to `arggon-prover` (#583).
- **One consequence I had to make for coherence:** duty 4 telling the coordinator to use `arggon-prover` is incoherent while the template's own allow-list denies it. `ArggonManager/docs/agents.md` §Orchestration already documents the allow-list as `arggon-worker` / `arggon-reviewer` / `arggon-prover` / `explore`, so the template was behind its own carrier — added `- action: subagent / resource: arggon-prover / effect: allow`. The wave smoke's permission probe denies `general`, which is unaffected.

### Pins (`cli/src/init-opencode.test.ts`, 45 tests green in that file)

New test **"no other carrier tells an agent to claim without a worktree, or to hand-roll one"** walks all five carriers (skill reference, OpenCode worker, ZCode coordinator, ZCode worker, repo-root `AGENTS.md`): each must carry the claim/verify rule and none may carry "Claim your item …", "Claim **your** item (`in_progress` + assignee)", "claims exactly one item", `git worktree add ../<repo>-<item-id>`, "create one per item with" or `--status in_progress --assignee`.

The existing coordinator pin also now covers the foreground rule, the `arggon-prover` mention, and the prover allow-list entry. Note the two pins that had to be assertion-shaped rather than string-shaped: a "not.toContain('git worktree add')" pin can never pass, because the replacement forbids that command by name (my first attempt failed exactly this way — fixed to pin the instruction, not the string).

### Gates (worktree, head `c0fcfa0b`)

- `npm test` → see the run recorded below · `npm run lint` · `npm run build` · `npm run check:plugin` (bundle byte-identical, no `opencode/plugins/arggon/**` change) · `npm run arggon -- validate` → `ok:true`, 0 errors, 0 warnings · prettier clean on every touched file
- B1 probe: empty (above)

### Still open (not mine)

- Item box 2 (reconciling `bug-release-notes-extraction-breaks-on-linked-header` and `task-native-start-take-over-input`) — left to the coordinator lane, unticked.
- Not filed by me: whether the reverted stamps deserve a follow-up item (a release regenerates them), and the round-1 finding 2 (stale checksums at HEAD) is now moot for the plugin/SKILL entries but will resurface at the next regen.

### 2026-10-02 @ses_f02bcc476ffes6LrJvCQylx0li
### Round-2 gates, exact (worktree `/home/arggon/Projects/ArggonManager-task-coordinator-claims-through-native-start`, head `c0fcfa0b` + tracker commits)

```
npm test          → Test Files 118 passed (118) | Tests 2166 passed (2166)   (77.59s)
npm run lint      → clean (no output)
npm run build     → clean (tsc x3 + postbuild; bundle 443240 bytes)
npm run check:plugin → exit 0, no `git diff` on opencode/plugins/arggon/index.bundle.ts
npm run arggon -- validate → {"ok":true,"errors":[],"warnings":[]}
prettier --check  → clean on all 11 touched files (templates x4, skills ref, AGENTS.md,
                     ArggonManager/docs/agents.md, cli/src/init-opencode.test.ts,
                     .opencode/agents/arggon-{coordinator,worker}.md,
                     .zcode-marketplace/arggon/agents/arggon-coordinator.md)
B1 probe          → `npx --yes arggon-manager@0.5.0 init --no-commit` then
                     `git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml'` = EMPTY
```

Suite went 2165 → 2166 (one new pin). The only failures I hit en route were my own two bad pins, both fixed: an `AGENTS.md` `not.toContain("git worktree add")` that can never pass (the replacement forbids the command by name — now pins the instruction instead) and a `.not.includes` typo on a string.

Item boxes ticked in this round: **1** (contract states claim step, ordering, prohibitions — now in all five carriers) and **3** (seam test pins the claim duty's presence, and the pins now cover every carrier). Box **2** left unticked for the coordinator lane; box **4** left unticked (its seam-test half is delivered, its reconciled-frontmatter half is box 2). Item stays `in_progress`, PR stays a draft.

### handoff 2026-10-02 @ses_f02bcc476ffes6LrJvCQylx0li (session: ses_f02bcc476ffes6LrJvCQylx0li) — next: Re-review PR #589 (draft): B1 probe empty, 5 carriers fixed, 2166 tests green; merge if satisfied
- branch: feat/task-coordinator-claims-through-native-start
- open questions: Is a follow-up item warranted for the reverted .convention.yml stamps at the next release regen?; box 2 (two drifted items) stays with the coordinator

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
verdict: approve — the coordinator contract now says, in every carrier that is actually loaded, that the claim IS the worktree step and it comes before dispatch. The audit that opened this item found live damage (worktrees on items still `todo`), and the fix closes the loop in five places, not one: the OpenCode coordinator template (claim duty, renumbered, with the recorded `worktree_path` in the launch duty), `skills/arggon-cli/references/orchestration.md` (loaded FIRST by both agent templates — the reviewer's point that fixing one carrier manufactures new drift was right), the OpenCode worker template, the ZCode coordinator AND worker templates (a fifth carrier a repo-wide grep found beyond the reviewer's list), and this repo's own root AGENTS.md, which was still telling every session here to hand-roll `git worktree add` and to claim with a bare `update --status in_progress --assignee`.

Two review blockers, both fixed and verified rather than argued: B1 — the refreshed `.convention.yml` stamps turned `tasks-validate` red because CI installs the PUBLISHED 0.5.0, whose bundled template predates the fix, and regenerates the file; reverted to main's state file (the #583 precedent), and the reviewer's probe now returns EMPTY (`arggon-manager@0.5.0 init --no-commit` leaves a clean tree). The honest trade-off — those generated files read as adopter-modified until the next release regen — is recorded on the item and in the PR body, not hidden. B2 — the four-carrier fix above, with the reviewer's own corrections folded in (the hand-rolled bullet lives in the repo-root AGENTS.md, not `templates/docs/AGENTS.md`, which already claims natively).

Also fixed in-PR from the review's non-blocking notes, because they were the same class of drift: the agents.md 'convention guess' line now names the recorded `worktree_path`; the subagent rule no longer reads ambiguously for a dispatched worker; no CLI syntax inside native duties; the `npm ci` remedy is attributed to BOTH the unconditional fresh-worktree install gate and `x-tracker.strict-gate-bins`; duty 3 says foreground only (a background child outlives a headless `opencode run`) and names `arggon-prover`, with the coordinator's allow-list extended to match (the template was behind its own carrier). Pins now cover all five carriers and were made to assert INSTRUCTIONS, not bare strings — two of the worker's own pins failed en route for exactly that reason.

One external red had to be cleared first: the repo-wide spec gate was failing on `spec-methodology-adapters-017.md` (no Synopsis), which is why #589's `cli` ran red twice on a PR that does not touch specs — fixed and merged as #590 under bug-spec-017-missing-synopsis-blocks-all-prs.

Merged: PR #589 squash -> main. Item done. Follow-ups filed: bug-unclaim-leaves-worktree-record-without-reaper (the contract's unclaim remedy leaves branch + worktree_path + env file + claim stamp, and cleanup never reaps a non-done item — the same unowned-worktree class arriving through the documented remedy).
