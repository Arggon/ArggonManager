---
type: task
status: todo
id: task-opencode-v2-playbook
title: "Playbook: OpenCode 2.0.7 and docs reference integration"
priority: p2
depends_on: [task-opencode-v2-adr]
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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
