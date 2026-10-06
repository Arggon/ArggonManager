---
type: task
status: todo
id: task-spec-owner-decision-brief
title: "Spec: the decision-brief convention, its answer grammar, and the unanswered-brief report-only finding (exploration 025 edge cases as acceptance criteria)"
parent: role-model-foundation
labels: [methodology, roles, spec]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
depends_on: [task-adr-0026-owner-decision-brief]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-spec-owner-decision-brief.md
  Leaves live only under a story. id is the filename stem: task-spec-owner-decision-brief.
  CLI `arggon create task spec-owner-decision-brief` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the decision-brief convention, its answer grammar, and the unanswered-brief report-only finding (exploration 025 edge cases as acceptance criteria)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG
Gated behind `task-adr-0026-owner-decision-brief` (the ADR decides; this specifies it). **ADR 0017 hard gate: this spec must pass `arggon spec analyze` with no NEW findings before any implementation task is claimed** — including `task-wire-decision-brief-carriers`.

Every row of exploration 025's edge-case table becomes an acceptance criterion, so nothing stays "unknown". The non-obvious ones:

- **Routing rule** — briefs owed only for the ADR 0021 §2 rows and hard-to-reverse calls; a one-option question is **not** a brief (the lead decides it and records why).
- **Unanswered** — the stated default executes and the brief records that it did. This is the mechanism that makes escalation cheap rather than blocking.
- **Concurrency** — one canonical item per decision; a second brief links to it. No cross-item dedupe scanner in v0: **explicit non-goal**, the volume does not justify a surface.
- **Never a gate** — report-only, inherited from ADR 0021 §4: no transition consults it, no command refuses because of it, CI never fails on it.
- **Time** — absolute ISO dates only; never a relative deadline.
- **Domain neutrality** — every field named in the project's own terms; software is the worked example, never the vocabulary (ADR 0021 §6.2).
- **Upgrade** — `init --propose` delivers it; both skill copies stay byte-equal in the same PR.

## Acceptance

- [ ] `ArggonManager/docs/specs/spec-<owner-decision-brief>-NNN.md` written from `templates/spec.md`, with the six brief fields, the answer grammar, and the routing rule specified
- [ ] **Every** row of exploration 025's edge-case table appears as an acceptance criterion, an explicit non-goal, or a tracked spike — an adversarial re-pass finds no "unknown"
- [ ] The report-only finding specified: a `decide:` header with no later `decided:`, mirroring `MISSING-PRODUCT-ACCEPTANCE`; **opt-in under `x-tracker.product-acceptance`, never CI-failing**
- [ ] Spec states the promotion-policy tiers are unchanged, so product-owner touchpoints per shipped change do not rise
- [ ] `arggon spec validate` green and `arggon spec analyze` reports **no NEW findings** — the gate for `task-wire-decision-brief-carriers`
- [ ] Plan filed with ordered tasks and `depends_on`, per `references/methodology.md`

### 2026-10-06 @ses_eee50c3c2ffea91lEKg6KhytwM
Spec landed as `ArggonManager/docs/specs/spec-owner-decision-brief-021.md` (NNN 021: 020 is the highest existing spec, so 021 is the next free number — verified with `ls | sort`, not assumed). PR #660, one commit `2451727e`, no squash. Branch `feat/task-spec-owner-decision-brief`.

**The two questions ADR 0026 left open, answered**

1. *Which read-only surface reports an unanswered brief* → `show <id> --json` gains an additive `decision_brief` field (`none｜open｜decided｜self-decided`) and `spec analyze` gains one report-only finding `UNANSWERED-DECISION-BRIEF`, mirroring `MISSING-PRODUCT-ACCEPTANCE` under the **existing** `x-tracker.product-acceptance` arming (no new config key). `report --json` and `sync --json` stay byte-identical: `sync` classifies only items reconciled with an open PR (`lib/src/sync-command.ts:81–83`) — the same correction ADR 0021's dated amendment records at 0021:323–347 — and `report` aggregates per container (`lib/src/report.ts:13`) while a brief is item-level and often lives on a leaf. Justified in the spec's §"The read-only surface".
2. *Where the carrier text lives* → `task-wire-decision-brief-carriers`; the spec's §"Boundary with the carriers item" lists what that item will do and what it must not re-decide.

**Gates (command → expected → observed)**

- `npm run arggon -- validate --json` → `ok:true` → `{"ok":true,...,"errors":[],"warnings":[]}`
- `npm run arggon -- spec validate` → ok → `arggon spec: ok (37 doc(s), 5 warning(s))`; the 5 are pre-existing `DOC_NUMBER_COLLISION` warnings in other files, unchanged from before my file (36 docs → 37 docs)
- `npm run arggon -- spec analyze` → no NEW findings → **10 findings before, 10 after**, none in this spec. Before: 2 `no-error-path`, 3 `vague-quantifier`, 5 `duplicate-doc-number`. After: identical counts and kinds. `spec analyze --spec ArggonManager/docs/specs/spec-owner-decision-brief-021.md` → `scanned 1`, zero findings in every bucket.
- `npx prettier --check <file>` → clean → "All matched files use Prettier code style!" (run once before the commit, re-run after the final edit — this repo's Markdown formatter has non-idempotent cases, so the post-edit re-check is the one that counts)
- `npm run test:structure` → green → "test result: ok. 5 passed; 0 failed"
- `npm run lint:structure` → clean → no rule hits
- `npm run --silent arggon -- validate` (the pre-commit hook body, run manually) → ok → "arggon validate: ok (0 warning(s), convention v5)"

**Edge-case coverage.** All twelve rows of exploration 025 §Edge cases are carried: hostile input/no product owner (non-goal + default-executes), one option / options with no consequence (AC 9, AC 12), concurrency (AC 11 + no-dedupe-scanner non-goal), no answer by the date (§Synopsis default rule), forgery / self-answer (`self-decided` state reported never blocked + auth non-goal), rubber-stamping (routing rule bounds volume), relative deadlines (AC 12), existing trees (nothing-migrates non-goal), unanswered observability (AC 4), hostile brief text (AC 13), non-software adopters (AC 14), upgrade (AC 15).

**Ambiguity found in ADR 0026, reported not resolved by invention**

- The ADR names the surface question but does not say whether the *classification* also rides `report`. I chose `show` + `spec analyze` and left `report` unchanged, with the reasoning stated in the spec. A maker could reasonably have added a container row; that is now a documented choice, not an open question.
- `self-decided` is **my** state name. ADR 0026 §2 mandates attribution-only but never names a state; I mirrored `self-accepted` because the sibling precedent is exactly this case. Flagged in the spec's §States as mirroring, so a reviewer can reject the name without unpicking the design.
- ADR 0026 §8's two reversal limbs are **not computable** from anything this spec adds: limb (a) needs answer latency (a comment-date difference) and limb (b) needs a count of decisions made outside briefs, which no surface records. Recorded as an explicit "not established" non-answer in the spec rather than a metric invented here.

**Not done (yours):** item not flipped to `done`, PR not merged. `task-wire-decision-brief-carriers` remains `todo` and gated — its `depends_on` already lists this item.
