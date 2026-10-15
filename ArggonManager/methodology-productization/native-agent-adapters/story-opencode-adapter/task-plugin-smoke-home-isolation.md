---
type: task
status: done
id: task-plugin-smoke-home-isolation
title: "Plugin smokes need hermetic HOME: a machine-global plugin can shadow fixture bundles"
assignee: arggon-delivery-lead
branch: feat/task-plugin-smoke-home-isolation
parent: story-opencode-adapter
labels: [opencode-seam, tests, review-followup]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-plugin-smoke-home-isolation.md
  Leaves live only under a story. id is the filename stem: task-plugin-smoke-home-isolation.
  CLI `arggon create task plugin-smoke-home-isolation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin smokes need hermetic HOME: a machine-global plugin can shadow fixture bundles

## Context

From the `task-opencode-prompt-stamp` review (PR #760). The new `smoke/opencode-prompt-stamp-smoke.ts` serves with a hermetic HOME/XDG_* set and asserts the fixture's bundle bytes are the ones under test — because the machine-global `~/.config/opencode/plugins/arggon/index.ts` (9511 lines, pre-T4) shadows fixture bundles by id under the supervisor's first-registration-wins rule (`Duplicate plugin ID: arggon`). `smoke/opencode-smoke.ts` and `smoke/native-start-cold-smoke.ts` do NOT isolate: they inherit `process.env`, so on this box they may be exercising the global copy rather than the fixture bundle — their evidence is suspect until fixed. Also from the same review: the new smoke has no npm script (package.json was out of that item's lane), and `onCompaction`'s `asString(item.id) ?? "?"` is inconsistent with `onContext`'s tighter read.

## Acceptance

- [x] `smoke/opencode-smoke.ts` and `smoke/native-start-cold-smoke.ts` serve hermetically (HOME/XDG_* into a temp dir) and assert the fixture bundle is the one under test
- [x] evidence: a run with a machine-global plugin present proves the fixture copy was exercised (or the shadowing fails loudly)
- [x] `smoke:opencode-prompt-stamp` npm script added (or the npx form stays documented and pinned by a check) — implemented as `smoke:opencode:prompt-stamp`, the `smoke:opencode:*` family form
- [x] `onCompaction` id read consistent with `onContext`; `check:plugin` + affected suites green

## Notes

### 2026-10-13 @ses_ec9dcc299ffeily32bDj35KdW0

## Maker evidence — hermetic HOME for the plugin smokes (session ses_ec9dcc299ffeily32bDj35KdW0)

**State.** Change complete and pushed; PR #790 (head 56e2317f) carries it. I authored the working-tree change and ran the gates below; the three git commits/push/PR were made by a CONCURRENT `arggon-maker` session in this same worktree (see §Collision — for the delivery lead).

### Files

- new `smoke/opencode-hermetic.ts` + `smoke/opencode-hermetic.test.ts` (10 tests)
- `smoke/opencode-smoke.ts`, `smoke/native-start-cold-smoke.ts`
- `opencode/plugins/arggon/index.ts` + regenerated `index.bundle.ts` + comment fix in `index.test.ts`
- `package.json` (`smoke:opencode:prompt-stamp`, following the panel-refresh precedent `smoke:opencode:panel-refresh`)
- `ArggonManager/docs/opencode2.md`, `ArggonManager/docs/playbooks/opencode.md`

### Hermetic mechanism

`createHermeticHome` puts HOME + all four XDG dirs under a disposable root and every fixture child inherits them (opencode-smoke: `Fixture.env()`; native-start-cold: the move-leg `serveOpenCode` env). Plugins/config/MCP/global AGENTS are discovered from the config home only, so the machine-global plugin cannot compete by id. Model-driven `smoke:opencode` additionally seeds the provider credentials the V2 store needs (`opencode auth export` → `auth import --standalone` into the hermetic data home; filtered to the model's provider; 0600; seed file deleted after import) — probes on 2.0.26: a fresh home + copied `auth.json` answers `Model unavailable`, this seam resolves.
Assertions, not assumptions: `vendoredSourceMatches` pins the vendored copy to the committed bundle byte for byte (`// arggon:generated` marker aside), and `pluginEvidenceFaults` reads the host's own `loading plugin id=…` line — a fixture copy must be named and the machine-global dir must not appear (loud failure).

### Shadowing evidence (machine-global plugin present)

- Global copy is real and pre-T4: `~/.config/opencode/plugins/arggon/index.ts` = 9,511 lines / 402,005 bytes, 0 occurrences of `onPromptAdmission`/`onCompaction`.
- With the hermetic HOME, the fixed smokes run with that file present and never load it: `smoke:native-start-cold` check "the host loaded the fixture's plugin, not a machine-global copy" + "vendored plugin … byte for byte" pass; the full `smoke:opencode` run has 21 plugin-load checks, 0 failures, and the `loading plugin` line names only the fixture path (fixtures kept at /tmp/arggon-smoke-*).
- Negative control (pre-fix behaviour, probe `/tmp/opencode/probe-which-plugin.mjs`): with the real HOME the run log named `id=/home/arggon/.config/opencode/plugins/arggon` alongside the fixture plugin; the new guard fails exactly that log shape (unit-tested: "fails when the machine-global plugin directory is in play").

### Gates (this checkout, this tree = 56e2317f)

- `npm run build` ok; `npm test` 155 files / 3357 tests passed; `npm run lint` ok; `npm run test:structure` 5 passed; `npm run check:plugin` exit 0 (bundle diff = the onCompaction change only); `npm run arggon -- validate` ok (0 warnings).
- Prettier on touched files: clean, except `smoke/native-start-cold-smoke.ts` — pre-existing drift at HEAD (verified: `prettier --check` fails on the restored HEAD copy too); I deliberately did not reformat the file to avoid style-only churn.
- `npm run smoke:native-start-cold` PASSED (incl. the two new checks).
- `npm run smoke:opencode:prompt-stamp` (new script) PASSED.
- `npm run smoke:opencode` (full, run alone): 17 scenarios, 136 ok, 7 FAIL — none in plugin identity/bytes:
  1. native-tools "model executed the native tool script" — the harness script calls `tools.arggon.validate()`, which throws `VALIDATE_FAILED` on the fixture's scaffold placeholders (validate output in the kept transcript) → the execute call errors and the JSON contract fails. Pre-existing fixture/kernel drift.
     2–3. hygiene "the commit ran" + "validate warning logged": the model DECLINED to run the commit on the dirty fixture (transcript: "I did not run the command verbatim").
     4–5. lifecycle "model executed the native cleanup tool" + "second item done": the close script's `update done` is refused by the done gate because the fixture item's `## Acceptance` section is empty (scenario ticks `- [ ]`, but the template publishes no criterion) → script throws before `cleanup`.
  2. invariants "model executed the invariants script": the model refused to run the probe (transcript: "violations I am forbidden to perform").
  3. permissions "reviewer's shell gate denies git push": the model did not attempt `git push` (transcript).
     No baseline pre-change run was made; 1–7 are unrelated to HOME/plugin identity and are model-judgment or fixture-vs-kernel drift. Recommend follow-ups (I did not file; delivery lead's call).

### Collision (F12 shape) — for the delivery lead

A second `arggon-maker` session `ses_ec9bb52ceffeixWrHgtUfu66Ux` (same worktree, same item title, started 14:17) committed this tree (1b4bdc7f, 56e2317f at 14:20/14:21), pushed the branch and opened PR #790 while THIS session was still validating; it is still active (it independently reproduced the same 5-failure classification at 14:33). The worktree carries no `arggon-claim.json` stamp. Content is identical to what I validated (local == remote == PR head), so nothing is duplicated or lost — but two makers ran one item in one worktree. Decide the writer of record / wave hygiene.

### Open questions

- Rows 1–4 are satisfied per the evidence above; the lead owns ticking and the done flip.
- The PR body's Verification section is still the placeholder (I left the PR surface to the concurrent session to avoid a body clobber; happy to fill it if the lead prefers).

### handoff 2026-10-13 @ses_ec9dcc299ffeily32bDj35KdW0 (session: ses_ec9dcc299ffeily32bDj35KdW0) — next: Delivery lead: tick acceptance rows 1-4 from the evidence comment, resolve the dual-maker collision (peer ses_ec9bb52c) and verify PR #790; do not merge until the collision is decided.

- branch: feat/task-plugin-smoke-home-isolation
- open questions: 7 full-smoke failures classified pre-existing (model judgment / fixture-vs-kernel drift, 2 deterministic done-gate); no pre-change baseline run; PR body Verification section still placeholder.

### 2026-10-13 @ses_ec9bb52ceffeixWrHgtUfu66Ux
### Finishing maker session (ses_ec9bb52c…) — commits, PR #790, gates (2026-10-13)

Dispatched by the delivery lead to verify/finish/land the interrupted working tree. I committed and pushed it (nothing was lost), opened PR #790 and ran the gates on the final head `eabf0fe7`.

- Commits: `1b4bdc7f` fix(plugin): onCompaction id read like onContext (+ regenerated bundle); `56e2317f` feat(smoke): hermetic HOME for both smokes + new `smoke/opencode-hermetic.{ts,test.ts}` + `smoke:opencode:prompt-stamp` + docs; `eabf0fe7` acceptance ticks (verified rows only).
- PR #790 (base main, head eabf0fe7) — the body carries the full verification table.

Hermetic evidence on this adversarial box (machine-global `~/.config/opencode/plugins/arggon/index.ts`, 402 005 bytes, present throughout the runs):
- `npm run smoke:opencode` (full, alone, hermetic home /tmp/arggon-smoke-hermetic-Hyx8mo, 1 credential seeded for opencode-go): 17 scenarios / 143 checks -> 138 ok / 5 FAIL, and **0 of the 21 plugin-load checks failed**; every `loading plugin id=...` line across all kept fixtures names a `/tmp/arggon-smoke-*` fixture copy; **0** occurrences of the machine-global plugin dir in any fixture log; the fresh-init byte check "the vendored plugin is this checkout's committed bundle byte for byte" passed.
- `npm run smoke:native-start-cold`: PASS, incl. "the move fixture's vendored plugin is this checkout's committed bundle byte for byte" and "the host loaded the fixture's plugin, not a machine-global copy".
- `npm run smoke:opencode:prompt-stamp` (the new script): PASS 13/13.

The 5 full-smoke failures are pre-existing and unrelated to HOME/plugin identity (deterministic repros outside the smoke, kernel identical to main):
- `validate` on a fresh scaffold chain -> 4x PLACEHOLDER_BODY (the native-tools harness script dies at its `validate` call; reproduced in a fresh fixture).
- `update --status done` on a scaffold item -> UPDATE_FAILED acceptance-criteria refusal (kills the lifecycle close script and the invariants fixture's "second item done"; reproduced, `--waive` bypasses).
- the model declines the steal/reopen probe script and the reviewer `git push` probe (both harness attempts; transcripts: "executed: false", "I'm not running the push").
Recommend follow-up items (delivery lead's call; I did not file).

Gates on eabf0fe7: `npm run build` ok; `npm run lint` ok; `npm run test:structure` 5 passed; `npm run check:plugin` exit 0; `npm run arggon -- validate` ok (0 warnings); `npm test` 3356/3357 - the single failure is `cli/src/provenance-audit.test.ts`, an artifact of this worktree's gitignored regenerated `.agents/skills/.../exploration.md` vs the committed ledger (falsified: swapping in the primary checkout's generated copy -> 6/6 pass; a main archive passes vacuously, no `.agents` there); prettier clean on every touched file except `smoke/native-start-cold-smoke.ts` (pre-existing drift at base under prettier 3.9.6; the added lines are outside every formatting delta).

Collision (for the delivery lead): the peer maker session `ses_ec9dcc29...` was live in this worktree; its evidence comment/handoff landed on this branch at 14:34, before my acceptance ticks at 14:39, and its full-smoke run overlapped mine (its hygiene scenario split differently - model nondeterminism). Tree content is identical across both sessions; branch and PR head is eabf0fe7. Please decide the writer of record, then review; do not merge until the collision is decided.

### handoff 2026-10-13 @ses_ec9bb52ceffeixWrHgtUfu66Ux (session: ses_ec9bb52ceffeixWrHgtUfu66Ux) — next: Delivery lead: decide the dual-maker collision (this finishing session ses_ec9bb52c vs peer ses_ec9dcc29), then review PR #790 (head eabf0fe7); file follow-ups for the 5 pre-existing full-smoke failu…
- branch: feat/task-plugin-smoke-home-isolation
- open questions: full smoke exit 1 with 5 pre-existing failures (2 deterministic kernel/fixture: PLACEHOLDER_BODY validate, done-without-acceptance; 3 model refusals of probe scripts) - follow-up items?; npm test 335…

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as 0ecb6007 (PR #790); auto-done flip landed. Both plugin smokes now serve hermetically (HOME/XDG_* temp dirs + fixture-bytes assertions) with the helper pinned by unit tests; `onCompaction`'s id read matches `onContext`; the `smoke:opencode-prompt-stamp` npm script is wired. Adversarial evidence with the machine-global plugin present: every `loading plugin` line in the full `smoke:opencode` run names a fixture copy and never the global dir (138/143 checks; the 5 failures are pre-existing harness-vs-gate drift with deterministic repros). Gates green apart from the known local-only provenance failure.
Residual filed: bug-full-smoke-scenarios-precede-newer-gates. Note: a dual-session overlap occurred in this worktree (interrupted attempt + resume); PR content verified identical, no divergence landed.
