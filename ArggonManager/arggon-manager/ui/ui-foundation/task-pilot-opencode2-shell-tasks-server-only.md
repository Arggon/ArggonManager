---
type: task
status: todo
id: task-pilot-opencode2-shell-tasks-server-only
title: Run the isolated server-only opencode2-shell-tasks pilot
parent: ui-foundation
labels: [opencode, pilot, tooling, server-only]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
depends_on: [bug-native-start-worktree-no-install]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-pilot-opencode2-shell-tasks-server-only.md
  Leaves live only under a story. id is the filename stem: task-pilot-opencode2-shell-tasks-server-only.
  CLI `arggon create task pilot-opencode2-shell-tasks-server-only` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Run the isolated server-only opencode2-shell-tasks pilot

## Context

Run the time-boxed `opencode2-shell-tasks@0.1.1` pilot proposed by `exploration-open-source-agent-tooling-013` in an isolated OpenCode profile, server-only. The candidate may reduce interactive latency for long test/build/Playwright/TUI jobs, but its beta SDK, outside-repository state, detached process handling, and new permission action make this an experiment—not a product dependency or CI replacement.

## Acceptance

- [ ] Use exact pinned versions and disposable `XDG_CONFIG_HOME`/`XDG_DATA_HOME`/state/work directories outside this repository; record the supported OpenCode runtime and package/dependency/audit facts.
- [ ] Register and exercise only through the OpenCode server/API; do not use or modify the bundled `/tasks` TUI and do not edit this repo's generated OpenCode config.
- [ ] Configure `background_bash` as explicit `ask`, deny it for the reviewer, and prove no permission bypass; never run the pilot unattended.
- [ ] Compare representative foreground and background unit, build, Playwright, and PTY TUI runs, recording task ID, exit code, bounded output tail, synthetic wake-up count, wall time/time-to-next-action, and process cleanup.
- [ ] Exercise failure, cancellation, restart reconciliation, and an out-of-session workdir; prove no leaked process group, duplicate wake-up, repository log/sidecar, secret leak, or tracker mutation outside `tools.arggon.*`.
- [ ] Produce a bounded decision table and explicit PASS/FAIL exit gate: four tools register, zero permission bypasses/leaks/duplicate wake-ups, and repeatable interactive benefit.
- [ ] If PASS, file a separate dev-only ADR/playbook work item with exact versions, safety/schema budget, fallback, and rollback; do not add the third-party plugin to this repository in the pilot PR. If FAIL, remove the profile/plugin and record the negative result without an ADR/playbook.
- [ ] No runtime/product dependency, generated configuration, CI lane, or committed pilot state is introduced; `arggon validate` and the normal repo gates remain green for any tracker/doc-only commit.

## Notes
