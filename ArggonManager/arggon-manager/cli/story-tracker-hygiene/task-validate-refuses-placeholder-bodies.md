---
type: task
status: in_progress
id: task-validate-refuses-placeholder-bodies
title: "validate refuses placeholder bodies on open items (blocking, decided A)"
assignee: arggon-delivery-lead
branch: feat/task-validate-refuses-placeholder-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T02:53:12.924Z"
depends_on: [task-author-methodology-improvements-bodies, task-author-parallel-worktree-bodies, task-author-tooling-env-bodies, task-author-ci-wall-clock-bodies, task-author-harness-transfer-bodies, task-author-spec-pipeline-body]
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-validate-refuses-placeholder-bodies.md
  Leaves live only under a story. id is the filename stem: task-validate-refuses-placeholder-bodies.
  CLI `arggon create task validate-refuses-placeholder-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# validate refuses placeholder bodies on open items (blocking, decided A)

## Context

Wave 2 of `decided: A` on `bug-template-only-bodies-ship-green` (depends on all six author-* tasks — the tree must be clean before the gate lands, or every lane goes red). The owner decided: a template-only body on an OPEN item must FAIL `validate`, not warn. Report-only (B) and split (C) were explicitly rejected: the delivery lead owns the backlog, so parking rot there is not an option.

Hard constraint from the wave-1 survey: the guard must match the SCAFFOLD MARKER (the `<!-- … -->` placeholder comment in a live section), never quoted prose — `bug-template-only-bodies-ship-green` itself quotes the placeholder strings in real content and must stay green.

## Acceptance

- [ ] `arggon validate` FAILS (non-zero, named error) on an open (`todo`/`in_progress`/`blocked`) item whose live `## Context` or `## Acceptance` still carries the scaffold placeholder marker
- [ ] Done/cancelled items excluded (history, not the contract) and the message says so
- [ ] The guard reads the item body (derives from source), not a restated marker copy in the test — with a negative control proving quoted placeholder prose stays green
- [ ] `ArggonManager/docs/convention.md` documents the refusal alongside the done gate; human-only waiver path stated (agents cannot waive)
- [ ] `npm test` green; prettier clean; PR opened

## Notes

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

Lead note (wave-1b gate): the guard change stays staged-uncommitted on its branch until `task-wave1b-agent-native-bodies` + `task-wave1b-mixed-bodies` merge — committing earlier turns main red on the pre-commit hook (the guard correctly refuses its own commit while 24 placeholders remain). Those two tasks are the remaining depends_on in effect; frontmatter `depends_on` untouched deliberately (`bug-update-depends-on-multiline-rejected`: the serializer would rewrite it multiline-broken).

### 2026-10-12 @ses_ed1f86789ffeDGCjHbm16z2VN9

Maker evidence (arggon-maker, worktree session, 2026-10-12):

Claim confirmed after session_move: show(meta) = in_progress + assignee arggon-delivery-lead + branch feat/task-validate-refuses-placeholder-bodies + recorded worktree_path. Never re-claimed, never took the stamp. Work done exclusively in the worktree. Live Acceptance boxes NOT ticked; status NOT flipped (lead owns done).

What changed (staged, explicit paths only):

- lib/src/placeholder.ts (new): scaffold-marker grammar over live sections (HTML comment outside inline code spans; fences/dated-comments excluded via the shared live-section extraction). No restated marker strings (kernel ships no assets, ADR 0013) — documented in the module header.
- lib/src/items.ts: liveContextRegion (mirrors liveAcceptanceRegion) + CONTEXT_HEADING; exported.
- lib/src/validate.ts: checkPlaceholderBodies pass (open statuses only, one error per item, code PLACEHOLDER_BODY, message states the done/cancelled exclusion).
- lib/src/index.ts: kernel exports. opencode/plugins/arggon/index.bundle.ts: rebuilt tracked artifact (drift gate requires committing it).
- ArggonManager/docs/convention.md: refusal documented alongside the done gate incl. human-only path (no --waive on validate, no native/MCP parameter; only path past without prose is the human-only done-gate waiver, which closes the item; agents cannot take it).
- cli/src/validate-placeholder.test.ts (new, 14 tests): markers derived at runtime from templates/*.md; negative controls from the real bug-template-only-bodies-ship-green body + quoted-marker fixtures; todo/in_progress/blocked fail, done/cancelled pass, containers fail, CLI exit-code probes.
- test/acceptance.ts: satisfyPlaceholders helper (kernel-detected, anchored replacement, fixture-only).
- Repairs (scaffold seeds now carry real prose; intent-preserving, 1-6 lines each): cli/src/{deps,comment,handoff,comment-race,milestone,promote,update-reparent,frontmatter,lib,mcp-parity,mcp-server,layout,import-issues,worktree}.test.ts, opencode/plugins/arggon/tools.test.ts (test seed only, no product change), labs/torture.test.ts.

Gates:

- validate BEFORE (clean checkout, stale build): green, 0 errors.
- validate AFTER (built kernel): 24x PLACEHOLDER_BODY, nothing else. Full list in the handoff context and in the blocked-commit log below.
- npm test: 3154/3156 pass. Only failures: cli/src/validate.test.ts "passes the sample launch-mvp tree" + cli/src/capability-matrix.test.ts real-tree validate — both assert the REAL tree green and fail solely on the same 24 (left strict by design; see blocker).
- npx prettier --check on all 24 touched files: clean. tsc --noEmit: clean. npm run build: ok (dist + drift-gated bundle rebuilt).
- Probes (built dist/cli.js on scratch trackers in /tmp/opencode): A placeholder/todo -> exit 1, single [PLACEHOLDER_BODY] naming live '## Context', --json error.code VALIDATE_FAILED (expected fail, observed fail). B quoted-prose/todo -> exit 0 ok (expected pass, observed pass). C done/with markers in BOTH sections -> exit 0 ok (expected pass, observed pass).
- Native tools.arggon.validate in THIS session reports ok:true/0 errors: STALE SEAM, not evidence. This session loaded the vendored plugin before the change (documented predates-050 behavior); disk copy .opencode/plugins/arggon/index.ts is already refreshed (00:05, contains the guard). CLI (built kernel) is the authoritative evidence above; a new session will load the fresh seam.

BLOCKER — commit/push did NOT land (reported exactly, not bypassed):

- git add (explicit paths) staged 24 files fine. git commit was REFUSED by the repo pre-commit hook (#!/bin/sh: npm run --silent arggon -- validate) with exit 1: the 24 PLACEHOLDODER_BODY errors above. --no-verify is denied to agents and was not used.
- Root cause: the dispatch premise "Wave 1 is fully merged, the tree is clean" is FALSE. All six author-* deps are done, but they covered only their named files; 24 open items OUTSIDE wave-1 scope still carry live scaffold markers (20 with both sections, 4 with one). Three have zero dated Notes (nothing to transcribe; authoring needs domain judgment): bug-context-report-baseline-date-mismatch, bug-mcp-budget-contradicted-across-docs, bug-release-needs-auth-self-describing. Full 24: the parallel-worktree 7 (bug-force-push, bug-fresh-worktree-refusal, bug-gatebin-budget, bug-mcp-server-binds, bug-prover-agent-entry, bug-self-decided, bug-task-permissions), methodology-improvements 3 (bug-context-report, bug-mcp-budget, bug-wave-probe), spec-pipeline 2 (bug-parity-suite, bug-zero-byte), tooling-env 6 (bug-bundle-update, bug-ci-seam-pin, bug-prose-format-timeout, bug-stale-merge, bug-test-spawn, bug-verification-regex), role-model-foundation 3 (bug-adopter-engineering, bug-verifier-cannot-read, bug-x-tracker-option), release-pipeline 1 (bug-release-needs-auth), adapter-selection 1 (task-adapter-report-nits), capability-matrix 1 (task-capability-matrix-followups).
- Blast radius is confined to this branch until merge (other checkouts run pre-guard builds; main stays green). Merging this branch first would turn main red and wedge every lane's commits on the same hook — do NOT merge before wave-1b.
- Change is staged and ready; committing is mechanically unblocked the moment the 24 are authored (no rework needed here).

No tracker items filed, no bodies outside the item touched, no scope growth (the 24 are reported, not fixed).

### handoff 2026-10-12 @ses_ed1f86789ffeDGCjHbm16z2VN9 (session: ses_ed1f86789ffeDGCjHbm16z2VN9) — next: Dispatch wave-1b author pass over the 24 listed placeholder items, then commit this staged change and re-run gates

- branch: feat/task-validate-refuses-placeholder-bodies
- open questions: Wave-1b scoping/ownership per area; whether import/adopt scaffolds get authored post-creation; restore-strictness not needed (tests already strict)
