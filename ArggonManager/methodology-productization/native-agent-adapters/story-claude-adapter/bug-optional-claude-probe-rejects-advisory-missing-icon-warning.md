---
type: bug
status: todo
id: bug-optional-claude-probe-rejects-advisory-missing-icon-warning
title: Optional Claude probe rejects advisory missing icon warning
parent: story-claude-adapter
labels: []
created: "2026-11-04"
updated: "2026-11-04"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/bug-optional-claude-probe-rejects-advisory-missing-icon-warning.md
  Leaves live only under a story. id is the filename stem: bug-optional-claude-probe-rejects-advisory-missing-icon-warning.
  CLI `arggon create bug optional-claude-probe-rejects-advisory-missing-icon-warning` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Optional Claude probe rejects advisory missing icon warning

## Context

Found during PR #873 verification (https://github.com/Arggon/ArggonManager/pull/873), unrelated to its methodology extraction. With the currently installed Claude CLI, `claude plugin validate --strict <plugin>` exits 0 and prints `Validation passed`, but also prints a directory-only `ICON_MISSING` warning. The optional live probe in cli/src/init-claude.test.ts asserts stdout does not contain `warning`, so a full local run fails despite successful validation. Reproduced independently on the unchanged f0138d77 plugin via `git archive f0138d77 templates/docs/claude/arggon` into a disposable fixture and a throwaway HOME/CLAUDE_CONFIG_DIR: exit 0, same advisory warning, `Validation passed`. No product or test code is changed for this finding in #873; its optional live probe is reported separately from the deterministic regression suite. Evidence: /tmp/868-baseline-claude.log and /tmp/868-baseline-claude.I9y01g (ephemeral host paths).

## Acceptance

- [ ] Reproduce and record the supported client version, command, exit and advisory/error distinction on a disposable plugin fixture.
- [ ] Reconcile the optional probe's expectation with the supported validation contract, preserving failures for real invalid manifests and keeping any product icon decision explicit.
- [ ] Add regression evidence for both valid/advisory output and actual validation failure; no blanket warning suppression or silently skipped installed-client probe.

## Notes
