---
type: task
status: todo
id: task-wire-native-start-cold-smoke-into-ci
title: Decide and wire the native start cold-start smoke into a CI lane
parent: ui-foundation
labels: [opencode-seam, smoke, ci]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
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
