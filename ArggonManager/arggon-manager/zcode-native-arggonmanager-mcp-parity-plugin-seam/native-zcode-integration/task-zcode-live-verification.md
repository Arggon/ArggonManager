---
type: task
status: todo
id: task-zcode-live-verification
title: "Live ZCode client verification of the plugin seam"
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
---

# Live ZCode client verification of the plugin seam

## Context

The ZCode plugin seam (task-zcode-plugin-seam, PR #437) is fully verified
headless; the code review's verdict gates the spec/plan flip
(`spec-zcode-native-seam-012` → `implemented`) on a live ZCode desktop
session, which cannot be driven headlessly. One session covers every open
question.

## Acceptance

- [ ] Plugin Marketplace → Add → Add Plugin Marketplace with a fresh-init
      repo's `.zcode-marketplace/` directory; the `arggon` plugin installs
- [ ] The 15 `mcp__arggon__arggon_*` tools appear in a session (needs the
      arggon CLI on PATH)
- [ ] `/arggon-next`, `/arggon-start`, `/arggon-review` commands discover and
      run; `${CLAUDE_PLUGIN_ROOT}` expands for the hook commands
- [ ] A `PreToolUse` hook actually fires in-session (force-push Bash probe
      denied with the gate's reason)
- [ ] Reviewer dispatch: the agent's `tools:` allowlist honors `mcp__arggon__*`
      names (worst case: ZCode ignores them and the hook backstop is the only
      restriction — the reason it exists)
- [ ] Whether `PostToolUse(Agent)` fires when a subagent dispatch errors —
      if not, confirm Stop/TTL clearing suffices (the gate header documents
      the assumption)
- [ ] On full pass: flip spec/plan to `implemented`, close the story
