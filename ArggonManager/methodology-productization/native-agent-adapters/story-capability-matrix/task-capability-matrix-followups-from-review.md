---
type: task
status: done
id: task-capability-matrix-followups-from-review
title: "Capability matrix review follow-ups: ADR-0020 characterization line, stale \"docs + CLAUDE.md\" ADR statement, `gap` criterion wording, lint-scope comment, README pointer spec S1 owes"
assignee: arggon-delivery-lead
branch: feat/task-capability-matrix-followups-from-review
parent: story-capability-matrix
labels: [docs]
created: "2026-10-03"
updated: "2026-10-13"
worktree_path: /home/arggon/Projects/ArggonManager-task-capability-matrix-followups-from-review
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/task-capability-matrix-followups-from-review.md
  Leaves live only under a story. id is the filename stem: task-capability-matrix-followups-from-review.
  CLI `arggon create task capability-matrix-followups-from-review` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Capability matrix review follow-ups: ADR-0020 characterization line, stale "docs + CLAUDE.md" ADR statement, `gap` criterion wording, lint-scope comment, README pointer spec S1 owes

## Context

Five non-blocking findings from the reviewer of PR #600 (task-capability-matrix), all verified-cleared-in-spirit but needing a home of their own:

1. The matrix's `derivation` sentence characterizes ADR 0020 slightly unfairly (it credits the collision/stale-seam problem to the ADR rather than to the transcription step) — decide and correct the wording.
2. ADR 0020's "docs + CLAUDE.md" line is now stale — tracked separately as `task-adr0020-claude-seam-statement-stale`.
3. Tighten the `gap` criterion wording so the zcode MANIFEST cannot be misused later as a per-client gate (the matrix distinguishes `package: zcode` from `docs + CLI floor:`; the criterion text should not blur them).
4. A code comment noting the false-absence lint's TRUE scope (it scans the gap clause only, so the "what still enforces it" half is intentionally not flagged — that clause-scoped split is load-bearing and someone will otherwise "fix" it into a false positive).
5. `README.md` needs its pointer to the capability matrix — spec §S1 owes it and the matrix work did not land it.

## Acceptance

- [x] The matrix's `derivation` sentence no longer characterizes ADR 0020 unfairly: the collision/stale-seam problem is credited to the transcription step rather than the ADR, with the corrected wording decided and recorded
- [x] ADR 0020's stale "docs + CLAUDE.md" line is handled via its separate item (`task-adr0020-claude-seam-statement-stale`) — linked here, not fixed here
- [x] The `gap` criterion wording is tightened so the zcode MANIFEST cannot be misused later as a per-client gate (the `package: zcode` vs `docs + CLI floor:` distinction stays unblurred)
- [x] A code comment states the false-absence lint's TRUE scope (gap clause only; the "what still enforces it" half is intentionally not flagged) so nobody "fixes" the clause-scoped split into a false positive
- [x] `README.md` carries the pointer to the capability matrix that spec §S1 owes

## Notes

### 2026-10-13 @ses_eca8380bdffe1mNEVdrYKdoMXg
### Maker evidence — PR #772 (head 15bf460d): all five rows implemented, acceptance ticked 5/5

The 5 uncommitted files from the killed attempt were verified row-by-row against the acceptance, finished, and committed as 60e9e7b7 (+ ticks in 15bf460d). Branch pushed, PR #772 open. Not merged here, not flipped done.

1. **derivation** — `adapters/capability-matrix.json` (+ byte-identical template) now credits the collision to transcription: "never transcribed from ADR 0020's prose. The stale-seam collision is a transcription problem, not the record's: the ADR's prose models the adapter-bundle state and once understated the `.mcp.json` floor every client gets (its own amendments mark those corrected points), so a row copied from that prose collides with the seam the tree actually ships." Wording decision recorded: kept the transcription credit; replaced the present-tense "does not account for" (false of the record as amended - the unfairness this row exists to remove) with "once understated", the ADR amendment's own verb.
2. **ADR 0020 stale line** — not fixed here, and now closed elsewhere: `task-adr0020-claude-seam-statement-stale` is `done` (PR #610, three dated amendments incl. the frontmatter bullet). This PR touches no ADR file (link: this comment).
3. **gap criterion** — `rows[].gap` states: a surface that reaches every client is never the missing thing "however it is registered"; the ZCode plugin manifest and the generated `.mcp.json` are "two registrations of one server - registration is per-client, reach is not"; gap rows carry `package: none` + `docs + CLI floor:`, `package: zcode` marks a client-bundle mechanism - "a client registration of a universal surface is never a gap, and a package-carried mechanism is never the shared floor".
4. **lint scope** — comment in `cli/src/capability-matrix.test.ts` (test "never claims a gap on a surface `arggon init` ships to every client") states the true scope: one failure shape (a note that CLAIMS a universal surface is missing), gap clause only, the "what still enforces it" half intentionally not flagged, the clause-scoped split load-bearing. The referenced seam-derived test title exists verbatim (line 155).
5. **README** — §S1 pointer added to "The methodology" -> "The carriers" list; the previous matrix PR had only put the matrix in the init-docs tier-1 list, so this is not a duplicate.

Mechanical: template byte-identical (`cmp`); destination `x-generated` checksum refreshed to `sha256:4f4481f7...` and equals `sha256sum`; JSON valid; 10 925 B <= MAX_MATRIX_BYTES 16 384.

Gates at head `15bf460d`: `npm run build` clean; `npx vitest run cli/src/capability-matrix.test.ts` 26/26; `npm test` 152 files / 3311 tests; `provenance-audit` + adapter-selection + pack-contents + init + init-docs + mcp-doc-contract 162/162; `npm run lint` clean; `npm run test:structure` 5 passed; `npm run arggon -- validate` ok (0 warnings); `npx prettier --check` on the five touched files clean.

Environment note: the killed attempt had left vitest's artifact freeze on (`lib/dist` + `dist` 0444/0555, `test/kernel-artifacts.ts`); the first build failed EACCES because of that, not the tree. Modes restored to 0755/0644 (the teardown's own behaviour), then all gates green.

Open question (non-blocking): a semantically-neutral frontmatter re-serialization of this item file appeared in the worktree between the two commits (title quote style, blank line after frontmatter). Pre-commit hook, `arggon validate` and the edit tool were each ruled out by direct probe; content unchanged.

### handoff 2026-10-13 @ses_eca8380bdffe1mNEVdrYKdoMXg (session: ses_eca8380bdffe1mNEVdrYKdoMXg) — next: Review + merge PR #772, verify the 5 acceptance ticks against the diff, then flip this item done.
- branch: feat/task-capability-matrix-followups-from-review
- open questions: Item-file frontmatter re-serialized between commits - writer unidentified (hook/validate/edit tool ruled out); judge derivation wording 'once understated'.
