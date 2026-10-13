---
type: task
status: todo
id: task-seam-nits-v1-schema-and-marker
title: "Seam nits from PR #754 review: docs/agents.md:655 calls the V1 published schema the field-level source of truth (the vendor's V2 guidance says never infer V2 names from it); and the agents carry the argon:generated marker twice"
parent: story-opencode-adapter
labels: [opencode-seam, docs, review-followup]
created: "2026-10-13"
updated: "2026-10-13"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-seam-nits-v1-schema-and-marker.md
  Leaves live only under a story. id is the filename stem: task-seam-nits-v1-schema-and-marker.
  CLI `arggon create task seam-nits-v1-schema-and-marker` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Seam nits from PR #754 review: docs/agents.md:655 calls the V1 published schema the field-level source of truth (the vendor's V2 guidance says never infer V2 names from it); and the agents carry the argon:generated marker twice

## Context

Two nits from the PR #754 standards review (`task-seam-footprint-config-inline-evaluation`), recorded so they outlive the item:

1. **`ArggonManager/docs/agents.md:655`** calls the published `https://opencode.ai/config.json` schema the "field-level source of truth". The vendor's own V2 guidance (shipped with the runtime, v2.0.26) says verbatim: _"The schema served from https://opencode.ai/config.json may describe V1 … Never use it to infer V2 field names or shapes."_ The published schema is V1 (`plugin`/`agent`/`command` singular); V2 uses `plugins`/`agents`/`commands` with `system`/`permissions`. `agents.md` is a methodology carrier — the correction is a real doc fix, not a nit pick.
2. **The agents carry the `argon:generated` marker twice** (e.g. `.opencode/agents/arggon-maker.md` lines 2–3). Probably harmless, but it should be one marker; check whether the duplicate affects `stampGeneratedContent`/checksum parsing and fix the emitter.

## Acceptance

- [ ] `agents.md:655` corrected to point at the V2 names (or explicitly warn the published schema is V1 — cite the vendor sentence); check `docs/playbooks/opencode.md` for the same claim
- [ ] The double `argon:generated` marker identified (emitter or template), reduced to one, and a test pins single-marker emission for the opencode seam
- [ ] `arggon doctor --agents` still classifies the touched seam files correctly; `npm run test` green

## Notes
