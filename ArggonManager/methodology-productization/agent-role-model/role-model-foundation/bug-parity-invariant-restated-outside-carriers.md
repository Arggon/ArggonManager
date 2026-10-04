---
type: bug
status: in_progress
id: bug-parity-invariant-restated-outside-carriers
title: "ADR 0020 §Decision.1 and docs/claim.md:99 still state the superseded parity invariant — live normative text left behind by the carrier wiring"
assignee: arggon-coordinator
branch: fix/bug-parity-invariant-restated-outside-carriers
parent: role-model-foundation
labels: [docs, methodology, roles]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T22:14:38.930Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-parity-invariant-restated-outside-carriers
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-parity-invariant-restated-outside-carriers.md
  Leaves live only under a story. id is the filename stem: bug-parity-invariant-restated-outside-carriers.
  CLI `arggon create bug parity-invariant-restated-outside-carriers` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0020 §Decision.1 and docs/claim.md:99 still state the superseded parity invariant — live normative text left behind by the carrier wiring

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

PR #636 wired ADR 0021 §1 into the three carriers' invariant blocks
(`agents.md`, `engineering.md`, `convention.md` — now byte-identical and stating
_work-loop parity + asymmetric named authority_). Two **live normative** statements
of the old rule sit outside that file set and were correctly left alone by the
worker:

- `ArggonManager/docs/adr/0020-methodology-first-productization.md:62–64` — the
  decision that declares those carriers to be the product, whose invariants list still
  reads _"humans and agents follow the same rules"_
- `ArggonManager/docs/claim.md:99` — _"Agents and humans follow the same rules"_

Frozen records are **not** to be rewritten: `spec-methodology-adapters-017.md:49`,
`spec-spec-pipeline-002.md:20`, `spec-deps-001.md:19` and the explorations are
historical statements of what was true when written. ADR 0020 and claim.md are not —
they are live text a reader consults today, and both now contradict the carriers.

## Acceptance

- [x] ADR 0020's invariant list carries a **dated amendment** naming ADR 0021 §1 as the superseding rule — superseded, never rewritten
- [x] `docs/claim.md:99` carries the two-axis rule with a pointer to ADR 0021
- [x] No spec, plan or exploration is edited — frozen records stay as taken
- [x] `npx prettier --check` clean on both files; `arggon validate` ok
- [x] If `cli/src/capability-matrix.test.ts` pins either file verbatim, the amendment satisfies it and the suite stays green — **it pins neither**; it reads only the three carriers' `- **Invariants:**` header block, and the suite is green as-is (no mirror needed, nothing sequenced)

### 2026-10-04 @ses_ef703be1affejUdFDEiwVTY34x
**verdict: approve** — both live restatements fixed, diff is 2 files, frozen records untouched.

## What changed

- **`ArggonManager/docs/adr/0020-methodology-first-productization.md`** — a dated `> Amendment (2026-10-04, ADR 0021 §1)` note in the **header block** (after the existing 2026-10-02 / PR #610 amendment bullet), in the same style as this record's other two dated notes and ADR 0021 §6.1/§6.2a′. It names ADR 0021 §1 as the superseding rule, marks **only** the `"humans and agents follow the same rules"` clause superseded, states that the other four invariants in §Decision.1 are unchanged, records **Status unchanged (Accepted)**, and points at the three carriers for the live wording (noting PR #636 rewired them byte-identical). **The §Decision body is untouched** — the clause still reads exactly as taken.
- **`ArggonManager/docs/claim.md:99`** — the sentence `Agents and humans follow the same rules:` is replaced in place by the two-axis rule with a link to [ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §1, and a pointer to `engineering.md` §Roles and authority. It names the one asymmetry that reaches that page (`--steal` is a product-owner power — already enforced at claim.md §Stale claims, so the prose now matches the code).

## Guard check — **no mirror needed, nothing to sequence**

`cli/src/capability-matrix.test.ts:241` ("mirrors the carriers' Invariants header block") reads **only** these three paths:

```
ArggonManager/docs/agents.md, ArggonManager/docs/engineering.md, ArggonManager/docs/convention.md
```

It pins none of my two files. `grep -rn "claim\.md\|0020-methodology" cli/src/ lib/src/` returns one hit only — a code comment in `lib/src/rules.ts:65` (`// human-only --steal takeover (docs/claim.md)`), not a verbatim pin. `adapters/capability-matrix.json`'s `same-rules` row already carries the new work-loop-parity statement, and `README.md:67` already carries the full two-axis block (both landed in #636). **The suite passes as-is**; there is nothing to mirror and no sequencing needed for the coordinator.

## Gates — expected vs observed

| Gate | Expected | Observed |
|---|---|---|
| `npm run build` | ok | ok — lib + 3 tsc projects + `build:plugin` (42 modules → bundle) |
| `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` | `arggon validate: ok (0 warning(s), convention v5)` — exit 0 |
| `npm run arggon -- spec validate` | ok, warnings pre-existing | `arggon spec: ok (34 doc(s), 5 warning(s))` — exit 0; all 5 are pre-existing `DOC_NUMBER_COLLISION` in files I did not touch |
| `npm run arggon -- spec analyze` | exit 0, findings pre-existing | `10 finding(s) across 21 spec(s) — report only, nothing was edited` — exit 0; all 10 pre-existing, none in my files |
| `npx prettier --check` (both files) | `All matched files use Prettier code style!` | exactly that (item file also checked, clean) |
| `npm test` | full suite green | `Test Files 127 passed (127)`, `Tests 2625 passed (2625)` |
| `npx vitest run cli/src/capability-matrix.test.ts cli/src/adr-index-parity.test.ts` | green | `2 passed`, `30 passed` |

The two `fatal: not a git repository` lines in the `npm test` output are fixture-repo noise from a sandboxed init/commit test, not a failure of this change.

## Scope held

`git diff --name-only main` → only the 3 expected paths (ADR 0020, `docs/claim.md`, this item file). Nothing under `docs/specs/`, `docs/plans/` or `docs/explorations/` was touched — the frozen records keep the old wording as taken.

## Found but NOT fixed (outside my file set — for the coordinator to sequence)

1. **`templates/docs/docs/convention.md:3` — the adopter-facing template `arggon init` writes into every new project still states the flat invariant verbatim:** "Humans and agents follow the same rules." This is the *same* defect as `docs/claim.md:99`, but higher blast radius: it ships into every adopting repo. It is **not** drift-tested against the repo carrier — `cli/src/init-docs.test.ts:166` asserts it is "adopter-owned … not ArggonManager's", and no test compares the two. **Recommend a follow-up item: this one needs an owner of `templates/**` + a parity guard, and arguably an ADR 0016 upgrade-channel note** (adopters who already have the file will not get it refreshed, per the never-overwrite promise).
2. **`ArggonManager/agent-native/agent-native.md:19` and `:30`** — a dated roadmap doc (2026-09-11) restating the differentiator as "same rules for humans and agents, state 100% in git". Same class as claim.md (live prose, not a frozen record) but weaker: it reads as a roadmap statement of intent, not a rule a reader consults as normative. Left alone deliberately; your call whether it warrants an item.

Checked and **correctly left alone**: `templates/docs/AGENTS.md:17` ("Subagents follow the same rules") and `docs/agents.md` ("same CLI, same rules, no private dialect") are about **work-loop / no-private-dialect** parity, which the two-axis rule still asserts — not drift. `docs/viewer-spike.md:65` is the same case. Frozen explorations 018/011/019 and the specs keep the old wording as taken, as instructed.

### handoff 2026-10-04 @ses_ef703be1affejUdFDEiwVTY34x (session: ses_ef703be1affejUdFDEiwVTY34x) — next: Coordinator reviews and merges (merge, do not squash); nothing left to implement on this branch.
- branch: fix/bug-parity-invariant-restated-outside-carriers
- open questions: File follow-ups for templates/docs/docs/convention.md:3 (flat parity, ships to every adopter) and agent-native.md:19,30; no capability-matrix mirror needed - suite green as-is.

### 2026-10-04 @ses_ef703be1affejUdFDEiwVTY34x
**PR: https://github.com/Arggon/ArggonManager/pull/638** — OPEN, MERGEABLE, base `main`, head `fix/bug-parity-invariant-restated-outside-carriers` (5 commits: claim + 2 item bookkeeping + the doc change; branch based on `main` tip `2bdaab69`, no rebase needed).

**Merge, do not squash.** ADR 0016 impact class: **Advisory** — a dated status/annotation change to one ADR plus one corrected live doc sentence; no agent re-learns a rule, so no behavioral / upgrade-channel obligation.

Diff vs `main`: 3 files — `docs/adr/0020-methodology-first-productization.md` (+21), `docs/claim.md` (+8/-1), this item file (checklist ticked + verdict/handoff).
