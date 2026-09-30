---
type: task
status: done
id: task-review-verdict-checker
title: review-verdict-checker
assignee: Arggon
branch: feat/task-review-verdict-checker
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-review-verdict-checker.md
  Leaves live only under a story. id is the filename stem: task-review-verdict-checker.
  CLI `arggon create task review-verdict-checker` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# review-verdict-checker

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — C2 (exploration-methodology-improvements-014)

Verdicts are prose today: nothing distinguishes approve from request-changes and nothing checks verdict state; "only a passing review merges" is social. Scope here = **convention + report-only linter**; a blocking gate is explicitly out of scope until the linter proves low-noise.

Design:
- Convention doc in `docs/engineering.md` §Review bar: verdict comments on the item start with a bounded header line — `verdict: approve` or `verdict: request-changes` (optional scope after it) — followed by the evidence list. Human-written; documentation, not schema.
- Checker (report-only): extend `arggon sync` (the PR reconciliation surface) — for each item with an open PR, classify verdict state from the item's body comments: `approved` (latest verdict = approve), `changes-requested` (a request-changes newer than the last approve), `none`. Additive envelope fields (schemaVersion unchanged); no extra gh calls beyond what sync already makes. If a different seam is clearly better, implement it and record the rationale in the PR.

### Acceptance checklist

- [x] `docs/engineering.md` verdict convention section (minimal + example).
- [x] `sync --json` emits additive verdict classification per matched/pending PR; unit tests for the parser (approve / request-changes / none; ordering by comment timestamp).
- [x] README + `ArggonManager/docs/json-output.md` updated (additive fields noted).
- [x] Smoke: fixture item with request-changes newer than approve → `changes-requested`; approve-only → `approved`; no verdicts → `none` (expected vs observed).
- [x] Full suite + lint/typecheck green; `arggon validate` ok.

### 2026-09-29 @Arggon
Implementation + evidence (branch feat/task-review-verdict-checker, PR #440).

- Convention: docs/engineering.md §Review bar → Review verdicts (bounded header line + evidence list; human prose, not schema).
- Checker: lib/src/verdict.ts (parseVerdicts/classifyVerdicts) wired into runSync — additive 'verdicts' field in the sync envelope (matched/fillable/pending/ambiguous items only; never no_pr). No extra gh calls (bodies already loaded); matching/exit_code untouched; schemaVersion stays 1.
- Tests: cli/src/verdict.test.ts (12: ordering by date then body order, case-insensitivity, scope capture, near-miss tokens, prose-only → none, first-line-per-comment) + 2 sync envelope integration tests.
- Gates: npm test 1734/1734 green, npm run lint clean, npm run build ok, arggon validate ok:true.
- Smoke (fixture /tmp/fixture-c2, fake gh on PATH — same technique as cli/src/sync-smoke.test.ts):
  - approve 2026-09-28 → request-changes 2026-09-29 ⇒ changes-requested (expected) / changes-requested (observed)
  - request-changes 2026-09-28 → approve 2026-09-29 ⇒ approved / approved
  - newer approve 2026-09-30 appended after a request-changes ⇒ flip to approved / approved
  - matched item without verdict comments ⇒ none / none
  - branch+no-PR item ⇒ absent from verdicts / absent
  - schemaVersion 1, exit_code 0 throughout.

### handoff 2026-09-29 @Arggon — next: Coordinator review of PR #440 against the review bar; merge after acceptance checklist tick
- branch: feat/task-review-verdict-checker
- open questions: None blocking; blocking merge gate deliberately out of scope per exploration-014 C2
- [ ] `docs/engineering.md` verdict convention section (minimal + example).
- [ ] `sync --json` emits additive verdict classification per matched/pending PR; unit tests for the parser (approve / request-changes / none; ordering by comment timestamp).
- [ ] README + `ArggonManager/docs/json-output.md` updated (additive fields noted).
- [ ] Smoke: fixture item with request-changes newer than approve → `changes-requested`; approve-only → `approved`; no verdicts → `none` (expected vs observed).
- [ ] Full suite + lint/typecheck green; `arggon validate` ok.

### 2026-09-29 @Arggon
verdict: approve

Reviewed statically against docs/engineering.md (read-only session — file/git-graph inspection only, no shell, so I could not re-run the suite or the smoke myself; worker-recorded evidence below). PR #440, feat/task-review-verdict-checker.

What I checked and observed:

1. Parser (lib/src/verdict.ts): `VERDICT_LINE = /^[ \t]*verdict:[ \t]*(approve|request-changes)(?=$|[ \t(])/i` — case-insensitive on token and value; near-misses `approved`/`approvals` rejected by the end/space/paren lookahead; a mid-sentence mention (`the verdict: approve ...`) rejected by the line anchor. Comment gate `^###\s+(\d{4}-\d{2}-\d{2})\s+@` is static, anchored, bounded-quantifier (no RegExp-from-input, no ReDoS surface — security bar ok) and fails closed: top-level prose, `#### Notes`, and `### handoff <date>` headings never carry verdicts. Only the first verdict-looking line per comment counts (`seenVerdictInComment`), so quoted verdicts in evidence lists cannot impersonate. Ordering = date (lexicographic, safe for YYYY-MM-DD) then body position for same-date comments.
2. Scope strictly additive: sync-command.ts diff is import + one report block + pass-through; sync-types.ts and operations.ts each gain one documented field; cli.ts gains one print loop. `JSON_SCHEMA_VERSION` is still 1 in both trees (lib/src/json.ts:6). No new network surface: verdicts read item bodies already loaded by `loadItems`; cli/src/sync-command.test.ts asserts `execGh` called exactly once per run. Classification never gates matching or exit_code (asserted in test).
3. Tests travel with behavior: cli/src/verdict.test.ts has 12 meaningful assertions including negatives (near-miss tokens, prose-only comments, mention-not-header, quoted-impersonation, empty body, date-over-position and position-tiebreak ordering, case-insensitivity, scope capture). cli/src/sync-command.test.ts covers approved / changes-requested / none per reconciled item, no_pr exclusion, and empty `verdicts` when nothing reconciles.
4. Docs match the implemented parser: engineering.md §Review bar → Review verdicts (header line + optional scope + latest-verdict-wins + report-only + blocking gate out of scope); json-output.md envelope table row + semantics paragraph (additive, schemaVersion 1, no extra gh calls, never no_pr); README §`arggon sync`; agents.md coordinator duty references the convention.
5. Boundedness: `verdicts` holds at most one entry per PR-reconciled item — same bound as the existing matched/pending arrays; classification is one linear pass per body. No unbounded growth.
6. Bundles regenerated: opencode/plugins/arggon/index.bundle.ts carries the identical COMMENT_HEADING/VERDICT_LINE regexes (lines 5627-5628) and classifyVerdicts; .opencode/plugins/arggon/index.ts too.
7. Smoke evidence recorded on the item covers all four states with expected vs observed (request-changes-newer → changes-requested; approve-newer → approved; flip-back; no-verdict → none) plus no_pr exclusion, schemaVersion 1 and exit_code 0. Worker-reported gates: npm test 1734/1734, lint clean, build ok, arggon validate ok. I could not independently re-run these from this session — CI green on the PR is the remaining confirmation.

Nits (non-blocking, no change requested):
- The human print line in cli.ts (~2795-2801) has no direct test; cli/src/sync-smoke.test.ts already asserts sibling lines and would be the natural home for one assertion.
- parseVerdicts has no fenced-code-block awareness: a quoted `### <date> @<author>` heading plus verdict line inside a code fence could register as a verdict comment. Report-only and no trust boundary is crossed (anyone can write a real verdict comment); worth a sentence in the module doc someday.
- The parser accepts leading whitespace before `verdict:` while the convention doc says the comment "starts with" the header line — a harmless superset.

Merge recommended.
