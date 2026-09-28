---
type: task
status: in_progress
id: task-pilot-opencode2-shell-tasks-server-only
title: Run the isolated server-only opencode2-shell-tasks pilot
assignee: Arggon
branch: feat/task-pilot-opencode2-shell-tasks-server-only
parent: ui-foundation
labels: [opencode, pilot, tooling, server-only]
priority: p2
created: "2026-09-24"
updated: "2026-09-28"
claimed_at: "2026-09-28T21:44:27.042Z"
depends_on: [bug-native-start-worktree-no-install]
worktree_path: /home/arggon/Projects/ArggonManager-task-pilot-opencode2-shell-tasks-server-only
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

- [x] Use exact pinned versions and disposable `XDG_CONFIG_HOME`/`XDG_DATA_HOME`/state/work directories outside this repository; record the supported OpenCode runtime and package/dependency/audit facts.
- [x] Register and exercise only through the OpenCode server/API; do not use or modify the bundled `/tasks` TUI and do not edit this repo's generated OpenCode config.
- [ ] Configure `background_bash` as explicit `ask`, deny it for the reviewer, and prove no permission bypass; never run the pilot unattended. — _work performed, but the "no bypass" half is not satisfiable: a bypass was proven. See "Result"._
- [x] Compare representative foreground and background unit, build, Playwright, and PTY TUI runs, recording task ID, exit code, bounded output tail, synthetic wake-up count, wall time/time-to-next-action, and process cleanup.
- [x] Exercise failure, cancellation, restart reconciliation, and an out-of-session workdir; prove no leaked process group, duplicate wake-up, repository log/sidecar, secret leak, or tracker mutation outside `tools.arggon.*`.
- [x] Produce a bounded decision table and explicit PASS/FAIL exit gate: four tools register, zero permission bypasses/leaks/duplicate wake-ups, and repeatable interactive benefit.
- [x] If PASS, file a separate dev-only ADR/playbook work item with exact versions, safety/schema budget, fallback, and rollback; do not add the third-party plugin to this repository in the pilot PR. If FAIL, remove the profile/plugin and record the negative result without an ADR/playbook. — _FAIL branch taken: profile/plugin removed, negative result recorded, no ADR/playbook item filed._
- [x] No runtime/product dependency, generated configuration, CI lane, or committed pilot state is introduced; `arggon validate` and the normal repo gates remain green for any tracker/doc-only commit.

## Result: **FAIL** (gate not met)

The four tools register and the latency benefit is real, but the gate's hard
safety criterion — _zero permission bypasses_ — is **not** met, and the
package's declared supported runtime is unavailable. No ADR/playbook item is
warranted; the exploration's `opencode2-shell-tasks` recommendation should be
withdrawn for this repository.

Full evidence, the decision table and the limitations are in the item comments.

### Why FAIL (bounded)

1. **`ask` is not enforced for `background_bash`.** Configured
   `background_bash: ask`; in 2/2 runs the tool executed with **no** permission
   request. Control in the _same_ session: `shell` under an identical `ask`
   policy did raise a request. `deny` _is_ enforced (the tool is removed from the
   reviewer's catalog). So the pilot's safety model — a human approves every
   background start — does not hold.
2. **No package-supported runtime.** The package requires `0.0.0-beta-*`; this
   machine has only stable `v2.0.18` (`opencode2` is a shim to the same binary).

### What passed

- 4/4 tools registered and invoked through the server API.
- 0 leaked process groups (incl. a 4-member group fully reaped on cancel).
- 0 duplicate synthetic wake-ups (16 tasks, 14 wake-ups, 0 duplicates).
- 0 repository log/sidecar writes, 0 secret leaks, 0 out-of-kernel tracker writes.
- Time-to-next-action 9–18 ms vs 5.5–33 s blocked in the foreground.

## Notes
