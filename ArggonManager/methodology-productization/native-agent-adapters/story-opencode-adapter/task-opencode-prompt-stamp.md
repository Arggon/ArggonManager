---
type: task
status: in_progress
id: task-opencode-prompt-stamp
title: OpenCode prompt-admission stamp + compaction retention (plan T4)
assignee: arggon-delivery-lead
branch: feat/task-opencode-prompt-stamp
parent: story-opencode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:58:21.268Z"
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
