---
type: task
status: todo
id: task-opencode-v2-plugin-import-gotcha
title: "Plugin import gotcha: static @opencode/plugin import fails without node_modules (v2.0.7)"
priority: p3
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-plugin-import-gotcha.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-plugin-import-gotcha.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin import gotcha: static @opencode/plugin import fails without node_modules (v2.0.7)

## Context

Finding **F1** from the independent review of PR #325 (W2), reproduced twice on
real `opencode v2.0.7`: the pattern the V2 plugin docs show —
`import { Plugin } from "@opencode/plugin"` — makes an **auto-discovered**
plugin under `.opencode/plugins/` fail to load when the tree has no
`node_modules` (`Cannot find package '@opencode/plugin'`; the session still
exits 0, the plugin is skipped with a warning). `Plugin.define` is identity, so
the shipped plugin avoids the import with a guarded dynamic import plus a
plain-object default export (`{ id, setup }`), which loads and runs.

The workaround is documented in the plugin source and the item body, but the
playbook only says "dependency-free": the gotcha and the condition to drop the
workaround are not recorded, and nothing tracks re-verification on the next 2.x
(ADR 0010's V2-churn revisit trigger).

## Acceptance

- [ ] `docs/playbooks/opencode.md` (Conventions) records: the documented static
      import fails without `node_modules` on 2.0.7; the bundled plugin's guarded
      pattern is the supported form; and the condition to simplify it (when the
      runtime resolves `@opencode/plugin` in dependency-less trees, or the docs
      change) — with the PR #325 probe as evidence.
- [ ] ADR 0010's revisist trigger references this item so the next 2.x
      re-verification is not lost.
- [ ] On the next 2.x: re-run the A/B probe (static import vs plain object in a
      dependency-less fixture). If the static import resolves, simplify the
      plugin and refresh the smoke evidence; if not, update the version-pin note.
- [ ] Optional (review F3): a dedicated typecheck (or a computed specifier for
      the dynamic import) so editors/`tsc` do not flag the guarded import.

## Notes

- Review F2 (parity test self-heals by design; the byte assertion lives in
  `init-opencode.test.ts`) and F4 (T8's remaining assertions — skills/agents/
  commands/context/full cycle — extend in W3/W4) are informational and tracked
  by their own waves; no action here.
