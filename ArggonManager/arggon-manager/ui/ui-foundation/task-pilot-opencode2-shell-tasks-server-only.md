---
type: task
status: done
id: task-pilot-opencode2-shell-tasks-server-only
title: Run the isolated server-only opencode2-shell-tasks pilot
assignee: Arggon
branch: feat/task-pilot-opencode2-shell-tasks-server-only
parent: ui-foundation
labels: [opencode, pilot, tooling, server-only]
priority: p2
created: "2026-09-24"
updated: "2026-09-28"
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

### 2026-09-28 @Arggon-worker
# Pilot evidence — `opencode2-shell-tasks@0.1.1`, server-only, isolated

Author: Arggon-worker. Gate: **FAIL**. Full detail in the item body.

## 1. Versions, isolation and package/dependency/audit facts

- Runtime: `opencode v2.0.18` (stable, channel `latest`). `opencode2` on this
  box is a 47-byte shim (`exec …/opencode "$@"`) to the **same** binary, so it
  also reports `v2.0.18` — there is no `0.0.0-beta-*` runtime available. The
  package README's precondition (`opencode2 --version` must report
  `0.0.0-beta-*`) is therefore **unsatisfiable here**.
- Package: `opencode2-shell-tasks@0.1.1` (MIT, published 2026-08-24, exact pin,
  no `@latest`). Sole dependency `@opencode-ai/plugin@0.0.0-beta-18027`
  (exact). Peer deps `@opentui/core|keymap|solid >=0.5.7`, `solid-js >=1.9.10 <2`.
- Install: **197 packages**, 174 MB (matches the exploration's figure).
  `npm audit --omit=dev` → **5 low, 0 moderate/high/critical**, chain
  `@babel/core ← @opentui/solid ← @opentui/keymap` / `@opencode-ai/plugin`.
- Plugin loaded from the isolated cache:
  `…/cache/opencode/npm/opencode2-shell-tasks@0.1.1/…/dist/server.js`
  (server entrypoint only; `./tui` never loaded).

Isolated roots (all outside the repository; `opencode debug paths` under the
pilot env redirected every one of them):

| Variable | Pilot value |
| --- | --- |
| `XDG_CONFIG_HOME` | `/tmp/opencode/shell-tasks-pilot/config` |
| `XDG_DATA_HOME` | `/tmp/opencode/shell-tasks-pilot/data` |
| `XDG_STATE_HOME` | `/tmp/opencode/shell-tasks-pilot/state` |
| `XDG_CACHE_HOME` | `/tmp/opencode/shell-tasks-pilot/cache` |
| `OPENCODE_BACKGROUND_TASKS_DIR` | `/tmp/opencode/shell-tasks-pilot/state/background-tasks` |
| session/workdir | `/tmp/opencode/shell-tasks-pilot/work/run` |

Isolation proofs: `debug paths` shows `data`/`config`/`state`/`cache` all under
the pilot root (vs the real `/home/arggon/.…`); the real
`~/.config/opencode/opencode.json` md5 was **identical before and after** the
pilot (`e745858482b6a25edff0766363988a4e`); no real
`~/.local/share/opencode/background-tasks` was created; the real `auth.json`
(mtime 2026-09-08) was never read into or copied into the pilot.

A private `opencode serve --port 47821` was used deliberately: the managed
background service on port 49374 belongs to the live desktop session (PID
52314) and was never touched.

## 2. Server-only registration (4/4)

`/api/plugin` is **useless as a registration signal on v2.0.18** — it reports
only `type: "builtin"` entries and returned an empty list under a broken config.
The real signal was the server log line
`loading plugin id=opencode2-shell-tasks@0.1.1 entrypoint=…/dist/server.js`,
and the decisive proof is actual invocation: all four tools were called through
the API-driven session (`background_bash`, `background_tasks`,
`background_output`, `background_kill`).

Config schema note: the published `https://opencode.ai/config.json` does
**not** match this runtime. The runtime requires
`permissions: [{action, resource, effect}]` — **`resource` is required**; a rule
without it is silently dropped (`kind=invalid action="skipped malformed
recognized value"`). The agent key is `agents` (plural), not `agent`. Both were
found in the server's own `/openapi.json`.

## 3. Permission boundary — the blocking FAIL

Configured top-level `background_bash: ask`, `background_kill: ask`, and
`agents.reviewer` with both `deny`.

Resolved server-side via `POST /api/session/{id}/permission`:

| Action | Agent | Effect |
| --- | --- | --- |
| `background_bash` | general | `ask` |
| `background_bash` | reviewer | `deny` |
| `background_kill` | reviewer | `deny` |
| `background_bogus` (control) | reviewer | `allow` |

**`deny` holds** — in a reviewer session `background_bash` was absent from the
tool catalog entirely, the model could not call it, and no task was created.

**`ask` does NOT hold** — 2/2 runs executed `background_bash` with no
permission request. A/B in **one** session, same `ask` policy:

| Tool | effect | Permission request raised? | Result |
| --- | --- | --- | --- |
| `shell` (`echo AB_SHELL`) | `ask` | **yes** — `action=shell`, `resources=["echo AB_SHELL"]` | blocked pending approval |
| `background_bash` (`echo AB_BG`) | `ask` | **no** | `status: completed` |

So the `ask` mechanism demonstrably works headlessly; the bypass is specific to
`background_bash`. Mechanism: the tool is only reachable through Code Mode's
`execute` tool, and nested `tools.*` calls inside the evaluated script are not
individually permission-gated. Consequence: the plugin's declared safety model
(a human approves every background start) does not hold, and every background
job runs with the user's full privileges, inherited env and no workdir
containment.

## 4. Foreground vs background (all four lanes, both arms)

Workload copy: `git archive` of the item branch head `ddac065a` into the pilot
root, with a symlink-only `node_modules` overlay (nothing written to the
worktree). `@playwright/test` was installed into a **separate** pilot dir
because it is declared but absent from the repo install.

| Lane | Foreground (agent blocked) | Background tool latency (time-to-next-action) | Background task | Exit |
| --- | --- | --- | --- | --- |
| unit `npm test` | 49,621 ms | **9 ms** | `bg_multg1wb_cae033`, 58,078 ms | 1 |
| build `npm run build` | 5,484 ms | **10 ms** | `bg_multh6or_37cff4`, 13,051 ms | 0 |
| Playwright `@smoke` | 6,385 ms (9 passed) | **15 ms** | `bg_multmfmo_9c922c`, 4,000 ms | 0 (9 passed) |
| PTY TUI `smoke:tui-board` | 32,980 ms | observed (model-driven) | `bg_multhtjb_d2e6c2` | 0 |

Wake-up: exactly one synthetic message per task, text e.g.
`Background task pilot-registration completed (exit 0). Use the background_output
tool with task_id "bg_…" …`; the model then called `background_output` and
continued. Bounded output tails read via `background_output` (max 2000 lines).

Honest caveats: the background arm's *task* wall times were often **longer** than
the foreground baseline (unit 58.1 s vs 49.6 s; build 13.1 s vs 5.5 s). I could
not attribute that to the plugin versus the isolated environment (cold
transform cache, env differences), so the only clean signal is tool latency.
The unit lane's non-zero exit is an artifact of the `git archive` copy — the
failing tests are the git-checkout/packed-install/build-identity ones; the real
worktree is green at 1640/1640.

## 5. Failure, cancellation, restart, out-of-session workdir

- **Failure** — `sh -c "echo BEFORE_FAIL; exit 42"` → `status=failed`,
  `exitCode=42`, log tail `BEFORE_FAIL`. Exit codes propagate exactly.
- **Cancellation** — a job with a 4-member detached process group
  (`pgid 783475`: wrapper, `sh -c`, 2× `sleep 300`). `background_kill` →
  `status=killed`, `signal=SIGTERM`, and **all 4 group members reaped**
  (group-signalled via `kill(-pid)`).
- **Restart reconciliation** — a detached job outlived the server
  (`kill -TERM` on the server; child survived), finished with `RESTART_SURVIVED`
  and wrote exit `7` to the sidecar. After restart the store still read
  `status=running, exit=null` until the next tool call, which corrected it to
  `failed` / `exit 7`. Reconciliation works but is **lazy** (nothing is
  reconciled proactively at startup), and no wake-up fires for a job that
  completes during downtime — by design to avoid duplicates, but it means a
  restart silently drops completions. 2 of 16 tasks ended with no wake-up for
  this reason.
- **Out-of-session workdir** — `workdir` is `path.resolve(sessionDir, workdir)`
  with **no containment check**. `workdir: "/tmp"` ran `pwd` → `/tmp`, i.e. it
  escapes both the session directory *and* the disposable pilot root. Combined
  with `env: process.env` and the unenforced `ask`, a `background_bash` call is
  an unprompted arbitrary-command primitive.

## 6. Leak / cleanliness proofs

- **Process groups**: 16/16 tasks terminal (`completed` 6, `failed` 9, `killed`
  1); 0 non-terminal; 0 leaked PIDs before teardown; 0 after.
- **Duplicate wake-ups**: 16 tasks, 14 synthetic wake-ups, **0 duplicates**.
- **Repository log/sidecar**: 0. Both checkouts `git status` clean; no `bg_*`,
  `background-tasks`, `*.exit` or `*shell-tasks*` path anywhere in either repo
  outside `.git` refs and this item's own file.
- **Secret leak**: 0. The server password appears only in the pilot's
  `state/serve.pw`, never in any task log or sidecar; the real `auth.json` was
  never copied into the pilot; no real provider id appears in any task log.
- **Tracker mutation outside `tools.arggon.*`**: 0. The only change is this
  item's body; frontmatter untouched by hand.
- **File modes**: job JSON and logs `0600` as claimed, but the **exit sidecar is
  `0644`** (written by the shell wrapper with the default umask, not the
  plugin's `open(…, 0o600)`), and the state directories are `0755` — so task
  ids and exit codes are world-readable, which slightly contradicts the
  "mode-restricted by default" claim.

## 7. Teardown proof

1. Pilot `opencode serve` (PID 783758) `kill -TERM`ed → confirmed gone.
2. `opencode plugin remove opencode2-shell-tasks` reported **"not configured"**
   — it does not match the versioned spec `opencode2-shell-tasks@0.1.1` (minor
   CLI observation).
3. Entire disposable root deleted: 396 MB removed,
   `/tmp/opencode/shell-tasks-pilot` **absent**.
4. Post-teardown: 0 processes matching `shell-tasks-pilot` or port 47821.
5. The shared desktop service (PID 52314, up since 16:17) is untouched.

## 8. Repo gates for this tracker-only commit

- `npm test` → **1640/1640 passed**
- `npm run lint` → clean
- `npm run build` → ok
- `npm run check:plugin` → ok
- `npm run arggon -- validate --json` → `{"ok":true,…,"errors":[],"warnings":[]}`
- pre-commit hook (`arggon validate`) → `ok (0 warning(s), convention v5)`
- `npm run lint:structure` / `npm run test:structure` → **cannot run**:
  `ast-grep: command not found`. The declared devDependency
  `@ast-grep/cli@0.45.3` is absent from this environment's install. Pre-existing
  and unrelated to this change — it fails identically on the untouched claim
  commit. (Same root cause as the missing `@playwright/test`.)

## 9. Limitations

1. **Gate is FAIL on `ask` being unenforced** — 2/2 runs, with a same-session
   control proving the mechanism itself works. A quota-blocked or partial run
   was not used to excuse this.
2. **No package-supported runtime exists here** — every measurement is against
   stable v2.0.18, which the package does not claim to support. This alone would
   block a PASS.
3. **Provider quota**: the briefed `opencode-go/deepseek-v4-flash` exhaustion
   did **not** block the pilot. The isolated profile deliberately has no
   credentials, but the `opencode` Zen provider exposes 8 `apiKey: "public"`
   free models, so sessions ran on `opencode/space-bunny-free`. No real
   credential was needed or copied.
4. **Foreground arm measured directly, not through the agent's `shell`.** In the
   isolated profile the agent's `shell` had a broken `PATH`
   (`vitest/tsx: command not found`) and its tool-call telemetry is not exposed
   (`metadata.toolCalls` empty), so a like-for-like in-agent A/B was not
   possible. Foreground numbers are direct timings of the same commands, which
   is what a blocking tool costs the agent.
5. **Background-vs-foreground wall-time delta is unattributed** (plugin vs cold
   isolated environment).
6. **Single-machine, single-day, one runtime**; `linux` only, no macOS/Windows.
7. The exit-code sidecar's `0644` mode and the lazy restart reconciliation were
   observed but not stress-tested (e.g. concurrent servers, network filesystems).

## 10. Recommendation

Withdraw the `opencode2-shell-tasks` pilot for this repository. The latency
benefit is real and large (9–18 ms vs seconds), but it arrives with the
approval gate silently disabled, no workdir containment, and full environment
inheritance. If the background-job idea is still wanted, the exploration's own
fallback applies: internalize only the minimal behaviour in ArggonManager's
existing vendored plugin, where permissions are first-class and reviewable.

### handoff 2026-09-28 @Arggon-worker — next: Coordinator: review draft PR #423 and merge; then flip status done. Gate is FAIL, so no ADR/playbook item is warranted.
- branch: feat/task-pilot-opencode2-shell-tasks-server-only
- open questions: Permission FAIL is real (ask unenforced, 2/2 plus same-session control). Withdraw the exploration's opencode2-shell-tasks recommendation? lint:structure/test:structure could not run here (@ast-grep/c…
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
