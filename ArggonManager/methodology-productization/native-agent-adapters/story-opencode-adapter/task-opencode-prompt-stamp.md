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
