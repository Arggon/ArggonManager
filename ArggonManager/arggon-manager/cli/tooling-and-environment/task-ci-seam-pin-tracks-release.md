---
type: task
status: done
id: task-ci-seam-pin-tracks-release
title: arggon.yml ARGGON_VERSION pin must track the release — enforced by a lag-guard test (derivation rejected with evidence)
assignee: Arggon
branch: feat/task-ci-seam-pin-tracks-release
parent: tooling-and-environment
labels: [ci, release]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-ci-seam-pin-tracks-release.md
  Leaves live only under a story. id is the filename stem: task-ci-seam-pin-tracks-release.
  CLI `arggon create task ci-seam-pin-tracks-release` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon.yml ARGGON_VERSION pin must track the release (derive from package.json, not a literal)

## Context

Filed from the #527 review: publishing 0.4.1 + regenerating the seam with
0.4.1 turned `tasks-validate` red on main because
`.github/workflows/arggon.yml` pinned `ARGGON_VERSION` as a literal 0.4.0
while the committed seam was 0.4.1-shaped. Goal: publishing and pinning
cannot diverge silently. Resolution (evidence in Notes): a **lag-guard test**
enforcing the literal pin — run-time derivation was rejected.

## Acceptance

> Amendment 2026-10-01 (coordinator, PR #544 evidence): criterion 1 of the
> original filing ("pin derived/automated") is resolved as
> **guard-enforced literal pin** — derivation rejected with recorded evidence
> (red window is intrinsic to a registry-pinned install: the derived version
> does not exist between bump and publish, on main and on the release PR
> itself). The invariant "publishing and pinning cannot diverge" is unchanged;
> the mechanism is detection (loud red test) instead of prevention.

- [x] A test fails when the pin lags the shipped version: `cli/src/ci-seam-pin.test.ts` — red exactly on the #527 shape (seam stamps newer than pin), green through the whole documented flow (mid-cycle, release window, template-less patch re-pin); demonstrated RED on the real tree with an actionable message, then restored (6/6 green).
- [x] Enforcement is automated on every PR and push: the guard runs in CI (`npm test` discovery); the opposite drift (pin moved without seam regen) stays policed by the workflow's drift gate.
- [x] Runbook updated: `release.md` re-pin step is guard-enforced ("a stale pin is a red test, not a silent outage"); no other runbook content changed.
- [x] PR #544 merged (0ee659fa) after reviewer `verdict: approve` (red path re-derived independently; diff minimal; smoke evidence in body).
- [x] Superseded wording corrected at the sources: ADR 0018 dated amendment (d70817c8) + item title updated; adopter template keeps its literal pin by design (asserted in the guard test).

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the #527 review: publishing 0.4.1 + regenerating the seam with 0.4.1 turned tasks-validate red on main because .github/workflows/arggon.yml pins ARGGON_VERSION as a literal 0.4.0. The manual re-pin is release-runbook step now documented in release.md; this item removes the foot-gun: derive the pin from the root package.json version (or a workflow-level env referenced from package.json), so publishing and pinning cannot diverge. Acceptance: pin derived/automated, a test or CI check that fails when the pin lags the shipped version, runbook updated.

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
Scheduled as wave-1 work under the ADR 0018 rollout (initiative delivery-rollout): this item is now a gate for task-release-workflow — the seam pin must be derived (not literal) when release.yml lands.

Scope notes for the claiming agent: the fix targets THIS repo's committed .github/workflows/arggon.yml (derive ARGGON_VERSION from the root package.json at run time, e.g. node -p "require('./package.json').version"); the shipped adopter template (templates/docs/github/workflows/arggon.yml) keeps its literal pin by design — adopters pin deliberately and the drift gate couples the pin to their committed seam. The release.md re-pin step this item's Context mentions should end up removed/superseded when task-release-workflow shrinks the runbook — coordinate via the item, both edits name this file in different PRs.

### 2026-10-01 @ses_f08092f0bffe681eueaMGezSgZ
Decision (recovery session): KEEP the literal ARGGON_VERSION pin; finish the lag-guard test; runbook documents a guard-enforced re-pin. Derivation is REJECTED, and ADR 0018's parenthetical ("derive the seam's ARGGON_VERSION pin from the root version") is superseded by this evidence.

Evidence against derivation:
1. Runbook order (release.md, executed verbatim for 0.4.1): step 1 bumps package.json in a chore(release) commit ON MAIN and pushes; step 3 publishes (npm publish); step 3 notes registry propagation lags minutes.
2. .github/workflows/arggon.yml triggers: push: branches [main] + pull_request (all PRs). With a derived pin, the step-1 push makes main's CI run npm install -g "arggon-manager@<V+1>" BEFORE the version exists on the registry -> install fails -> tasks-validate red on main from the bump push until publish + propagation. That is the #527 outage class (tasks-validate red on main and every open PR), made GUARANTEED on every release instead of a rare drift. The inherited (rejected) release.md text conceded this: "One window remains: between the chore(release) push (step 1) and the publish (step 3), CI on main installs a version that is not yet on the registry".
3. ADR 0018 does NOT change the verdict: the future flow is the release-PR model — "Merging it is the release", publish fires on/after merge (lib first, then CLI, OIDC). The release PR bumps package.json to V+1 and CI runs on it pre-merge, pre-publish (pull_request covers all PRs), so a derived pin turns the release PR itself red — the very PR whose green CI gates the human merge. The red window is intrinsic to deriving from package.json while the install is a registry pin, under both the current manual runbook and the ADR 0018 pipeline.

Chosen invariant (now enforced by cli/src/ci-seam-pin.test.ts): the literal pin must never lag BOTH the root package.json version and the newest arggonVersion stamp in ArggonManager/.convention.yml. Green through the whole documented flow (mid-cycle; release window, pin == stamps; template-less patch re-pin, pin == pkg); red exactly on the #527 shape (seam regenerated by a newer version than the pin). The opposite drift (pin moved without seam regen) stays policed by the workflow's own drift gate at CI time.

Diff shape: .github/workflows/arggon.yml reverted to the literal pin (comment now records why derivation was rejected); release.md re-pin step = "a stale pin is a red test, not a silent outage" (guard-enforced re-pin); the untracked guard test finished (pure lag predicate + red-case table + template-still-pins-literally assertions); cli/src/headless-ci.test.ts REVERTED to main (its inherited additions asserted derivation — wrong under this decision; the template assertions moved into the guard test, so the slow network suite is untouched).

Follow-ups for the coordinator (not filed): (a) ADR 0018 §Decision 1 parenthetical says "derive the seam's ARGGON_VERSION pin" — it contradicts this decision and needs a one-line amendment PR (outside this item's file scope); (b) primary checkout still shows cli/src/headless-ci.test.ts dirty despite stash@{0} "seam-pin worker diagnostics...".

### 2026-10-01 @ses_f08092f0bffe681eueaMGezSgZ
PR: https://github.com/Arggon/ArggonManager/pull/544 (branch feat/task-ci-seam-pin-tracks-release, commit a162e280 on top of the claim commit).

Evidence for the reviewer (commands run in the worktree ../ArggonManager-task-ci-seam-pin-tracks-release):
- npx vitest run cli/src/ci-seam-pin.test.ts — expected pass, observed 6/6 passed (617ms): verdict-table greens (whole release flow), red cases (#527 shape, newest-stamp-wins), file-based guard, repo-workflow-never-derives, template-still-pins-literally.
- RED demonstration (smoke gate): sed the workflow pin 0.4.1 -> 0.4.0, run the file-based test — observed FAIL with "ARGGON_VERSION 0.4.0 lags the committed seam ... Bump ARGGON_VERSION ... (release runbook Gotchas: \"Re-pin the seam check\"). A stale pin is a red test, not a silent outage."; restored the file, re-run — 6/6 green. Restored bytes verified by the green run + git diff cleanliness before commit.
- npx prettier -c (3 touched files) — one auto-format fix on the test file, then clean; npx eslint cli/src/ci-seam-pin.test.ts — clean; npx tsc -p tsconfig.typecheck.json — exit 0; npm run arggon -- validate — ok (0 warning(s), convention v5), also green in the pre-commit hook of commit a162e280.
- cli/src/headless-ci.test.ts: REVERTED byte-identical to main (inherited additions asserted the rejected derivation approach; template assertions folded into the guard test) — the network-dependent suite was therefore not run, by design.
- Inherited state disposition: workflow derivation step + release.md "derived, no manual re-pin" — reverted/rewritten; untracked guard test — kept and finished; headless-ci expect-tweaks — reverted with the file (they belonged to the derivation approach, not a standalone debugging story).

### handoff 2026-10-01 @ses_f08092f0bffe681eueaMGezSgZ (session: ses_f08092f0bffe681eueaMGezSgZ) — next: Review PR #544; merge if the guard approach is accepted; then file the ADR 0018 parenthetical amendment.
- branch: main
- open questions: ADR 0018 says "derive the pin" — decision supersedes it; needs a one-line ADR amendment PR by the coordinator.

### 2026-10-01 @ses_f0800e929ffe07GoJECvBzDE1W
DECISION: keep the LITERAL ARGGON_VERSION pin; enforcement moves to a lag-guard test (cli/src/ci-seam-pin.test.ts). Derivation from package.json is REJECTED — it contradicts the item title, which was written before the red-window analysis.

EVIDENCE (verified in this worktree):
1. Red window on main, current runbook: release.md step 1 bumps package.json+lib/package.json in one chore(release) commit pushed to main; step 3 publishes later and notes "Registry propagation lags minutes". .github/workflows/arggon.yml triggers on push:main AND pull_request — so the step-1 bump commit itself runs tasks-validate on main. A derived pin (node -p "require('./package.json').version") would npm install -g arggon-manager@<bumped> before the registry has it → guaranteed red on main every release, for the whole bump→publish(+propagation) window.
2. Red window on the release PR, ADR 0018 flow: §1 makes the release-please PR the bump vehicle ("Merging it is the release") and publishes post-merge via release.yml/OIDC. The release PR runs CI pre-merge, pre-publish → derived pin red on that very PR. Structurally unfixable by reordering: CI must pass BEFORE the merge that enables the publish. Derivation is incompatible with the release-PR model.
3. Template: an adopter's package.json version is unrelated to arggon releases, so the shipped template (templates/docs/github/workflows/arggon.yml) could never derive; it keeps a literal (asserted by the new test).
4. #527 outage class: seam regenerated 0.4.1-shaped while the pin said 0.4.0 → red on main + all open PRs until the manual re-pin. The guard fails exactly that shape and only it: pin lags BOTH the root package.json version AND the newest arggonVersion stamp in ArggonManager/.convention.yml (predicate pinLagsSeam, covered by a verdict-table unit test so the red case is asserted, not just witnessed).

DIVERGENCE NOTE for the ADR 0018 spec reviewer: the ADR's operational duty says this item "derives the seam's ARGGON_VERSION pin from the root version". We keep the literal + test instead. The ADR's intent ("publishing and pinning cannot diverge") is still met — the guard makes a lagging pin unmergeable (red test on every PR) instead of silently installed. When the pipeline story lands, the parenthetical should be amended to name the guard.

WHAT SHIPPED (one coherent diff): (a) workflow env comment documents the literal-on-purpose rationale (the previously added derivation step is reverted/absent; ARGGON_VERSION stays "0.4.1"); (b) ci-seam-pin.test.ts finished — 6 tests: verdict table (all 5 green release-flow states + the #527 red state), file-based lag test, repo-workflow never-derives (no DERIVE_PIN, no GITHUB_ENV), install-step consumes the pin, adopter-template literal pin; (c) release.md Gotchas "Re-pin the seam check" now ends: "The re-pin is enforced by cli/src/ci-seam-pin.test.ts — a stale pin is a red test naming this step, not a silent outage."; (d) headless-ci.test.ts left untouched — the inherited expect() tweaks are not in this worktree and are not needed (its assertions target the template file only).

SMOKE: scratch fixture at /tmp/opencode/seam-pin-fixture with pin 0.4.0 / package.json 0.4.1 / stamps up to 0.4.1 → vitest run: 1 failed ("ARGGON_VERSION 0.4.0 lags the committed seam... Bump ARGGON_VERSION ... release runbook Gotchas: 'Re-pin the seam check'"), 5 passed; after re-pinning the fixture to 0.4.1 → 6/6 green. Real tree: npx vitest run cli/src/ci-seam-pin.test.ts → 6/6 green (113 ms). Gates: eslint ok, prettier ok, tsc typecheck ok, arggon validate ok.

### handoff 2026-10-01 @ses_f0800e929ffe07GoJECvBzDE1W (session: ses_f0800e929ffe07GoJECvBzDE1W) — next: Review PR #544 (head a162e280); merge if the literal-pin+lag-guard decision is accepted; then the ADR 0018 parenthetical amendment.
- branch: feat/task-ci-seam-pin-tracks-release
- open questions: ADR 0018 §Decision 1 still says "derive the pin" — needs the coordinator's one-line amendment PR; primary checkout may still show headless-ci.test.ts dirty (pre-existing, stashed).

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
Completed via PR #544 (merged 0ee659fa) after reviewer verdict: approve — the red path was re-derived independently (sed fixture in /tmp) and the falsifiability attack on the red-window claim failed on every premise (triggers, registry-pinned install, runbook order, ADR 0018 §1 flow).

Resolution: literal pin kept + lag-guard test (cli/src/ci-seam-pin.test.ts) — derivation rejected with recorded evidence (decision comment above); runbook re-pin step is guard-enforced; adopter template keeps its literal pin by design (asserted). Acceptance amended with a dated note: criterion 1 ("derived/automated") resolved as guard-enforced — invariant unchanged, mechanism is loud detection instead of prevention. Item title updated accordingly.

Superseded wording corrected at the sources: ADR 0018 dated amendment (d70817c8). Downstream consumers aligned: release-pipeline spec Interplay/T0 rewritten to the guard design (PR #545 head 0b99eb83 + review fixes in flight); task-release-spec Context line corrected on main.

Reviewer nits noted for the future owner (optional, not blocking): verdict-table row for "pin == pkg while stamps newer" and a temp-file fixture for the file-based red path.

### 2026-10-01 @ses_f0821d67dffeJCEv1KlhMw1eCD
Implementation evidence (subagent session, item task-ci-seam-pin-tracks-release).

DECISION: keep the literal pin + lag-guard test; derive REJECTED. Deriving ARGGON_VERSION from package.json installs a version the registry lacks between the release bump (step 1) and the publish (step 5): guaranteed red tasks-validate on main + release PR every release (404 on npm install -g arggon-manager@<bumped>), and an adopter's package.json is unrelated to arggon releases so the template could never derive. The guard (cli/src/ci-seam-pin.test.ts) fails exactly when the pin lags BOTH package.json and the newest arggonVersion seam stamp (the #527 shape) and stays green through every documented flow state.

PROVENANCE (disclosed): a concurrent writer session was active in this worktree during implementation (writes at 10:18, 11:41-44, 12:04-12:07 local). Per coordinator directive I waited for it to finish, re-assessed, and ADOPTED its final state (commit a162e280), which had converged on this same test-approach design and incorporated/extended my drafted guard test (extracted pinLagsSeam predicate + verdict-table unit tests + anti-derive regression assertions). My own additions on top: canonical runbook step 6 rewrite, item body/acceptance, verification below. No work was discarded.

VERIFICATION EVIDENCE:
- YAML parse (python3 yaml): workflow parses; step order checkout -> setup-node -> install -> bootstrap -> drift gate -> validate; literal ARGGON_VERSION "0.4.1"; no derive step.
- Mutation A (#527 replay, pin -> 0.4.0): vitest RED with message naming the fix ("Bump ARGGON_VERSION ... Re-pin the seam check").
- Mutation B (restore): 6/6 green. Mutation C (release-window: package.json -> 0.4.2, pin 0.4.1): 6/6 GREEN (rules out the naive pin==package.json test). Mutation D (restore): green.
- Gates: npm run build OK; npm test 113 files / 2003 tests passed; npm run lint exit 0; npm run check:plugin exit 0 (bundle unchanged); npm run arggon -- validate --json ok:true errors:[] warnings:[].

COMMITS on feat/task-ci-seam-pin-tracks-release: 0cf39cdc (claim), a162e280 (ci: enforce the seam pin with a lag guard, keep the literal), + this runbook/item commit before push.

### handoff 2026-10-01 @ses_f0821d67dffeJCEv1KlhMw1eCD (session: ses_f0821d67dffeJCEv1KlhMw1eCD) — next: Coordinator: review + merge PR (do not merge myself); then next release's step-6 re-pin per the updated runbook
- branch: main
- open questions: ADR 0018 parenthetical still expects derive from this item - superseded by the recorded decision; template pin is 0.4.0 vs committed 0.4.1 (fresh-adopter drift-gate red on first push) - needs a follo…

### 2026-10-01 @ses_f0821d67dffeJCEv1KlhMw1eCD
Correction to the handoff above: 'branch: main' is a wrong auto-detection (the tool ran from the primary checkout). The item branch is feat/task-ci-seam-pin-tracks-release (see frontmatter); head is 3fb2e280 after the handoff append.
