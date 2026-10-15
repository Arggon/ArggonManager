---
type: bug
status: in_progress
id: bug-prover-agent-has-no-x-generated-entry
title: "`.opencode/agents/arggon-prover.md` is committed with NO `x-generated` entry, so `init` classifies it adopter-modified and skips it — invisible to both seam gates"
assignee: arggon-delivery-lead
branch: fix/bug-prover-agent-has-no-x-generated-entry
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, hygiene]
created: "2026-10-03"
updated: "2026-10-15"
claimed_at: "2026-10-15T12:11:30.190Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-prover-agent-has-no-x-generated-entry
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-prover-agent-has-no-x-generated-entry.md
  Leaves live only under a story. id is the filename stem: bug-prover-agent-has-no-x-generated-entry.
  CLI `arggon create bug prover-agent-has-no-x-generated-entry` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `.opencode/agents/arggon-prover.md` is committed with NO `x-generated` entry, so `init` classifies it adopter-modified and skips it — invisible to both seam gates

## Context

Found by the worker on PR #607 (bug-seam-drift-gate-blocks-new-generated-seam-content), 2026-10-03, while making the seam drift gate branch-aware. Independently confirmed twice: the reviewer of PR #606 also identified this exact file as the live example of the no-provenance-state case it had to fix classification for.

**The gap.** `.opencode/agents/arggon-prover.md` exists in the tree but has **no `x-generated` entry** in `ArggonManager/.convention.yml` — it was added after v0.5.0 (by d0aba5ef / #583) without a regenerated state file. So:

- `arggon init` classifies it **adopter-modified** and skips it. If its template ever drifts, nobody is told.
- The seam drift gate cannot see it either: it compares committed bytes against what the generator produces, and this file is in the skipped set, so it is neither verified nor reported.

This is a genuine blind spot in BOTH enforcement layers: the file is unverified and unreported, and it looks like ordinary committed content. Note the irony — it is also the one file that PR #606's classification fix was _proven against_ (a present dest with no provenance state must be `adopter-edited`, not `stale`), so the bug that made it invisible is the same bug that class caught.

Two possible remedies, and the choice is not obvious: (a) run a full seam regeneration and commit the resulting state entry, accepting the known 15-stamp drift sweep; or (b) make the gates report "a committed file under a managed path has no provenance entry" as a finding, which would catch the whole CLASS rather than this instance — the same false-absence lint shape the capability matrix adopted for gap notes.

## Acceptance

- [ ] One remedy is chosen and the reason recorded: (a) run a full seam regeneration and commit the resulting state entry, or (b) make the gates report a committed file under a managed path with no provenance entry as a finding
- [ ] If (a), the regenerated state entry lands with the known 15-stamp drift sweep accepted and explained; if (b), the finding catches the whole class, not just this file
- [ ] Both enforcement layers cover the file afterwards: `arggon init` no longer silently skips it and the seam drift gate verifies or reports it
- [ ] A regression test pins a committed file under a managed path with no provenance entry as reported, never silently skipped; `arggon validate` green, prettier clean

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the worker on PR #607 (bug-seam-drift-gate-blocks-new-generated-seam-content), 2026-10-03, while making the seam drift gate branch-aware. Independently confirmed twice: the reviewer of PR #606 also identified this exact file as the live example of the no-provenance-state case it had to fix classification for.

**The gap.** `.opencode/agents/arggon-prover.md` exists in the tree but has **no `x-generated` entry** in `ArggonManager/.convention.yml` — it was added after v0.5.0 (by d0aba5ef / #583) without a regenerated state file. So:

- `arggon init` classifies it **adopter-modified** and skips it. If its template ever drifts, nobody is told.
- The seam drift gate cannot see it either: it compares committed bytes against what the generator produces, and this file is in the skipped set, so it is neither verified nor reported.

This is a genuine blind spot in BOTH enforcement layers: the file is unverified and unreported, and it looks like ordinary committed content. Note the irony worth recording — it is also the one file that PR #606's classification fix was _proven against_ (a present dest with no provenance state must be `adopter-edited`, not `stale`), so the bug that made it invisible is the same bug that class caught.

Two possible remedies, and the choice is not obvious: (a) run a full seam regeneration and commit the resulting state entry, accepting the known 15-stamp drift sweep; or (b) make the gates report "a committed file under a managed path has no provenance entry" as a finding, which would catch the whole CLASS rather than this instance — the same false-absence lint shape the capability matrix adopted for gap notes.

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
Premise update (2026-10-15, delivery lead): the specific file is gone — `.opencode/agents/arggon-prover.md` was dropped by 40292f97 ("chore(seam): drop the stranded arggon-prover.md from this repo's own seam"), and the role now ships as `arggon-verifier.md` with its `x-generated` row and template. So remedy (a) (regenerate the state entry for the prover file) is moot, and the item's real remaining deliverable is remedy **(b): make the gates report a committed file under a managed path with no provenance entry as a finding — the whole class**, which is what this item's own reasoning prefers ("the same false-absence lint shape the capability matrix adopted"). The class gap is live: a no-row file under a managed path is classified adopter-edited and skipped, invisible to the provenance audit. Keep open; queued for a following wave with remedy (b) as the chosen route.

### 2026-10-15 @Arggon
Evidence — remedy (b), PR #839 (`fix/bug-prover-agent-has-no-x-generated-entry`).

**Chosen surfaces (recorded):** the audit (`auditGeneratedProvenance`, kind `unprovenanced`) + `arggon init`'s report (additive `unprovenanced[]` on the run and `--dry-run`, plus one human line per file) + `arggon doctor` (`docs.unprovenanced` / `docs.unprovenancedDocs` + hint). Why both report layers: init is where the silent skip happened, doctor is the standing report-only surface, and the audit is the gate a template edit cannot skip.

**The finding's shape:** a file whose own bytes claim arggon provenance (visible marker `arggon:generated template="…"` as first line, or first line inside frontmatter) but which has NO `x-generated` entry. Independent of the current-destination walk, so a stranded file whose template left the install (the prover shape: marker, no row, template gone) is reported. A marker-less no-row file is the sanctioned pre-provenance adopter file and is deliberately silent — a pure path check would false-positive on this repo's own five adopter-owned no-row destinations (`AGENTS.md`, `.gitignore`, `CONTRIBUTING.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/engineering.md`), verified before choosing the marker boundary.

**Clean-tree evidence (expected vs observed):**
- `auditGeneratedProvenance` against this checkout (repo-self test): expected `[]`, observed `[]` — every marker-bearing committed file carries a row.
- Whole-tree probe, marker-anchored, all files: expected 0, observed 0 marker files with no row.
- `npm run arggon -- init --no-commit --json` on this tree: expected no unprovenanced rows / no writes, observed `unprovenanced: []`, `created: []`, `reaped: []`; only `ArggonManager/.convention.yml` dirtied (`generatedAt` refresh, the CI drift gate's excluded path) — restored with `git checkout --` before commit.
- `npm run arggon -- doctor` on this tree: no unprovenanced hint.

**Regression tests (reported, never silently skipped):**
- `cli/src/provenance-audit.test.ts`: 17/17 — the stranded prover shape reports `unprovenanced`; nested namespace + HTML/frontmatter marker shapes; adopter-owned no-marker file silent; marker file WITH a row silent even when bytes diverge; row dropped + bytes diverged reports; marker-reader anchoring (CRLF/BOM, body phrase not provenance). Repo-self test stays `[]`.
- `cli/src/init-docs.test.ts`: 60/60 — run + dry run report the row, the file is byte-identical after the run, CLI `--json` envelope and human output carry it, clean scaffold and adopter file report nothing.
- `cli/src/doctor.test.ts`: 60/60 — count/name/hint, report-only (state file untouched), clean scaffold silent. `cli/src/eol-provenance.test.ts` docs-object assertions extended.

**Gates (worktree, all green):** `npm run arggon -- validate` ok; focused provenance-audit + init + doctor + eol tests pass; `npm test` 160 files / 3537 passed; `npm run lint` clean; `npm run test:structure` 5/5; `npx prettier --check` on every touched file clean. One load-induced flake observed once in `cli/src/prose-format.test.ts` (prettier spawn timeout under parallel load — passes in isolation and in the green full run; unrelated to this diff).

**Files:** `cli/src/docs.ts` (reader + class scan + audit kind), `cli/src/init.ts`, `cli/src/doctor.ts`, `cli/src/cli.ts` (JSON envelope + human print; kept minimal — sibling branch edits this file), tests in `provenance-audit` / `init-docs` / `doctor` / `eol-provenance`.

### handoff 2026-10-15 @Arggon — next: Standards review of PR #839, then merge; completion is the delivery lead's call (item not flipped to done)
- branch: fix/bug-prover-agent-has-no-x-generated-entry
- open questions: Marker-vs-path boundary: a marker-less generated file (JSON destinations carry no marker) under a managed path with no row is still invisible — out of scope here; cli.ts carries a small additive edit…

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead review + merge verification — 2026-10-15 (delivery lead)
Merged as 507447c3 (PR #839). Remedy **(b)** shipped as the whole class: the finding is a file whose OWN bytes carry the visible provenance marker (anchored exactly as the stamp writes it — first line, or first line inside frontmatter; CRLF/BOM tolerated) but which has no `x-generated` entry — the false absence. That marker boundary is the key design call: a marker-less no-row file is the sanctioned pre-provenance adopter file and stays silent (a pure path check would false-positive on five adopter-owned no-row destinations in this repo — verified before choosing). The managed-path walk covers current destinations + every ledger-recorded destination + namespace directories, so a stranded sibling whose template left the install (the prover shape) is still seen; bounded (5000 files / 8 KiB head) and pure.

Surfaces (recorded): the seam drift gate (`auditGeneratedProvenance` gains the `unprovenanced` kind), `arggon init` (additive `unprovenanced[]` + one human line; the file is never written), and `arggon doctor` (`docs.unprovenanced`). Clean-tree evidence: repo-self audit `[]`, whole-tree marker probe 0, `init --no-commit` reports `unprovenanced: []`. Tests: provenance-audit +130, init-docs +73, doctor +72; full suite 3537 green; CI green on the refreshed head. Recorded open question (out of scope): marker-less generated JSON destinations with no row remain invisible — noted on the item.
