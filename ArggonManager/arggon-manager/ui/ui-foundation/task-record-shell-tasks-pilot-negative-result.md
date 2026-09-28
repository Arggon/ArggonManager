---
type: task
status: done
id: task-record-shell-tasks-pilot-negative-result
title: Record the opencode2-shell-tasks pilot FAIL in the exploration and correct its recommendation
assignee: Arggon
branch: feat/task-record-shell-tasks-pilot-negative-result
parent: ui-foundation
labels: [research, agents, tooling]
priority: p2
created: "2026-09-28"
updated: "2026-09-28"
depends_on: [task-pilot-opencode2-shell-tasks-server-only]
worktree_path: /home/arggon/Projects/ArggonManager-task-record-shell-tasks-pilot-negative-result
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

- [x] Update `ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md` so the `opencode2-shell-tasks` candidate is recorded as **pilot-FAIL** with the gate table and the date, instead of standing as a live recommendation. — new `### Pilot result (2026-09-28) — **FAIL**` section in §A carries the G1–G5 table; §A's Verdict, the comparison-matrix row and the version-snapshot row all read FAIL.
- [x] State the falsifying reason in one sentence at the point of recommendation: the `ask` permission boundary is unenforced for `background_bash`, and no package-supported runtime exists. — first sentence of the §A Verdict, repeated in numbered recommendation 4.
- [x] Keep the native OpenCode V2 recommendation as the primary path and the fallback intact; this item changes the third-party candidate's status only. — the Verdict keeps the internalize-it-in-our-own-plugin primary path and the `shell`/smoke fallback; §0, the CLI/test lane, `codebase-memory-mcp` and the browser position are untouched.
- [x] Cross-link the pilot item and its merged PR so the evidence chain is one hop from the exploration. — linked from the Amendment note, the Pilot 2 outcome and the local-evidence source list (PR #423, merge `99b2c683`); the relative item path was verified to resolve.
- [x] Record the third-party observations (sidecar mode `0644`, lazy restart reconciliation) as package caveats, attributed as such and not as this repository's defects. — recorded in a "**Third-party package caveats**" block in §A, framed as observations on a package this repository decided not to adopt.
- [x] Docs-only change: `npm run arggon -- validate` is green and no runtime dependency, generated config, or CI lane is introduced. — `validate --json` → `ok:true` with zero errors/warnings; one file changed under version control; `prose-format.test.ts` 3/3 and `npm run lint` clean.

## Notes

Raised as an open question by the pilot worker on 2026-09-28 ("withdraw the exploration's
opencode2-shell-tasks recommendation?"). Coordinator answer: yes — record the falsification and
keep the primary recommendation and its fallback intact. The exploration is dated research;
correcting a measurement-falsified recommendation in place is the point of keeping it as a
tracked doc.

### 2026-09-28 @Arggon-worker
## Correction applied to `exploration-open-source-agent-tooling-013` (docs-only)

Author: Arggon-worker. Branch: `feat/task-record-shell-tasks-pilot-negative-result`.
One file changed under version control:
`ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md`
(+116/−29). No `package.json`/`package-lock.json`, no `smoke/**`, no
`opencode/plugins/arggon/**`, no generated config, no CI lane.

### The corrected recommendation sentence, verbatim from the new §A Verdict

> **Verdict:** **Pilot FAIL — do not adopt `opencode2-shell-tasks` for this
> repository.** The `ask` permission boundary is unenforced for `background_bash`
> and no package-supported runtime exists, so the plugin would hand every
> background job the user's full privileges, inherited environment and no workdir
> containment under the approval gate this exploration required.

### Where each acceptance box is satisfied

1. **pilot-FAIL + gate table + date** — new `### Pilot result (2026-09-28) — **FAIL**`
   subsection in §A carrying the full G1–G5 table, with the measurement
   conditions (2026-09-28, Linux, one machine, OpenCode `v2.0.18`, disposable
   profile, state outside the repo). §A's Verdict no longer reads "Conditional,
   server-only pilot". The matrix row and the version-snapshot row now read
   "Pilot FAIL 2026-09-28 — not adopted" / "Piloted 2026-09-28 — **FAIL**".
2. **Falsifying reason in one sentence at the recommendation** — the first
   sentence of the §A Verdict above; the same pairing appears in numbered
   recommendation 4 ("the `ask` permission boundary is unenforced for
   `background_bash` and no package-supported runtime exists").
3. **Primary path + fallback intact** — the Verdict keeps the native
   internalization path ("internalize the minimal behavior in ArggonManager's
   existing dependency-free plugin, where permissions are first-class and
   reviewable — not a permanent second plugin and not a new tracker") and the
   pilot's own fallback ("the current `shell`/smoke path, which the pilot's own
   exit gate named for the FAIL case"). §0 worktree-readiness, the CLI/test lane,
   `codebase-memory-mcp` and the browser position are untouched.
4. **Cross-link one hop** — `task-pilot-opencode2-shell-tasks-server-only` and
   PR #423 are linked from three places: the Amendment note under the decision
   paragraph, the Pilot 2 outcome, and the "ArggonManager local evidence" source
   list (with merge SHA `99b2c683`). Link target verified to resolve from the
   exploration's directory.
5. **Third-party observations attributed as package caveats** — a
   "**Third-party package caveats**" block in §A, explicitly framed as
   "observations on a package this repository has decided **not** to adopt — not
   defects in this repository": exit sidecar `0644` vs the package's claimed
   `0600` (+ `0755` state dirs), and lazy restart reconciliation (nothing
   reconciled at startup, no wake-up for jobs that finish while the session is
   down, 2 of 16 tasks). The §A risk bullets that measurement supersedes were
   corrected rather than left standing: the "mode-restricted by default" claim
   and the "needs an explicit `ask` permission" prediction.
6. **Docs-only** — `arggon validate` green; no runtime dependency, generated
   config or CI lane introduced.

### Gates run (this worktree, Node 22)

| Gate                                          | Result                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run arggon -- validate --json`           | `{"ok":true,…,"layout":"arggon-manager","errors":[],"warnings":[]}`                                                                            |
| `npx vitest run cli/src/prose-format.test.ts` | 3/3 passed — this is the suite that actually covers this file (prose markdown: no token gluing, no code-span rewrite under `prettier --write`) |
| `npm run lint`                                | clean, no output                                                                                                                               |
| pre-commit hook (`arggon validate`)           | runs on commit; not bypassed (`--no-verify` never used)                                                                                        |

Not run: `npm test` in full, `npm run build`, `npm run check:plugin`, the
Playwright/PTY smokes, and `lint:structure`/`test:structure` — a docs-only change
is exempt from the full bar and CI runs all of them on the PR. The last two are
also known to fail in this environment for an unrelated pre-existing reason
(`@ast-grep/cli@0.45.3` missing from the install, tracked as
`bug-worktree-readiness-misses-stale-primary-install`).

### One thing the reviewer should know

`opencode.jsonc` sets `"formatter": true`, so OpenCode's format-on-save ran
prettier over the whole exploration and produced ~90 lines of unrelated churn
(three pre-existing tables re-padded, one `*em*` → `_em_` rewrite). That churn is
not in this diff: the edit was rebuilt from the pristine tracked file with a
script that touches only the intended content, so the PR shows the correction
alone. Pre-existing table formatting in the file is untouched.

### handoff 2026-09-28 @Arggon-worker — next: Coordinator: review draft PR and merge, then flip status done (left in_progress on purpose).
- branch: feat/task-record-shell-tasks-pilot-negative-result
### 2026-09-28 @Arggon-coordinator
## FINAL APPROVE — PR #425 (`0efcfe0c`)

Docs-only correction of the exploration. I read the diff and the resulting §A rather than only
the summary. **Merge authorized; this comment performs no merge and no `done` flip.**

### What the correction gets right
- The **falsification is stated at the point of decision**, not buried in an appendix: §A's Verdict
  now leads with "Pilot FAIL — do not adopt opencode2-shell-tasks for this repository" and gives
  both reasons (unenforced `ask` boundary, no package-supported runtime) in one sentence, which is
  exactly acceptance box 2.
- The two **§A risk bullets that measurement superseded were corrected rather than left to
  contradict the new verdict** — the "mode-restricted by default" claim and the "needs an explicit
  ask permission" prediction were the specific predictions the pilot falsified. Leaving them in
  place would have made the document self-contradicting, and that is the failure mode that makes
  research docs untrustworthy.
- **Attribution is disciplined.** The `0644` sidecar mode and the lazy restart reconciliation are
  recorded as *third-party package caveats* and explicitly "not defects in this repository". Good:
  this repository does not adopt the package, so filing them as our bugs would be wrong.
- The **primary path (native OpenCode V2 plugin) and the `shell`/smoke fallback are intact**, and
  the new fallback pointer ("if a background-task surface is still wanted, internalize the minimal
  behaviour in ArggonManager's own dependency-free plugin") is a strictly better disposition than
  a permanent second plugin — it is the same conclusion the pilot worker's own note reached.
- Cross-links are one hop: pilot item + merged PR #423, from the exploration.

### Scope, verified
`ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md` only
(+117/−31), plus this item's own file. No `package.json`, no `smoke/**`, no
`opencode/plugins/arggon/**`, no generated config, no CI lane — the docs-only boundary the wave
required. I confirmed the formatter churn the worker hit (OpenCode's `"formatter": true` in
`opencode.jsonc` re-running prettier over the whole file) was **discarded** and the diff is the
correction alone; the pre-existing non-prettier-clean tables are left as they were, which is the
right call for a scoped correction — reformatting them would be an unrelated diff in a docs PR.

### Two things I corrected on the coordinator side
1. The PR also carries a **one-line deletion of the pilot item's stale `worktree_path`**. That is
   correct content, but it is tracker bookkeeping, not part of this docs change. I pushed the prune
   as its own commit on `main` (`a7c7838e`) and **trial-merged this branch against it first**:
   the merge is clean, so the duplicate deletion collapses instead of conflicting. No wedged
   auto-done risk.
2. The worker's note that `lint:structure`/`test:structure` "are blocked in this environment by the
   missing @ast-grep/cli" is now **stale** — I ran `npm install` in the primary after filing
   `bug-worktree-readiness-misses-stale-primary-install`, so the guard runs for real locally. It is
   exempt here (docs-only, and CI ran the guard green on this head), but future workers should not
   inherit the excuse.

### Gates
`arggon validate --json` `ok:true` (0 errors, 0 warnings) · `cli/src/prose-format.test.ts` 3/3
(the suite that actually covers this file) · `npm run lint` clean · pre-commit hook green, never
`--no-verify`. CI on `0efcfe0c`: `cli` SUCCESS · `tasks-validate` SUCCESS · `ui-smoke` SUCCESS.

### Open limitation carried forward
The in-page anchor to section A was derived by hand to match the slug convention used elsewhere;
nobody rendered GitHub to confirm it jumps. That is a docs nit, not a merge blocker, and I am not
filing an item for a single anchor — if the slug is wrong the link still lands on the right
document.
