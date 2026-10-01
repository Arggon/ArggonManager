---
type: task
status: todo
id: task-session-formatter-bypasses-prettierignore
title: "Session file formatter rewrites plugin source that .prettierignore excludes, so agent edits inject a ~900-line reformat"
parent: tooling-and-environment
labels: [tooling, dogfood]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
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

### 2026-10-01 @Arggon
Worker pass complete (branch feat/task-session-formatter-bypasses-prettierignore, PR to follow).

## Root cause (established, not inferred)

The OpenCode session formatter (formatter: true → built-in prettier) spawns `<prettier> --write $FILE` with the **session's project directory as cwd**. Prettier DOES read .prettierignore (v3.9.6) — the coordinator's "does not consult it" reading was wrong in the detail — but it resolves the ignore file **from cwd** and matches patterns relative to it. A session rooted in the primary checkout editing a sibling arggon worktree by absolute path (the normal native-start layout) therefore escapes the anchored `opencode/plugins/arggon/` pattern: the path relative to the primary is `../<repo>-<id>/opencode/plugins/arggon/index.ts`, which matches nothing, so prettier formats the "ignored" file.

Evidence: opencode server log 2026-09-28T23:53:15 (run df79a0db) — `formatting file` … `cwd=/home/arggon/Projects/ArggonManager` with file in `../ArggonManager-bug-worktree-readiness-misses-stale-primary-install/`; 28 s later the worker reverted (`git checkout -- opencode/plugins/arggon/index.ts`) and catted .prettierignore (log line 24929). Today's spawns run with cwd=<the worktree> and cause no churn (PR #517's plugin diff is clean, feature-only). prettier used is opencode's own cache: ~/.cache/opencode/npm/prettier@latest/… (3.9.6).

## Probes (scratch copies, prettier 3.9.6, repo .prettierrc.json defaults)

- cwd=primary, file in sibling git worktree, file ignored in its own tree: `prettier --write` printed `../primary-wt/opencode/plugins/arggon/index.ts 23ms` and injected the semicolon → bypass reproduced.
- cwd=worktree, same file: skipped, file untouched → ignore file fine; anchoring is the bug.

## Fix

opencode.jsonc: formatter.prettier.command override (adopted-owned-on-edit, init skips it) — same invocation re-anchored at the edited file's own git root: resolve the file's `git rev-parse --show-toplevel`, cd there, use that tree's node_modules/.bin/prettier (fallback: PATH prettier; none → exit 0, skip — skipping beats churn), prettier --write on the absolute path. Matching extensions inherited from the built-in.

- Probe matrix after the fix: bypass shape → skipped (no reformat); non-ignored file → formatted (semicolons added, as before); cwd=worktree ignored file → skipped (no regression).
- Live acceptance check: headless `opencode run --standalone --model opencode/mimo-v2.6-flash-free` on a scratch repo+worktree fixture with the fixed config; the model's edit tool changed the plugin file; opencode log shows the formatter firing the overridden `sh -c` command; result: content-only diff (2 renamed identifiers), semicolon-free style intact.
- Plugin source NOT reformatted (policy box): file untouched; npm run check:plugin exit 0.

## Gates (this worktree)

npm test → 112 files / 1980 passed / 0 failed (headless-ci needed npm run build first — fresh worktree, no artifacts; passes after build); npm run lint → exit 0; npm run build → ok (bundle 401934 B, byte-stable); npm run check:plugin → exit 0; npm run arggon -- validate --json → ok:true, errors:[], warnings:[].

## Notes for review

- The formatter config surface has no path-based ignore (matching is extension-only; documented fields: disabled/command/environment/extensions), so the command override IS the "formatter's own configuration" lever.
- The generated template (cli/src/docs.ts OPENCODE_CONFIG) still emits formatter: true — adopters get the built-in unchanged; this repo's config is now adopter-owned. If the cwd-anchoring bypass is wanted for adopters too, that is a separate product decision (not filed per subagent rules — coordinator's call).
- Cold-worktree edge: before start links node_modules the override finds no prettier and skips formatting (previous built-in resolved opencode's cached prettier regardless). By the time agents edit in an arggon worktree the install is linked; degradation is safe (no formatting, never wrong formatting).
- Incidental observation, no action taken: the start-created worktree initially had no node_modules, so the claim commit's pre-commit gate (tsx) failed once; I linked the primary install per the playbook remedy and re-ran start (attach) — the claim commit then needed a manual git commit. Worth a look if native start's link step was expected to fire here.

### handoff 2026-10-01 @Arggon (session: ses_f087fbfe8ffeB7CicWxFX7KC1U) — next: Coordinator review of PR #531 (config+doc only); merge flips the item — checklist already ticked, evidence comment recorded.
- branch: feat/task-session-formatter-bypasses-prettierignore
- open questions: Apply the same cwd-anchoring override to the GENERATED opencode.jsonc template for adopters? Also: native start left the worktree without node_modules (gate failed once) — expected?
