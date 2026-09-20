# Adversarial audit protocol

> Task: `task-audit-protocol` (story-self-improvement). First run: 2026-09-14 (this document's landing PR).

## Purpose

Find violations of promised behavior **before adopters do**. The best bugs of the
adoption series (claim race, reopen gate, ack drift) came from attacking
invariants and checking doc promises against behavior — not from using the app.
This protocol makes that repeatable by any agent.

- **When**: after a notable feature wave, or before a release. (~1h per run.)
- **Where**: in a **throwaway temp tree** (`mktemp -d` + `arggon init`), never a
  real repo. Audits never patch ArggonManager directly — findings file via the
  tracker.
- **Deliverable**: a structured report (below) + tracker items for every
  deviation, or an explicit zero-findings statement per checklist item.

## 1. Invariant checklist

Attack each invariant in a throwaway temp tree. Each item names the invariant,
the concrete attack, and the expected behavior (with the bug that pinned it).

| Invariant | Attack | Expected |
| --- | --- | --- |
| **Claim exclusivity** | Run N concurrent `arggon start <id>` processes: same assignee, and different assignees. | Single winner per the file lock (`ArggonManager/docs/claim.md`): same assignee → exactly one `created: true`, others attach; different assignees → exactly one wins, others `START_FAILED` claim conflict. No last-write-wins. (bug-claim-race-no-lock) |
| **Never-reopen for agents** | On a `done` item: CLI with non-TTY stdin (`< /dev/null`, piped `y`), and the MCP update tool. | Both refused; piped `y` does not pass; no `--yes` override exists. (#135 / bug-reopen-ungated-cli) |
| **Never-steal for agents** | Non-TTY `update --steal --reason ... --assignee ...` with the repo armed (`x-tracker.allow-steal: true`) and un-armed; TTY run without `y`. | Non-TTY always refused even armed and with `y` piped; un-armed refused with the arm hint; TTY aborts on non-`y`. No `--yes`. (#128 / bug-cli-steal-not-gated) |
| **Never-overwrite generated docs** | Hand-edit a generated doc; re-run `init`; repeat with `--force`; repeat with `--backup`. | Untouched → silently regenerated; modified → skipped (never overwritten, **not even with `--force`**); `--backup` → archived to `backup/<date>/`. (#109/#127) |
| **Cascade honesty** | Tick all leaves of a container whose own body has unchecked acceptance boxes; flip the last leaf to done. | The container with unchecked boxes is **never** auto-completed (`autoCompleted` omits it). (#136) |
| **Lost-push safety** | Create divergent remote state (commit upstream after the local push), then `cleanup --prune`. | Cleanup refuses / reports rather than discarding unmerged local work. (#131) |
| **Auto-commit coverage** | With a dirty tree of your own files: flip a status, import issues, comment. | Tree is clean of tracker mutations afterwards; only the files the CLI wrote are in its commit; your dirty files untouched. (#138) |
| **x-generated semantics** | For each of: untouched generated doc, hand-edited one, `--backup`, acked doc — re-run `init`/`doctor` and classify. | untouched → regenerated; hand-edited → `modified`; `--backup` → `backedUp`; acked → never regenerated. Acked **drift** invisibility is a known open bug — see worked example below. (#127) |

## 2. Doc-promise conformance sweep

Every normative statement in the governing docs is a promise. Extract and test:

1. Grep the promise sources for normative markers: `SKILL.md`
   (`.agents/skills/arggon-cli/SKILL.md`), `ArggonManager/docs/agents.md`,
   `ArggonManager/docs/convention.md`, `ArggonManager/docs/claim.md` — patterns: `never`, `always`,
   `only`, `requires`, `must`, `refuses`, `is human-only`, `MUST NOT`.
2. For each statement, identify the behavior it claims and verify against the
   built CLI/MCP (build first: `npm run build` or run via tsx) with a literal
   repro in the temp tree.
3. Classify each: **holds** / **drifts** (doc says X, tool does Y) /
   **untestable-cheaply** (note why; candidate for a lab scenario).

### Worked example: the ack-drift promise

The adoption checklist (cli/src/adopt.ts `ADOPT_TASK_BODY`, mirrored in
ArggonManager/docs/agents.md §Adoption step 6) promises "Hand edits made AFTER this ack still
report modified — the protection stays intact". Code read + live repro
(estanteria experiment, 2026-09-14) showed the opposite: `docs.ts` skips
acknowledged entries **before** comparing checksums and `doctor.ts` counts
acknowledged entries as healthy regardless of content — so post-ack drift is
invisible everywhere. Filed as `bug-ack-drift-promise` (story-adopt, OPEN).
This is the class of finding the sweep exists to produce: a sentence written as
a promise that a later change silently falsified.

## 3. Angle rotation

Each audit picks **2–3 fresh attack angles** — entry points not covered by
previous audits. Repeating the same angles exhausts the signal; the checklist
above is the floor, not the whole audit. Angle ideas:

- the newest merged feature wave (attack what has zero audit history);
- an entry point not yet audited (e.g. MCP-only flows, `board --tui`, the
  auto-done GitHub workflow, `import-issues` idempotency);
- a new ecosystem (new OS, new git host, monorepo layout, symlinked
  infrastructure, non-English locale);
- adversarial data (weird ids, unicode titles, deeply nested trees).

Record the chosen angles in the report so the next audit rotates away from them.

## 4. Filing rules

- Every deviation files via the tracker under the **owning story**
  (`arggon create bug "<title>" --parent <story-id>`), with the literal repro
  command(s), the literal output/error, and evidence file references — a
  finding without a repro is a hunch, not a finding.
- **Never patch ArggonManager from an audit.** The auditor is adversarial, not
  the fixer; fixes are claimed afterwards through the normal loop.
- Confirmations of already-filed bugs are noted in the report as
  confirmations (re-run the repro, link the item) — **not** refiled.
- Zero findings on an item is a result: state it explicitly per checklist row.

## 5. Report format

Each run produces a report (PR description or item comment) with:

1. **Scope**: commit audited, angles chosen (rotation).
2. **Scenario matrix**: checklist row × result (`holds` / `deviation: <id>` /
   `confirm: <id>` / `not-run: <reason>`).
3. **Conformance sweep table**: statement → doc+line → verdict.
4. **Literal messages**: exact commands and outputs for every deviation.
5. **Filed items**: new ids, or "no new findings".
