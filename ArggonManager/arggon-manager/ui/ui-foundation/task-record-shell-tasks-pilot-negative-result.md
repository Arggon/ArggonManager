---
type: task
status: todo
id: task-record-shell-tasks-pilot-negative-result
title: Record the opencode2-shell-tasks pilot FAIL in the exploration and correct its recommendation
parent: ui-foundation
labels: [research, agents, tooling]
priority: p2
created: "2026-09-28"
updated: "2026-09-28"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-record-shell-tasks-pilot-negative-result.md
  Leaves live only under a story. id is the filename stem: task-record-shell-tasks-pilot-negative-result.
  CLI `arggon create task record-shell-tasks-pilot-negative-result` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Record the opencode2-shell-tasks pilot FAIL in the exploration and correct its recommendation

## Context

`exploration-open-source-agent-tooling-013` evaluated agent tooling and carries
`opencode2-shell-tasks@0.1.1` as a candidate to reduce interactive latency for long
test/build/Playwright/TUI jobs. The isolated server-only pilot
(`task-pilot-opencode2-shell-tasks-server-only`, merged PR #423) **failed its exit gate**, so the
exploration's recommendation is now falsified by measurement and must be corrected rather than
left standing.

Measured gate (2026-09-28, Linux, single machine, OpenCode `v2.0.18`):

- **G1 NO** — 4/4 tools registered, but the package declares `0.0.0-beta-*` and no such runtime exists here; all measurements are against stable `v2.0.18`, not a package-supported version.
- **G2 NO (blocking)** — `background_bash` set to `ask` produced **0 permission requests in 2/2 runs**, while a same-session control (`shell` at `ask`) did raise one. `deny` is honored. This is a permission-boundary bypass, not a config mistake.
- **G3 YES** — 16/16 tasks terminal, a 4-member detached group fully reaped on cancel, 0 leaks before and after teardown.
- **G4 YES** — 16 tasks, 14 synthetic wake-ups, 0 duplicates.
- **G5 PARTIAL** — time-to-next-action 9–18 ms vs 5.5–33 s blocked, but background wall time sometimes exceeded foreground.

The two criteria the pilot set out to test — no permission bypass, and a supported runtime — are
the two that failed. Latency (the reason it was proposed) was the part that worked, which is
exactly the case for recording the negative result rather than quietly dropping it.

Also observed, not stress-tested, and not ours to fix (third-party package we do not adopt):
exit sidecars are created `0644` though the package claims `0600`, and restart reconciliation is
lazy (no wake-up for jobs that finish while the session is down).

## Acceptance

- [ ] Update `ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md` so the `opencode2-shell-tasks` candidate is recorded as **pilot-FAIL** with the gate table and the date, instead of standing as a live recommendation.
- [ ] State the falsifying reason in one sentence at the point of recommendation: the `ask` permission boundary is unenforced for `background_bash`, and no package-supported runtime exists.
- [ ] Keep the native OpenCode V2 recommendation as the primary path and the fallback intact; this item changes the third-party candidate's status only.
- [ ] Cross-link the pilot item and its merged PR so the evidence chain is one hop from the exploration.
- [ ] Record the third-party observations (sidecar mode `0644`, lazy restart reconciliation) as package caveats, attributed as such and not as this repository's defects.
- [ ] Docs-only change: `npm run arggon -- validate` is green and no runtime dependency, generated config, or CI lane is introduced.

## Notes

Raised as an open question by the pilot worker on 2026-09-28 ("withdraw the exploration's
opencode2-shell-tasks recommendation?"). Coordinator answer: yes — record the falsification and
keep the primary recommendation and its fallback intact. The exploration is dated research;
correcting a measurement-falsified recommendation in place is the point of keeping it as a
tracked doc.
