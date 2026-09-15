---
type: task
status: done
id: task-skill-generated-command-reference
title: "Forever fix: SKILL command reference generated from the CLI"
assignee: Arggon
branch: feat/task-skill-generated-command-reference
parent: story-init-docs
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-skill-generated-command-reference.md
  Leaves live only under a story. id is the filename stem: task-skill-generated-command-reference.
  CLI `arggon create task skill-generated-command-reference` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Forever fix: SKILL command reference generated from the CLI

## Context

The SKILL content audit (task-skill-sync-feature-wave) found 4 gaps and fixed them manually — but the fix is momentary: the SKILL command block is hand-written prose that drifts every time a command/flag changes (show, handoff, next --include-stories all drifted within one cycle). The permanent fix makes drift IMPOSSIBLE BY CONSTRUCTION: the mechanical parts of the SKILL are GENERATED from the live CLI, the narrative parts stay hand-written with the standing review rule.

Design (coordinator decision, mirrors the established generatedMarker/skills:sync/parity machinery):
1. The SKILL command block (the `arggon <cmd> ...` reference lines in the command sections) becomes a GENERATED marker region: `skills:sync` renders it by introspecting the real commander program (same source-parse approach the parity harness uses — command names, args, .description() strings), and splices it between markers in skills/arggon-cli/SKILL.md. Curated one-liner comments per command move into a maintained description map in the generator (improving a description improves CLI --help AND SKILL from one place).
2. Test invariant: the rendered region matches the live CLI surface — adding/renaming a command without regenerating fails loudly.
3. Cross-check invariant: every user-facing CLI command appears somewhere in SKILL.md + README.md + docs/agents.md (the "documented somewhere" net for narrative omissions).
4. The .agents copy pipeline (marker + source) is unchanged, running after the splice.

Research component: document how established tools keep docs synced from source (oclif `readme` marker-region generation, terraform-docs, clap_generate-style) — dated sources, one line each, cited in the exploration; confirm or challenge the marker-region choice before implementing.

## Acceptance

- [x] Exploration recorded (docs/explorations/): docs-from-source patterns with dated sources; marker-region confirmed or a better pattern adopted with rationale
- [x] The SKILL command reference is a generated marker region rendered from live CLI introspection; `skills:sync` regenerates it; the parity/copy pipeline unchanged downstream
- [x] Cross-check test: every user-facing command documented in SKILL.md + README.md + docs/agents.md (fails loudly on new undocumented commands; maintained exception list for internal commands like mcp/instructions if needed)
- [x] Narrative sections (quality bar, pitfalls, orchestration) remain hand-written — the standing review rule covers them (noted in the item)
- [x] Full suite + parity + skills:sync pipeline green; doctor 0 modified / 0 drifted

## Notes

- Exploration: docs/explorations/exploration-docs-from-source-003.md (oclif readme markers, terraform-docs BEGIN/END markers, clap_mangen build-time whole-file, agent skill-sync tools solve distribution not drift) — marker-region pattern CONFIRMED.
- Implementation: cli/src/skill-commands.ts (source introspection of cli.ts `.command()/.description()/.argument()`, exclusion list with reasons: hello, mcp, spec/stack/playbook grouping parents); cli/src/sync-skills.ts splices the three `arggon:generated-commands` regions of skills/arggon-cli/SKILL.md (§2 work loop, §3 tooling, §4 planning) before writing the .agents copy; curated nuances moved to hand-written bullets outside the regions.
- Invariants: cli/src/skill-generated-commands.test.ts — (1) regenerated regions must equal on-disk regions, (2) every non-excluded command name appears in SKILL.md ∪ README.md ∪ docs/agents.md, (3) generator sanity render.
- skills:sync verified idempotent (two runs = zero diff); full suite 900/900, lint, build green; doctor 0 modified / 0 drifted.

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. This is the forever fix done right: the command reference is now COMPILED from the same .description() strings that power --help — improving a description improves the CLI, the SKILL and the docs net from one place. The introspection resolves nested subcommand groups via owner-token with loud failures on unresolvable parents (never silent), regions are per-section filtered, exclusions carry reasons, and the three invariants (region==fresh render, documented-everywhere net, generator sanity) plus verified idempotency make drift structurally impossible. Research confirms the marker-region pattern is the industry standard (oclif readme, terraform-docs) and strengthens it with source introspection instead of help-text scraping. Narrative stays hand-written under the standing review rule. Merge follows.
