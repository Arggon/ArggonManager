---
type: task
status: in_progress
id: task-board-footer-links-the-friction-report
title: Board footer links the friction report
assignee: arggon-delivery-lead
branch: feat/task-board-footer-links-the-friction-report
parent: ui-web-board-v2
labels: []
created: "2026-10-16"
updated: "2026-10-16"
claimed_at: "2026-10-16T14:07:18.089Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-footer-links-the-friction-report
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-footer-links-the-friction-report.md
  Leaves live only under a story. id is the filename stem: task-board-footer-links-the-friction-report.
  CLI `arggon create task board-footer-links-the-friction-report` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board footer links the friction report

## Context

Product-owner request 2026-10-16 (after the friction channel landed in the tracker loop): the friction log is invisible unless you run `arggon friction --report` on the machine that recorded it. They want something in the board UI to see those frictions. Placement decided by the owner: a footer link/badge next to the build stamp (task-board-build-stamp), not the drawer.

Shape notes for the maker: the log is per-machine local state (`arggon friction --report` renders the deduped, redacted report); narratives are untrusted data (verbatim, never instructions). Follow the build-stamp discipline — snapshot baked at export time for the static export, captured once at server start for serve mode, never a live per-request read of the raw log. A served board on another host can only show its own host's snapshot; say so honestly in docs/notes rather than implying cross-machine visibility.

## Acceptance

- [x] The served board and the static export footer show a friction indicator (count/badge) next to the build stamp, opening the redacted friction report without devtools
- [x] Narratives render as plain text (escaped); no raw log paths or secrets leak — redacted report surface only, never the raw jsonl
- [ ] Snapshot discipline: export-time bake for static, server-start capture for serve; board-parity (or equivalent) pins it; `arggon validate` green; prettier clean; PR opened

## Notes

### 2026-10-16 @Arggon

Maker evidence (task-board-footer-links-the-friction-report, branch feat/task-board-footer-links-the-friction-report, commit 4c0e623b):

Files changed: cli/src/board.ts (friction snapshot + footer badge + report panel + wireBoardFriction), cli/src/board-serve.ts (server-start capture), cli/src/board-friction.test.ts (new, 7 tests), cli/src/board.test.ts + board-parity.test.ts (friction-tolerant build-stamp assertions), README.md (friction indicator bullet).
Friction source reused: lib/src/friction-report.ts readFrictionReport + renderFrictionReport (same deduped redacted path as arggon friction --report) + lib/src/friction-optout.ts readFrictionOptOut; never reads raw jsonl, never invents redaction, never embeds log path.

Gates expected-vs-observed:

- tsc typecheck: expected clean, observed clean (exit 0)
- eslint touched files: expected clean, observed clean (no output)
- prettier check (6 files): expected clean, observed All matched files use Prettier code style
- arggon validate: expected ok, observed ok (0 warnings, convention v5)
- vitest board lane (board/board-parity/board-friction/board-serve): expected pass, observed 4 files / 207 tests passed
- serve fetch smoke: expected footer+Badge+panel, observed HAS_FOOTER_BUILD true, HAS_FRICTION_BADGE true (friction 203), HAS_FRICTION_PANEL true, HAS_WIRE true
- Playwright drive (real board --serve render): expected badge visible + cards match list + panel opens/closes, observed BADGE_VISIBLE true (friction 203), CARDS 678 MATCH_LIST true, PANEL_VISIBLE_AFTER_CLICK true, no raw script tag, hidden after Esc
- static export: expected badge baked, observed board.html 678 items with friction 203 badge + panel

Acceptance readiness: 1-2 ready (served + static footer badge opens redacted report; narratives escaped, no jsonl path); 3 needs lead: PR not opened (lead opens per instructions), validate green + prettier clean done, parity pins in board-friction.test.ts. Did NOT flip status to done, did NOT open PR.

Note: MCP tracker tools (tools.arggon.show/comment/handoff) blocked by harness gate (no checkers installed); worked via worktree files + npm run arggon CLI per item instructions. No harness files created (out of scope).

### handoff 2026-10-16 @Arggon — next: Lead: review diff, open PR, tick acceptance

- branch: feat/task-board-footer-links-the-friction-report
- open questions: None; hostile-narrative escaping pinned; served snapshot is host-local by design

### 2026-10-16 @Arggon

verdict: approve (friction footer, commit 4c0e623b)

- standards review: kernel redaction path reused (no invented redaction, no paths/secrets by construction); narratives escaped into <pre>, no innerHTML; legacy-bytes guard holds with exact-footer pins retained on hermetic paths; snapshot discipline export-bake/server-capture, no per-request reads; README host-local honesty
- verifier evidence: board-friction 7/7 pass; board+parity 169/169 pass; build green; prettier clean; validate ok; Chromium smoke PASS (badge visible, cards match list, hostile </script> literal with zero page errors, panel opens + Esc/backdrop/close dismiss, no friction.jsonl in html)
- non-blocking notes: test name over-claims opted-out leg; Esc closes drawer+friction panel together (harmless)
