---
type: task
status: done
id: task-env-contract-start
title: Implement the worktree env contract in start (spec worktree-env-contract-016)
assignee: Arggon
branch: feat/task-env-contract-start
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [kernel, cli, worktree]
created: "2026-10-01"
updated: "2026-10-02"
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

- [x] Every acceptance box in `spec-worktree-env-contract-016` is ticked — those ten verifiable boxes are the contract for this task (kernel unit tests, never-overwrite, seed-only-if-absent, per-OS dirs, additive receipt on both surfaces, env files never committed, `x-worktree.env: false` opt-out, init gitignore, docs same PR, tests/smoke green).
- [x] PR references this item id and the spec id; impact class **Behavioral** stated in the PR (ADR 0016) — new receipt field + convention key.
- [x] Coordinator review verdict recorded on this item before merge. (2026-10-01: approve — reviewer traced all ten boxes to named tests/smoke legs; rulings recorded: attach written:false accepted, Windows co-location accepted, cleanup env-reap caveat documented.)

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

### 2026-10-01 @ses_f0697a26fffelQHzQVRfDPIlHe
Change requests landed on PR #566 (pushed to the same branch, dd9b595e..58bfce5c; item stays in_progress — not done).

FIX 1 — seed-warning drop (lib/src/worktree.ts):
(a) fresh-write success return now carries ...(warnings.length > 0 ? { warning: warnings.join("; ") } : {}) — a failed .env seed after a successful .arggon.env write surfaces as written:true + warning "could not seed .env: …".
(b) attach (and the EEXIST race) returns build the warning as [...warnings, "already exists — left byte-identical (never overwritten)"].join("; ") — seed failures no longer discarded.
Test: "surfaces seed failures as a receipt warning on every path" — deterministic root-proof repro via a broken symlink at <worktree>/.env (existsSync false, COPYFILE_EXCL fails EEXIST); asserts fresh written:true + warning, attach written:false + warning containing BOTH "could not seed .env" and "byte-identical".

FIX 2 — reconciled with main (merged origin/main cleanly, c71f842e; #564 pattern doc):
- docs/worktree-services.md table: .arggon.env six keys / .env seed+dirs / preparation.env+opt-out rows Promised -> Shipped ("**this PR**", PR #566); NEW row "cleanup --prune reaping of a start-created .arggon.env (contract-shape ownership) — Shipped (this PR)"; "Promised means…" paragraph replaced with the Shipped-this-PR/release-caution wording; stale "after the env contract ships" snippets updated.
- NEW "Env contract receipt and lifecycle notes" section in the pattern doc: attach written:false semantics per ruling (a); Windows %LOCALAPPDATA% co-location per ruling (b) (isolation = per-worktree uniqueness, unaffected); seed-failures-never-vanish; cleanup reap with STRICT ownership (every line a six-set KEY=value; comments/extra keys/symlinks left) and the reviewer caveat stated plainly: value-only edits of a contract-shaped file ARE reaped — do not park data in .arggon.env.
- Spec 016 errata blockquote: the three-case written:false list is incomplete, not contradicted — attach is the fourth case; rulings (a) and (b) encoded.

FIX 3 — rulings encoded as docs text: (a) in the spec errata + pattern-doc receipt note ("written means this run created the file" — matches the kernel doc comment verbatim); (b) in the spec errata + pattern-doc note line.

GATES (post-fix, on the pushed head): npm test 2068/2068 green; lint clean; build green; check:plugin green (regen committed separately 58bfce5c); smoke:native-start-cold 47/47 with all 5 env legs; npm run arggon -- validate ok:true (pre-commit gate on both commits).

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Final verdict: approve — reviewer PASS 10/10 spec boxes with per-box trace-to-test; rulings encoded in docs: attach `written:false` ACCEPTED (written = this run created the file; spec errata marks the 3-case list incomplete + adds the attach case); Windows state/cache co-location ACCEPTED as documented (isolation = per-worktree uniqueness); cleanup env-reap shipped with the reviewer's caveat stated plainly in the pattern doc (value-only edits of a contract-shaped file ARE reaped); the seed-warning drop fixed + tested (never-silent invariant restored). Merged: PR #566 squash -> main (f2117c06; CI green on the reconciled head; smoke 47/47 incl. the 5 env legs + the env-free claim-commit leg). Item done. Follow-ups: task-cleanup-declared-services unblocked; pattern-doc table reconciled in-PR.
