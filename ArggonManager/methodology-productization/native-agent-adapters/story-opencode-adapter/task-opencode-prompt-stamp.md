---
type: task
status: done
id: task-opencode-prompt-stamp
title: OpenCode prompt-admission stamp + compaction retention (plan T4)
assignee: arggon-delivery-lead
branch: feat/task-opencode-prompt-stamp
parent: story-opencode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-13"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
worktree_path: /home/arggon/Projects/ArggonManager-task-opencode-prompt-stamp
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

- [x] **Prompt-admission stamp (spec S4):** the `prompt` hook writes a bounded
      branch/item stamp into the admitted prompt's own `metadata` under the
      `arggon` key — worktree env contract (`.arggon.env`) first, then the
      process environment, then the correlation chain — resolved from the
      SESSION's directory, and never into the prompt text.
- [x] **Unit tests for the hook rewrite contract:** `prompt.text`, `files`,
      `agents`, `skills` and `delivery` stay byte-identical; `metadata` merges
      (caller keys preserved) and re-stamps rather than accumulating; no stamp
      outside a tracker tree; no empty stamp on a plain checkout; the stamp's
      byte bound (768 B) is enforced by clipping then dropping the least
      load-bearing fields.
- [x] **Compaction retention (spec S4):** the `compaction` hook appends the
      same bounded item block to the checkpoint-summary request's system
      instructions, exactly once per request, and never sets `result` — the
      model still writes the summary.
- [x] **Headless smoke evidence (expected vs observed in the verdict):**
      `smoke/opencode-prompt-stamp-smoke.ts`, model-free (real `opencode serve` +
      scripted OpenAI-compatible provider): 13/13 checks pass, exit 0 — command,
      expected, observed and what it does NOT prove are in the item comment.
- [x] **No polling fallback regression:** the hooks add no timer, no CLI polling
      and no extra provider request; the smoke's 4 s idle window observes zero
      requests, and the plugin registers only the three session hooks
      (`context`, `prompt`, `compaction`) plus the tool hook it already had.
- [x] **Permission rules unchanged:** no permission surface is added or edited
      (the diff touches no template, seam or agent file); the session admits and
      compacts with no permission request raised, and the existing permission
      tests (`cli/src/init-opencode.test.ts`, `smoke/opencode-smoke.ts`
      scenarios) stay green.

## Notes

### 2026-10-11 @ses_ed543078effeMABEBvMjeiHJGq
## Impact class: **Behavioral** (methodology carrier: `opencode/plugins/arggon/**`)

Per `ArggonManager/docs/agents.md` §Changing the methodology itself. Agents must
re-learn two things: every prompt an OpenCode session admits now carries an
`arggon` key in its `metadata` (`payload.metadata.arggon`), and a compaction
summary is produced WITH the item block in the request's system instructions
(the hook appends it; it never records the compaction itself). No rule text,
gate, command contract or pipeline step changed. Adopter-upgrade channel
([ADR 0016](ArggonManager/docs/adr/0016-adopter-upgrade-channel.md)): the change
ships inside the vendored bundle that `arggon init` refreshes — an adopter with a
never-overwrite/acked `.opencode/plugins/arggon/index.ts` gets it through the
documented refresh path, exactly like every previous plugin change; `arggon
doctor`/`init --dry-run` report the destination as outdated. No skill copy is
affected: `skills/arggon-cli/**` is untouched by this diff (byte-equal already),
so there is no skill/plugin sync to perform.

## What changed

- `opencode/plugins/arggon/index.ts` (+ regenerated `index.bundle.ts`): two new
  session hooks.
  - `session.hook("prompt")` (`onPromptAdmission`) writes a bounded branch/item
    stamp into the admitted prompt's own `metadata` under the `arggon` key.
    Source order: worktree env contract (`.arggon.env`) → process environment
    → the correlation chain the context hook already uses. Byte bound 768 B,
    enforced by clipping then dropping the least load-bearing fields.
  - `session.hook("compaction")` (`onCompaction`) appends the same bounded item
    block to the checkpoint-summary request's system instructions, exactly once
    per request (marker check), and never sets `result`.
  - Both resolve their directory from the SESSION's own location
    (`ctx.session.get` → `location.directory`), NOT `ctx.location.directory`:
    the plugin instance is loaded from the project's canonical checkout, so the
    instance's location names the primary even for a session moved into a
    worktree — and the env contract's `.arggon.env` exists only at the
    session's directory (observed on opencode 2.0.26; this is why the first
    working draft silently stamped nothing).
- Tests: `opencode/plugins/arggon/index.test.ts` (+424 lines) for the rewrite
  contract; `smoke/opencode-prompt-stamp-smoke.ts` + its `.test.ts` wrapper.
- Docs: `ArggonManager/docs/opencode2.md` (four bullets + smoke list + hermetic
  HOME note), `ArggonManager/docs/agents.md` (the ambient-behavior sentence),
  `ArggonManager/docs/playbooks/opencode.md` (resolution order + hook contract).

## Gates — expected vs observed

| Command | Expected | Observed |
| --- | --- | --- |
| `npm test` | green | **137 files / 2964 tests passed** (was 136/2947; +17 smoke predicate cases, +18 plugin cases) |
| `npm run build` + `npm run check:plugin` | committed bundle == source | **exit 0** (build regenerates 44 modules; `check:plugin` exit 0 on the committed tree) |
| `npm run lint` | clean | **clean** (0 problems) |
| `npm run test:structure` | ok | **5 passed; 0 failed** |
| `npm run lint:structure` | ok | **ok** (no findings) |
| `npx prettier --check` (touched paths) | clean | **clean** on all 8 touched files |
| `tools.arggon.validate()` | ok | **ok:true**, 0 errors, 0 warnings |
| `npx tsx smoke/opencode-prompt-stamp-smoke.ts` | exit 0 | **exit 0, 13/13 checks pass** |

## Headless smoke evidence (model-free)

`npx tsx smoke/opencode-prompt-stamp-smoke.ts` — real `opencode serve` (2.0.26)
+ the committed vendored bundle + a scripted OpenAI-compatible provider in the
smoke process; a real git worktree on `feat/<item>` with the env contract written
by the REAL kernel writer (`prepareWorktreeEnv`); exits 0 with
`skipped: opencode not installed` when the binary is absent. No model, no
quota, no network.

- Command: `npx tsx smoke/opencode-prompt-stamp-smoke.ts` (needs `npm run build` first).
- Expected → observed:
  1. fixture + env contract written with the six documented keys → **ok**
  2. session record answers `location.directory` = the worktree → **ok**
  3. fixture carries the committed bundle byte-for-byte, no `Duplicate plugin ID` → **ok**
  4. admitted prompt carries the env-contract stamp and preserves caller metadata
     → **ok**: `payload.metadata` = `{caller:"smoke", keep:7, argon:{item:"task-prompt-stamp-smoke", branch:"feat/task-prompt-stamp-smoke", worktreePath:<worktree>, worktreeId:"repo-stamp-task-prompt-stamp-smoke", source:"<worktree>/.arggon.env"}}`
  5. prompt text byte-identical, delivery `steer` → **ok**
  6. second admission re-stamps (one stamp, no accumulation) → **ok**
  7. compaction request carries the item block exactly once and the model still
     wrote the summary (`status: completed`, non-empty summary) → **ok**
  8. post-compaction agent-loop request still carries the block → **ok**
  9. 4 s idle window → **zero** provider requests → **ok** (no polling)
  10. plain primary checkout (no `.arggon.env`, branch `main`) → no `arggon`
      key written, text still intact → **ok**
  11. no permission request raised, bundle declares no permission domain call → **ok**
- What it does NOT prove: a real model's behavior (the provider is scripted, so
  the summary CONTENT is whatever the script returns — the smoke proves the
  request CARRIED the block, not that any particular model repeats it), the TUI
  surface, an adopter tree's bundle load, and the W4/W3 model-driven scenarios
  (`smoke:opencode`, `smoke:opencode:wave`), which were not run here.

## What I did NOT prove / left out

- The plan's T4 second bullet — "Board panel refreshes from the OpenCode event
  stream instead of polling" — is the sibling item
  `task-opencode-event-panel`, which collides on the plugin graph and is not
  mine. Untouched.
- `package.json` is outside this item's lane, so the new smoke is NOT registered
  as an npm script; it is run as `npx tsx smoke/opencode-prompt-stamp-smoke.ts`
  and documented that way in `docs/opencode2.md`. The one line to add when that
  file is free: `"smoke:opencode-prompt-stamp": "tsx smoke/opencode-prompt-stamp-smoke.ts"`.
- Environment finding for the delivery lead: this machine has a machine-global
  `~/.config/opencode/plugins/arggon/index.ts` (9511 lines, no T4 hooks). The
  plugin supervisor resolves ids globally and keeps the FIRST registration, so a
  fixture's vendored copy is rejected with `Duplicate plugin ID: arggon`. My
  smoke now serves with a hermetic `HOME` and asserts the fixture's bytes are
  the ones under test — but the repo's other plugin smokes
  (`smoke/native-start-cold-smoke.ts`'s move leg, `smoke/opencode-smoke.ts`)
  do not, so on this box they may be exercising the global copy rather than the
  fixture bundle. That is a harness-validity question, not a code defect, and it
  is not this item's scope.

### handoff 2026-10-11 @ses_ed543078effeMABEBvMjeiHJGq (session: ses_ed543078effeMABEBvMjeiHJGq) — next: Review/merge 109fecec (T4 hooks + tests + smoke + docs); if package.json frees up, add the smoke:opencode-prompt-stamp script; task-opencode-event-panel owns the event-stream panel half of T4.
- branch: feat/task-opencode-prompt-stamp
- open questions: Should the other plugin smokes also serve with a hermetic HOME (the global ~/.config/opencode/plugins/arggon shadows fixture bundles by id)? Is the stamp's `source` best named as the .arggon.env path…

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
