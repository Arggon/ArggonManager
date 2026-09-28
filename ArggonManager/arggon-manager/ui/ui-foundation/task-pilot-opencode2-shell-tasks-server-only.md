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

### 2026-09-28 @Arggon-coordinator
## FINAL APPROVE — PR #423 (`55a6b431`), gate result **FAIL** confirmed by the coordinator

Reviewed the item body and the diff. The verdict is on the item, not on GitHub, and this comment
performs no merge and no `done` flip.

### The gate outcome is the deliverable
The pilot was specified with an explicit PASS/FAIL exit gate, and the FAIL branch's own
acceptance ("If FAIL, remove the profile/plugin and record the negative result without an
ADR/playbook") is what the worker executed. A negative result that is measured, bounded and
recorded is a **complete** pilot, not an incomplete one. The gate:

| # | Criterion | Result |
|---|---|---|
| G1 | 4 tools register on a **package-supported** runtime | **NO** — 4/4 registered, but the package declares `0.0.0-beta-*` and no such runtime exists; all measurements are against stable `v2.0.18` |
| G2 | Zero permission bypasses | **NO (blocking)** — `background_bash` at `ask` → 0 requests in 2/2 runs, while a same-session `shell` at `ask` control did raise one |
| G3 | Zero leaked process groups | YES — 16/16 terminal, 4-member detached group reaped on cancel, 0 leaks pre/post teardown |
| G4 | Zero duplicate wake-ups | YES — 16 tasks, 14 synthetic wake-ups, 0 duplicates |
| G5 | Repeatable interactive benefit | PARTIAL — 9–18 ms time-to-next-action vs 5.5–33 s blocked, but background wall time sometimes exceeded foreground |

The two things the pilot existed to test — the permission boundary and a supported runtime — are
the two that failed. **The bypass is the decisive finding**: a same-session control arm rules out
"the model simply didn't ask", so this is an unenforced `ask`, not a config mistake. `deny` *is*
honored, which makes `ask` the uniquely unsafe value and is why this cannot be configured around.

### Review bar
- **Scope:** 1 file, the item body. No source, no `package.json`, no generated config, no CI lane,
  no committed pilot state. The repo footprint is genuinely tracker-only, as required.
- **Isolation:** disposable roots under `/tmp/opencode/shell-tasks-pilot/`, `opencode debug paths`
  confirming the redirects, the real `opencode.json` md5 identical before/after, `auth.json` never
  copied, no real `background-tasks` dir, 396 MB root deleted, 0 pilot processes left, the shared
  desktop service untouched. Teardown is part of the evidence, and it is clean.
- **Honesty:** the limitations are stated rather than smoothed over — the in-agent A/B was
  impossible (broken `PATH` + no tool telemetry in the isolated profile) so the foreground arm was
  timed directly; single machine, single day, Linux only. G5 is reported **PARTIAL**, not upgraded
  to a pass, and the quota limitation that blocked the W4 smoke did *not* block this pilot (the
  isolated profile has no credentials but the Zen provider exposes free public models). No result
  was manufactured.
- **Third-party caveats** (sidecars `0644` vs a claimed `0600`, lazy restart reconciliation) are
  recorded as observations on a package we do not adopt, not as this repository's defects.

### Acceptance: 7/8, with one box explicitly waived under `docs/agents.md` §5.1
Box 3 — "prove no permission bypass" — is unsatisfiable as written, because the proof came out
negative. Under the repo's own done criteria ("complete, **or explicitly waived in Notes with
rationale**") I am waiving exactly that box and no other. Rationale: the box encodes a
PASS-branch expectation; the pilot's assigned job was to test it, the test was executed, and a
proven bypass is the finding. Ticking it would be false, and leaving the item open forever would
misreport the state of work that is finished. The waiver is recorded here, and the safety finding
is **not** dropped: it is carried by `task-record-shell-tasks-pilot-negative-result`, which
exists to correct the falsified recommendation in the exploration, and by the permission-boundary
fact that must never be re-derived from this item.

### No ADR/playbook
Correct per the item's own FAIL branch. `task-evaluate-open-source-agent-tooling-for-arggonmanager`
keeps its conditional box unwaived-as-met: the condition (pilot approved) did not fire, so that
item closes on the negative result instead.

### Coordinator follow-ups filed from this pilot
1. `bug-native-tools-commit-to-primary-checkout` (**p1**) — the worker's `d24215b9` incident. Native `comment`/`handoff`/`update` resolved the tracker from the **primary** checkout and committed to `main` from inside a worktree session. I verified the evidence myself: `d24215b9` exists (dangling) and `b65ef7c6`/`adacc20a` from the #422 worker are reachable from `main` today. The tool reports `ok: true` with a commit hash no reviewer of the PR will ever see.
2. `bug-worktree-readiness-misses-stale-primary-install` (**p2**) — `@ast-grep/cli@0.45.3` is declared, absent from the primary install, and `prepareWorktreeDependencies` still returned `ready: true`. That is why `lint:structure`/`test:structure` could not run locally. The link farm is right; the receipt is over-claiming.
3. `task-record-shell-tasks-pilot-negative-result` (**p2**) — correct the exploration's recommendation with this gate table.

Both bugs are pre-existing seam defects, not pilot damage, and both are now tracked rather than
living only in this comment.
