---
type: task
status: done
id: task-board-build-stamp
title: Board serves its build commit so a stale deployment is diagnosable from the drawer
assignee: arggon-delivery-lead
branch: feat/task-board-build-stamp
parent: ui-web-board-v2
labels: []
created: "2026-10-12"
updated: "2026-10-16"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-build-stamp.md
  Leaves live only under a story. id is the filename stem: task-board-build-stamp.
  CLI `arggon create task board-build-stamp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board serves its build commit so a stale deployment is diagnosable from the drawer

## Context

Found 2026-10-12 from a product-owner report: the drawer on their board shows the PRE-#728 shape (parent as plain text, no children section) while current main provably renders parent-as-link + children (reproduced in Chromium against a fresh `board --serve`: `data-detail-id` anchor + `drawer-children` section present; `/api/item` edges exact). Diagnosis is stale deployment — a checkout/build predating the #728 merge, a cached page/JS bundle, or a static export generated before #728 — but nothing in the board says which commit it was served from, so "stale" vs "broken" took a full repro to separate. The board has a freshness stamp for data; it has no identity for its own build.

## Acceptance

- [x] The served board and the static export expose the build commit (hash and/or release version) somewhere the viewer can read without devtools (footer, drawer meta, or equivalent)
- [x] The value comes from the build (`write-build-info.mjs` or equivalent), never hand-maintained
- [x] Static export stamps at export time; serve mode stamps at server start
- [x] `board-parity` pins it; `arggon validate` green; prettier clean; PR opened

## Notes

### 2026-10-16 @ses_ebbc5ea3effezfLY0eElZwxH3T

Maker evidence (task-board-build-stamp, commit 1973bdf9, branch feat/task-board-build-stamp pushed to origin).

Files changed (5, +256/-5): cli/src/board.ts (build opt on BoardOptions/renderBoardHtml, runBoard resolves buildVersion() at export time, header meta + footer#board-build + drawerMarkup(build) panel chrome, footer/drawer CSS), cli/src/board-serve.ts (build opt, captured once at server start, passed per render), cli/src/board.test.ts (+5 build-stamp tests), cli/src/board-parity.test.ts (+4 parity tests incl. serve-vs-static shape parity), README.md (build-stamp bullet).

Gates (expected vs observed):

- `npm run arggon -- validate` → expected ok, observed ok (0 warnings, convention v5; also ran as pre-commit hook on 1973bdf9)
- `npx prettier --check` on 5 touched files → expected clean, observed clean (after --write on board.ts/board.test.ts)
- `npx tsc --noEmit` → expected clean, observed clean
- `npm run lint` → expected clean, observed clean
- `npx vitest run board/board-parity/board-serve/board-embed/build-info/cli` → expected all pass, observed 6 files / 263 passed
- `npm run build` → expected ok + build-info names worktree HEAD, observed ok, dist/build-info.json = 4a5c1585 feat/task-board-build-stamp
- UI smoke (Playwright chromium headless vs real startBoardServer on temp fixture, script removed after): expected footer stamp visible + drawer stamp visible + cards match list, observed footer "build 0.10.0 (4a5c1585, feat/task-board-build-stamp)" visible=true, drawer same text visible=true after card click, cards [launch,story-a,task-one] == list ids, screenshot /tmp/opencode/board-stamp-smoke.png. SMOKE PASS.

Design notes for reviewer: JSON envelopes untouched (no json-output.md change needed); renderBoardHtml without `build` renders legacy bytes so existing byte-identical assertions hold; escaping via escapeHtml on all three surfaces (hostile-string test included); axe contrast inherits the already-measured meta grey pairs.

Follow-ups found (not filed — lead consolidates): none. Possible future: e2e @smoke assertion for #board-build (currently covered by unit+parity+manual smoke only).

Acceptance readiness: all four boxes are ready to tick — served + static stamp viewer-visible (footer/header/drawer), value from buildVersion()/write-build-info.mjs, export-time vs server-start wiring + tests, board-parity + validate + prettier green. PR not opened (branch pushed; lead opens).

### handoff 2026-10-16 @ses_ebbc5ea3effezfLY0eElZwxH3T (session: ses_ebbc5ea3effezfLY0eElZwxH3T) — next: Lead: review 1973bdf9, tick acceptance, open PR from feat/task-board-build-stamp

- branch: feat/task-board-build-stamp
- open questions: PR creation left to lead; e2e @smoke pin for #board-build optional

### 2026-10-16 @Arggon

verdict: approve (board build-stamp, commit 1973bdf9)

- standards review: boundaries clean (cli/board surface, no schema fork, no new deps), value-from-build wiring real (runBoard export-time, serve server-start, same buildVersion as --version), three surfaces escaped via escapeHtml, legacy-bytes guard holds, tests discriminate, README travels, scope 5 files +256/-5
- verifier evidence: validate ok 0 warnings; prettier clean 5 files; tsc clean; lint clean; vitest 6 files / 263 passed incl 9 new build-stamp tests; real-browser Chromium smoke PASS (footer #board-build visible, drawer #board-drawer-build visible after card click, cards match list)
- probes 1-6 pass; probe 7 CI ui-smoke lane skipped locally, to confirm on PR
- advisory nit (non-blocking): README --details byte-identical phrasing now version-relative; optional follow-up e2e @smoke pin for #board-build to file separately
