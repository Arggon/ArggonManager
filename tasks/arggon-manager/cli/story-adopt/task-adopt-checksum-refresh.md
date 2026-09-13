---
type: task
status: done
id: task-adopt-checksum-refresh
title: Refresh x-generated checksums after the adopt sweep
assignee: Arggon
branch: feat/task-adopt-checksum-refresh
parent: story-adopt
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adopt/task-adopt-checksum-refresh.md
  Leaves live only under a story. id is the filename stem: task-adopt-checksum-refresh.
  CLI `arggon create task adopt-checksum-refresh` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Refresh x-generated checksums after the adopt sweep

## Context

Audit finding (story-adopt): after the adoption agent legitimately fills the generated docs during the sweep (AGENTS.md description, ARCHITECTURE problem, CONTRIBUTING specifics...), those docs stay permanently "modified" vs their `x-generated` checksums — every future template upgrade always reports them, and adopting an upgrade requires the `--backup` dance. The sanctioned sweep edits should become the new baseline.

## Acceptance

- [x] `arggon adopt --ack`: acknowledges the CURRENT on-disk content of all docs present in `x-generated` state as the new baseline — recomputes checksums from disk, refreshes the state entries (checksum + arggonVersion + generatedAt).
- [x] Creates nothing: files absent from the state are untouched; state entries whose file is missing on disk are left as-is; requires an initialized tree (`ADOPT_FAILED` otherwise).
- [x] Human output lists the acked docs (path + new checksum) + count; `--json` envelope: `{ command: "adopt", acked: [{ path, checksum }], count }`.
- [x] Works standalone, even when `task-adopt-arggon` is already done.
- [x] Adoption guidance wired in: `ADOPT_TASK_BODY` gains a checklist step (before verify) to run `arggon adopt --ack` after completing the generated docs, noting hand-edits AFTER acking still report modified; checklist numbering stays consistent (docs/agents.md sweep procedure kept in sync).
- [x] Docs updated: `docs/json-output.md` (adopt --ack payload), `README.md` (adopt section), `docs/convention.md` (x-generated: checksums refreshed by `adopt --ack` and by init re-runs).
- [x] Tests: ack refreshes checksums → doctor/next-init report untouched (not modified); untracked docs untouched; --ack on non-initialized tree fails; --json payload correct; hand-edit AFTER ack → modified again (protection intact).
- [x] Gates green: `tsc -p tsconfig.json --noEmit`, `eslint cli/src`, full `vitest run`.

## Notes

Protection semantics are unchanged for non-sanctioned edits: only the explicit `--ack` act re-baselines. After an ack, a later template upgrade regenerates the doc from the upgraded template (`updated[]`) — the pre-upgrade content lives in git history (commit before upgrading), matching the documented Copier/Helm-style re-run semantics.
