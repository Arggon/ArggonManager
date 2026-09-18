---
type: task
status: in_progress
id: task-opencode-v2-playbook
title: "Playbook: OpenCode 2.0.7 and docs reference integration"
assignee: Arggon
branch: feat/task-opencode-v2-playbook
parent: story-opencode-v2
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T00:57:29.519Z"
depends_on: [task-opencode-v2-adr]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-playbook
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-opencode-v2/task-opencode-v2-playbook.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-playbook.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Playbook: OpenCode 2.0.7 and docs reference integration

## Context

Adopting OpenCode V2 as a supported agent surface is an "introducing a
technology" case in [docs/agents.md](../../../../docs/agents.md) §5: the
pipeline is explore → ADR → playbook → status. The exploration is done
([exploration-opencode-v2-native-009](../../../../docs/explorations/exploration-opencode-v2-native-009.md))
and the ADR is task-opencode-v2-adr; this task produces the playbook and the
docs the integration points to. Local version verified: `opencode v2.0.7`
(2026-09-17).

## Acceptance

- [ ] `arggon playbook new opencode --version 2.0.7` then `playbook refresh`
      once research is recorded; sections filled: Setup, Conventions, Testing,
      Security, Upgrade policy — sourced from the exploration (V2 docs URLs,
      access date).
- [ ] `docs/playbooks/opencode.md` records the verified wiring: `.agents/skills`
      auto-discovery, `AGENTS.md` as the only instruction mechanism (V2 ignores
      `CLAUDE.md`), `mcp.servers` registration, config precedence, never-invent
      V2 fields from the V1 schema.
- [ ] `docs/agents.md` §Reference integrations gains an OpenCode V2 subsection
      (generated-stanza excerpt + link to the playbook); add an
      `arggon instructions` extraction hook only if the snippet should be
      printable (`cli/src/instructions.ts` heading contract, plus its test).
- [ ] README user-facing note where the agent wiring is described.
- [ ] `arggon playbook status` shows the playbook current (no stale finding).

## Notes

- Docs travel with code: if Phase 1 or 2 lands first, this task absorbs the
  as-shipped wiring rather than the intended wiring.
- Keep the playbook lean (≤1 page): version pin, the five sections, and links.

### 2026-09-18 @Arggon
W1c playbook evidence (task-opencode-v2-playbook)

playbook new:
{"ok":true,"schemaVersion":1,"conventionVersion":3,"command":"playbook","files":["docs/playbooks/opencode.md"]}

playbook refresh:
{"ok":true,"schemaVersion":1,"conventionVersion":3,"command":"playbook","path":"docs/playbooks/opencode.md","version":"2.0.7","researched":"2026-09-18"}

playbook status: opencode v2.0.7 researched 2026-09-18 ageDays 0 stale=false; staleCount=0 of 4 playbooks.

Consistency check vs the seam code (PR #322 b1d8630, re-checked after merging origin/opencode2 8d79c2e):
- templates/docs/opencode.jsonc: mcp.servers.arggon {type: local, command: ["arggon","mcp"]}, formatter: true, compaction.keep.tokens: 15000 — matches playbook Setup and the docs/agents.md stanza.
- artifacts: .opencode/agents/arggon-{coordinator,worker,reviewer}.md + .opencode/commands/arggon-{next,start,done,handoff,review,status}.md — matches both docs.
- cli/src/docs.ts: findOpenCodeConfig candidates (opencode.json/jsonc, .opencode/opencode.json/jsonc) and present-skip→skipped[] — matches the "config only when absent" claim and the precedence rationale.
- skills bundled to .agents/skills/ (arggon-cli, arggon-upgrade), cli/src/docs.ts:161-162.
- V2 claims re-verified against https://opencode.ai/v2/docs/{skills,config,mcp-servers,instructions}/ (accessed 2026-09-17): AGENTS.md only / no CLAUDE.md fallback; instructions array accepted but inert; mcp.servers + disabled; .opencode configs override direct configs.

Gates after merge 8d79c2e: argon validate ok, spec validate ok, npm run build ok, npm run lint ok; npm test 66 files / 1047 passed (the 1056 baseline = 1047 + the 9 init-opencode.test.ts tests that live in still-open PR #322).

Not done, reported instead: README untouched (file ownership; PR #322's README bullet already lists the OpenCode seam). Optional `arggon instructions` extraction hook skipped deliberately (small-scope choice; follow-up candidate if the stanza should be printable).
