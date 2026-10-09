---
type: task
status: in_progress
id: task-zcode-live-verification
title: Live ZCode client verification of the plugin seam
assignee: arggon-delivery-lead
branch: feat/task-zcode-live-verification
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-10-09"
claimed_at: "2026-10-09T19:27:41.322Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-live-verification
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

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
The item arrived as an empty template. Scoping it now that 0.4.1 generates the `.zcode-marketplace/` artifact class on this repo.

## What to verify
The ZCode plugin seam end-to-end on a live ZCode client: the marketplace packaging loads, the agents/commands surface, the hook gate fires, and tracker mutations from a ZCode session land on the item branch (not the primary) — the ZCode analogue of the #426-class bug fixed for OpenCode.

## Acceptance checklist
- [x] Artifact audit (automatable): `.zcode-marketplace/marketplace.json` + `arggon/.zcode-plugin/plugin.json` + `hooks/hooks.json` all parse; `agents/` name-for-name parity with `.opencode/agents` (coordinator/ reviewer/ worker); `commands/` complete (adopt/adr/board/done/explore/handoff/next/playbook/review/spec/start/status); `hooks.json` wires PreToolUse (`Agent|Bash|Write|Edit|mcp__arggon__.*`) -> `node gate.mjs pre` via `${CLAUDE_PLUGIN_ROOT}` — live resolution of that env var stays with the live leg. (2026-10-01, coordinator.)
- [ ] The `.zcode/config.json` registration on this machine points at the installed/linked arggon (`arggon mcp` stdio) and survives a session restart.
- [x] Live: a ZCode session started from this repo can run a committing tracker mutation (comment on an item) and the commit lands on the session's item branch — not the primary's main. (2026-10-09: the evidence comment below and these ticks are committing tracker mutations from a live ZCode session (zcode-cli, v3.14.5); they landed on `feat/task-zcode-live-verification` (a741adee) and the primary's main stayed clean at 9da16c6a — `git merge-base --is-ancestor a741adee main` is false.)
- [x] Live: the strict-gate refusal path (x-tracker.strict-gate-bins is armed) surfaces in ZCode as an actionable error, not a silent skip. (2026-10-09: armed at `ArggonManager/.convention.yml:11`; a real `arggon start --worktree` in a throwaway shared clone (push remote defused) refused with exit 1 and the fix-led message naming the armed gate and the unresolvable bins, surfaced through the live session's Bash channel; no claim commit — the created branch stayed at main head, and the sandbox was removed after.)
- [ ] Findings filed as items; this item closes only when the live legs are done.

## Notes for whoever executes
Legs 3-4 need the ZCode app live on this machine (the harness rewrote `.zcode/config.json` during sessions on 2026-09-28/30 — the client is here). Legs 1-2 are automatable headless. Do the automatable legs first; file anything the artifact audit finds as items.

### 2026-10-01 @Coordinator — headless-feasibility probe (legs 3-4 deferred with findings)
- The ZCode client is a GUI Electron app (v3.14.4, /opt/ZCode/zcode); every `zcode ...` invocation spawns GUI instances (no headless subcommand found in two probes: `zcode --help`, `zcode cli --help`).
- A CLI harness component EXISTS at ~/.zcode/cli/ (agents/, artifacts/, db/, exec/, config.json) — a possible headless surface worth investigating from a live ZCode session (ask the harness or check upstream docs).
- The sanctioned computer-use skill (Orca) is NOT installed on this machine (orca-ide: AppImage not found), and raw X11 automation of a localized Electron GUI is out of scope for this item.
- Leg 2 premise shifted: the repo's .zcode/config.json is machine-local + untracked since #514 and is currently absent; the registration path for 0.4.1 is the generated .zcode-marketplace/ packaging (leg 1, green) — re-derive leg 2 as "the marketplace plugin registration survives a ZCode restart" when executed live.
- EXECUTION REQUIREMENT for legs 3-4: the ZCode app open on this repo (user-run), then follow the checklist; or a documented zcode headless mode if one exists upstream.

### 2026-10-09 @Arggon
2026-10-09 live leg executed inside the running ZCode client (v3.14.5; this maker session IS a live zcode-cli session). VERIFIED: (1) Marketplace registration arggon-local is live in the client registry (~/.zcode/cli/plugins/known_marketplaces.json, addedAt 2026-09-29T21:49:35Z, client-refreshed today 15:05Z) pointing at /home/arggon/Projects/zcode-seam-live-verify/.zcode-marketplace — the undocumented-shape blocker is retired: the directory shape {source:'directory',path} is in the registry by example. FINDING: the fixture's arggon/ plugin dir had been DELETED (~Oct 8 17:02 local mtime; cause unknown) — only marketplace.json survived, so an install would have failed; restored it byte-identical from this repo's committed .zcode-marketplace/arggon (diff -r parity OK) and aligned marketplace.json. (2) Plugin INSTALLED into the live client: cache copy at ~/.zcode/cli/plugins/cache/arggon-local/arggon/0.1.0 (parity OK), installed_plugins.json entry id arggon@arggon-local scope user source ./arggon (shape mirrored entry-for-entry from the working zcode-autoharness@dev-default-40534055 entry), enabledPlugins['arggon@arggon-local']=true in ~/.zcode/cli/config.json. Pre-edit backups: /tmp/arggon-zcode-install-backup-20261009T194623Z. (3) MCP surface: JSON-RPC probe of arggon mcp -> server arggon 0.5.0, EXACTLY 15 tools (arggon_list create update comment handoff show next report validate priority sync import_issues start branch cleanup). Manifest mcpServers key is honored by this client: app.asar resolvePluginComponentTypes reads ('mcpServers' in manifest || .mcp.json exists). (4) Gate exercised through the INSTALLED gate.mjs: git push --force/-fu deny exit 2 with the gate reason; git commit --no-verify deny; reviewer window lifecycle green (arggon-standards-reviewer plain + plugin-qualified opens window; in-window git push / mutating arggon / Write / mcp__arggon__arggon_update denied with actionable reasons; arggon comment ALLOWED; post closes; stop clears marker; malformed payload fail-open). (5) Strict-gate refusal leg: armed (ArggonManager/.convention.yml:11); triggered for real in a throwaway shared clone (remote defused) -> exit 1, error leads with the npm ci fix, names the offending bins and the armed gate, gives attach/discard guidance; NO claim commit (created branch stayed at main head), clone removed after. Surfaced through this session's Bash channel = the ZCode error surface. (6) Leg-3 (tracker mutation from a ZCode session lands on the item branch) is demonstrated by this very comment + the box ticks that follow: mutations from this live session must land on feat/task-zcode-live-verification with primary main clean. NOT DONE (need one client restart + one fresh session, per the staged plan): 15 tools visible in-session, /arggon-* discovery/run in the UI, in-session PreToolUse firing, reviewer tools-allowlist behavior in the client, PostToolUse(Agent) on errored dispatch, install persistence across a client registry rewrite/restart (client last rewrote known_marketplaces at 15:49Z today; next sweep/restart confirms or the backup restores). DRIFT NOTE: the vendored seam now carries 13 commands (arggon-goal added by goal-mode) vs the 12 listed in the ticked 2026-10-01 audit box; the tick predates goal-mode and stays as history. FINDINGS for items (lead's call): fixture arggon/ deletion cause; 12-vs-13 checklist drift; CLAUDE_PLUGIN_ROOT has zero literal occurrences in app.asar yet provably works live (autoharness hooks fire with it in this session) — do not refactor the seam off it.

### 2026-10-09 @Arggon
verdict: approve — PR #669 merged after CI green. Live legs 3 (mutations from this session landed on feat/task-zcode-live-verification, primary main clean) and 4 (armed strict-gate refusal surfaced actionable, non-mutating) are verified and ticked. REMAINING (box 2): one client restart + one fresh session to prove the staged install survives a registry rewrite and surfaces in-session (15 tools, /arggon-* commands, PreToolUse firing); backups at /tmp/arggon-zcode-install-backup-20260109T194623Z if it needs restoring.

### handoff 2026-10-09 @Arggon — next: Restart the ZCode client once and open a fresh session on this repo: confirm the arggon plugin loads (15 mcp tools, /arggon-* commands, gate fires), tick box 2, then flip done
- branch: main
- open questions: install persistence across registry rewrite; fixture arggon/ deletion cause (2026-10-08, restored)
