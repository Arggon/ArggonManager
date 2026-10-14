---
type: bug
status: done
id: bug-wave-smoke-retired-model-pin
title: smoke/opencode-wave.ts still pins the retired opencode-go/deepseek-v4-flash model — same mass failure the full smoke just fixed
assignee: arggon-delivery-lead
branch: fix/bug-wave-smoke-retired-model-pin
parent: story-opencode-adapter
labels: [opencode-seam, tests]
created: "2026-10-14"
updated: "2026-10-14"
worktree_path: /home/arggon/Projects/ArggonManager-bug-wave-smoke-retired-model-pin
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/bug-wave-smoke-retired-model-pin.md
  Leaves live only under a story. id is the filename stem: bug-wave-smoke-retired-model-pin.
  CLI `arggon create bug wave-smoke-retired-model-pin` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# smoke/opencode-wave.ts still pins the retired opencode-go/deepseek-v4-flash model — same mass failure the full smoke just fixed

## Context

Found while landing `bug-full-smoke-scenarios-precede-newer-gates` (PR #799): the provider retired `opencode-go/deepseek-v4-flash`. The full smoke (`smoke/opencode-smoke.ts`) failed en masse until its default pin moved to `opencode-go/deepseek-v4.1-flash` (commit 36225d2d, canaried with the focused verifier probe 11/11). `smoke/opencode-wave.ts:96` still pins the retired model, so the scripted wave smoke will fail the same way until it moves. The two smokes should not drift apart on the model pin again.

## Acceptance

- [x] `smoke/opencode-wave.ts` no longer pins the retired model; the replacement is canaried (a focused run, or the full wave run alone) or the reason it cannot be is documented
- [x] the model pin has one source or a documented reason to differ between `opencode-smoke.ts` and `opencode-wave.ts`
- [x] evidence recorded on the item (command/expected/observed); `arggon validate` green; prettier clean on touched files

## Notes

### 2026-10-14 @ses_ec5ee801affeIpa4kifNI1tFAC
## Evidence — model pin moved off the retired model, one shared source (PR #803, head a10fd6c3)

### Canary (focused, run alone)
**command**: `OPENCODE_SMOKE_ONLY=verifier-permissions npm run smoke:opencode`
**expected**: the shared successor serves; focused verifier probe green
**observed**: `smoke:opencode passed — 1 scenarios, 0 failures` — **11 ok / 0 FAIL**, exit 0, first line `model: opencode-go/deepseek-v4.1-flash` (log `/tmp/opencode/canary-verifier-permissions.log`). Mirrors the predecessor's canary (bug-full-smoke-scenarios-precede-newer-gates, 11/11 on 36225d2d).

**Wave resolution** (the wave script itself must never be imported — `main()` runs on import): `resolveWaveModel({}) = opencode-go/deepseek-v4.1-flash`, `resolveSmokeModel({}) = opencode-go/deepseek-v4.1-flash`, equal → the wave resolves the canaried model.
**Retired literal gone**: `grep deepseek-v4-flash smoke/opencode-smoke.ts smoke/opencode-wave.ts` → none (only `smoke/opencode-model.ts` names the retired id, in history prose).

**Full `npm run smoke:opencode:wave` is NOT run**: it is a model-driven, timing-sensitive chain that must run alone, and other makers are active in this wave window. Deferred to a solo window — it is not part of any deterministic gate, and CI never runs it (no `opencode` binary).

### One source
`smoke/opencode-model.ts` now owns the only pin: `DEFAULT_OPENCODE_MODEL` + `resolveSmokeModel` / `resolveWaveModel`. `opencode-smoke.ts:151` and `opencode-wave.ts:97` both resolve through it — `OPENCODE_SMOKE_MODEL` overrides both, `OPENCODE_WAVE_MODEL` the wave only (precedence unchanged from the wave's previous code).
`smoke/opencode-model.test.ts` (6 tests) pins the shared default, both overrides, and the no-re-pin rule: neither harness may carry its own provider-qualified id (`/["'`]opencode-go\//`).

### Gates on this head
- `npm run build` → exit 0 (48 modules inlined; bundle rebuilt byte-identical, no diff)
- focused `npx vitest run smoke/opencode-model.test.ts smoke/opencode-smoke.test.ts smoke/opencode-hermetic.test.ts` → 47/47
- `npm test` → 157 files / 3388 tests passed (3382 before this item's 6)
- `npm run lint` → exit 0; `npm run test:structure` → 5 passed; `npm run arggon -- validate` → ok (0 warnings)
- `npx prettier --check` on all touched files → clean; `prettier --write` on the playbook leaves the committed bytes unchanged (it is a prose-format REPAIRED_FILE)

### Lesson promoted (second occurrence of the class)
`ArggonManager/docs/playbooks/opencode.md` §Testing: "**One model pin for both harnesses:** `smoke/opencode-model.ts` is the only model id — a retirement is one change plus a canary, never two scripts. — bug-wave-smoke-retired-model-pin".

### Does not prove
- No full wave run on this head (see above); the wave's T12/T13 checks are not exercised by this canary — the pin resolution and provider reachability are.
- One green focused run is one sample of a model-driven system.

### handoff 2026-10-14 @ses_ec5ee801affeIpa4kifNI1tFAC (session: ses_ec5ee801affeIpa4kifNI1tFAC) — next: Review PR #803 (head with evidence commits): wave off the retired pin, one shared source in smoke/opencode-model.ts, focused canary 11/11; merge-commit, no squash; full wave smoke deferred to a solo …
- branch: fix/bug-wave-smoke-retired-model-pin
- open questions: full smoke:opencode:wave not run (model-driven, must run alone, others active) — solo window still owed; CI never runs the model-driven harnesses

### 2026-10-14 @ses_ec5ee801affeIpa4kifNI1tFAC
Precision note on the evidence above: `npx prettier --check` is clean on the authored files (`smoke/opencode-model.ts`, `smoke/opencode-model.test.ts`, `smoke/opencode-smoke.ts`, `smoke/opencode-wave.ts`, `ArggonManager/docs/playbooks/opencode.md`). The tracker item file itself is NOT prettier-formatted — `ArggonManager/<initiative>/…` is deliberately excluded from the prose corpus (`cli/src/prose-format.test.ts` §Scope; item bodies are historical records), and every neighbouring item is equally non-byte-clean. No formatter churn was written into the item.

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-14 (delivery lead)
Merged as fa6fde4c (PR #803); auto-done flip landed. One source of truth for the smoke model: `smoke/opencode-model.ts` (`DEFAULT_OPENCODE_MODEL = opencode-go/deepseek-v4.1-flash`; per-harness env overrides preserved) with 6 unit tests including a no-re-pin rule — neither harness may carry a provider-qualified literal again. Canary: focused verifier probe 11/11 on the successor model; the full wave smoke stays deferred to a solo window (documented — it is not a CI gate). Lesson promoted to `playbooks/opencode.md` per ADR 0027 (second occurrence). Full suite 3,388; CI green.
