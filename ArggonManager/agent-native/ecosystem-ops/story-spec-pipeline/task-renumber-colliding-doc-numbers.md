---
type: task
status: todo
id: task-renumber-colliding-doc-numbers
title: "Renumber the 5 live doc-number collisions in this corpus (exploration -001 x2, spec -001/-015, plan -001/-015) plus every citation"
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-renumber-colliding-doc-numbers.md
  Leaves live only under a story. id is the filename stem: task-renumber-colliding-doc-numbers.
  CLI `arggon create task renumber-colliding-doc-numbers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Renumber the 5 live doc-number collisions in this corpus (exploration -001 x2, spec -001/-015, plan -001/-015) plus every citation

## Context

Surfaced by PR #603 (bug-spec-analyze-does-not-detect-duplicate-doc-numbers), 2026-10-02 — the detector works and immediately found five live collisions in this repo's own corpus (report-only, exit 0, so nothing was failing before it existed):

- \`docs/explorations/\`: exploration \`-001\` x2
- \`docs/specs/\`: spec \`-001\` x2, spec \`-015\` x2
- \`docs/plans/\`: plan \`-001\` x2, plan \`-015\` x2

Ten files plus every citation. Deliberately NOT in that PR: a detector PR that also renumbers ten documents is two changes, and the renumber is mechanical while the detector is the judgment call. They must land in that order (detector first, so the renumber is verifiable against it) — this item depends on that.

The renumber precedent exists and is painful: ADR 0016 carries a renumber note, ADR 0019 carries a "spec-plan 016 renumber" note, and the coordinator collided two ADR 0020s plus two exploration -018s plus two spec/plan -017 pairs in a single wave. Five hand-renumbers is why this detector exists.

## Acceptance

- [ ] Depends on PR #603 landing first, so the renumber is verifiable against the detector (record the dependency in frontmatter via \`depends_on\`)
- [ ] All 5 collisions resolved; \`arggon spec validate\` and \`spec analyze --baseline\` report 0 duplicate-doc-number findings
- [ ] Every citation updated: ADR cross-references, spec \`spec:\` frontmatter, plan links, exploration Decision sections, and any \`docs/\` reference to a renamed file
- [ ] Renumber notes recorded in the affected documents, following the existing ADR 0016 / 0019 idiom, so the history is auditable
- [ ] The detector finding is NOT made blocking in this PR (per the reviewer's recommendation: land the gate after the corpus is clean, so it does not fire on every commit meanwhile)

## Notes
