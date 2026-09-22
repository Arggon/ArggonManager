---
type: bug
status: todo
id: bug-ci-version-guard-dev-only
title: CI version guard demands a release bump for dev-only package.json changes
parent: tooling-and-environment
labels: [ci, tooling]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-ci-version-guard-dev-only.md
  Leaves live only under a story. id is the filename stem: bug-ci-version-guard-dev-only.
  CLI `arggon create bug ci-version-guard-dev-only` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CI version guard demands a release bump for dev-only package.json changes

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`.github/workflows/ci.yml` step "Fail if package.json version is already tagged (release forgotten)" fails the PR whenever **any** change touches `package.json` while the current version is already tagged:

```sh
if ! git diff --name-only origin/main...HEAD | grep -q '^package\.json$'; then exit 0; fi
v=$(node -p "require('./package.json').version")
if git rev-parse -q --verify "refs/tags/v$v" >/dev/null; then echo "version $v already tagged - bump package.json"; exit 1; fi
```

After v0.4.0 this blocks dev-only edits (adding a test/dev dependency, a script) that are **not** adopter-facing and per the release runbook's bump rules (patch = bug fixes, minor = adopter-facing) do not warrant a release. First hit: `task-ui-browser-smoke-ci` needs `@playwright/test` as a devDependency; the guard would demand a version bump (or a wasted 0.4.1) for a CI-only change.

## Acceptance

- [ ] The guard only demands a version bump when **publish-relevant** fields change (at minimum `dependencies`, `bin`, `files`, `engines`, `name`, `private`, `version`); a `devDependencies`/scripts-only change passes with a clear message
- [ ] The release-forgotten case still fails: probe the predicate against a synthetic shipping-field change with the current version tagged (expected fail vs observed, recorded in the item comment)
- [ ] The step carries a comment explaining the scoping; `cli` check green on the proving PR
- [ ] Fixed in `task-ui-browser-smoke-ci`'s PR (hard prerequisite there) and referenced from both items — or in a dedicated PR if the smoke item lands first

### 2026-09-22 @ses_f34ab7c2effeGb96Q5UOGLzjgq
Fixed in `task-ui-browser-smoke-ci`'s PR: https://github.com/Arggon/ArggonManager/pull/401 (branch `feat/task-ui-browser-smoke-ci`, commit `50c89218`).

- `cli/version-guard.mjs` scopes the demand to `name`/`version`/`private`/`bin`/`files`/`dependencies`/`engines`; dev-only changes pass with a message, shipping-field changes still fail when tagged.
- Probe expected vs observed is recorded on `task-ui-browser-smoke-ci` (dev-only PASS; dependencies+tagged FAIL; dependencies+untagged PASS).
- Extra finding fixed in the same step: the guard was silently dead on PRs (`origin/main...HEAD` has no merge base in the shallow checkout — CI run 35794199343); the step now diffs against `github.event.pull_request.base.sha` and actually runs (green on PR #401, `cli` job prints the dev-only pass).
