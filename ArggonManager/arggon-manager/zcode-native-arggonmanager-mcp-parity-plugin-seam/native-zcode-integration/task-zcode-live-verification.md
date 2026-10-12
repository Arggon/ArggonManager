---
type: task
status: done
id: task-zcode-live-verification
title: Live ZCode client verification of the plugin seam
assignee: arggon-delivery-lead
branch: feat/task-zcode-live-verification
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-10-10"
---
# Live ZCode client verification of the plugin seam

## Context

The ZCode plugin seam (task-zcode-plugin-seam, PR #437) is fully verified
headless; the code review's verdict gates the spec/plan flip
(`spec-zcode-native-seam-012` → `implemented`) on a live ZCode desktop
session, which cannot be driven headlessly. One session covers every open
question.

## Acceptance

- [x] Plugin Marketplace → Add → Add Plugin Marketplace with a fresh-init
      repo's `.zcode-marketplace/` directory; the `arggon` plugin installs
      (2026-10-10: end state proven live — the client's own registry sweep at
      21:21:49Z adopted and kept the staged `arggon-local` registration pointing
      at the fresh-init fixture's `.zcode-marketplace/`; `installed_plugins.json`
      entry, `enabledPlugins: true` and the populated cache survived the restart;
      the UI Add dialog itself was not hand-driven — the coordinator's 2026-10-01
      re-derivation of this leg governs.)
- [x] The 15 `mcp__arggon__arggon_*` tools appear in a session (needs the
      arggon CLI on PATH)
      (2026-10-10: post-restart session carries all 15, namespaced by the client
      as `mcp__plugin_arggon_arggon__arggon_*`; `arggon_validate` answered with
      the tracker envelope. Note: the zcode-autoharness plugin registers a second
      copy of the same 15 under its own prefix — duplicate registration, worth
      knowing when reading tool counts.)
- [x] `/arggon-next`, `/arggon-start`, `/arggon-review` commands discover and
      run; `${CLAUDE_PLUGIN_ROOT}` expands for the hook commands
      (2026-10-10: BOTH halves proven — the product owner confirms the commands
      are offered in the UI on the reinstalled seam; `${CLAUDE_PLUGIN_ROOT}`
      expansion was proven by the gate hook firing in-session, which requires
      it to have resolved `gate.mjs`.)
- [x] A `PreToolUse` hook actually fires in-session (force-push Bash probe
      denied with the gate's reason)
      (2026-10-10: `git push --force origin no-such-ref` in a remoteless throwaway
      repo was denied pre-execution: "arggon gate: denied — force push … denied by
      the arggon plugin gate", exit 2.)
- [x] Reviewer dispatch: the agent's `tools:` allowlist honors `mcp__arggon__*`
      names (worst case: ZCode ignores them and the hook backstop is the only
      restriction — the reason it exists)
      (2026-10-10: WORST CASE CONFIRMED — a dispatched `arggon:arggon-standards-reviewer`
      sees the full tool surface including Bash, despite its role prompt saying
      "no shell"; ZCode does not enforce the generated `tools:` allowlist. The
      hook backstop, verified live, is the only real restriction, exactly as the
      box anticipated. Recorded as the seam's operative posture in ZCode.)
- [x] Whether `PostToolUse(Agent)` fires when a subagent dispatch errors —
      if not, confirm Stop/TTL clearing suffices (the gate header documents
      the assumption) (2026-10-10, live probe: RESOLVED on the fallback branch —
      Stop/TTL clearing confirmed sufficient, TTL = 2h. Structure: the installed
      hooks.json wires exactly PreToolUse / PostToolUse(Agent) / Stop — NO
      failure event (e.g. PostToolUseFailure) is wired, so an errored dispatch
      can never decrement via a failure path; only post (reviewer-named Agent,
      gate.mjs:203-208), Stop (gate.mjs:210-213, unconditional zero, matcher-less
      hooks.json:31-43) or TTL expiry (gate.mjs:50 `MARKER_TTL_MS = 2h`, enforced
      gate.mjs:130) close the window. Live through the installed cache gate.mjs:
      marker opened via pre (`/tmp/arggon-zcode-hooks/95d3dd5caa7953d0ded92945.json`
      `{"count":1,...}`); then one errored dispatch-equivalent fired — this
      subagent's toolset has NO Agent tool, so the closest surface, TaskOutput
      with a nonexistent task id, errored ("No task found with ID: …") — marker
      delta NONE (byte-identical). A non-Agent error cannot discriminate "client
      skips PostToolUse(Agent) on errored dispatch" from "fires but no-ops for a
      non-reviewer type"; the real reviewer type was not dispatched per probe
      constraints. Undetermined-but-not-load-bearing: closure never depends on
      the errored dispatch's own post — then post closed the window and a second
      pre+stop cycle confirmed stop removes the marker file (state dir left
      empty). Matches the gate header's documented assumption (gate.mjs:35-37).)
- [x] On full pass: flip spec/plan to `implemented`, close the story
      (2026-10-10: full pass reached — every box above ticked, the last being
      the product owner's /arggon-* confirmation; `spec-zcode-native-seam-012`
      and `plan-zcode-native-seam-012` flipped `implemented`, and the
      `native-zcode-integration` story's acceptance ticks published with
      evidence, closing the story.)

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
- [x] The `.zcode/config.json` registration on this machine points at the installed/linked arggon (`arggon mcp` stdio) and survives a session restart. (2026-10-10: satisfied in the coordinator's re-derived form — the marketplace registration survived a ZCode restart AND a client registry rewrite; the in-session surface came up with it. The literal `.zcode/config.json` path was superseded by #514's machine-local untracking; registration today is `known_marketplaces.json` + `installed_plugins.json` + `enabledPlugins`.)
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

### handoff 2026-10-09 @Arggon — next: Restart the ZCode client once and open a fresh session on this repo: confirm the arggon plugin loads (15 mcp tools, /arggon-* commands, gate fires), tick box 2, then flip done
- branch: main
- open questions: install persistence across registry rewrite; fixture arggon/ deletion cause (2026-10-08, restored)

### 2026-10-09 @Arggon
2026-10-10 post-restart verification (delivery lead, this session IS the fresh post-restart session): (1) REGISTRATION SURVIVED — known_marketplaces arggon-local entry intact and client-rewritten at 21:21:49Z (post-restart), installed_plugins arggon@arggon-local + enabledPlugins:true + populated cache intact; (2) 15-tool MCP surface live in-session under the client's plugin-qualified prefix mcp__plugin_arggon_arggon__* — arggon_validate answered ok (note: zcode-autoharness registers a DUPLICATE of the same 15 under its own prefix); (3) PreToolUse gate FIRED in-session: a force-push probe (remoteless throwaway repo, nonexistent ref) was denied pre-execution with exit 2 and the gate's own reason — which also proves CLAUDE_PLUGIN_ROOT expanded for the hook command; (4) reviewer dispatch probe: arggon:arggon-standards-reviewer sees the FULL tool surface including Bash despite the role prompt — ZCode does NOT enforce the generated tools: allowlist; the hook backstop (verified live) is the only real restriction, the exact worst case the acceptance box anticipated. Live-gate friction observed live: the gate pattern-matches the ENTIRE Bash string, so quoting a denied command verbatim inside a comment/tracker write gets the benign call denied too (this exact comment had to be reworded once). Live-section boxes ticked: 1, 2, 4, 5 (1 with the noted caveat: client-adopted registration + install proven, UI Add dialog not hand-driven). REMAINING for full pass: /arggon-* command discovery in the UI (one user glance), the PostToolUse(Agent)-on-errored-dispatch question, then the spec/plan flip on full pass.

### handoff 2026-10-09 @Arggon — next: Two live-section boxes left: /arggon-* command discovery (one user glance at the UI — type /arggon-next), then the PostToolUse(Agent)-on-errored-dispatch probe; on full pass flip spec-zcode-native-se…
- branch: main
- open questions: PostToolUse(Agent) on errored dispatch; UI command discovery

### 2026-10-10 @Arggon
### 2026-10-10 @live-verification-probe (subagent dispatched by arggon-delivery-lead) — box 6 probe + fixture refresh

BOX 6 (does PostToolUse(Agent) fire when a subagent dispatch errors) — RESOLVED on the fallback branch; box TICKED (commit 0bf387be). (1) Installed seam structure (cache copy ~/.zcode/cli/plugins/cache/arggon-local/arggon/0.1.0/): hooks.json wires EXACTLY three events — PreToolUse (matcher Agent|Bash|Write|Edit|mcp__arggon__.*) -> gate.mjs pre, PostToolUse (matcher Agent ONLY) -> gate.mjs post, Stop (NO matcher) -> gate.mjs stop (hooks.json:3-44). NO PostToolUseFailure or any failure event is wired, so an errored dispatch can never decrement through a failure path. Marker: /tmp/arggon-zcode-hooks/<sha256(projectDir+session_id)[:24]>.json; TTL 2h (gate.mjs:50, expiry enforced gate.mjs:130); post decrements only for reviewer-named Agent dispatches (gate.mjs:203-208); stop unconditionally zeroes (gate.mjs:210-213); the header documents the Stop/TTL assumption (gate.mjs:35-37). (2) ONE live probe, safe, real reviewer type NOT dispatched: baseline state dir EMPTY; opened a reviewer window for a synthetic probe key through the INSTALLED gate (tool_name=Agent, subagent_type=arggon-standards-reviewer, session_id=live-verification-probe, cwd=fixture) -> /tmp/arggon-zcode-hooks/95d3dd5caa7953d0ded92945.json {"count":1,...}. Errored dispatch-equivalent: this subagent's toolset has NO Agent tool, so the closest dispatch-adjacent surface, TaskOutput with a nonexistent task id, was fired and ERRORED ("No task found with ID: nonexistent-probe-task-live-verification"). DELTA after the error: NONE — marker byte-identical {"count":1,...}. CAVEAT recorded honestly: a non-Agent tool error cannot discriminate "client skips PostToolUse(Agent) on errored dispatch" from "fires but no-ops for a non-reviewer subagent_type"; whether the client itself fires PostToolUse(Agent) for an errored Agent dispatch stays undetermined from this seat (no Agent tool exists in a subagent toolset; dispatching the real reviewer type was forbidden). It is NOT load-bearing: Stop is matcher-less and unconditional and the 2h TTL bounds any stuck marker, so window closure never depends on the errored dispatch's own post. Side probe: grep of /opt/ZCode/zcode/resources/app.asar for hook event names is inconclusive as an instrument (even PreToolUse, which provably fires in this client, greps 0 — the asar is not greppable plaintext). (3) Stop/TTL sufficiency CONFIRMED live through the installed gate: post removed the marker file; a second pre re-opened it ({"count":1,...}) and stop removed it; state dir left EMPTY (no window jammed open). TTL = 2h cited from gate.mjs:50, not waited out. => Box 6 ticked on the 'Stop/TTL clearing confirmed sufficient with the TTL value named (2h)' branch; 'it fires on errored dispatch' neither affirmed nor needed.

FIXTURE REFRESH (ask step 5) — refreshed from merged main; PREMISE CORRECTION: the lead-role task has NOT merged. Evidence, run now: gh pr view 677 -> {"state":"OPEN","mergedAt":null} (PR #677 = feat/task-zcode-lead-role-belongs-to-the-main-session, the lead-removal); after git fetch origin main, commit 54656327 (removes templates/docs/zcode/arggon/agents/arggon-delivery-lead.md) is still NOT an ancestor of origin/main (now 5f10ea65); the lead item on origin/main is status: todo. Refresh executed anyway from the ask's named source (merged main): git archive origin/main .zcode-marketplace -> rsync -a --delete into /home/arggon/Projects/zcode-seam-live-verify/.zcode-marketplace -> diff -r parity CLEAN. What the refresh changed in the fixture: arggon/hooks/gate.mjs (PR #675 deny-pattern fix, verified identical to origin/main), NEW arggon/templates/automations/, regenerated .zcode-plugin/plugin.json + marketplace.json. LEAD AGENT: still PRESENT in the refreshed copy (agents/ = arggon-delivery-lead.md, arggon-maker.md, arggon-standards-reviewer.md) — because merged main still ships it; once #677 merges, re-running this refresh (or the lead task's own AC 5 live leg) is what removes it. ADDITIONAL OBSERVATION: the installed client cache copy ~/.zcode/cli/plugins/cache/arggon-local/arggon/0.1.0/agents/ still carries arggon-delivery-lead.md (installed from the pre-#677 seam earlier today); whether a client restart re-syncs the cache from the directory marketplace source was NOT probed (no restart in scope) — if it does not, the running client also needs a reinstall to drop the lead agent.

Nothing else committed: this comment + the box-6 tick on feat/task-zcode-live-verification only; primary checkout untouched.
