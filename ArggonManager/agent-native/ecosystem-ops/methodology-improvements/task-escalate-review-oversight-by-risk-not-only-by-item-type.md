---
type: task
status: done
id: task-escalate-review-oversight-by-risk-not-only-by-item-type
title: "Escalate review oversight by risk, not only by item type"
assignee: arggon-superagent
branch: agent/risk-based-escalation-e8713e4ab5af
parent: methodology-improvements
labels: [methodology, agents]
created: "2026-11-04"
updated: "2026-11-04"
issue: 871
worktree_path: /home/arggon/.dsh/state/superagent/work/risk-based-escalation-e8713e4ab5af
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-escalate-review-oversight-by-risk-not-only-by-item-type.md
  Leaves live only under a story. id is the filename stem: task-escalate-review-oversight-by-risk-not-only-by-item-type.
  CLI `arggon create task escalate-review-oversight-by-risk-not-only-by-item-type` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Escalate review oversight by risk, not only by item type

## Context

Issue #871 (part 4 of 5 of the 2026-11-03 methodology review) shows the promotion
policy decides review depth from an item's **type**: every `task`/`bug` leaf is T0
(agent self-certification) and T1 is only `story` containers. A one-line auth,
crypto, destructive-migration, public-schema, CI-permission or billing change is
therefore the least-reviewed class of change, and the item holds no record that a
leaf was escalated.

This task makes T0 conditional on a **risk triage**: a leaf with no risk trigger stays
T0, a triggered leaf is T1 (recorded human acceptance) or T2 (human-gated when the
change is irreversible), the triage is recorded on the item as `risk-…` labels, the
PR template asks the question, the authenticated gate is named separately from the
recorded one, and `arggon report --json` gains a report-only audit block (open
risk-triggered leaves whose acceptance is not `accepted`) so the policy is measurable
before it can ever block.

Issue: https://github.com/Arggon/ArggonManager/issues/871

Methodology impact class: **Behavioral** — agents must re-learn the T0 default
(ADR 0016 upgrade channel). The tracker `accept:` record stays report-only; the
authenticated gate remains the GitHub review the project declares (CODEOWNERS).

## Acceptance

- [x] `ArggonManager/docs/engineering.md` has a risk-trigger table with concrete examples and an explicit T0 exception for triggered leaves.
- [x] The T0 row no longer says every `task`/`bug` leaf is agent-accepted by default; it says "no risk trigger".
- [x] The escalation is recordable on an item (`risk-…` labels) and visible in the normal read surfaces (`show`, `list --json` + filter, PR template).
- [x] Security-sensitive, destructive, compatibility-breaking, supply-chain, and safety-critical changes each have a named escalation path.
- [x] The policy states which gate is authenticated (GitHub review/CODEOWNERS) and which is only recorded (tracker `accept:`).
- [x] A test or report query proves a risk-triggered leaf is not classified as routine T0; the first iteration may be report-only.

## Notes

### 2026-11-04 @arggon-superagent

Methodology impact class: **Behavioral** (ADR 0016) — agents must re-learn the T0 default. The bundled skill command excerpt was regenerated with `npm run skills:sync`, the generated Claude seam with `arggon init --no-commit`, and the committed plugin bundle with `npm run build`.

Delivered on `agent/risk-based-escalation-e8713e4ab5af`:

- `docs/engineering.md`: T0 is "task/bug leaf with **no risk trigger**"; risk-trigger table (security, destructive, compatibility, supply-chain, safety-critical) with an explicit "a small diff never lowers the tier"; authenticated GitHub review (CODEOWNERS/named reviewer) separated from the recorded tracker `accept:`; report-only audit documented.
- `docs/specs/spec-promotion-policy-018.md` and `docs/adr/0021-…md` §3: dated amendments (the ADR is amended, not silently rewritten); §4's artifact unchanged.
- `docs/agents.md` §5 and the PR template carry the triage; `risk-…` labels are the chosen record, visible in `show`, `list --json`/`--filter label:risk-security`, the board and the PR.
- `arggon report`: additive `risk: {checked, leaves, leavesTotal}` (`--json`) plus bounded human-table and markdown blocks; open `risk-…` leaves whose latest `accept:` state is not `accepted`, with story/epic chain, capped at `MAX_RISK_LEAVES`.

Verification (expected vs observed):

- `npx vitest run cli/src/report.test.ts cli/src/acceptance-convention.test.ts` → 64 passed (includes the new risk tests and the acceptance/table invariant).
- `npm run lint` clean; `npm run build` clean; `npm run test:structure` 5 passed; `npm run lint:structure` clean.
- `arggon validate` ok; `spec validate` ok (38 docs); `spec analyze --baseline` 0 new / 0 resolved / 4 unchanged.
- `npm run context:report` core 101,208 B / 122,880; start 20,025 B / 20,480.
- Fixture smoke: a `risk-security` leaf with no acceptance is reported as a gap in both the human block and `--json`; a human `accept: approve` clears it.
- Local full `npm test` has 7 environment-only failures reproduced identically on `main` (`6d9b971f`): 4 TUI pty/ANSI under Node 26, 2 doctor (`url.insteadOf` rewrites `git@github.com:` in this machine's global config), 1 Claude plugin install (external CLI). Relevant report/acceptance suites are green; CI is the authoritative gate.
