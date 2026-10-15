---
type: task
status: todo
id: task-gate-force-with-lease-discriminator
title: "Plugin gates: the force-push deny over-matches `--force-with-lease` (both seams) — apply the OpenCode discriminator"
parent: methodology-improvements
labels: []
created: "2026-10-15"
updated: "2026-10-15"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-gate-force-with-lease-discriminator.md
  Leaves live only under a story. id is the filename stem: task-gate-force-with-lease-discriminator.
  CLI `arggon create task gate-force-with-lease-discriminator` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin gates: the force-push deny over-matches `--force-with-lease` (both seams) — apply the OpenCode discriminator

## Context

Routed from `bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use` (PR #836): the OpenCode
permission layer now discriminates `--force-with-lease` (allowed) from bare `--force`/`-f`/
`+refspec` (denied). The same over-match lives in BOTH plugin gates' force-push deny —
`templates/docs/zcode/arggon/hooks/gate.mjs` (~L108) and
`templates/docs/claude/arggon/hooks/gate.mjs` (~L143): the regex `--force\b` matches inside
`--force-with-lease`, so a ZCode or Claude session is denied the safe rebase push — the exact
class that stopped a real wave on the OpenCode side. The behaviour is stated as current in
`agents.md` §Force-push spellings; this item fixes it.

## Acceptance

- [ ] Both gates' global force-push deny discriminates like the OpenCode fix: `--force-with-lease`, `--force-with-lease=<ref>:<expect>` and `--force-if-includes` are allowed; bare `--force`, `-f` and refspec-with-`+` stay denied (the refspec-`+` check unchanged)
- [ ] Red-first: a test that fails against the current gates (both seams), then passes — the discriminator matrix mirrors #836's (including the `+refspec` negative control)
- [ ] The repo-self copies (`.zcode-marketplace`/`.claude-marketplace` hook files) are regenerated with `x-generated` rows intact; `init-zcode.test.ts` / `init-claude.test.ts` updated, not deleted
- [ ] The gate headers and the `agents.md` seam sections state the permitted/refused spellings (the OpenCode playbook wording is the precedent); impact class stated if the permitted set changes
- [ ] `arggon validate`, the full suite, lint, structure, prettier green

## Notes

- Precedent: PR #836 (`cli/src/opencode-force-push.test.ts` — evaluating rules with the runtime's own matcher; deny-first ordering rationale).
- The gates' quoted-text semantics are unaffected: only the force-push discriminator changes.

## Notes
