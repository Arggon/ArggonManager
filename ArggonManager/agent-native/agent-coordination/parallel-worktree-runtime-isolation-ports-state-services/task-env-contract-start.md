---
type: task
status: in_progress
id: task-env-contract-start
title: Implement the worktree env contract in start (spec worktree-env-contract-016)
assignee: Arggon
branch: feat/task-env-contract-start
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [kernel, cli, worktree]
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T21:39:37.961Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-env-contract-start
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-env-contract-start.md
  Leaves live only under a story. id is the filename stem: task-env-contract-start.
  CLI `arggon create task env-contract-start` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Implement the worktree env contract in start (spec worktree-env-contract-016)

## Context

Implements layer 1 of [ADR 0019](../../../../docs/adr/0019-worktree-runtime-isolation.md):
`start --worktree` (CLI + native `tools.arggon.start`) writes the gitignored
`.arggon.env` (six documented keys incl. `ARGON_ITEM` for plugin correlation),
seeds `.env` copy-if-absent, creates the per-OS suffixed state/cache dirs, and
reports the additive `preparation.env` receipt field. The contract is
filesystem-only and portable (linux/macos/windows), best-effort by design —
it never blocks the claim. The reviewable contract is
`ArggonManager/docs/specs/spec-worktree-env-contract-016.md`; the breakdown is
`ArggonManager/docs/plans/plan-worktree-env-contract-016.md` (T1–T4).

## Acceptance

- [ ] Every acceptance box in `spec-worktree-env-contract-016` is ticked — those ten verifiable boxes are the contract for this task (kernel unit tests, never-overwrite, seed-only-if-absent, per-OS dirs, additive receipt on both surfaces, env files never committed, `x-worktree.env: false` opt-out, init gitignore, docs same PR, tests/smoke green).
- [ ] PR references this item id and the spec id; impact class **Behavioral** stated in the PR (ADR 0016) — new receipt field + convention key.
- [ ] Coordinator review verdict recorded on this item before merge.

## Notes

### 2026-10-01 @ses_f0697a26fffelQHzQVRfDPIlHe
Implemented spec-worktree-env-contract-016 in start. PR: https://github.com/Arggon/ArggonManager/pull/566 (draft, NOT merged). Branch: feat/task-env-contract-start.

PER-BOX EVIDENCE (all ten ticked in the spec file):
1. Fresh six-key write — lib/src/worktree.test.ts "writes .arggon.env with exactly the six documented keys" (raw KEY=value, LF, order) + smoke leg.
2. Attach byte-identical — FS-level guarantee (wx open, COPYFILE_EXCL seed); kernel + CLI tests + smoke "the attach re-run leaves .arggon.env byte-identical".
3. .env seed only-if-absent — kernel test (seed / adopter-modified kept / no-primary), receipt seededDotenv.
4. Per-OS dirs exist — kernel test via exported env-paths mapping (env/home injectable); smoke asserts existence + <repo>-<item-id> suffix.
5. preparation.env on both surfaces — CLI envelope additive env (parity test green unchanged, mcp-server spawns CLI); native receipt forwarded bounded (tools.test.ts assertion); json-output.md env row.
6. Never staged/committed — smoke "claim commit stays env-free" on top of the only-the-item-file leg; CLI status check.
7. x-worktree.env: false — parse tests (explicit false only), kernel disabled test, CLI test (claim still lands).
8. init .gitignore — new generated destination templates/docs/gitignore (provenance-managed, created only when missing; adopter .gitignore kept); init test added.
9. Docs — README subsection + cleanup sentence; json-output row+prose (prettier-stable); agents.md §4 subsection; convention.md env bullet; adopter template row.
10. Gates — see below.

GATES: npm test 2067/2067 (one transient fixture-race failure in one run; two subsequent full runs green); lint clean; build green; check:plugin green after the separate "chore: regen plugin bundle" commit (dd9b595e); smoke:native-start-cold 47/47 incl. 5 new env checks; npm run arggon -- validate ok:true (pre-commit gate ran on every commit).

DEVIATIONS/NOTES (also in the PR body — none silent):
- Attach is a fourth written:false case the spec left implicit; receipt reports written:false + warning "already exists — left byte-identical" (+path/gitignored when knowable). Spec bug or intent? Coordinator call; the adopter-services doc should state it.
- Windows: by the spec's env-paths mapping both state and cache bases are %LOCALAPPDATA%, so the two dirs co-locate at %LOCALAPPDATA%/<repo>-<item-id> there. Implemented as spec'd; documented.
- ADDITION beyond the spec: cleanup --prune now reaps a start-created .arggon.env (strict ownership: all lines must be the six KEY=value pairs; adopter-customized files/symlinks left) before git worktree remove — found as a REAL failure (cleanup refused pruning otherwise). The adopter-services pattern doc must mention this.
- No steps-log entries for env (the env fragment is its own channel); NativePrepStep union unchanged.
- Values strip CR/LF (hostile id/branch cannot split the format).
- Spec/plan status fields left "proposed" (flipping is not this task's call).

### handoff 2026-10-01 @ses_f0697a26fffelQHzQVRfDPIlHe (session: ses_f0697a26fffelQHzQVRfDPIlHe) — next: Review PR #566 (draft, do not merge via this task); reconcile the attach written:false shape + the cleanup env-reap addition into the adopter-services pattern doc before it lands.
- branch: main
- open questions: Attach receipt: spec lists 3 written:false cases, attach is a 4th (implemented, flagged); Windows state/cache dirs co-locate by the spec's env-paths mapping — intended?

### handoff 2026-10-01 @ses_f0697a26fffelQHzQVRfDPIlHe (session: ses_f0697a26fffelQHzQVRfDPIlHe) — next: Review PR #566 (draft, do not merge via this task); reconcile the attach written:false shape + the cleanup env-reap addition into the adopter-services pattern doc before it lands.
- branch: feat/task-env-contract-start
- open questions: Attach receipt: spec lists 3 written:false cases, attach is a 4th (implemented, flagged); Windows state/cache dirs co-locate by the spec's env-paths mapping — intended?
