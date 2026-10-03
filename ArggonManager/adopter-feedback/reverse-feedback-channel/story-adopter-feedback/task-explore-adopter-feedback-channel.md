---
type: task
status: todo
id: task-explore-adopter-feedback-channel
title: "Exploration: reverse feedback channel from adopter repos (friction capture, dedupe, human-gated publish)"
parent: story-adopter-feedback
labels: [methodology, adopters]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-explore-adopter-feedback-channel.md
  Leaves live only under a story. id is the filename stem: task-explore-adopter-feedback-channel.
  CLI `arggon create task explore-adopter-feedback-channel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Exploration: reverse feedback channel from adopter repos (friction capture, dedupe, human-gated publish)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f031e92afffeGv1n1RTkEsHjpb

**PR #586** — exploration + container chain + the CONTRIBUTING bug. Impact class: **advisory** (no methodology carrier touched; the carrier change lands with the ADR/spec).

Phase 0–5 complete. Summary of the verdict on the original proposal:

**Refuted — "instruct agents to open a GitHub issue":** the evidence is a named incident, not taste. `deftai/directive#3633` (2026-08-23) shipped a skill documented as _"the sanctioned route for a consumer agent to escalate a framework gap upstream"_, and it was missed **by an agent that was actively escalating and following the rule that pointed at it** (policy flag off by default, skill absent from the host inventory, `REFERENCES.md` never deposited). The friction was _"absorbed into the session"_ — silent loss, which is worse than no channel because it looks like success. Three corroborating findings: it fights `docs/agents.md` §0 (the first section agents read); `claude-code#93077` shows cross-repo instruction precedence is unreliable; and the output shape is actively auto-closed by peers (OpenCode's `duplicate-issues.yml` rejects "AI-generated walls of text"; claude-code carries a 27.6% duplicate rate).

**Kept and improved — the instinct was right, only the writer of the issue was wrong.** Three projects converged (2026-07→09) on local capture → redact-before-exit → dedupe → human consent gate → publish (`ce-ai#426` shipped, `ContextDesk#325` shipped, `subfloor#543` declined-but-published). Their tiered output dissolves the auth objection _and_ the doctrine conflict: tier B is a **prefilled `issues/new?title=…&body=…` URL** — no `gh`, no auth, **a human clicks submit**. The agent never opens an issue, so §0 is never violated and one canonical record survives. Sentry's fingerprint rules then constrain the dedupe key: never derive it from the narrative (an LLM-authored value is exactly the "frequently changing" case that produces bad groups).

**Correction to my own earlier framing:** I first called the privacy objection "concrete, precedent-backed". The research supports _structural_ soundness (redact before render; whitelist capture) but found **no incident** of an adopter leaking paths into a maintainer's tracker via this trigger. PixelLeak is the same failure _shape_ — no sanctioned channel, so the agent chose public — but a different cause. The exploration records that downgrade explicitly rather than keeping the stronger claim.

**Recommended, not decided:** `arggon friction` → local bounded log outside the tracker → stable-fields-only fingerprint → redacted report → human-gated tiered publish, in four independently shippable stages. Stage 1 needs no adopter opt-in and attacks this repo's 10 known duplicate items directly.

Gates green: `validate` ok (0 warnings, v5); `spec validate` ok (30 docs); `spec analyze` no new finding; prettier clean; placeholder scan clean.

Next per the ADR 0017 gate: an ADR (settling the carrier change's behavioral impact class, opt-out semantics, and the explicit non-goal of automatic publication), then the spec carrying the 13 hunted edge-case dimensions as acceptance criteria. No implementation task claimed before `spec analyze` reports no NEW findings.

### 2026-10-02 @Reviewer
verdict: request-changes (ADR/spec/plan numbering collides with already-merged main; a `done` item is rewritten; ADR ships `Accepted` pre-merge)

Reviewed PR #586 (`feat/task-explore-adopter-feedback-channel`, 18 files, +1830/-12) by reading the branch against `origin/main`. No gates run — execution evidence requested at the end.

**Bottom line: the thinking is good and I want this merged. The blockers are all mechanical (renumber, rebase, one status line, one README row).** The exploration is the strongest artifact in this story: the refutation of the original proposal rests on a named dated incident rather than taste, it self-corrects an overstated privacy claim, it records its own evidence gaps, and its 13-row edge-case table resolves every hunted dimension into a spec AC, an explicit non-goal, or a spike with nothing left "unknown".

---

## Blocking findings

**B1 — Every artifact identifier in this PR collides with main. Four of them.**

| Artifact | this PR | already on `origin/main` |
| --- | --- | --- |
| ADR | `0020-adopter-friction-channel.md` (`172af2fb`, **19:36 -0300**) | `0020-methodology-first-productization.md` (`448b31dc`, **13:06**) — later flipped to `Accepted` by `ecedac02` "docs: accept ADR 0020" |
| exploration | `exploration-adopter-feedback-channel-018.md` | `exploration-methodology-productization-018.md` (`448b31dc`) |
| spec | `spec-friction-capture-017.md` | `spec-methodology-adapters-017.md` (`448b31dc`) |
| plan | `plan-friction-capture-017.md` | `plan-methodology-adapters-017.md` (`448b31dc`) |

This is not an unavoidable concurrent-PR race: the branch last merged main at 11:35 and wrote its own ADR 0020 **~6h later**, by which time main had already filed *and accepted* an ADR 0020. After merge the repo holds **two Accepted ADRs numbered 0020**, two explorations ending `-018`, and two spec/plan pairs ending `-017`. Every "ADR 0020" reference then means two things — including `docs/engineering.md:3`, which declares the methodology carrier "per [ADR 0020](./adr/0020-methodology-first-productization.md)".

`engineering.md:171` requires "a 4-digit monotonic number", and the repo has already paid for this class twice with the right remedy: ADR 0016 (`a03fb3b5 docs: renumber ADR 0014-adopter-upgrade-channel to 0016`, plus a `Numbering note`) and ADR 0019 (`6825f680 … + ADR 0019/spec-plan 016 renumber`, with a `Numbering note` naming the collision). Follow that precedent: renumber to the next free id (0021 / 019 / 018), update all cross-references (exploration, spec, plan, 6 tasks, 3 spikes, this item body), and carry the same one-line `Numbering note`.

Note this is **invisible to the tooling**, which is why review must catch it: `cli/src/spec.ts:280-297` keys uniqueness on `kind:docId`, so `friction-capture-017` vs `methodology-adapters-017` does not trip `SPEC_DUPLICATE_ID`, and git merges the four files without a conflict (different filenames).

**B2 — This PR rewrites a `done` item.**
The diff includes `bug-contributing-github-issue-contradiction.md` (+55/-…). On `main` that item was fixed and closed after this branch base: `3693ac29` claim → `d506894b docs: fix CONTRIBUTING.md contradiction` (PR #594) → `8ba5947a chore(tasks): done bug-contributing-github-issue-contradiction` (`41cdda87` pruned it). Main now carries `status: done`, `assignee: Arggon`, `branch: fix/bug-contributing-github-issue-contradiction`, a fully ticked checklist, the fix evidence note, and a `verdict: approve` from the #594 review. **This branch copy has `status: todo`, no assignee/branch, and replaces that record with five unticked boxes.**

So the merge either conflicts on that file, or — worse, if resolved by taking this side — **reopens a done item, strips its claim record, and deletes a reviewer approve verdict**, which `AGENTS.md` and `docs/agents.md` §5 forbid. Fix: rebase onto `origin/main` and **drop this hunk entirely**. The item is closed; the branch context/acceptance is redundant, and the `CONTRIBUTING.md:13 vs :269` contradiction it documents no longer exists.

**B3 — ADR ships `Status: Accepted` before merge.**
`engineering.md:191`: "Proposed in a PR → Accepted when merged (or explicitly recorded)". Main own ADR 0020 landed **Proposed** (`448b31dc`) and was accepted in a **separate follow-up commit** (`ecedac02`, "docs: accept ADR 0020") — that is the "explicitly recorded" path, and ADR 0016 carries a `Status note` for its own late flip. Meanwhile the item is still `in_progress` and the epic acceptance leaves "An ADR settles the cross-cutting decision" **unticked** (see N3), so nothing on this PR records the maintainer acceptance of *this* ADR. Land it as `Proposed` and let the merge (or an explicit accept commit) flip it.

**B4 — the new ADR is not indexed.**
`ArggonManager/docs/adr/README.md` indexes 0001–0019 and this PR adds no row. That is the exact defect tracked as `task-adr-readme-index-missing-adr-0020` ("Every ADR file in the directory has an index row (sweep the whole dir, not just 0020)"), filed while reviewing PR #598. Add the row in the renumbering commit.

---

## Non-blocking findings

**N1 — the `doctor` `friction` block is owned by two tasks.** `task-friction-surface-parity-and-docs` (T5) claims `doctor --json` gains `friction: { triggerPresent, triggerVersion, current, files }`; `task-friction-trigger-carrier` (T6) claims `doctor --json` reports `triggerPresent`/`triggerVersion` "(with task-friction-surface-parity-and-docs)". Same deliverable, two owners, not disclosed — and it is the exact piece under review. Give it one owner.

**N2 — the compliance spike is unrunnable *and* claimable.** ADR 0020 §1 Stage 2 ("reached only after the compliance spike measures real trigger firing") and the spike own AC (`doctor --json` `friction.triggerPresent` is recorded) require the trigger to exist — i.e. T6 — yet `task-spike-friction-trigger-compliance` carries **no `depends_on`**, so it is claimable today, before `arggon friction` even exists. Its sibling spike (`volume-threshold`) *does* declare `depends_on`, so this is an omission. Minimum fix: `depends_on: [task-friction-trigger-carrier]`.

**N3 — internal inconsistency across containers.** `story-adopter-feedback` ticks "[x] The decision is recorded as an ADR (carrier change is **behavioral**)"; the epic `reverse-feedback-channel` leaves "[ ] An ADR settles the cross-cutting decision and the spec passes `arggon spec analyze` with no NEW findings" unticked; the ADR itself claims `Accepted`. All three land in one PR. Reconcile: either tick the epic box (the worker claims the analyze gate is met) or split it into "ADR written" / "ADR accepted", so the epic does not contradict the ADR own status.

**N4 — duplicated H1 in all 10 touched items.** Each file now carries the create-template H1 *and* a second one the worker appended (`adopter-feedback.md`, `reverse-feedback-channel.md`, `story-adopter-feedback.md`, `task-explore-adopter-feedback-channel.md`, and the 9 leaves). In the story the two H1s even disagree: `# Adopter friction channel: capture, dedupe, human-gated publish` (template) vs `# Adopter feedback channel: friction capture, dedupe, human-gated publish` (added). Delete the added H1s.

**N5 — the item body "still broken, deliberately not touched" note is stale on both items it names.** `368809d5` ("fix 4-level doc link prefix in two adopter-feedback items") fixed `bug-prettier-glues-split-inline-code-span.md` on main, and `bug-contributing-github-issue-contradiction.md` was rewritten by the #594 fix and no longer contains a 4-level link. The PR documents as broken two things main already fixed/closed.

**N6 — minor spec/exploration inconsistencies.** (a) The exploration concurrency row resolves with "`O_EXCL`-style create"; the spec and T1 specify `O_APPEND` on an existing append-only log — pick one (the AC, "two concurrent writers… non-interleaved lines", is the real gate and is testable). (b) Rotation past 5000 lines appears in both `task-friction-capture-command` and `task-friction-dedupe-and-report`; the dedupe copy says "(test; shared with …)", which is honest, but pick an owner.

---

## Scope calls (coordinator decides; my recommendation)

**4a · `doctor` gains a `friction` block — keep it, but re-justify it and re-own it (one task).**
The ADR stated reason is weaker than it reads. `cli/src/doctor.ts:649-692` iterates `config.generated`, re-renders the **current** template and reports `outdated` for *every* local state — untouched, modified, **acked** and acked-drifted — with the paths in `outdatedDocs` (`doctor.ts:74-77`) and a human hint pointing at `arggon init --dry-run` (`doctor.ts:856-861`). And the generated agent files *are* in that map: `cli/src/init-opencode.test.ts:413-414` asserts `config.generated[".opencode/agents/arggon-coordinator.md"].template === "docs/opencode/agents/arggon-coordinator.md"`. So merely editing `templates/docs/opencode/agents/arggon-worker.md` already makes the trigger absence show up as an outdated managed doc. **"the channel is not live here" is not invisible today.**

What the dedicated block uniquely buys is narrower and still real: (i) per-file `triggerVersion`, so "trigger present at 0.5.0" is distinguishable from "current is 0.6.0"; (ii) separating *trigger absent* from generic template drift — exactly the observable the compliance spike needs to tell "never seen" from "seen and ignored". Rewrite §2 to rest on those two, not on invisibility. If you want the minimal stage 1, the cuttable part is `triggerVersion`/`files`, not the block.

**4b · stopping at tier B — defensible, keep the boundary.**
`docs/agents.md:24` ("GitHub is for **PRs only**") and `:36` ("Do **not** open new GitHub issues") stay intact because tiers A/B never require `gh`, never write to GitHub, and the agent job ends at printing a prefilled URL a **human** opens; the spec Opt-out/Non-goals sections forbid any auto-submit path, and ADR 0020 §4 keeps the canonical record in-tree (`arggon create`), so no second record is born. The dedupe value is not lost either: stage 1 stable-fields fingerprint is what collapses this repo 10 known repeats, and what stage 1 gives up is only *upstream* pre-search — the genuinely "automatic" part, correctly gated on measured volume + compliance. One thing to record rather than leave implicit: local-only dedupe cannot see an issue a human already filed upstream, so a re-filed class will be re-emitted. That belongs in the spec Limits criterion.

**4c · trigger-carrier last — right instinct, wrong slot, and the current graph is harmful.**
The stated rationale ("an agent file naming a command that does not exist yet is worse than no trigger") is satisfied as soon as **T1** lands the capture command — nothing in the trigger text needs T4/T5. But ADR 0020 makes the compliance spike gate stage 2 *and* tier C, and that spike measures whether an embedded trigger fires. Todays ordering therefore delays the single most decision-relevant measurement until the entire chain (incl. skill copy + evals + README/convention docs) is done, while N2 leaves the spike claimable in the meantime. Minimum fix: the `depends_on` edge. Better: split T6 — trigger block right after T1, skill/evals/parity docs after T5.

---

## What I verified by reading

- **Exploration protocol compliance** (`skills/arggon-cli/references/exploration.md`): Phase 0 classification (greenfield, one-way ratchet); Phase 1 read-only stance; Phase 2 grounding in code/carriers/ADRs/labs/live `gh`+git data; Phase 3 all 8 frontier rounds logged in dependency order, and the one genuine unknown routes to a spike not a guess; Phase 4 **all 12 template dimensions present plus `adopter trust`, every row resolved** — mapped 1:1 into 13 spec ACs (13 hunted → 13 mapped + 3 extra: surfaces parity, carrier discipline, gates) or into non-goals, nothing "unknown"; Phase 5 three approaches + three set-aside, trade-offs, recommendation, artifact order, self-review; `Evidence gaps` section present and honest. Structure matches `templates/exploration-project.md`.
- **ADR does not silently overrule ADR 0016 or 0018.** Verified `agents.md:24,36` (§0), `:462-467` (impact-class rule, quoted accurately by ADR 0020 §2), `:579-586` (§Self-improvement loop holds only the two maintainer-side labs protocols — no existing channel to duplicate). ADR 0020 §2 defers to the ADR 0016 propose channel ("never by overwrite"); §3 `ARGGON_NO_FRICTION` mirrors ADR 0018 `ARGGON_NO_UPDATE_CHECK` opt-out and its "no phone-home beyond our own packument" line is consistent with ADR 0018 §3; §4 tier-C/CI rules do not contradict ADR 0018 "on CI the registry GET never runs" posture. Neither ADR is amended or contradicted — both would only gain a cross-reference.
- **Spec/plan structure** against `cli/src/spec.ts`: `spec_id`/`title`/`status: proposed`/`created` present; `## Purpose`/`## Synopsis`/`## Acceptance` all present (the validator three required sections, `spec.ts:157-176`); plan carries `plan_id`/`title`/`status`/`created`/`spec` with a resolvable `spec` path; ACs are verifiable and several are genuine discriminators (fixture A: one class ×3 with differing prose → one row `count: 3` fails if the fingerprint reads `narrative`; fixture B: near-identical prose, different `errorCode` → two rows fails if it over-merges).
- **ADR 0017 gate honored**: the ADR precedes the spec precedes the plan precedes the tasks in protocol order; all 6 implementation tasks and 3 spikes are `status: todo`, unclaimed, with no `branch`/`claimed_at` — no implementation task claimed before the spec exists.
- **Impact class honest**: the PR touches no carrier (`docs/agents.md`, `docs/engineering.md`, `docs/convention.md`, `skills/arggon-cli/**` are all absent from the diff), so **advisory** here with **behavioral** correctly deferred to T6 is right.
- **`x-friction` follows the established extension policy**: `convention.md:457-458, 471, 494, 514` ("unknown nested keys ignored; a scalar is a parse error") — T4 AC mirrors the existing `x-views`/`x-playbooks`/`x-tracker`/`x-import` contract, and T6 correctly schedules the `convention.md` doc.
- **State-dir claim grounded**: `ARGGON_STATE_DIR` exists (`lib/src/worktree.ts:1037`) and the per-OS state base is real (`lib/src/worktree.ts:1092-1103`: `XDG_STATE_HOME`/`~/.local/state`, `~/Library/Application Support`, `%LOCALAPPDATA%`).
- **Task hygiene**: all 9 leaves sit directly under `story-adopter-feedback` (confirmed via `arggon list --parent`; convention v5 forbids level-skipping); no duplicate of existing work — checked `story-self-improvement`/`task-telemetry-mining` (done, maintainer-side, explicitly untouched) and §Self-improvement loop; priorities `p1/p2/p3` consistent with the plan ordering. **Untestable acceptance: none found.** The two hygiene defects are N1 and N6(b), both ownership, not testability.
- **Smoke gate**: exempt — `engineering.md:94,140`, "docs-only PRs are exempt"; this diff is 18 `.md` files, zero runtime code. No probe evidence owed for behavior.

## Unverified (claims I could not check by reading)

`arggon validate` 0 warnings; `spec validate` 32 docs / 0 warnings; `spec analyze` 7 pre-existing findings and zero NEW across 19 specs; `npm run lint`; `prettier --check`; the primary-checkout-clean claim. The 32-doc figure is *arithmetically consistent* with the branch (19 specs + 13 plans, after removing main methodology-adapters pair that post-dates the branch base), which is a point in the worker favour — but consistency is not evidence.

## Probes needed

1. `cd /home/arggon/Projects/ArggonManager && git merge-base origin/main origin/feat/task-explore-adopter-feedback-channel` → expect a base older than `448b31dc`; confirms how far behind the branch is. (I could run git plumbing except `merge-tree`, which permissions blocked.)
2. `cd /home/arggon/Projects/ArggonManager && git merge-tree $(git merge-base origin/main origin/feat/task-explore-adopter-feedback-channel) origin/main origin/feat/task-explore-adopter-feedback-channel` → expected: exactly one textual conflict, in `bug-contributing-github-issue-contradiction.md`; expected *not* to appear: any conflict or duplicate notice for the four colliding identifiers. That is the proof B1 is silent and B2 is real. A different conflict set changes the fix list.
3. `cd /home/arggon/Projects/ArggonManager-task-explore-adopter-feedback-channel && npm run arggon -- spec validate` → expected: ok, 0 errors, 32 docs. After merging main, expected: ok, **34 docs** with **no** `SPEC_DUPLICATE_ID` — i.e. the validator passes on a repo holding two ADR-0020s, two `-018` explorations and two `-017` spec/plan pairs. That negative result is what makes B1 a review responsibility rather than a tooling catch.
4. `… && npm run arggon -- spec analyze` → expected: 7 findings, all pre-existing, zero NEW. Any NEW finding blocks the ADR 0017 gate and must be triaged before T1 is released.
5. `… && npm run arggon -- validate` and `npx prettier --check` over the 18 changed files → expected: clean.
6. After the renumber + rebase: re-run 3–5 and `git log --oneline -1 -- <bug-contributing…>` to confirm the branch no longer edits that item.

## Recommendation

**No merge as-is.** Fix B1–B4 (renumber all four identifiers to the next free ids with a `Numbering note`, rebase onto `origin/main` and drop the `done`-item hunk, ship the ADR as `Proposed`, add the README row), fold in N1–N6, then re-request review — the content should not need another architecture pass. Scope calls 4b and 4c stand as recommended; 4a stands with the §2 re-justification. Release `task-friction-capture-command` (T1) only after the renumber lands and probe 4 reports zero NEW findings; add `depends_on: [task-friction-trigger-carrier]` to the compliance spike before it becomes claimable.

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Coordinator decision on the reviewer's B1 (4 number collisions) — **the WORKER'S side renumbers, not mine.**

The collision is real and the root cause was mine: I wrote ADR 0020 (methodology-first productization) and accepted it on main before dispatching this worker, which independently wrote its own ADR 0020. Same for exploration `-018` and spec/plan `-017`.

Renumbering `origin/main`'s side would mean touching an ACCEPTED ADR and four artifacts that already reference it (the carriers from PR #592, README, `task-methodology-carriers`, the spec/plan pair). Renumbering the branch's side touches one PR that has not merged. So:

- ADR `0020-adopter-friction-channel.md` → `0021-adopter-friction-channel.md`
- `spec-friction-capture-017.md` → `spec-friction-capture-018.md`, `plan-friction-capture-017.md` → `plan-friction-capture-018.md`
- `exploration-adopter-feedback-channel-018.md` → `exploration-adopter-feedback-channel-019.md`
- every internal reference: frontmatter `spec:`/`planTask:`, the exploration's Decision link to its ADR, the spec's link back, the plan's link back, any cross-reference in the item body and the 6 tasks + 3 spikes

Also required before this merges, from the reviewer's remaining findings:
- **B2** the PR rewrites a `done` item: `bug-contributing-github-issue-contradiction.md` was fixed and closed on main after this branch's base, and the branch's copy is `status: todo` with unticked boxes. Rebase onto main and take main's copy for that file (it is NOT this PR's item).
- **B3** the ADR ships `Status: Accepted` pre-merge, against `engineering.md` §ADR process and the repo's own two-step precedent → ship it `Proposed`.
- **B4** add the new ADR's row to `docs/adr/README.md`. Note the parallel finding already filed as `task-adr-readme-index-missing-adr-0020` (now merged) added a PARITY TEST that asserts every ADR file has exactly one index row — so the new ADR must be indexed in this same PR or that test fails.

And the two scope calls the reviewer ruled on, which you should carry into the ADR: keep the `doctor` `friction` block but re-justify it on the grounds that actually hold (per-file `triggerVersion` plus separating "trigger absent" from generic template drift — `doctor.ts` already re-renders templates for acked entries too, so `outdated` alone does not give it) and stop claiming it is claimed by both T5 and T6; and name in the spec that local fingerprint dedupe cannot see an already-filed upstream issue, which is the honest boundary of stopping at tier B.

`bug-spec-analyze-does-not-detect-duplicate-doc-numbers` has MERGED, so `arggon spec validate` / `spec analyze` will now catch any residual collision — use them as the check rather than by eye.
