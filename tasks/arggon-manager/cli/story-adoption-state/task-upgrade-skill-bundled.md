---
type: task
status: todo
id: task-upgrade-skill-bundled
title: upgrade skill bundled at init + convention v4 template + release 0.3.0
parent: story-adoption-state
labels: [p1]
created: "2026-09-17"
updated: "2026-09-17"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-upgrade-skill-bundled.md
  Leaves live only under a story. id is the filename stem: task-upgrade-skill-bundled.
  CLI `arggon create task upgrade-skill-bundled` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# upgrade skill bundled at init + convention v4 template + release 0.3.0

## Context

The upgrade channel (init --dry-run/--propose, doctor outdated, EOL-normalized compares) is proven on the first real adopter upgrade (ArggonStores-am 0.2.0 absorb, 2026-09-17). Two gaps: (1) the upgrade FLOW lives only in the coordinator's head + README prose — it should be a bundled SKILL that init delivers to every adopting repo; (2) templates/docs/docs/convention.md (the adopter-facing convention doc) predates convention v4 — the priority field ships without its docs. Plus the pending v0.3.0 release (section-backports, CRLF fix, priority field + ranking, this skill).

## Acceptance

- [ ] `skills/arggon-upgrade/SKILL.md`: the upgrade flow as a skill (triggers: doctor outdated / new ArggonManager release / user asks to update; flow: tool sync -> doctor -> dry-run -> propose -> item+worktree -> review/merge regions with judgment rules -> re-ack -> gates -> PR; judgment rules: apply gains at anchors, keep curated content, skip deliberate divergence, never --backup; EOL-normalization note; new-version files land via a plain init re-run)
- [ ] init bundles BOTH skills: `.agents/skills/arggon-cli/SKILL.md` + `.agents/skills/arggon-upgrade/SKILL.md` (generalize the single-skill constants into a bundled-skills list, existsSync-guarded so fixture layouts keep working; provenance/ack semantics identical to the existing skill)
- [ ] `templates/docs/docs/convention.md`: priority v4 section (short adopter-facing version of the ArggonManager convention.md addition)
- [ ] Tests: init generates both skills (created/provenance/ack); existing suites green
- [ ] Release 0.3.0: package.json bump, CHANGELOG section (section-backports, CRLF fix, priority v4 + migrate + ranking, upgrade skill), tag v0.3.0 post-merge (coordinator)
- [ ] Gates: validate ok, spec validate ok, suite green, lint/build clean, doctor 0 modified / 0 drifted
