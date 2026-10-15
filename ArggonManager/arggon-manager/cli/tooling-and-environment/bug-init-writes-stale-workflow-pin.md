---
type: bug
status: done
id: bug-init-writes-stale-workflow-pin
title: init writes a stale ARGGON_VERSION pin into the generated workflow
assignee: Arggon
branch: fix/init-pin-tracks-cli-version
parent: tooling-and-environment
labels: []
created: "2026-10-15"
updated: "2026-10-15"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-init-writes-stale-workflow-pin.md
  Leaves live only under a story. id is the filename stem: bug-init-writes-stale-workflow-pin.
  CLI `arggon create bug init-writes-stale-workflow-pin` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init writes a stale ARGGON_VERSION pin into the generated workflow

## Context

`arggon init` copied the template's literal `ARGGON_VERSION` into an adopter's
`.github/workflows/arggon.yml`. The release flow bumps package.json before the
template is re-pinned, so published tarballs carried an older pin than
themselves: arggon-manager@0.5.0 wrote `"0.4.0"` and @0.10.0 writes `"0.7.0"`.
Seen in Arggon/agent-scheduled-tasks and Arggon/opencode-scheduled-tasks, where
the adopter had to hand-edit the pin after every init. Reproduce:
`npx arggon-manager@0.10.0 init` in an empty repo, then grep ARGGON_VERSION.

## Acceptance

- [x] init renders the generated workflow's pin from the running CLI's package.json version (`arggonVersion()`), not the template literal; output stays a literal pin (task-ci-seam-pin-tracks-release unchanged)
- [x] A test fails when the generated pin and package.json version diverge (`cli/src/workflow-pin.test.ts`)
- [x] Content without a pin line and non-semver versions are left untouched
- [x] CI green on the PR

## Notes

## Evidence

- `npx vitest run cli/src/workflow-pin.test.ts cli/src/ci-seam-pin.test.ts cli/src/init-docs.test.ts`: 3 files, 61 tests passed.
- RED without the fix (docs.ts reverted to main): workflow-pin.test.ts failed 2 tests (`expected '0.4.0' to be '9.8.7'`, `renderWorkflowPin is not a function`); restored, green.
- `npx eslint` and `npx prettier` on touched files clean; `npx tsc -p tsconfig.typecheck.json` exit 0.
- Branch fix/init-pin-tracks-cli-version; CI on the PR.
