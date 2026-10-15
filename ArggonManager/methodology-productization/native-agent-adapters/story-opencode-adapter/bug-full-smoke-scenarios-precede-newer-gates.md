---
type: bug
status: done
id: bug-full-smoke-scenarios-precede-newer-gates
title: "5 full-smoke checks fail on main: scenarios predate the placeholder-body and done-gate rules"
assignee: arggon-delivery-lead
branch: fix/bug-full-smoke-scenarios-precede-newer-gates
parent: story-opencode-adapter
labels: [opencode-seam, tests]
created: "2026-10-13"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/bug-full-smoke-scenarios-precede-newer-gates.md
  Leaves live only under a story. id is the filename stem: bug-full-smoke-scenarios-precede-newer-gates.
  CLI `arggon create bug full-smoke-scenarios-precede-newer-gates` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# 5 full-smoke checks fail on main: scenarios predate the placeholder-body and done-gate rules

## Context

Found by the full `npm run smoke:opencode` run recorded on `task-plugin-smoke-home-isolation` (PR #790, merged): 17 scenarios / 143 checks → **138 ok, 5 FAIL**, with **0** plugin-load failures (the hermetic-HOME work landed cleanly; every `loading plugin id=...` line names a fixture copy, never the machine-global `~/.config/opencode/plugins/arggon`). The 5 failures are pre-existing on main — deterministic repros with the kernel identical to main pinned them:

1. `validate` → 4× `PLACEHOLDER_BODY` on fresh scaffold items: the native-tools script scenario creates items and validates them, but scaffold items now carry the placeholder markers the newer validate gate refuses — the scenario (and its fixture items) predate that gate.
2. `update --status done` → acceptance-criteria refusal: the lifecycle-close scenario flips items done without live acceptance criteria, which the done gate now refuses — it kills lifecycle close and the invariants "second item done" check.
3. The model **declined** the steal/reopen and `git push` probes in both harness attempts (model nondeterminism — the harness reports a decline the same way it would report a gate refusal, so the discrimination is lost).

These are harness-vs-kernel drift, not product regressions: the smoke scenarios must either satisfy the newer gates (real bodies/acceptance in fixtures) or assert the refusals as the expected path, and the probe scenarios need to distinguish "model declined" from "gate refused".

## Acceptance

- [x] `npm run smoke:opencode` on a quiet machine reaches 143/143, or every remaining failure is reclassified with evidence (model nondeterminism documented as such, never summarized as a pass) — final run on `36225d2d`: 158 ok / 0 FAIL (see evidence comment; 158 is the green run's executed-check count, up from the failing run's 143)
- [x] the fresh-scaffold scenarios create items that satisfy the `PLACEHOLDER_BODY` gate (real context/acceptance prose) rather than tripping it
- [x] the lifecycle-close scenario's items carry acceptance criteria, or the scenario asserts the refusal as the expected path
- [x] the steal/reopen/`git push` probes distinguish "model declined" from "gate refused" and report the discrimination, or are made deterministic — the probes attempt the writes (readiness requires them) and the refusal checks passed non-vacuously; the decline branch is unit-pinned but was not needed on the final run
- [x] the run's expected-vs-observed evidence recorded on the item; `arggon validate` green; PR opened

## Notes

### 2026-10-14 @ses_ec60f45b9ffe3ffeIyT88O1JN9
## Full smoke run — final evidence (head 36225d2d, branch fix/bug-full-smoke-scenarios-precede-newer-gates)

**command**: `npm run smoke:opencode` (bare, alone on the machine; hermetic HOME `/tmp/arggon-smoke-hermetic-cUeXDT`)
**expected**: 17 scenario groups green on the model-driven harness; exit 0
**observed**: `smoke:opencode passed — 27 scenarios, 0 failures` — **158 ok / 0 FAIL**, model `opencode-go/deepseek-v4.1-flash`
**exit**: 0 (the `passed` line is emitted only on the zero-failure path of `main()`)
**transcript**: `/tmp/opencode/full-smoke-final.log` (machine-local; 9589 bytes)

### Per-scenario summary (ok / FAIL)

| scenario | ok | FAIL |
| --- | --- | --- |
| fresh init | 12 | 0 |
| adopter config | 5 | 0 |
| never clobber | 6 | 0 |
| failure isolation | 4 | 0 |
| plugin absent | 4 | 0 |
| native tools (W3) | 13 | 0 |
| commands (W3, 11 sessions) | 33 | 0 |
| context: branch | 7 | 0 |
| context: storage map | 6 | 0 |
| context: env override | 4 | 0 |
| context: silent | 4 | 0 |
| context: outside trees | 4 | 0 |
| hygiene | 3 | 0 |
| worktree lifecycle (W4) | 19 | 0 |
| invariants (W4) | 12 | 0 |
| permissions (W4 reviewer) | 11 | 0 |
| permissions (verifier) | 11 | 0 |
| **total** | **158** | **0** |

### Reclassifications

**None were needed** — every check passed on its gate-refusal/positive path. Specifically:
- verifier: update/create/comment were actually attempted (the probe readiness requires them) and refused; the item re-read shows no write landed. The refusal checks are non-vacuous.
- invariants: the kernel refused the steal through both `update` and `start`, and the reopen of a done item — real refusals.
- permissions: the reviewer's `git push` was denied by the shell gate (the local bare origin made it a real push, not a missing remote).
- hygiene: the model ran the commit and the validate warning was logged; the decline path was not hit.
The decline/inconclusive discrimination (`attemptedCode` + retry + distinct check names) is in place and unit-pinned (31/31); the final run did not exercise the decline branch.

### Additional harness fix on this head (beyond the three scenario commits)

`36225d2d` — the provider retired `opencode-go/deepseek-v4-flash`. The first full attempt on `595f8735` passed scenario 1, then every subsequent session died before any model output; the fixture transcript carries `provider.no-route: Model unavailable: opencode-go/deepseek-v4-flash` verbatim. The committed default is now `opencode-go/deepseek-v4.1-flash` (same family, still a pinned small model; `OPENCODE_SMOKE_MODEL` override untouched). Focused `OPENCODE_SMOKE_ONLY=verifier-permissions` probe on the successor: 11/11 ok before the full run.

**Finding, not fixed here (out of this item's surface)**: `smoke/opencode-wave.ts:96` pins the same retired `opencode-go/deepseek-v4-flash` default — the delivery lead should route a follow-up.

### Does NOT prove

- Only these 17 scenario groups; no claim outside them (no W1/W2 surface, no real GitHub flows — those stay typed-error assertions).
- One green run is one sample of a nondeterministic model-driven system: the refusals observed are real for this run, not a determinism guarantee; the inconclusive paths bound that uncertainty but do not remove it.
- CI does not run this harness (no `opencode` binary); this evidence is local to this machine.
- The acceptance row quotes 143/143; the green run executes 158 checks. 143 was the *failing* run's executed count — failure short-circuits skip conditional/loop checks (145 static `check(` call sites expand to 158 executions when all paths run). Not a changed expectation; the harness prints no fixed denominator.

### Other gates on the same head

- `npm run build` → exit 0 (48 modules inlined, bundle rebuilt byte-identical; no diff after)
- `npx vitest run smoke/opencode-smoke.test.ts` → 31/31
- `npm run smoke:native-start-cold` → passed
- `npm test` → 156 files / 3382 tests passed
- `npm run lint` → exit 0
- `npm run test:structure` → 5 passed
- `npm run arggon -- validate` → ok (0 warnings, convention v5)
- `npx prettier --check smoke/opencode-smoke.ts smoke/opencode-smoke.test.ts` → clean

### handoff 2026-10-14 @ses_ec60f45b9ffe3ffeIyT88O1JN9 (session: ses_ec60f45b9ffe3ffeIyT88O1JN9) — next: Delivery lead: review PR #799 at head 36225d2d — full smoke 158/158 green, all gates green; merge and complete the item.
- branch: fix/bug-full-smoke-scenarios-precede-newer-gates
- open questions: smoke/opencode-wave.ts:96 pins the same retired opencode-go/deepseek-v4-flash — route a follow-up; executed-check denominator drift (143 failing run → 158 green) documented in the evidence comment

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-14 (delivery lead)
Merged as 59d61d94 (PR #799); auto-done flip landed (all five rows ticked by the maker against its evidence). The five harness-vs-kernel failures are fixed scenario-side with no product gate weakened: fixtures carry real live Context/Acceptance prose (scaffold markers replaced), the lifecycle close ticks the criterion the fixture publishes, and `probeWithRetry` + `attemptedCode` distinguish "model declined" (INCONCLUSIVE, a distinct check) from a gate refusal. Final full `npm run smoke:opencode` run alone on the head: **158 checks, 0 failures** (27 scenarios; the 143→158 delta is committed denominator drift — the green run executes conditional/loop checks, documented in the evidence comment). The run also caught and fixed a second blocker: the provider retired `opencode-go/deepseek-v4-flash`; the smokes now pin the canaried successor `opencode-go/deepseek-v4.1-flash`. Gates green: full suite 3,382, native-start-cold, focused 31/31, lint/structure/validate/prettier.
Follow-up filed: bug-wave-smoke-retired-model-pin (the wave script still pins the retired model — same class, next occurrence).
