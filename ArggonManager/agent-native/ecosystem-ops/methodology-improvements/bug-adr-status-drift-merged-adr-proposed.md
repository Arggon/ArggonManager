---
type: bug
status: todo
id: bug-adr-status-drift-merged-adr-proposed
title: 'Three merged ADRs (0022, 0023, 0025) still read `Status: Proposed` — `engineering.md`''s lifecycle is "Accepted when merged", and ADR 0021 already needed a status-fix item for exactly this drift'
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-06"
updated: "2026-10-06"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-adr-status-drift-merged-adr-proposed.md
  Leaves live only under a story. id is the filename stem: bug-adr-status-drift-merged-adr-proposed.
  CLI `arggon create bug adr-status-drift-merged-adr-proposed` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Three merged ADRs (0022, 0023, 0025) still read `Status: Proposed` — `engineering.md`'s lifecycle is "Accepted when merged", and ADR 0021 already needed a status-fix item for exactly this drift

## Context

Found while running the delivery-lead review of ADR 0026 (PR #659), 2026-10-06.
`ArggonManager/docs/engineering.md` §ADR process declares the lifecycle:

> **Lifecycle:** Proposed in a PR → Accepted when merged (or explicitly recorded) →
> Superseded by a later ADR, never silently rewritten.

Measured on `main` at that moment:

| ADR  | On `main`?       | `- Status:` | Should read          |
| ---- | ---------------- | ----------- | -------------------- |
| 0022 | yes (`8643c32b`) | `Proposed`  | `Accepted`           |
| 0023 | yes (`66035a4a`) | `Proposed`  | `Accepted`           |
| 0024 | yes              | `Accepted`  | `Accepted` — correct |
| 0025 | yes (`6d3bef0c`) | `Proposed`  | `Accepted`           |

So three merged ADRs assert a lifecycle state the declared process says they
left two commits ago. A record that says "Proposed" about a decision already taken
is the same defect class ADR 0021 hit: its own status line lagged its merge, and
`task-adr-0021-status-accepted` fixed it after the fact. ADR 0021's amendment
block now says so explicitly, and its own note names the cause — _"only the
status line lagged the merge"_.

The index row is not the failure: `cli/src/adr-index-parity.test.ts` asserts the
row's status agrees with the ADR's own status line, so row and file agree — both
wrong together, consistently. That is why nothing catches it. A status assertion
that only checks internal consistency cannot detect a status that never moved.

## Acceptance

- [ ] ADR 0022, 0023 and 0025 each read `- Status: Accepted`, and each gains a **dated status note** in the house style of ADR 0021's — naming the merge that accepted it, and stating that nothing below the note is rewritten
- [ ] `ArggonManager/docs/adr/README.md` status cells for 0022 / 0023 / 0025 updated to `Accepted` so the index agrees
- [ ] A **prevention** is recorded, not just the three fixes. Choose one and say why: (a) a check that fails when an ADR is merged while still `Proposed`, (b) a documented convention that the merge commit carries the flip (what ADR 0026 does), or (c) accepting the drift as a known, owned cost — in which case the reason belongs in `engineering.md` §ADR process so the next ADR's author knows not to rely on the status line
- [ ] If (a): the check is added to the gates that already carry `adr-index-parity.test.ts`, and it is proven with a negative case — a fixture ADR that is merged-and-Proposed must **fail**, not pass
- [ ] `npx vitest run cli/src/adr-index-parity.test.ts` green; `npm run arggon -- validate` green; `prettier --check` clean on the files touched
- [ ] The fix is a status line plus a dated note. **No ADR body text is rewritten** — supersede, never rewrite (`engineering.md` §ADR process)

## Notes
