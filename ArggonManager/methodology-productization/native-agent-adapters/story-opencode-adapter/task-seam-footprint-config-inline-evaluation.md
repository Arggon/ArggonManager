---
type: task
status: in_progress
id: task-seam-footprint-config-inline-evaluation
title: "Seam footprint: evaluate loading the OpenCode plugin via config and inlining agents/commands into opencode.json(c) — 15 tracked files + generated plugin copies vs config keys"
assignee: arggon-delivery-lead
branch: feat/task-seam-footprint-config-inline-evaluation
parent: story-opencode-adapter
labels: [opencode-seam, methodology, evaluation]
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T23:39:26.165Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-seam-footprint-config-inline-evaluation
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-seam-footprint-config-inline-evaluation.md
  Leaves live only under a story. id is the filename stem: task-seam-footprint-config-inline-evaluation.
  CLI `arggon create task seam-footprint-config-inline-evaluation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Seam footprint: evaluate loading the OpenCode plugin via config and inlining agents/commands into opencode.json(c) — 15 tracked files + generated plugin copies vs config keys

## Context

Raised by the product owner, 2026-10-12: "we have inside the `.opencode` folder
a lot of stuffs. Are them really necessary? can't we just add the plugin to the
`plugins` inside `.opencode/opencode.json`?"

Measured inventory in this repo (2026-10-12):

| Path                                             | Size  | Tracked            | What it is                                                                                                     |
| ------------------------------------------------ | ----- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `.opencode/agents/*.md` (4)                      | 28K   | yes, `x-generated` | Role agents (delivery-lead, maker, standards-reviewer, verifier) materialized by `arggon init`                 |
| `.opencode/commands/*.md` (11)                   | 44K   | yes, `x-generated` | `/arggon-*` commands                                                                                           |
| `.opencode/plugins/arggon/index.ts` + `tui.tsx`  | ~497K | no (gitignored)    | Generated vendored copies of the committed bundles — the seam's loading mechanism ("no `node_modules` needed") |
| `opencode.jsonc` (repo root)                     | small | yes                | Generated project config (adopter-editable)                                                                    |
| `.opencode/opencode.json` + `.opencode/harness/` | small | no, not ignored    | **Not ArggonManager's**: a local agent-harness plugin's config/state                                           |

Schema facts (fetched 2026-10-12 from `https://opencode.ai/config.json`): the
config field is **`plugin`** (singular; array of string | [string, object]) —
not `plugins` — and the schema supports inline **`agent`** (`prompt`,
`description`, `mode`, `permission`, …) and **`command`** (`template`, …)
objects. So both halves of the question have real options:

- **agents/commands as file vs config keys**: inlining would collapse 15 tracked
  files into config, but loses per-file `x-generated` provenance, `init`'s
  per-file refresh/ack/adopter-edit semantics, `doctor --agents` per-file
  statuses, and markdown-diff readability. The capability matrix and the seam
  tests pin the current shape.
- **plugin vendored copy vs config `plugin` entry**: a config entry still needs
  a resolvable artifact (absolute path — machine-specific, like the owner's
  harness example; or a package spec — requires an install the seam deliberately
  avoids). For adopters the vendored copy IS the artifact; in this repo pointing
  at the committed `opencode/plugins/arggon/index.bundle.ts` is conceivable but
  diverges this repo's seam from every adopter's and interacts with `doctor`'s
  staleness detection.

## Acceptance

- [ ] Decide, with reasoning recorded on this item: keep the file seam (and say
      what the file count/size actually is — 72K of md + one generated bundle),
      inline agents/commands into `opencode.json(c)`, load the plugin via a
      config `plugin` entry in this repo only, or a mix
- [ ] If inlining: the `x-generated`/ack/refresh model and `doctor --agents` get
      an explicit replacement story (or a recorded scope reduction), the seam
      tests and capability matrix are updated in the same change, and adopters'
      trees see the same shape
- [ ] If config-referencing the plugin in this repo: `doctor`'s vendored-plugin
      staleness detection, `npm test`'s rewrite step, and the `.gitignore`
      entries are reconciled in the same change
- [ ] Regardless of decision: the two clearly-local artifacts
      (`.opencode/opencode.json`, `.opencode/harness/`) are kept out of
      ArggonManager's seam accounting — either gitignored (they already trip
      worktree pruning and `git status`) or documented as machine-local
- [ ] The owner's config idiom is validated as part of the decision: the
      published schema names the field `plugin` (singular) — if the runtime
      being used applies `plugins`, record which client/version accepts it

## Notes
