---
type: story
status: done
id: install-ergonomics
title: "Install ergonomics: packaging and side-by-side installs"
assignee: Arggon
parent: cli
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-22"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/install-ergonomics.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Install ergonomics: packaging and side-by-side installs

## Context

Adopters (and this repo's own dev checkout) need to run `main` and `opencode2`
side by side, and to install either build cleanly. The 2026-09-18 investigation
verified on this machine:

- Both branches declare the same package bin (`arggon`), so two `npm link`
  installs collide; the global shim ends up pointing at whichever was linked
  last.
- `npm pack --dry-run` ships 973 files / 8.4 MB (tests included) because
  `package.json` has no `files`; there is no `prepare` build, and `tsc` leaves
  `dist/cli.js` non-executable (644), so manual symlink installs fail.
- Workable paths exist (named shim + per-project PATH via mise; isolated npm
  prefix copy), but neither is documented.

Scope: packaging hygiene and the documented side-by-side install recipe. No
rule-logic or tracker changes.

## Acceptance

- [x] `task-npm-packaging` closed: the package ships a slim, buildable tarball.
- [x] `task-opencode2-side-by-side-installs` closed: documented, verified
      recipe for running both builds at once.

## Notes

- Follow-ups filed from the 2026-09-18 side-by-side investigation; Option A
  (wrapper + `arggon-oc2` + `mise.local.toml` `_.path`) is already mounted
  locally.
