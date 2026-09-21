---
type: bug
status: in_progress
id: bug-formatter-glues-markdown-spaces
title: Formatter glues markdown spaces around inline code (prettier 3.9.6)
assignee: Arggon
branch: fix/bug-formatter-glues-markdown-spaces
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
claimed_at: "2026-09-21T22:40:49.883Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-formatter-glues-markdown-spaces
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-formatter-glues-markdown-spaces.md
  Leaves live only under a story. id is the filename stem: bug-formatter-glues-markdown-spaces.
  CLI `arggon create bug formatter-glues-markdown-spaces` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Formatter glues markdown spaces around inline code (prettier 3.9.6)

## Context

Found in the PR #384 review (`task-native-lib-hygiene`, finding F1): with the
repo's `formatter: true`, prettier 3.9.6 **removes the spaces around inline
code spans** in `ArggonManager/docs/json-output.md` (reproduced on the intact
base: `prettier --write` over `origin/opencode2:docs/json-output.md` produces
the four glued tokens, and `prettier --check` already warns at base). The file
cannot be prose-correct and prettier-clean at the same time; CI does not run
prettier, so the corruption went unnoticed until a review token-diff. The fix
restored the spaces, leaving `prettier --check` warning only on that file.

## Acceptance

- [x] Decide the guard: pin/configure prettier so it stops gluing inline-code
      spacing, exclude markdown prose from `npm run format`, or add a prose
      token-diff check. **Decided: prose token-diff check** (`cli/src/prose-format.test.ts`)
      plus the source repair. Pin/config rejected with evidence — the glue reproduces on
      prettier 3.5.3/3.6.2/3.7.4/3.8.1/3.9.0/3.9.6 and under every markdown option
      (`--print-width 80…100000`, `--prose-wrap always|never|preserve`); `.prettierignore`
      rejected because it hides the corruption, loses table formatting, and leaves the
      spans rendering wrong.
- [x] `npm run format` no longer corrupts `docs/json-output.md` (or the
      exclusion is documented). `prettier --write` on the repaired file is a
      byte-identical no-op (at base it produced the 4 glues plus a mis-padded table);
      the guard pins it in CI.
- [x] Any existing glued tokens elsewhere in docs are repaired (token-diff).
      Repaired the 4 glues in `docs/json-output.md` and the 2-space indent loss in
      `skills/arggon-cli/references/pitfalls.md`. Token-diff over all 552 tracked `.md`
      files: the only remaining hits are 2 tracker items that quote the mangled output as
      evidence (excluded from the guard by design); the indentation-variant findings
      outside this item's scope are listed in the comment below.
- [x] `arggon validate` green; CI green. `arggon validate: ok (0 warning(s),
      convention v5)`; PR #387 checks: `cli` pass (4m9s), `tasks-validate` pass (35s).

## Notes

- Filed per the review-findings rule; cosmetic but recurring (the auto-formatter
  runs on every edit in this repo).

### 2026-09-21 @Arggon
**Worker evidence — guard decision, repairs, gates** (branch `fix/bug-formatter-glues-markdown-spaces`, PR #387, commit `efd1d88`).

### Guard decision (acceptance 1)

**Chosen: prose token-diff check + source repair.** Rejected alternatives, with the probes that killed them:

- **Pin/config (rejected).** `prettier --write` over `origin/opencode2:ArggonManager/docs/json-output.md` (intact base) produces the four glues on **3.5.3, 3.6.2, 3.7.4, 3.8.1, 3.9.0 and 3.9.6**, and with `--print-width 80|100|500|100000` and `--prose-wrap always|never|preserve` — so no version pin and no markdown option fixes it. Root cause: `\`` is **not** an escape inside a CommonMark code span; the parser splits the span at the inner backticks and prettier's printer rebuilds the pieces from its own parse, dropping the whitespace around the split.
- **`.prettierignore` for docs prose (rejected).** It only hides the corruption, loses table formatting, and leaves the spans rendering wrong (the source is invalid markdown, so `docs/json-output.md` renders several broken spans today).

### Changes

- `ArggonManager/docs/json-output.md`: the 4 spans are re-encoded with ` ``double-backtick`` ` delimiters; each now parses as **one** code span whose value is the CLI's actual string (`OPENCODE_MCP_HINT`, init's git warning, the outdated-docs hint, the doctor sample JSON). `prettier --check` is now clean on the file (it warned at base); the same formatter run re-padded the `start` table to canonical alignment (whitespace/dashes only).
- `skills/arggon-cli/references/pitfalls.md`: the code span that spanned a line break is kept on one line, so prettier can no longer eat the continuation indent (`8c98b03` had already lost 2 spaces that way).
- `cli/src/prose-format.test.ts` (new): formats every tracked markdown file outside the tracker item tree with the repo's prettier config and fails when a formatted token is the concatenation of whitespace-separated source tokens — a glue — requiring the same neighbours so a coincidental substring cannot fire it. CI runs it via `npm test`.

### Expected vs observed

| Check                                     | Expected                 | Observed                                                                                                                                     |
| ----------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| guard on the pre-repair file              | fail, naming the 4 glues | fail: `` `null` otherwise → `null`otherwise; and `.mcp.json` → and`.mcp.json`; `v1.findings` entries → `v1.findings`entries; as `{ → as`{ `` |
| guard on the repaired tree                | pass                     | pass (1.6 s)                                                                                                                                 |
| `prettier --write` on the repaired docs   | no prose loss            | **byte-identical** for both files                                                                                                            |
| `npm test`                                | green                    | 91 files / 1467 tests pass                                                                                                                   |
| `npm run lint`, `npm run build`           | green                    | green (plugin bundle unchanged)                                                                                                              |
| `arggon validate`, `arggon spec validate` | green                    | ok (0 warnings, convention v5) / ok (18 docs, 0 warnings)                                                                                    |
| PR #387 CI                                | green                    | `cli` pass (4m9s), `tasks-validate` pass (35s)                                                                                               |

### Out of scope — reported for triage, not in this PR

Same defect class in files outside this item's scope. Token-diff over all 552 tracked `.md` files (format each in-memory, compare whitespace-separated tokens):

- **Token glues** remain only in 2 tracker items that quote the mangled formatter output as evidence: `task-native-lib-hygiene` and `bug-seam-signature-anchor-regressed` (the latter also loses spaces between paragraph lines). Tracker item bodies are excluded from the guard by design — they are historical records.
- **Indentation variant** (code span spanning a line break: prettier joins it and drops the continuation line's indent — renders identically, cosmetic): `docs/explorations/exploration-adopter-upgrade-experience-007.md`, `docs/explorations/exploration-priority-model-008.md`, `docs/explorations/exploration-torture-contention-005.md`, `docs/plans/plan-spec-pipeline-002.md`, `docs/specs/spec-priority-field-008.md`, `docs/specs/spec-spec-pipeline-002.md`, plus `docs/playbooks/node.md` and `docs/playbooks/vitest.md` (in flight in the playbook work item) and 3 tracker items.

Each repair needs its code span restructured, not just the whitespace restored (prettier re-removes it — verified on `pitfalls.md`), so they belong in a follow-up item rather than in this diff. Repro for the whole list: `prettier --write` a copy of each file with the repo config and compare the whitespace run before/after each token.

### handoff 2026-09-21 @Arggon — next: Review PR #387 (guard test + 4 span repairs + pitfalls restructure); merge with a merge commit (tracker-carrying branch); then decide the follow-up for the indentation-variant docs listed in the comm…
- branch: fix/bug-formatter-glues-markdown-spaces
- open questions: File the follow-up item for the 8 docs with the indent variant (2 playbooks in flight)? Extend the guard with an indentation rule once they are repaired?
