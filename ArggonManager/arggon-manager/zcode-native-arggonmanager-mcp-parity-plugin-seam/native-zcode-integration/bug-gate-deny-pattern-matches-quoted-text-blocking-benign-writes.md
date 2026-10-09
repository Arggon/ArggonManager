---
type: bug
status: in_progress
id: bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes
title: "Gate deny-pattern matches quoted text, blocking benign writes"
assignee: arggon-delivery-lead
branch: fix/bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes
parent: native-zcode-integration
labels: []
created: "2026-10-09"
updated: "2026-10-09"
claimed_at: "2026-10-09T21:49:31.610Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes
---
<!--
  Placement (v0): ArggonManager/arggon-manager/zcode-native-arggonmanager-mcp-parity-plugin-seam/native-zcode-integration/bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes.md
  Leaves live only under a story. id is the filename stem: bug-gate-deny-pattern-matches-quoted-text-blocking-benign-writes.
  CLI `arggon create bug gate-deny-pattern-matches-quoted-text-blocking-benign-writes` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Gate deny-pattern matches quoted text, blocking benign writes

## Context

Found live 2026-10-10, minutes after the ZCode seam gate first fired in-session (the `task-zcode-live-verification` restart leg). The hook gate scans the ENTIRE Bash command string for its deny patterns (force-push, `--no-verify`, …), so a command that merely QUOTES a denied command — e.g. a tracker comment documenting a gate probe, a commit message citing the denied form, or a `node gate.mjs` self-test invocation — matches the pattern and the whole benign call is denied with the force-push reason.

Repro: with the seam gate active in a session, run a Bash call whose text contains the literal substring of a denied command anywhere (e.g. `npm run arggon -- comment <id> "… a force-push probe: git push --force origin …"`) — the call is denied with `arggon gate: denied — force push …` before anything runs. Hit in practice: the post-restart evidence comment on `task-zcode-live-verification` had to be reworded once because it quoted the probe verbatim.

Severity: papercut (fail-closed, rewording works around it), but it will bite every agent that documents gate behavior — which is exactly what this repo's methodology tells agents to do.

## Acceptance

- [ ] Decide the matching scope deliberately: either restrict deny-pattern matching to the command's argv structure (not free text in arguments), or exempt tracker-write commands (`npm run arggon -- comment/handoff/create/update …`) from the string scan, or keep as-is with the trade recorded — the decision documented in the gate header.
- [ ] A test pins the decided behavior: quoting a denied command inside an `arggon comment` payload passes the gate (or is denied by the documented deliberate choice), and the force-push probe form still denies.
- [ ] No regression in the deny matrix: force-push / `--no-verify` / refspec-plus real invocations still denied with reasons.

## Notes
