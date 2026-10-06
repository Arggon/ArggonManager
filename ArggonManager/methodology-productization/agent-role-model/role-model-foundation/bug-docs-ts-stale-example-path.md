---
type: bug
status: done
id: bug-docs-ts-stale-example-path
title: cli/src/docs.ts orphan-reaping example path is stale — the example names a destination the rename removed
assignee: arggon-delivery-lead
branch: fix/bug-docs-ts-stale-example-path
parent: role-model-foundation
labels: [docs, cli]
priority: p3
created: "2026-10-05"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-docs-ts-stale-example-path.md
  Leaves live only under a story. id is the filename stem: bug-docs-ts-stale-example-path.
  CLI `arggon create bug docs-ts-stale-example-path` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cli/src/docs.ts orphan-reaping example path is stale — the example names a destination the rename removed

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

Found reviewing PR #641: `cli/src/docs.ts` (~line 990) carries a stale example path in the
orphan-reaping comment/label — it names a **destination the rename removed**. A worked example
in the code that decides whether a file may be deleted should name a file that exists, or a
reader cannot tell an example from a live value.

## Acceptance

- [x] The example names a destination that exists in the current templates (the four shipped agent ids are the natural choice)
- [x] If the string is a **fallback/literal** rather than an example, say so in the comment — ambiguity here is the defect
- [x] `npm run check:plugin` green if the bundle inlines this file; `npm test` green; prettier clean

### 2026-10-05 @arggon-maker — resolution: ambiguity fixed, not the id swapped

**One occurrence**, not several: `grep -n 'arggon-coordinator|arggon-worker|arggon-reviewer' cli/src/docs.ts`
returns exactly one hit — line 990, in the JSDoc policy note of `classifyOrphan`. The other two
`.opencode/agents/` mentions in the file (`:385` `.opencode/agents/x.md`, `:980`
`.opencode/agents/*.md`) are placeholder/glob and were already current.

**The string is an EXAMPLE, not a fallback/literal** — it is JSDoc prose on
`classifyOrphan`, never read by code. So criterion 2 applies and the fix is to resolve the
ambiguity, per the item Context ("a reader cannot tell an example from a live value").

**I did not swap the id to a live one, and that is the substantive call.** `.opencode/agents/arggon-coordinator.md`
was a REAL generated destination (`git log --diff-filter=ADR`: added `7122c8c1`, renamed away in
`0d1571e0`), and the paragraph's subject is exactly a destination the rename _removed_ — "clear a
dead agent — which the agent rename depends on (ADR 0021 §6.2a′ gates it on reaping)". Substituting a
shipped id (`arggon-delivery-lead.md` and friends) would make the sentence self-contradictory: a
live destination still has its template, so it can never be an orphan, so it can never be
"stranded". The retired id is the only class of path this note is about. Acceptance criterion 1
read literally would have made the docs worse.

Instead the example is now marked retired **and** names its live successor, so the reader can no
longer mistake it for a current destination:

> The case that matters is a destination the rename RETIRED, not a live one: stranded,
> `.opencode/agents/arggon-coordinator.md` is still dispatched as an agent, and no current template
> generates it (its successor is `arggon-delivery-lead.md`).

Mapping verified against ADR 0021 §6.2a′ (`arggon-coordinator` → `arggon-delivery-lead`); the
"no current template generates it" claim verified against `templates/docs/opencode/agents/` (4 files)
and `templates/docs/zcode/arggon/agents/` (3 files) — neither contains a retired id. Comment grew 8 → 10
lines, wrapping held at ≤77 cols to match the surrounding note.

**Generated mirrors: none to move.** The same policy is mirrored in `README.md:222`, but it names no
agent id at all — it says "Arming is how an adopted repo clears a dead agent across a rename" — so it
was already immune to rename drift and needed no change. No skill reference carries a retired id
(`.agents/skills/arggon-cli/**` absent from the repo-wide `arggon-coordinator` grep).
`check:plugin` confirms `cli/src/docs.ts` is **not** inlined into
`opencode/plugins/arggon/index.bundle.ts` (`grep -c` = 0; bundle diff empty after rebuild).

**Found, NOT fixed (out of my scope — recommend filing):** `ArggonManager/docs/json-output.md` carries
retired ids as live `doctor` example values — `:806`
`"agents": ["arggon-coordinator", "arggon-reviewer", "arggon-worker"]` and `:916`
`{"path": ".opencode/agents/arggon-coordinator.md", "status": "adopter-edited"}`. Neither is a mirror
of the `docs.ts` note (independent envelope examples), and that file is **hand-maintained, not
template-generated** — it is absent from `templates/docs/docs/` and from the convention's managed-doc
set, so there is no template to fix instead. `:806` also needs a real answer to the 4-vs-3 OpenCode/ZCode
shipped-agent asymmetry, which is its own change. Left untouched deliberately.

Gates (all on `fix/bug-docs-ts-stale-example-path`, after `npm run build`): `npm test` 128 files /
2680 tests passed (the filed `headless-ci` flake did not reproduce on this run); `npm run lint` clean;
`npm run test:structure` 5 passed / 0 failed; `npm run lint:structure` clean; `npm run build` ok;
`npm run check:plugin` clean; `npm run arggon -- validate` ok (0 warnings, convention v5);
`prettier --check cli/src/docs.ts` clean.

### 2026-10-05 @ses_ef1ad3ccbffe6ACtjjOZJJHx84
## Maker evidence — branch `fix/bug-docs-ts-stale-example-path` @ `f3ae6d77`

**Changed (2 files):** `cli/src/docs.ts` (the fix, JSDoc only) + this item file (checklist + notes).

### The substantive call: I did NOT swap the retired id for a live one
Acceptance criterion 1 as written ('the four shipped agent ids are the natural choice') would have made the docs WORSE, so I took criterion 2 instead. Evidence:

- `.opencode/agents/arggon-coordinator.md` **was a real generated destination** — `git log --diff-filter=ADR -- '.opencode/agents/*'` shows it added in `7122c8c1` and renamed away in `0d1571e0`.
- The note's subject is exactly that case: 'clear a **dead agent** — which the agent rename depends on (ADR 0021 §6.2a′ gates it on reaping)'.
- A shipped id (e.g. `arggon-delivery-lead.md`) still HAS its template, so it can never be an orphan, so it can never be 'stranded' — the swapped sentence would contradict itself and teach readers the wrong definition of orphan.
- Precedent for leaving it: `task-agent-role-contracts-seam.md:147` called this a 'one-token comment fix'; the one token was not the id, it was the missing 'this is retired' marker.

The example is kept and disambiguated instead — flagged `RETIRED`, with its live successor named:
> The case that matters is a destination the rename RETIRED, not a live one: stranded, `.opencode/agents/arggon-coordinator.md` is still dispatched as an agent, and no current template generates it (its successor is `arggon-delivery-lead.md`).

Mapping verified against ADR 0021 §6.2a′. 'No current template generates it' verified against `templates/docs/opencode/agents/` (4 files) and `templates/docs/zcode/arggon/agents/` (3 files) — neither holds a retired id. Comment 8 → 10 lines, wrap held ≤77 cols.

### Occurrences: exactly ONE in the file
`grep -n 'arggon-coordinator|arggon-worker|arggon-reviewer' cli/src/docs.ts` → 1 hit (line 990). The file's other two `.opencode/agents/` mentions (`:385` `x.md` placeholder, `:980` `*.md` glob) were already current. Not a fallback/literal — it is JSDoc prose on `classifyOrphan`, never read by code.

### Generated mirrors: none moved (and here is why, explicitly)
- `README.md:222` mirrors the same policy but names **no agent id** ('Arming is how an adopted repo clears a dead agent across a rename') — already rename-proof, needed nothing.
- No skill reference carries a retired id (`.agents/skills/arggon-cli/**` absent from a repo-wide `arggon-coordinator` grep).
- `check:plugin` clean ⇒ `cli/src/docs.ts` is NOT inlined into `opencode/plugins/arggon/index.bundle.ts` (`grep -c` = 0, bundle diff empty after rebuild). So no bundle regeneration is owed.
- **No template to fix:** `json-output.md` is not template-generated.

### FOUND, NOT FIXED — recommend filing as a separate bug (out of my scope)
`ArggonManager/docs/json-output.md` carries retired ids as live `doctor` example values:
- `:806` `"agents": ["arggon-coordinator", "arggon-reviewer", "arggon-worker"]`
- `:916` `{"path": ".opencode/agents/arggon-coordinator.md", "status": "adopter-edited"}`

Neither mirrors the docs.ts note (independent envelope examples), so not a doc-surface mirror of mine. The file is **hand-maintained, not generated** — absent from `templates/docs/docs/` and from the convention's managed-doc set, so there is no template to fix instead. `:916`'s `adopter-edited` is now impossible for that path (template gone ⇒ orphan status, not adopter-edited). `:806` additionally needs a real answer to the 4-vs-3 OpenCode/ZCode shipped-agent asymmetry. Left untouched deliberately rather than growing this diff.

### Gates — all run after `npm run build`, on this branch
| gate | result |
|---|---|
| `npm test` | **128 files / 2680 tests passed** (the filed `bug-headless-ci-twin-init-nondeterministic` flake did NOT reproduce on this run) |
| `npm run lint` | clean, no output |
| `npm run test:structure` | `5 passed; 0 failed` |
| `npm run lint:structure` | clean, no findings |
| `npm run build` | ok (lib + tsc ×3 + postbuild) |
| `npm run check:plugin` | clean, empty bundle diff |
| `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` |
| `prettier --check cli/src/docs.ts` | `All matched files use Prettier code style!` |

Committed without `--no-verify`; the pre-commit gate ran (`arggon validate: ok` in the hook output). Staged explicit paths only.

Item left `status: in_progress` — not flipped to `done` (delivery lead's call after merge).

### handoff 2026-10-05 @ses_ef1ad3ccbffe6ACtjjOZJJHx84 (session: ses_ef1ad3ccbffe6ACtjjOZJJHx84) — next: Lead: review f3ae6d77 + f030e6b4, open the PR against main (no squash, per repo convention), and decide the json-output.md follow-up
- branch: fix/bug-docs-ts-stale-example-path
- open questions: I did NOT swap the retired id for a shipped one — a live destination has a template, so it can never be an orphan; flagged RETIRED + named successor instead. Agree? Also: file the json-output.md stal…

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
Merged: PR #650, all three lanes green (`cli`, `tasks-validate`, `ui-smoke`), `MERGEABLE/CLEAN`. Reviewed against `engineering.md` §Review bar: architecture/boundaries, docs travelling with the change, scope held to one file, and the blocking end-to-end check.

Note on the `headless-ci` lane: it passed on this run. That file is environment-sensitive and did not reproduce here or in the maker's 10 full runs — consistent with `bug-headless-ci-twin-init-nondeterministic` being load- or cache-dependent rather than universally broken. The blocker I reported earlier was real but is not deterministic, and I am no longer treating it as a hard gate on every PR.
