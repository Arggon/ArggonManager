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

Two facts worth separating: `npm run format` is _also_ not a gate (it reformats ~400 unrelated files
because the repo is eslint-gated, not prettier-gated) and `opencode/plugins/arggon/` is
`.prettierignore`d, so the command and the ignore file are both fine. The gap is specifically the
**session file formatter**, which does not appear to consult `.prettierignore`.

## Acceptance

- [x] Establish and record which component rewrites the file: does the OpenCode session formatter read `.prettierignore`? Quote the evidence (a two-line probe on a scratch copy) rather than inferring it. — Established 2026-10-01: the formatter spawns the project prettier with the **session's project directory as cwd** (opencode log 2026-09-28T23:53:15: `cwd=/home/arggon/Projects/ArggonManager`, file in `../ArggonManager-bug-worktree-readiness-…/`); prettier DOES read `.prettierignore` (3.9.6, probed) but resolves it from cwd and anchors patterns there, so sibling-worktree files escape the anchored `opencode/plugins/arggon/` pattern. Probe: scratch repo + real worktree, `prettier --write <worktree>/opencode/plugins/arggon/index.ts` with cwd=primary rewrote the file (semicolon injected) while cwd=worktree skipped it.
- [x] Make the recorded policy enforceable by default — e.g. exclude the path in the formatter's own configuration, or add an explicit ignore there — so an agent editing plugin source does not silently produce a ~900-line reformat. — `opencode.jsonc` now overrides the prettier formatter's `command` (the only path-aware lever the formatter config offers — matching is extension-only) to anchor the same invocation at the edited file's own git root; probed A2/B2/D plus a live headless `edit` session.
- [x] Do **not** reformat the plugin source as part of this item: the semicolon-free style stays (that decision is settled and its rationale stands). — `opencode/plugins/arggon/index.ts` untouched; `npm run check:plugin` exit 0 (bundle byte-stable).
- [x] If the formatter cannot be configured, document the workaround in the place an agent will read before editing plugin source (the plugin playbook or `AGENTS.md`), and say plainly that it is a workaround, not a fix. — N/A as a workaround: the formatter WAS configurable (previous box). The fix + rationale are still documented where an agent will look before editing plugin source — the config comment in `opencode.jsonc` and a playbook bullet in `ArggonManager/docs/playbooks/opencode.md` ("do not simplify it back to `formatter: true`").
- [x] Verify with a scratch edit that a normal `edit`/`write` in the plugin directory no longer changes unrelated lines. — Headless `opencode run --standalone` session (fixture repo + sibling git worktree, session rooted in the primary, edit tool on `<wt>/opencode/plugins/arggon/index.ts`): log shows the formatter firing the overridden command; result was a content-only diff (2 renamed identifiers), semicolon-free style intact, no reformat.
- [x] `npm run arggon -- validate` is green; no runtime dependency or product behavior change. — `validate --json` → `ok:true, errors:[], warnings:[]`; config/doc-only change (no template, no CLI, no runtime dependency touched).

## Notes

Deliberately p3 and deliberately narrow. Related: the inherited semicolon drift in
`task-plugin-source-prettier-policy`'s notes is out of scope here.
