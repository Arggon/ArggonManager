---
type: task
status: done
id: task-adr-0021-supersede-6-2a
title: "Supersede ADR 0021 §6.2a: the product owner directs the agent rename; orphan reaping is the precondition that removes the objection §6.2a was based on"
assignee: arggon-coordinator
branch: feat/task-adr-0021-supersede-6-2a
parent: role-model-foundation
labels: [docs, adr, seam, migration]
priority: p1
created: "2026-10-04"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adr-0021-supersede-6-2a.md
  Leaves live only under a story. id is the filename stem: task-adr-0021-supersede-6-2a.
  CLI `arggon create task adr-0021-supersede-6-2a` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Supersede ADR 0021 §6.2a: the product owner directs the agent rename; orphan reaping is the precondition that removes the objection §6.2a was based on

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §6.2a rejected renaming the shipped agents, on one ground: `init` never
deletes, so a rename leaves each adopter with a **dispatchable orphan** per old
file. The product owner has directed the rename (2026-10-04), so §6.2a is
superseded — but the ground it stood on is real and must be discharged first.

The scope inventory (`task-spec-agent-rename-migration`) shrank the blast radius
and dissolved most of the objection:

- **7 template files** are path-coupled (4 OpenCode, 3 ZCode — no ZCode prover).
- **9 code files** carry string references; the sharpest is
  `templates/docs/zcode/arggon/hooks/gate.mjs:150` — `/(^\|:)arggon-reviewer$/`
  opens the dispatch-scoped read-only window, so a rename that misses the regex
  silently disarms the reviewer backstop. That coupling is security-relevant and
  gets its own test.
- **57 markdown files** carry prose references.
- **The capability matrix needs no change** — its rows are per *client*, not per agent.
- **The orphan problem is already solvable with data we ship**: every generated agent
  destination is recorded in `x-generated` with its `template:` and `checksum`
  (`ArggonManager/.convention.yml:84–96`, `:170–183`), so an orphan is a destination
  whose template is gone. `task-adapter-orphan-reaping` turns that into a
  `doctor` status plus a checksum-guarded reap that never deletes an adopter's edits.

## Acceptance

- [x] §6.2a carries a dated **superseded-by** amendment naming this item; its original text is left as taken (an ADR is superseded, never silently rewritten)
- [x] The amendment states the new ids — `arggon-delivery-lead`, `arggon-standards-reviewer`, `arggon-maker`, `arggon-verifier` — and the naming rule: **the id names the role, never the software title** (§6.2 applied to filenames); `arggon-product-manager` / `arggon-tech-lead` are rejected as ids and kept as non-normative analogues
- [x] The amendment records the orphan precondition explicitly: the rename does not ship before `task-adapter-orphan-reaping`, and reaping is checksum-guarded so an adopter-edited orphan is never deleted
- [x] The amendment records the hook-regex coupling as the migration's sharpest edge, with the obligation to add a test binding the gate's matcher to the shipped reviewer name
- [x] No other clause of §6.1/§6.2/§6.2b changes — the roles, the boundaries and the domain-neutrality clause stand as merged
- [x] `cli/src/adr-index-parity.test.ts` green; the index row stays `Accepted`
- [x] `npx prettier --check` clean; `arggon validate` ok

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: approve

Gates (expected vs observed, in the item worktree):
- `npx prettier --check/--write` on the ADR → clean, no reflow needed
- `npx vitest run cli/src/adr-index-parity.test.ts` → 7 passed (index row untouched, still `Accepted`)
- `arggon validate` → `ok (0 warning(s), convention v5)`
- All four clauses present and ordered: §6.2, §6.2a (now carrying its superseded note, text left as taken), §6.2a′ (the superseding amendment), §6.2b

Not run: `npm test` — one markdown file changed, no code, and the suite that owns
this corpus (`adr-index-parity`) was run directly.
