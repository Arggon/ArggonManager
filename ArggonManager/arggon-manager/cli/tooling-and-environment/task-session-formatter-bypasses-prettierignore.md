---
type: task
status: in_progress
id: task-session-formatter-bypasses-prettierignore
title: "Session file formatter rewrites plugin source that .prettierignore excludes, so agent edits inject a ~900-line reformat"
assignee: Arggon
branch: feat/task-session-formatter-bypasses-prettierignore
parent: tooling-and-environment
labels: [tooling, dogfood]
priority: p3
created: "2026-09-28"
updated: "2026-10-01"
claimed_at: "2026-10-01T12:46:53.743Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-session-formatter-bypasses-prettierignore
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-session-formatter-bypasses-prettierignore.md
  Leaves live only under a story. id is the filename stem: task-session-formatter-bypasses-prettierignore.
  CLI `arggon create task session-formatter-bypasses-prettierignore` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Session file formatter rewrites plugin source that .prettierignore excludes, so agent edits inject a ~900-line reformat

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-28 @Arggon-coordinator
## Filed from the PR #426 review (coordinator, 2026-09-28)

`task-plugin-source-prettier-policy` (`done`, 2026-09-22) decided to keep the authored
**semicolon-free** style in `opencode/plugins/arggon/index.ts`, and made that durable by adding the
file to `.prettierignore`, with the rationale that the generated bundle is what adopters receive so
reformatting only churns history.

That policy is **not enforced against the session file formatter**. `opencode.jsonc` sets
`"formatter": true`, and the worker's `edit`/`write` calls on the plugin source re-ran prettier over
the file and injected semicolons across ~900 lines of hand-authored, `.prettierignore`-excluded code.
The worker caught it and reverted, applying the edits through shell/python instead — but that is a
per-session workaround, not a repo-level guarantee, and the next agent will hit it.

Two facts worth separating: `npm run format` is *also* not a gate (it reformats ~400 unrelated files
because the repo is eslint-gated, not prettier-gated) and `opencode/plugins/arggon/` is
`.prettierignore`d, so the command and the ignore file are both fine. The gap is specifically the
**session file formatter**, which does not appear to consult `.prettierignore`.

## Acceptance

- [ ] Establish and record which component rewrites the file: does the OpenCode session formatter read `.prettierignore`? Quote the evidence (a two-line probe on a scratch copy) rather than inferring it.
- [ ] Make the recorded policy enforceable by default — e.g. exclude the path in the formatter's own configuration, or add an explicit ignore there — so an agent editing plugin source does not silently produce a ~900-line reformat.
- [ ] Do **not** reformat the plugin source as part of this item: the semicolon-free style stays (that decision is settled and its rationale stands).
- [ ] If the formatter cannot be configured, document the workaround in the place an agent will read before editing plugin source (the plugin playbook or `AGENTS.md`), and say plainly that it is a workaround, not a fix.
- [ ] Verify with a scratch edit that a normal `edit`/`write` in the plugin directory no longer changes unrelated lines.
- [ ] `npm run arggon -- validate` is green; no runtime dependency or product behavior change.

## Notes

Deliberately p3 and deliberately narrow. Related: the inherited semicolon drift in
`task-plugin-source-prettier-policy`'s notes is out of scope here.
