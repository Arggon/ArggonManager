---
spec_id: analyze-decision-gaps-013
title: spec analyze: decision-pipeline gap findings (report-only)
status: implemented
created: 2026-09-29
---

# Spec: analyze decision gaps (analyze-decision-gaps-013)

## Purpose

The explore → ADR → spec/plan pipeline leaks: explorations stay on a
placeholder Decision for weeks, ADRs sit in `Proposed` indefinitely, and plans
ship while their spec is still `proposed` (exploration-014 C3/F3 lists live
instances). `arggon spec validate` checks structure, not pipeline state. This
spec extends the existing **report-only** `arggon spec analyze` with
decision-pipeline gap findings, under the same invariants as the rest of
analyze (spec-analyze-004):

- **Report-only, pure read** — the decision pass NEVER edits any file.
- **Findings never fail the run** — exit 0 with findings; only a structural
  failure (unreadable file) exits non-zero (`SPEC_FAILED`).
- Deterministic, no AI; findings are advisory (`warn`), never gates (no new
  exit-code policy — the `--baseline` wave gate keeps working unchanged).

## Synopsis

```bash
arggon spec analyze [--json]   # unchanged CLI surface; findings.decisions is new
```

No new flags. The `--json` envelope gains one additive bucket:
`findings: { ambiguity, consistency, decisions }` — `schemaVersion` is
unchanged (additive field). `scanned` still counts spec documents only.

### Finding taxonomy (kind is the exact string below)

All three kinds live in the `decisions` bucket with the standard finding shape
`{ file, kind, line?, severity: "warn", message }` (`file` posix, repo-relative;
`line` is a 1-based full-file line number when tied to one).

- **`DECISION-PENDING-EXPLORATION`** — an exploration in
  `ArggonManager/docs/explorations/*.md` (legacy `<root>/docs/explorations/`)
  whose `created` frontmatter date is older than **7 days**
  (`DECISION_PENDING_DAYS`) AND whose Decision section records no ADR. The
  Decision section is the first `##` heading whose normalized text starts with
  `decision` (covers "Decision" and "Decision gate") through the next `##`
  heading or EOF; the section records an ADR when it contains an
  `adr/<name>.md` path — markdown link or bare text — whose filename is
  numbered (`NNNN-…`), not the `0000-` template placeholder and not a
  `<slug>` stub. HTML comments are stripped first, so template placeholders
  (`<!-- ADR placeholder: … -->`) never count as a decision. A missing
  Decision section counts as pending (no decision recorded). `line` is the
  Decision heading when present. A Decision section can also record an
  explicit **no-ADR decision** (task-exploration-decision-records): a line
  matching `No ADR required` + separator (`—`, `:` or `-`, an optional
  leading `- `/`* ` list bullet is tolerated) + a **non-empty rationale** —
  `No ADR required — bug-fix, no cross-cutting decision`. The rationale is
  mandatory: a bare token, an empty reason, or the same text anywhere outside
  the Decision section still counts as pending, so the marker cannot silence
  the scanner without saying why.
- **`STALE-PROPOSED-ADR`** — an ADR in `ArggonManager/docs/adr/*.md` whose
  `- Status:` line (list-item form, case-insensitive) starts with `Proposed`
  and whose `- Date:` is older than **14 days** (`STALE_PROPOSED_DAYS`).
  `line` is the Status line. ADRs with any other status line are never
  reported; a missing or malformed date is skipped (analyze never guesses).
- **`SPEC-STATUS-DRIFT`** — a spec with `status: proposed` (and a `spec_id`)
  for which at least one plan in `docs/plans/` whose `spec:` frontmatter
  resolves to that spec file carries `status: implemented`. One finding per
  (spec, plan) pair; the message names the drifted plan.

### Thresholds (documented constants, `cli/src/spec.ts`)

- `DECISION_PENDING_DAYS = 7` — a decision left pending longer than a week is
  a pipeline leak.
- `STALE_PROPOSED_DAYS = 14` — a Proposed ADR older than two weeks is either
  accepted or rejected; holding it in limbo is the leak.

Age is computed in whole days from the document date to _today UTC_; a finding
fires only when `ageDays > threshold` (exactly `threshold` days old is not a
finding). Dates must be `YYYY-MM-DD` (quotes allowed); unparseable or missing
dates produce no finding. Findings are date-dependent by design — a committed
`--baseline` snapshot may legitimately gain a finding as a document ages past
the threshold.

## Contrato JSON

`--json` envelope: `{ ok: true, schemaVersion, conventionVersion,
command: "spec", scanned, findings: { ambiguity: Finding[],
consistency: Finding[], decisions: Finding[] } }`. The `decisions` bucket is
additive; consumers reading only `ambiguity`/`consistency` keep working.
Baseline snapshots (`--save-baseline` / `--baseline`) include decisions
findings in their flat `findings` array (snapshot format unchanged). The
decision pass runs only in corpus mode — skipped with `--spec <path>`, same as
the consistency pass. Structural failures keep `error.code: "SPEC_FAILED"`
and exit 1; findings never set `ok: false` and never change the exit code.

## Acceptance

- [ ] `spec analyze --json` emits the three decision finding types in the additive `decisions` bucket (file + line? + severity + message), schemaVersion unchanged
- [ ] Fixture with a placeholder-only Decision (older than 7 days) yields DECISION-PENDING-EXPLORATION; a Decision linking a numbered ADR does not
- [ ] Fixture with a `Proposed` ADR older than 14 days yields STALE-PROPOSED-ADR; Accepted and fresh-Proposed ADRs do not
- [ ] Fixture with a `proposed` spec whose plan is `implemented` yields SPEC-STATUS-DRIFT; matching-status pairs do not
- [ ] Exit code is 0 with decision findings; no file is ever written (pure read)
- [ ] Human output lists the findings with their `[KIND]` tags
- [ ] Scanner run against this repo reports exploration-adopter-upgrade-experience-007 as pending and ADRs 0002/0003/0004 as stale Proposed (findings only)
