---
spec_id: promotion-policy-018
title: Promotion policy and the accept: product-acceptance convention
status: proposed
created: 2026-10-04
---

# Spec: Promotion policy and the `accept:` product-acceptance convention (promotion-policy-018)

Implements [ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md)
§3–§4 (from
[exploration-agent-primary-workers-019](../explorations/exploration-agent-primary-workers-019.md),
recommendation C2). ADR 0017 gate item: no implementation task below this one may be
claimed before it exists and `arggon spec analyze` reports no NEW findings.

## Purpose

ADR 0021 makes the human the **product owner** and gives that role a bounded authority
surface (§2). One of those powers — **accepting a container's work** — is the only one
with no record anywhere: the review bar assigns it to a "Project Manager" in prose
(`docs/engineering.md:75–78`), while containers close through the acceptance-aware
cascade (`docs/convention.md:52`). Every other product-owner power leaves a trace
(priority field, ADR 0015 waiver, `--steal` note, human-pushed release commit).

This spec settles the two pieces that make the role real without inventing authority:

1. **The promotion policy** (§3) — a bounded tier table naming how deep product-owner
   review goes per class of work, so agent-primary delivery can actually finish. The
   certificate already exists (the review bar + its blocking smoke, ADR 0008); what is
   missing is the written statement of review depth per class.
2. **One recorded artifact** (§4) — an `accept: approve | changes-requested` comment
   header on the item, in the same bounded convention as the existing review verdict,
   read report-only.

**Invariants**

- **Report-only.** Nothing here gates a transition, fails CI, or blocks a merge. The
  enforced human steps remain the four irreversible ones (steal, waive, reopen,
  publish); acceptance is attributed, never authenticated, because the tracker has no
  identity (`docs/agents.md:414`).
- **Never-overwrite / never-invent.** The convention is prose on the item, not schema:
  no frontmatter field, no CLI flag that writes it, no kernel rule.
- **Additive within `schemaVersion` 1** (`docs/json-output.md`); a breaking change to a
  tool input schema is out of scope because no tool schema changes.
- **Zero noise by default.** A repo that never adopts the convention sees no new
  findings, no new statuses and no behavior change.
- **Domain-neutral** (ADR 0021 §6.2): every surface is named by what the adopting
  project declares, not by software artifacts.

## Synopsis

```yaml
# ArggonManager/.convention.yml — arms the convention (default: absent = OFF)
x-tracker:
  product-acceptance: true # opt in; OFF keeps every adopter silent
```

```text
### 2026-10-04 @gonzalo
accept: approve
- login rate limit behaves as specified; p95 unchanged at 40 rps
```

```bash
arggon report --json          # additive `acceptance` per container
arggon show <id> --json       # additive `acceptance` on that item
arggon spec analyze           # additive finding when armed and a container closed bare
```

### The convention (bounded, mirrors `verdict:` exactly)

A product acceptance is a **comment** whose first `accept:`-looking line is the header:

| Element        | Rule                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Heading        | `### <YYYY-MM-DD> @<author>` — exactly what `arggon comment` writes; handoff headings never match                                 |
| Header line    | `accept: approve` or `accept: changes-requested`, case-insensitive on token and value, optional scope in parentheses              |
| Bounded        | the value must be followed by end-of-line, space or `(` — `accept: approved` and `accept: approvals` do not match                 |
| First only     | only the first acceptance-looking line of a comment counts, so a quoted acceptance inside an evidence list cannot impersonate one |
| Order tiebreak | comments are append-only, so body order breaks ties between same-date comments                                                    |
| Superseding    | a later `accept: approve` supersedes an earlier `accept: changes-requested` (same rule verdicts already use)                      |

### States

| State           | Meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `accepted`      | the latest acceptance is `approve`                                                        |
| `changes-noted` | the latest acceptance is `changes-requested`, and nothing later approved                  |
| `none`          | no acceptance comment on the item                                                         |
| `self-accepted` | the latest `approve` was written by the item's own assignee — **reported, never blocked** |

`self-accepted` exists because forgery is expected, not exceptional: with no identity
layer, the only honest signal is attribution. It is the thing a reader must see before
trusting an acceptance, so it is a first-class state and not a footnote.

### Surfaces (all additive, all report-only)

| Surface            | Field                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| `report --json`    | `groups[].containers[].acceptance` — `accepted｜changes-noted｜none｜self-accepted`   |
| `show <id> --json` | additive `acceptance` beside the existing `acceptance_complete` / done-gate verdict   |
| `spec analyze`     | `MISSING-PRODUCT-ACCEPTANCE` — a **container** that reached `done` with no acceptance |

**Correction to ADR 0021 §4 (dated amendment owed by the implementation PR).** §4 assigned
the classification to `arggon sync --json`. Grounding for this spec found that surface
cannot carry it: `sync` classifies only items reconciled with an **open PR**
(`lib/src/sync-command.ts:83`, `verdicts[match.itemId]` over PR matches), and product
acceptance is a **container**-level decision — containers never carry PRs, so a
container's acceptance would never appear. `report` is the surface that already
aggregates per container (`lib/src/report.ts:12` `ReportContainer`, one entry per story
under an epic), so the classification lands there, plus `show` for the single-item read.
`sync` is left byte-identical. The implementation PR must amend §4 to say so — a doc
statement the change makes false is fixed in the same PR (`docs/agents.md`
§Documentation maintenance).

### The promotion policy (tiers, by blast radius)

The tier table itself lands in `docs/engineering.md`
(`task-wire-role-model-carriers`); this spec fixes its **content**.

| Tier | Applies to                   | Who accepts                                                         | Blocking?                    |
| ---- | ---------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| T0   | `task` / `bug` leaves        | the agent self-certifies on the review-bar evidence + the gates     | no — and the default         |
| T1   | `story` containers           | the product owner, recorded as an `accept:` comment                 | no — recorded, never gated   |
| T2   | the four irreversible powers | a human, already structurally gated; the acceptance records the why | yes, by ADR 0015 / TTY gates |

Two rules that make the tiers survivable in practice:

- **Absence of a product owner never blocks.** A repo with no product owner is compliant
  at T0 by default and stays silent: the finding only fires when the repo has **armed**
  `x-tracker.product-acceptance: true`. Arming is the act of saying "we have a product
  owner and we want the record".
- **No timers, no PO-blocked status.** Acceptance is a comment at any hour; `claimed_at`
  staleness stays advisory (`docs/convention.md:302`). There is no SLA and no new
  status, so an absent product owner can never wedge a container's children — only its
  bookkeeping.

### The metric that would ever justify a gate

Deferred, and named so the deferral is falsifiable rather than a shrug: **acceptance
share** (terminal containers with `accepted` ÷ terminal containers) plus **human-only
hatches used** (waivers, steals) per closed container. A kernel-enforced acceptance gate
is the C3 alternative ADR 0021 rejected; it comes back only if a demonstrated failure
slips past this report **and** the report has proven low-noise — the same posture the repo
already took for review verdicts (`docs/engineering.md:109`).

## Acceptance

- [ ] **AC 1 — parser.** A kernel module (`lib/src/acceptance.ts`) mirroring
      `lib/src/verdict.ts`: heading regex, the bounded header line, first-match-only,
      append-order tiebreak, later-approve supersedes. Exported from the kernel index.
      Unit tests cover every boundary the verdict suite already pins, plus the accept
      vocabulary (`accepted` must not match `acceptance`, `approve` must not match
      `approved`).
- [ ] **AC 2 — attribution.** The parsed acceptance carries the comment's **author**
      (today `VerdictComment` does not capture it, so this is new data, not a
      re-read), enabling `self-accepted`.
- [ ] **AC 3 — `report`.** Additive `acceptance` on every `ReportContainer`, additive
      within `schemaVersion` 1; the human table gains at most one bounded column or
      marker, and `docs/json-output.md` is updated in the same PR.
- [ ] **AC 4 — `show`.** Additive `acceptance` beside the existing done-gate verdict on
      the item's own classification; bounded like its neighbours (ADR 0006).
- [ ] **AC 5 — `spec analyze` finding.** `MISSING-PRODUCT-ACCEPTANCE` fires only when
      `x-tracker.product-acceptance` is armed **and** the container is terminal
      (`done`/`cancelled`) **and** its latest state is not `accepted`. Never fires on a
      leaf, never fires on an open container, never fires when unarmed, never fails the
      run.
- [ ] **AC 6 — arming is opt-in and safe.** `x-tracker.product-acceptance` follows the
      `allow-steal` precedent: absent or `false` = every surface behaves exactly as
      today; a non-boolean value is a parse error per the `x-tracker` rule
      (`docs/convention.md:526`). Unknown nested keys stay ignored (forward compat).
- [ ] **AC 7 — idempotence and forward-only.** Re-running any surface never mutates
      state; a late acceptance on a closed container clears the finding on the next run;
      nothing backfills historical items.
- [ ] **AC 8 — no gate, anywhere.** No transition consults the acceptance state; no
      command refuses because of it; CI never fails on it. A test asserts the done gate
      and the cascade reach the same verdict with and without acceptance comments
      present.
- [ ] **AC 9 — one logic path.** The classification is computed in the kernel and read
      by every surface; no adapter reimplements it, and the capability matrix needs no
      row change.
- [ ] **AC 10 — docs travel with code.** `docs/engineering.md` gains the tier table and
      the convention; `docs/json-output.md` documents both new fields; ADR 0021 §4 gets
      its dated amendment naming the `report`/`show` surfaces instead of `sync`.
- [ ] **AC 11 — measurable.** The metric named above is computable from what this spec
      already adds (`report` per container + the existing waiver/steal records), so no
      new state is needed to evaluate the deferred gate.
- [ ] **AC 12 — domain-neutral wording.** Every doc sentence names the surface by what
      the adopting project declares, with the software case as one worked example only
      (ADR 0021 §6.2).
- [ ] **AC 13 — gates.** `arggon validate`, `arggon spec validate`, `npm test` green;
      `arggon spec analyze` reports no NEW findings for this spec.

## Non-goals

- **A kernel-enforced acceptance gate** (ADR 0021 C3) — deferred on evidence, per above.
- **Authentication of the product owner** — impossible without an identity layer; out of
  scope for this spec and for the deferred gate.
- **A `role:` / `owner:` frontmatter field** — rejected in ADR 0021: schema change
  carrying a fact `assignee` already carries, and a kernel-trusted field a worker could
  write to nominate itself.
- **Product-owner review per leaf** — spends the scarce input; T0 is the default for a
  reason (METR's field evidence, ADR 0021 F12).
- **Acceptance on PRs.** The record lives on the item; the PR carries the item id.
