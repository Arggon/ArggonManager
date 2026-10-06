---
type: task
status: todo
id: task-validate-missing-frontmatter-command-surface-assertions
title: `MISSING_FRONTMATTER` / `UNTERMINATED_FRONTMATTER` have no assertion at the `validate` COMMAND surface — only library-level `runValidate` calls
parent: tooling-and-environment
labels: [tests, tracker-schema]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-validate-missing-frontmatter-command-surface-assertions.md
  Leaves live only under a story. id is the filename stem: task-validate-missing-frontmatter-command-surface-assertions.
  CLI `arggon create task validate-missing-frontmatter-command-surface-assertions` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `MISSING_FRONTMATTER` / `UNTERMINATED_FRONTMATTER` have no assertion at the `validate` COMMAND surface — only library-level `runValidate` calls

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Filed from the merge verification of PR #619 (merged as `8f7f2f3a8`).

### Context

PR #619 makes a frontmatter-less item file a validate **error** with a typed code and the offending path. The review of that PR recorded this as a non-blocking gap (its N1) and it is still open.

`cli/src/validate.test.ts` asserts the new codes, but every assertion goes through the library-level `runValidate` helper. Nothing asserts that the **command** surfaces them: that `arggon validate --json` exits non-zero and emits `{"ok":false,...,"errors":[{"code":"MISSING_FRONTMATTER", ...}]}` in the stable envelope.

That gap matters more than it looks, because this repo's carriers treat the JSON envelope as the contract (ADR 0006) and `arggon.yml` runs `arggon validate --json` as a **pinned 0.5.0** install — so the new codes are not gated by `tasks-validate` at all. The only thing that gates them is the `cli` lane. If the command surface regressed to a generic throw, or the code got dropped from the envelope, every existing test would still pass.

The reviewer also noted the envelope is already proven in that same file for a different code, so there is a precedent pattern to copy rather than invent.

### Acceptance

- [ ] At least one test per new code (`MISSING_FRONTMATTER`, `UNTERMINATED_FRONTMATTER`) that runs the **command** — `dist/cli.js validate --json` with cwd on a fixture copy — and asserts the typed code, the offending path, and a non-zero exit
- [ ] Assert the **whole** code, not a substring: a test that greps the envelope can stay green when the code is renamed or dropped and a generic `BROKEN_YAML` is emitted instead
- [ ] Cover the unterminated case as its own assertion, since it now has a distinct code rather than sharing the generic parse failure
- [ ] A negative control: a non-item markdown file must still exit 0, so the command-surface test cannot be satisfied by a check that over-fires
- [ ] Verified against the authority — `docs/agents.md`'s envelope contract and whatever the current declared error codes are — not against this item's prose
