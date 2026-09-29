---
type: task
status: in_progress
id: task-wire-native-start-cold-smoke-into-ci
title: Decide and wire the native start cold-start smoke into a CI lane
assignee: Arggon
branch: feat/task-wire-native-start-cold-smoke-into-ci
parent: ui-foundation
labels: [opencode-seam, smoke, ci]
priority: p3
created: "2026-09-28"
updated: "2026-09-29"
claimed_at: "2026-09-29T00:17:06.012Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-wire-native-start-cold-smoke-into-ci
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-wire-native-start-cold-smoke-into-ci.md
  Leaves live only under a story. id is the filename stem: task-wire-native-start-cold-smoke-into-ci.
  CLI `arggon create task wire-native-start-cold-smoke-into-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Decide and wire the native start cold-start smoke into a CI lane

## Context

<!-- Why this task exists. -->

`smoke:native-start-cold` landed with PR #427 as a maintainer-run command; that PR
deliberately left the CI lane undecided and filed this item to make the call
explicit. Decision: **wire it** — it is deterministic, model-free, offline,
Chromium-free, needs no provider or quota, and guards a P1 fix, so it belongs with
the other dev-only node gates already in the `cli` job (`test:structure`,
`lint:structure`). The browser/TUI `ui-smoke` job is explicitly the wrong home:
this is not a UI gate, and installing Chromium for it would be wrong.

## Acceptance

- [x] `npm run smoke:native-start-cold` runs in CI in the correct job, after the build it depends on, and a failure fails the lane.
- [x] The observed runtime is recorded, and the placement is justified against the job's existing steps.
- [x] No `continue-on-error`, no advisory `if:`, no browser dependency, no second install of the same gates.
- [x] Docs state the gate runs in CI, what it proves, and that it does not replace the model-driven transcript smoke.
- [x] A deliberately broken local run is demonstrated to exit non-zero (so the lane's failure mode is proven, not assumed) — show the command and its exit code.
- [x] `npm run arggon -- validate --json` is green and the workflow YAML is valid.

## Notes

### Decision and placement

One additive step at the end of the `cli` job in `.github/workflows/ci.yml`, named
`Native start cold-start smoke (tools.arggon.start worktree path)`, with a comment
recording why. The job's `run` steps read as `npm ci` → `npm run build` →
`npm run check:plugin` → `npm run test` → `npm run lint` → `npm run test:structure`
→ `npm run lint:structure`; the smoke drives this checkout's plugin source and
built kernel, so `npm run build` is its only hard ordering constraint and the step
lands after it. `ui-smoke` untouched.

### Observed runtime

Five consecutive local runs: 0.476s, 0.476s, 0.469s, 0.474s, 0.476s — exit 0, 20/20
checks each; 0.471s on the post-change tree. Sub-second, so every PR, not
label-gated — no separate job or `workflow_dispatch` needed.

### Failure mode proven, not assumed

In a throwaway copy of the checkout (`/tmp/opencode/cold-mutation-probe`, fresh
`git init`, own `node_modules/@arggondev/lib` link, deleted afterwards — no owned
file touched in this worktree): exit **1** with the shipped bug shape
(`preparation.ready=false`, `claimCommitted=false`, the gate's own stderr) after
gating `linkNodeModules` to the pre-fix behaviour; exit **0** for the same binary
with the mutation off; exit **2** with the actionable `npm run build` line when
the build is missing. The step is blocking — the job shell is `bash -e`, no
`continue-on-error`, no `|| true`, no advisory `if:`.

### Validation

`actionlint v1.7.12` exit 0 with no findings, plus a negative control proving it
validates and a baseline run proving HEAD was already clean. Python `yaml.safe_load`
asserted the step order and the absence of advisory keys.
`npm run arggon -- validate --json` → `ok:true`. `npm run smoke:native-start-cold`
20/20 exit 0. `lint:structure` and `test:structure` exit 0.

Draft PR #431 (`42843794`), left open for coordinator review.

### 2026-09-29 @Arggon

## CI wiring — done; the open question from the #427 verdict is closed

`task-native-start-cold-smoke`'s verdict left one decision open ("wire the new smoke into a CI job or keep it maintainer-run?"). **Decision: wire it.** It is deterministic, model-free, offline, needs no provider/quota/Chromium, and guards a P1 fix — and `lint:structure`/`test:structure` are already precedent for a dev-only node gate in the `cli` job. The `ui-smoke` job is explicitly the wrong home (not a UI gate; a browser install for it would be wrong).

### The diff to the `cli` job (the whole change)

```yaml
      - run: npm run test:structure
      - run: npm run lint:structure
+     - name: Native start cold-start smoke (tools.arggon.start worktree path)
+       # task-wire-native-start-cold-smoke-into-ci: the deterministic,
+       # MODEL-FREE gate for the native worktree/start path, run in this job
+       # beside the other dev-only node gates (`test:structure`,
+       # `lint:structure`) rather than as a lane of its own. It drives THIS
+       # checkout's plugin source and kernel build, so it needs `npm run build`
+       # above — it prints the two paths it resolved and exits 2 with an
+       # actionable `npm run build` line when the build is missing.
+       #
+       # Why `cli` and not `ui-smoke`: it is offline, needs no provider, no
+       # quota and no Chromium, and adds no second install. It is NOT the
+       # model-driven `smoke:opencode` transcript, which stays the
+       # runtime-level evidence and is run by maintainers (still quota-bound).
+       #
+       # Ordering is only constrained by the build above; the vitest `$TMPDIR`
+       # purge is age-gated (2h) and suite-start-gated, so it cannot reap this
+       # step's fixture even if it were ordered earlier. Cheap and last: a
+       # failing run keeps its fixture for inspection, with nothing after it.
+       # Observed runtime ~0.5s (5/5 local runs: 0.47-0.48s, 20/20 checks).
+       #
+       # BLOCKING on purpose: the job shell is `bash -e`, so a non-zero exit
+       # fails this step and the job. Deliberately no `continue-on-error`, no
+       # `|| true` and no advisory `if:` — that is what makes it a gate.
+       run: npm run smoke:native-start-cold
```

One additive step. No reformatting, no reordering of unrelated steps, no `defaults` change. The `ui-smoke` job is untouched.

### Why the placement is correct, against the steps I read in `.github/workflows/ci.yml`

The `cli` job's `run` steps are, in order: `npm ci` → `npm run build` → `npm run check:plugin` → `npm run test` → `npm run lint` → `npm run test:structure` → `npm run lint:structure` (plus the PR-only version guard). The smoke drives this checkout's plugin source and its built kernel, so **`npm run build` is its only hard ordering constraint**, and it is already satisfied before any gate runs. The step lands after that build and beside the other dev-only node gates, with no second install (`npm ci` is the only install step in the job, untouched).

I checked the one ordering risk I could think of rather than assuming it away: could `npm run test` (vitest) reap the smoke's `$TMPDIR` fixture if the smoke ran first? No — `test/teardown-tmp.ts` is age-gated at 2h _and_ suite-start-gated, so it cannot touch a fixture younger than either. So "last" is a grouping/readability choice, not a safety requirement, and I am not claiming the earlier slot would have broken. Last is also right operationally: a failing run keeps its fixture for inspection, and nothing runs after it.

### Observed runtime

Five consecutive local runs of the gate: **0.476s, 0.476s, 0.469s, 0.474s, 0.476s** — exit 0, 20/20 checks each. Re-run on the post-change tree: 0.471s, 20/20, exit 0. Sub-second, so it is on every PR rather than behind a label or a `workflow_dispatch` — no alternative lane proposed, because there is no performance reason for one.

### The failure mode is proven, not assumed

Done in a throwaway `tar` copy of this checkout at `/tmp/opencode/cold-mutation-probe` (fresh `git init`, so it could not touch the real repo's worktree registry, and `node_modules/@arggondev/lib` re-pointed at the copy) — **no owned file was modified in this worktree, and the copy is deleted.**

- **exit 1 — a real check failing.** `linkNodeModules` gated to return `false` (the pre-fix cold worktree) and the kernel rebuilt:
  ```
  COMMAND: ARGON_PROBE_BREAK_LINK=1 npm run smoke:native-start-cold
  EXIT CODE: 1   elapsed_ms=394
    harness error: native start failed (START_FAILED): … git commit failed:
      cold-start gate: dependency native-gate-dep is not installed. Fix the
      project gate/dependency cause, then re-run tools.arggon.start(…)
    preparation: {"ready":false,"install":"unavailable","linkedNodeModules":false,…}
    claimCommitted: false
    claimCommit: {"status":"failed","committed":false,"skipped":"git commit failed: …"}
  ```
  20 checks down to 7 — the exact bug shape the P1 fix was about. The fixture is kept for inspection, as documented.
- **exit 0 — same binary, mutation off:** `EXIT CODE: 0`, 20/20, `runtime: …/cold-mutation-probe/lib/dist/index.js`. So the red run above was the mutation, not the harness.
- **exit 2 — harness cannot run:** with `lib/dist` moved aside, `EXIT CODE: 2` and the actionable line `Build this checkout first: npm run build (it produces …/lib/dist)`. Restored afterwards.

And the lane contract itself: the job shell is `bash -e` (no `defaults.run.shell` override in the file), so a non-zero exit fails the step and the job. A scan of the **parsed** workflow finds **0** occurrences of `continue-on-error`, `|| true`, `|| :` and `set +e`. The new step has no `if:`, no `continue-on-error`, and the `ui-smoke` job contains no reference to the smoke. The one `exit 0` in the file is pre-existing, in the version-guard step.

### YAML validation

`actionlint v1.7.12 .github/workflows/ci.yml` → **exit 0, no findings**. I did not take that at face value: I ran a **negative control** first (a deliberately broken job key) and actionlint flagged it with `[syntax-check]` and exited 1, so the tool is really validating. I also ran the file at `HEAD` through actionlint (exit 0) to confirm the baseline was already clean and my step introduced no new findings. Additionally parsed the workflow with Python `yaml.safe_load` and asserted the step index/order and the absence of advisory keys programmatically.

### Repo gates (all in this worktree)

- `npm run arggon -- validate --json` → `{"ok":true,…,"errors":[],"warnings":[]}`; the pre-commit hook ran it on the commit (`arggon validate: ok (0 warning(s), convention v5)`).
- `npm run smoke:native-start-cold` → 20/20, exit 0, 0.471s.
- `npm run lint:structure` → exit 0; `npm run test:structure` → 3 passed, exit 0.
- `git status --porcelain` clean after the probe runs; the worktree registry shows no leftover fixture entries from my work.
- Workflow-only + docs change, so the full `npm test` / `lint` / `build` bar is not re-run here (the smoke is the thing being wired, and it is green); PR CI covers the rest.

### Docs

`CONTRIBUTING.md` (§ Native start cold-start smoke) and `ArggonManager/docs/engineering.md` § Smoke test now state that the gate runs in CI, in which job and at which position, what it proves, that only exit `0` is green, the measured runtime, and what it does **not** claim: it does not replace the model-driven `smoke:opencode` transcript (still the runtime-level evidence, still maintainer-run, still quota-bound), and its fixture install is synthesized so it proves resolution, not npm's reifier.

### Scope

Three files, +45/−1: `.github/workflows/ci.yml`, `CONTRIBUTING.md`, `ArggonManager/docs/engineering.md`. **No** `package.json` / `package-lock.json` change (the script already existed — no change was needed), **no** change under `opencode/plugins/arggon/**`, `smoke/**` or `lib/src/**`. The probe mutation was confined to the deleted throwaway copy.

Draft PR #431, head `42843794`, left open and in draft for coordinator review. Item stays `in_progress`.

### handoff 2026-09-29 @Arggon — next: Coordinator: review draft PR #431 and merge; the cli job's last step is the wired smoke and CI is the real proof
- branch: feat/task-wire-native-start-cold-smoke-into-ci
- open questions: Any ci.yml runner cost concern with the step, or accept as-is?; Should smoke:opencode also cover the cold start once quota allows?

### 2026-09-29 @Arggon
## CI confirmation on the draft PR (head `42843794`) — the step is green on a real runner

Run [36502860291](https://github.com/Arggon/ArggonManager/actions/runs/36502860291), all three jobs **success**:

| Job             | Result | Note |
| --------------- | ------ | ---- |
| `cli`           | **success** | the new step ran as step 11 of 11, `conclusion: success` |
| `ui-smoke`      | **success** | untouched — still 8 steps, no smoke reference added |
| `tasks-validate`| **success** (36s) | |

The step log ([job 109197513114](https://github.com/Arggon/ArggonManager/actions/runs/36502860291/job/109197513114)) is the strongest evidence in this item, because it settles three things at once on a real runner:

1. **It is not vacuous and not the stale-copy failure mode.** The harness self-identified the runner's own checkout:
   ```
   runtime: plugin /home/runner/work/ArggonManager/ArggonManager/opencode/plugins/arggon/index.ts
   runtime: kernel /home/runner/work/ArggonManager/ArggonManager/lib/dist/index.js
   ```
   All **20** checks `ok`, zero `FAILED`, ending `smoke:native-start-cold passed`.
2. **The runner uses the real job shell `shell: /usr/bin/bash -e {0}`** — printed by the runner itself. That is the lane's contract in the runner's own words: no `-e` suppression anywhere, so a non-zero exit fails the step and the job. It is not inherited from my reading of the docs.
3. **The observed runtime on the runner is ~0.6s** (00:27:14.936 start → 00:27:15.637 last check, 0.616s of logged work on a cold `npm ci`-then-build runner). That confirms the ~0.5s local figure and settles the "is this materially slow in the lane" question with data rather than assumption: it is not, so no separate job or `workflow_dispatch`/label gate is warranted.

Ordering is confirmed by the step list too: `Run npm run build` (step 6 of the job) precedes `Native start cold-start smoke …` (step 11), with `check:plugin`, `test`, `lint`, `test:structure` and `lint:structure` in between — i.e. the build dependency the smoke documents is genuinely satisfied on the runner.

Branch head is now `e35477d1` (the two tracker-comment commits on top of `42843794`); the workflow and docs content is unchanged since the green run. Draft PR #431 stays open for review.
### 2026-09-29 @Arggon-coordinator
## FINAL APPROVE — PR #431 (`69517fb4`), p3

Read the workflow as parsed YAML rather than as a diff, because the only failure mode that matters
for a CI gate is a step that silently stops being one. **Merge authorized; this comment performs no
merge and no `done` flip.**

### Verified placement and, more importantly, verified that it is a gate
I parsed `.github/workflows/ci.yml` with `yaml.safe_load` and enumerated the `cli` job's steps:
`npm ci` → version-tag check → `npm run build` → bundle-drift check → `npm run test` → `npm run
lint` → `npm run test:structure` → `npm run lint:structure`. The new step lands **last**, which is
correct because the smoke's only hard ordering constraint is the build above it (step 5) — it drives
*this checkout's* plugin source and kernel build, and exits 2 with an actionable `npm run build` line
when the build is absent.

The added step carries **`name` and `run` only** — no `if:`, no `continue-on-error`, no
`timeout-minutes` override — and the job shell is `bash -e`. So a non-zero exit fails the step and
the job. That is the whole point of the change, and it is the thing most likely to be broken by an
innocent-looking edit later, so it is now written down in both the workflow comment and
`engineering.md` rather than left implicit.

### Scope: genuinely additive
One step and a comment block in the `cli` job. `ui-smoke` untouched, no step reordering, no
reformatting of the surrounding YAML (the diff is +24/−0 in a file that already had 10 steps in
`cli` and 7 in `ui-smoke`). No `package.json`/`package-lock.json` change was needed — the script
existed from PR #427 — and nothing under `smoke/**`, `lib/src/**` or
`opencode/plugins/arggon/**`. A CI diff that touches unrelated structure gets rejected; this one does
not.

### The timing question is settled with data, not taste
**0.476 / 0.476 / 0.469 / 0.474 / 0.476 s** across five local runs, **0.616 s** of logged work on the
runner. Sub-second on a cold runner, so a separate job, a label gate or a nightly schedule would be
ceremony around a half-second. Putting it on every PR is the right call, and the number that decided
it is in the workflow comment where the next person will see it.

### The failure mode was proven, not assumed
In a throwaway `tar` copy of the checkout (own `git init`, own lib link, deleted afterwards, so no
owned file was touched): reintroducing the pre-fix `linkNodeModules` gives **exit 1** with the shipped
bug shape and the check count dropping 20 → 7; the **same binary** with the mutation off gives exit 0,
which is what makes the red run attributable to the mutation rather than to the environment; and a
missing build gives **exit 2**. I did the same mutation myself on PR #427 and got the same result,
so this is now proven twice on two heads.

`actionlint` exit 0 **with a negative control first** (a deliberately broken job key) to prove the
linter was actually validating rather than passing everything, plus a `yaml.safe_load` assertion on
step order and absent advisory keys. Validating a linter before trusting its verdict is the part
people skip.

### Docs
`engineering.md` §Smoke test gained a CI-tier bullet naming the job, the ordering constraint, the
blocking mechanism, the runtime, and — importantly — what the gate does **not** claim: it does not
replace the model-driven `smoke:opencode` transcript (still the runtime-level evidence, still
maintainer-run, still quota-bound), and its fixture install is synthesized, so it proves *resolution*,
not npm's reifier. `CONTRIBUTING.md` matches. A gate whose limits are stated is a gate; one whose
limits are implied gets over-trusted within a month.

### Honest limit carried forward
The runtime is a warm local machine plus a **single** CI sample, not a distribution. That is stated on
the item. It is nowhere near a threshold that would justify a narrower lane, and I am not asking for
a distribution study on a p3 — but if the step ever becomes the slowest thing in the job, the number
in the comment is the baseline to compare against.

### Gates
`arggon validate --json` `ok:true` · `lint:structure` exit 0 · `test:structure` exit 0 ·
`smoke:native-start-cold` 20/20 exit 0 · `actionlint v1.7.12` exit 0 · CI `cli`, `ui-smoke`,
`tasks-validate` all success on this head.
