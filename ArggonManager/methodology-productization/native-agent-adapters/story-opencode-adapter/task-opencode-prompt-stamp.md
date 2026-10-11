---
type: task
status: todo
id: task-opencode-prompt-stamp
title: OpenCode prompt-admission stamp + compaction retention (plan T4)
parent: story-opencode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-opencode-prompt-stamp.md
  Leaves live only under a story. id is the filename stem: task-opencode-prompt-stamp.
  CLI `arggon create task opencode-prompt-stamp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode prompt-admission stamp + compaction retention (plan T4)

## Context

OpenCode session `prompt` hook stamps branch/item metadata on admission; `compaction` hook retains the item block

## Acceptance

- [ ] unit tests for the hook rewrite contract
- [ ] headless smoke evidence (expected vs observed in verdict)
- [ ] permission rules unchanged

## Notes

### 2026-10-11 @ses_ed4c5d320ffeScEzxxks3AMgTV
verdict: approve (T4 prompt stamp + compaction retention, Behavioral)

## What I read

- git -C /home/arggon/Projects/ArggonManager-task-opencode-prompt-stamp diff main...HEAD (8 non-tracker files: the plugin source +361, the regenerated bundle +179, +424 test lines, the new 905-line smoke and its 223-line wrapper, and 3 doc files).
- opencode/plugins/arggon/index.ts: the two hook implementations (L975-1090), hookDirectory (L1186-1221), the registration loop (L5532-5552), and the helpers they lean on (MAX_VALUE_CHARS/clip/byteLength/setBounded/asString at L254-280, findWorktreeEnv at L2013, processWorktreeIdentity at L2030, locationDirectory at L1162, sessionDirectoryResolver at L1176, resolveInjectedItem at L1458-1472).
- cli/src/plugin-bundle.ts (BUNDLE_EXPORTS = the board-panel surface, MAX_BUNDLE_BYTES) and package.json scripts (check:plugin).
- smoke/opencode-prompt-stamp-smoke.ts: the fixture/serve construction (L560-600), the plugin-identity assertion (L640-690) and the pure predicates.
- ArggonManager/docs/agents.md, opencode2.md and playbooks/opencode.md diffs; the item body with the impact statement.
- The machine's global plugin: ~/.config/opencode/plugins/arggon/index.ts (9511 lines / 402,005 bytes).

## What I checked, expected vs observed

**(a) The two hooks are bounded.** Expected: a declared bound, enforced by clipping then dropping, fail-closed. Observed: ADMISSION_STAMP_MAX_BYTES = 768 with a comment citing ADR 0006 (everything the seam adds pays on every call). buildAdmissionStamp clips every value to MAX_VALUE_CHARS (200) and then boundAdmissionStamp drops fields in a declared order — worktreeId, then worktreePath, then branch, then item — re-measuring byteLength(JSON.stringify(stamp)) each time, and returns undefined when neither item nor branch survives or when the remainder still does not fit. Worst case a 200-char 4-byte value (~800 B) exhausts the drop list and the hook writes nothing: the tail is fail-closed, never an oversized prompt. The item block the compaction hook pushes is the same bounded buildItemBlock the context hook uses (ITEM_BLOCK_MAX_BYTES). The two log-dedup maps (stampedSessions, retainedSessions) go through setBounded with CACHE_MAX_ENTRIES, so a long session cannot grow them.

**(b) The hooks resolve the SESSION's directory, and the reason is documented.** Expected: the session's own location, with a written reason. Observed: hookDirectory asks ctx.session.get via sessionDirectoryResolver first and falls back to locationDirectory(ctx) only when the session surface is absent or the lookup throws. The JSDoc states the reason in full and names the observed failure: the worktree env contract's .arggon.env exists at the session's directory, never at the canonical checkout the plugin instance was loaded from (a worktree session and its project share one plugin registration, observed on 2.0.26), so a hook reading ctx.location.directory would never see a worktree session's declaration and the stamp would silently come from the wrong checkout. I traced the same through docs/playbooks/opencode.md, which carries the identical explanation for a reader who never opens the source.

**(c) The committed bundle is genuinely regenerated.** Expected: a mechanism, not a claim. Observed: package.json defines check:plugin as `npm run build:plugin && git diff --exit-code -- opencode/plugins/arggon/index.bundle.ts` — build:plugin runs cli/src/build-plugin.ts, which rebuilds the bundle from the plugin source with the kernel inlined, and the gate then fails on any difference to the committed bytes. I read the bundle diff and it is exactly the new hooks: +4 occurrences of ADMISSION_STAMP_MAX_BYTES, +5 of buildAdmissionStamp, +3 of hookDirectory, +4 each of onPromptAdmission/onCompaction, and the only change to the export preamble is ADMISSION_STAMP_KEY and ADMISSION_STAMP_MAX_BYTES being added to the re-export list. Nothing else in the bundle moved.

**(d) The impact class Behavioral is correct and stated.** Observed: the item comment opens with "Impact class: **Behavioral** (methodology carrier: opencode/plugins/arggon/**)" and argues it — agents must re-learn that every admitted prompt now carries an arggon key in metadata.arggon and that a compaction summary is produced with the item block in scope. It also addresses the Behavioral row's obligations: the adopter-upgrade channel (the change ships inside the vendored bundle init refreshes, and doctor/init --dry-run report the destination as outdated) and the skill-sync obligation (skills/arggon-cli/** is untouched, so there is no sync to perform — byte-equal already, and the diff confirms no skills/ file changed). Stated in the item, which is where agents.md §Changing the methodology itself asks for it.

**(e) The smoke's hermetic HOME is a sound fix, and the other smokes' evidence really is suspect.** Expected: a sound isolation, not a workaround. Observed: the global plugin is real (9511 lines, 402,005 bytes, at ~/.config/opencode/plugins/arggon/index.ts) and it carries zero occurrences of onPromptAdmission/onCompaction (grep count 0) — it is a pre-T4 copy. The smoke serves opencode with HOME, XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_STATE_HOME and XDG_CACHE_HOME all pointed into a fresh dir with ARGON_ITEM explicitly undefined, so no global plugin, MCP server or config can be picked up. And the isolation is asserted rather than assumed: the smoke reads the fixture's vendored bundle and the committed bundle byte-for-byte, requires the vendored copy to contain onPromptAdmission, and requires the serve log to carry no "Duplicate plugin ID" — plus the decisive discriminator, that the stamp and retention checks can only pass when THIS bundle's T4 hooks run. That is a real pin, not a hopeful environment. On the second half of the question: yes, the other smokes' evidence is potentially invalid on this box. smoke/opencode-smoke.ts (PLUGIN_SOURCE points at the committed bundle, L125) and smoke/native-start-cold-smoke.ts (L1043) both copy the fixture bundle but inherit process.env — grep for HOME/XDG_ over the three plugin smokes returns nothing — so on a machine carrying a machine-global arggon plugin the supervisor's first-registration-wins rule can shadow their fixture. The maker flagged it honestly as a harness-validity question rather than claiming their own evidence proved theirs.

**(f) No board-panel surface touched.** Expected: this item must not touch the event-panel/board lane. Observed: the diff touches opencode/plugins/arggon/{index.ts,index.bundle.ts,index.test.ts}, the two smoke files and 3 docs — no tui.tsx, no templates/docs/**, no .claude/zcode seam file, no package.json. The bundle's export preamble still re-exports the exact same board surface (ARGON_BOARD_PANEL, boardItemDetail, boardSnapshot, boardTreeLines, emptyBoardSelection, moveBoardSelection, resolveBoardSelection, selectBoardItem, sidebarStatusLine) — I diffed the two preambles line by line and the only delta is the two new stamp constants. task-opencode-event-panel's board-refresh-from-event-stream half of T4 is untouched, and the item says so.

## Findings (none blocking)

1. hooks are registered with `await hook(name, (event) => handler(ctx, event as never))` — the event is cast to never. The structural PromptEvent/CompactionEvent types are declared locally precisely so no plugin types are imported, which is the right call for a vendored file; the cast is the cost of that. It is contained to the two new handlers and every handler opens with asString(event.sessionID) and a try/catch.
2. The acceptance section was rewritten rather than the original three boxes ticked in place. All three originals (unit tests for the hook rewrite contract, headless smoke evidence, permission rules unchanged) are covered by the new six rows, so nothing was dropped — but the original wording is gone from the live section. If the lead prefers the original boxes preserved, that is a one-line restore.
3. package.json was deliberately not touched, so the new smoke has no npm script. Documented in opencode2.md as the npx tsx form. Fine, but it means the smoke is one grep away from being orphaned — worth a follow-up when that file is free.
4. onCompaction uses `asString(item.id) ?? "?"` while onContext was tightened to `asString(item.id)` in the same diff. Cosmetic inconsistency.

## What remains unverified

Execution. I ran no server, no test suite and no gate. Everything above is from reading the diff, the plugin source, the bundle builder, the smoke harness and the docs. The 13/13 smoke result, the 2964-test suite, lint, test:structure, check:plugin's exit 0, tools.arggon.validate and prettier are all unverified by me — I verified only that the claims are checkable and that the mechanism the maker names (check:plugin = build:plugin + git diff --exit-code) is the real gate.

## Probes needed

1. cd /home/arggon/Projects/ArggonManager-task-opencode-prompt-stamp && npm run check:plugin — demonstrates the committed bundle is byte-identical to a fresh regeneration from the source. This is the single load-bearing claim of this PR; if it exits non-zero the shipped bundle is not what the source says.
2. Same cwd: npm run build && npx tsx smoke/opencode-prompt-stamp-smoke.ts — demonstrates the 13 checks, and specifically checks 3 (no Duplicate plugin ID), 4/5 (stamp on the persisted payload, prompt text byte-identical, delivery steer), 7/8 (one item block in the compaction request, the summary still landing, the block surviving into the next agent-loop request), 9 (4 s idle window with zero provider requests) and 10 (no stamp on a plain primary checkout).
3. Same cwd: npx vitest run opencode/plugins/arggon/index.test.ts — demonstrates the +424 lines of rewrite-contract assertions, in particular that metadata merges without dropping caller keys, that a re-admission re-stamps rather than accumulates, and that the 768 B bound is enforced by clip-then-drop.
