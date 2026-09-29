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

## Acceptance

- [ ] 

## Notes

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

I checked the one ordering risk I could think of rather than assuming it away: could `npm run test` (vitest) reap the smoke's `$TMPDIR` fixture if the smoke ran first? No — `test/teardown-tmp.ts` is age-gated at 2h *and* suite-start-gated, so it cannot touch a fixture younger than either. So "last" is a grouping/readability choice, not a safety requirement, and I am not claiming the earlier slot would have broken. Last is also right operationally: a failing run keeps its fixture for inspection, and nothing runs after it.

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
