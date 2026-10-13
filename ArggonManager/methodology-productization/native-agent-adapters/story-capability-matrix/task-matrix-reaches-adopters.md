---
type: task
status: in_progress
id: task-matrix-reaches-adopters
title: "`adapters/capability-matrix.json` never reaches an adopter: it is not in the package `files` (blocked by the tagged-version guard) so `doctor` reports \"not found\" in every adopter tree"
assignee: arggon-delivery-lead
branch: feat/task-matrix-reaches-adopters
parent: story-capability-matrix
labels: [adopters, packaging]
created: "2026-10-02"
updated: "2026-10-13"
claimed_at: "2026-10-13T03:19:04.611Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-matrix-reaches-adopters
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/task-matrix-reaches-adopters.md
  Leaves live only under a story. id is the filename stem: task-matrix-reaches-adopters.
  CLI `arggon create task matrix-reaches-adopters` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `adapters/capability-matrix.json` never reaches an adopter: it is not in the package `files` (blocked by the tagged-version guard) so `doctor` reports "not found" in every adopter tree

## Context

Found while reviewing PR #600 (task-capability-matrix), 2026-10-02 — the worker flagged it as a deliberate trade-off rather than an oversight.

The capability matrix ships as `adapters/capability-matrix.json` in the repo, but `adapters/` is NOT in the root `package.json` `files` list, so it never enters the published tarball. Adding it is a shipping-field change, and `v0.5.0` is already tagged, so the CI version guard ("Fail if package.json version is already tagged") correctly refuses the PR until a release bump. The worker reverted rather than smuggling a version bump.

Consequence: in every ADOPTER tree, `arggon doctor` reports `matrix: not found … report-only`. The feature works for this repo's own development and is invisible to the adopters it was meant to serve — which is the opposite of the point of a capability matrix that reports per-agent methodology coverage.

This is also a sequencing trap for the sibling adapter tasks (T2/T4/T5): any per-agent asset added under `adapters/` inherits this same invisibility until the packaging or init path carries it.

## Acceptance

- [ ] the matrix reaches an adopter tree — either `adapters/` joins the pack
      `files` allowlist (a shipping change, so it must land with a release that
      bumps the version past the tagged one) or a scaffold path (`arggon init`,
      template-bundled) writes `adapters/capability-matrix.json` into the adopter
      tree; the decision is recorded in this item's Notes
- [ ] `arggon doctor` in a FRESH `arggon init` tree reports `matrix.present:
    true` with the expected row/gap counts (verified on a temp fixture, not on
      this repo)
- [ ] the reading path stays tree-only, so the headless pack↔checkout envelope
      parity gate (`cli/src/headless-ci.test.ts`, "packed-bin --json envelopes
      are byte-identical to the checkout CLI") is still green
- [ ] the chosen destination is covered by the pack allowlist test in
      `cli/src/pack-contents.test.ts`, and the version guard is satisfied by an
      actual release rather than a manual bump
- [ ] `arggon validate`, the full test suite, lint and `npm run check:plugin` are
      green on the change
- [ ] the matrix's own gap rows are re-derived from the seam this path delivers
      (a Claude Code adopter tree that now carries the matrix still has no hook
      gate and no session context hook — do not flip those rows just because the
      file is visible)

## Notes

### 2026-10-13 @arggon-maker
### 2026-10-13 @arggon-maker — decision: path (b), template-bundled scaffold

**Decision (recorded here as the item's Notes).** The matrix reaches an adopter tree as a **tier-1 generated destination**: the committed matrix is shipped as the template `templates/docs/adapters/capability-matrix.json`, and `arggon init` writes `adapters/capability-matrix.json` into the tree (same never-overwrite/provenance machinery as every other generated doc). Path (a) — adding `adapters/` to the pack `files` allowlist — was rejected on evidence, not preference:

- `files` is a publish-relevant field (`cli/version-guard.mjs` SHIPPING_FIELDS) and `v0.7.1` is already tagged (release PR #749 landed on main while this branch was open; `git tag --sort=-v:refname | head -3` → v0.7.1, v0.7.0, v0.6.0), so the guard correctly refuses a `files` change until a release bumps past it. The acceptance forbids a manual bump, and a release is not this item's to cut.
- Path (b) touches **no** publish-relevant field: `git diff --name-only origin/main...HEAD | grep -c '^package.json$'` → `0`; `node cli/version-guard.mjs <main's package.json>` → "none of the publish-relevant fields (name, version, private, bin, files, dependencies, engines) — dev-only change, no version bump required" (exit 0). The guard is therefore satisfied without any bump.

**Files changed.** `templates/docs/adapters/capability-matrix.json` (new; byte-identical to `adapters/capability-matrix.json`), `cli/src/capability-matrix.test.ts` (four-gate header + a new describe: shipped bytes, destination registration, fresh-tree init + doctor counts), `cli/src/init.test.ts` (TIER1_DOCS), `cli/src/adapter-selection.test.ts` (NON_ADAPTER_DOCS + two tests whose premise was "a fresh init tree has no matrix" — now rewritten to the delivered behavior; snapshot updated), `cli/src/pack-contents.test.ts` (required list), `cli/src/capability-matrix.ts` (resolution docstring), `ArggonManager/.convention.yml` (x-generated record for the new destination), `README.md` + `ArggonManager/docs/json-output.md` (tier-1 list, agent-agnostic artifacts, matrix resolution).

**Fixture proof — fresh `arggon init`, never this repo** (`/tmp/opencode/matrix-proof-HRLxzL`, a bare `git init` tree):

```
$ node <worktree>/dist/cli.js init --no-commit          # exit 0
  - governing docs (61): … adapters/capability-matrix.json …
$ cmp <fixture>/adapters/capability-matrix.json <worktree>/templates/docs/adapters/capability-matrix.json
  byte-identical-to-shipped-template
$ node <worktree>/dist/cli.js doctor --json | jq .matrix
  { "present": true, "source": "adapters/capability-matrix.json", "schemaVersion": 1,
    "agents": ["claude","opencode","zcode"], "invariants": 5, "rows": 15, "gaps": 2,
    "gapsByAgent": [{"agent":"claude","gaps":2}], "invalid": 0, "truncated": false, "error": null }
$ node <worktree>/dist/cli.js doctor | grep -E "matrix:|gap:"
  matrix: adapters/capability-matrix.json — 5 invariant(s) x 3 agent(s) = 15 row(s), 2 gap(s) (report-only, never blocking)
  gap: discipline-enforceable x claude — …; gap: docs-travel-with-code x claude — …
```

Expected vs observed: expected `matrix.present: true` with the committed file's counts (5 × 3 = 15 rows, 2 gaps); observed exactly that, tree-only source, `invalid: 0`. Tarball check: `npm pack --dry-run --json` → `templates/docs/adapters/capability-matrix.json` present, root `adapters/capability-matrix.json` absent (149 files).

**Reading path stays tree-only.** No reader change; the parity gate's shape is untouched (both bins on the same tree read the same tree copy).

**Gap rows re-derived, not flipped.** The path adds a data file, not a client-native mechanism, so `claude × discipline-enforceable` (no `.claude/` hook gate — `find templates/docs -iname '*claude*'` → only `CLAUDE.md`; `PreToolUse` exists only in the zcode seam) and `claude × docs-travel-with-code` (no session context hook) stay gaps. `adapters/capability-matrix.json` is byte-unchanged by this PR; 15 rows / 2 gaps before and after.

**Ledger decision (pin-relevant).** The provenance audit (`cli/src/provenance-audit.test.ts`, "this repo's own committed seam has no ledger violations") correctly flagged the new destination's committed copy as a `missing-record`: without a record, init classifies it adopter-modified and silently stops propagating template edits. The record is written with `arggonVersion: "0.7.0"` — the pin. A stamp newer than `ARGGON_VERSION` is a re-pin request, not a bookkeeping edit (`bug-skill-source-edit-leaves-ledger-stale`, recorded lesson), and the re-pin cannot be routed here: the released 0.7.1 tarball predates this template, so regenerating with it would orphan-and-reap the file. The next release (which carries the template) refreshes this stamp through the normal re-pin.

**Residual interaction (open question for the delivery lead).** A stamp at the pin keeps both gates green but means the pinned 0.7.0 binary's `init` — if anyone ran it on this repo — would see the entry's template as absent and reap the unmodified file (checksum matches; not a downgrade at equal versions). CI never takes that path (this checkout is the seam's source, so the drift step regenerates with the branch build) and 0.7.1 is already released, so the window closes at the next release + re-pin. It also looks structural rather than specific to this item: a NEW generated destination added mid-cycle cannot both stay ≤ the pin (lag assertion) and read as "newer than the pinned install" (downgrade refusal) — worth a filed follow-up if the lead agrees, not fixed here.

**Gates** (worktree `feat/task-matrix-reaches-adopters`, merged with `origin/main` at 0.7.1; all green):

- `npm run build` ✓
- `npm test` ✓ — 149 files / 3250 tests passed (119s), including `headless-ci.test.ts`'s "packed-bin --json envelopes are byte-identical to the checkout CLI"
- `npm run lint` ✓ · `npm run test:structure` ✓ · `npm run lint:structure` ✓ · `npm run check:plugin` ✓
- `npm run arggon -- validate --json` → `{"ok":true,"schemaVersion":1,"conventionVersion":5,"layout":"arggon-manager","errors":[],"warnings":[]}`
- `npx prettier --check` on every touched file ✓ (one formatting-only hunk in `adapter-selection.test.ts`, a pre-existing drift line in a touched file)

**PR: #763** — `gh pr create --base main --head feat/task-matrix-reaches-adopters`. Not merged; the done flip is the delivery lead's call.

### handoff 2026-10-13 @arggon-maker (session: ses_eccb87007ffdvyi3SiDGkrAOJi) — next: Review PR #763 (decision + fixture evidence in the comment above); merge if green; the next release+re-pin refreshes the new ledger stamp
- branch: feat/task-matrix-reaches-adopters
- open questions: ledger stamp kept at pin 0.7.0 (pinned init could reap the copy until next release+re-pin); mid-cycle new destinations cannot satisfy both pin-lag and downgrade-refusal
