---
type: task
status: todo
id: task-zcode-live-verification
title: Live ZCode client verification of the plugin seam
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

### 2026-09-29 @Arggon
STAGED (everything headless is ready): global arggon CLI refreshed from merged main via npm link (0.4.0 d83fcd55; live doctor --budget = 15 tools / 15,701 B from the very arggon mcp entry the plugin registers); fixture repo /home/arggon/Projects/zcode-seam-live-verify init'ed with that CLI — .zcode-marketplace/ seam vendored (marketplace.json + arggon plugin), arggon validate ok. NOT done by hand: registering the marketplace in the client's registries (known_marketplaces.json has no documented local-directory source shape; a guessed hand-edit risks the live plugin system and buys nothing — the session-bound checks need a restart anyway). orca computer-use unavailable (AppImage missing). REMAINING (one restart away): in ZCode UI Plugin Marketplace -> Add -> Add Plugin Marketplace paste /home/arggon/Projects/zcode-seam-live-verify/.zcode-marketplace -> Install arggon -> restart/open a new session in the fixture -> probe: /arggon-next works, 15 mcp__arggon__ tools present, force-push Bash probe denied by the gate, reviewer dispatch read-only. Trial prompt for the fresh session: 'Run /arggon-next in this repo, then claim nothing; report which arggon MCP tools you can see.'

### 2026-09-29 @Arggon
Fixture refreshed to the 12-command seam (PR #439 landed /arggon-board; re-ran init in /home/arggon/Projects/zcode-seam-live-verify — the never-overwrite sweep added the new command beside the existing eleven). Everything else in the staged state unchanged.
