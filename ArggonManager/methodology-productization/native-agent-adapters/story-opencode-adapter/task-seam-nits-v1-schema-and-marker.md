---
type: task
status: in_progress
id: task-seam-nits-v1-schema-and-marker
title: "Seam nits from PR #754 review: docs/agents.md:655 calls the V1 published schema the field-level source of truth (the vendor's V2 guidance says never infer V2 names from it); and the agents carry the argon:generated marker twice"
assignee: arggon-delivery-lead
branch: feat/task-seam-nits-v1-schema-and-marker
parent: story-opencode-adapter
labels: [opencode-seam, docs, review-followup]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T16:39:56.711Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-seam-nits-v1-schema-and-marker
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

- [x] `agents.md:655` corrected to point at the V2 names (or explicitly warn the published schema is V1 — cite the vendor sentence); check `docs/playbooks/opencode.md` for the same claim
- [x] The double `argon:generated` marker identified (emitter or template), reduced to one, and a test pins single-marker emission for the opencode seam
- [x] `arggon doctor --agents` still classifies the touched seam files correctly; `npm run test` green

## Notes

### 2026-10-13 @ses_ec9dcc297ffe65zmdw5Lg4uIOi
Maker report — PR #788, branch feat/task-seam-nits-v1-schema-and-marker, commit 9ef55be9.

NIT 1 — docs corrected; vendor sentence observed from the installed runtime:
- ArggonManager/docs/agents.md (the "field-level source of truth" claim, line 661 after the edit) and ArggonManager/docs/playbooks/opencode.md:178-182 no longer name https://opencode.ai/config.json as the field-level source of truth. Both now quote the vendor verbatim and point at the V2 names (plugins; agents with system/permissions; commands).
- Citation evidence: strings -n 6 ~/.opencode/bin/opencode | grep -A3 "The schema served from" on the installed v2.0.26 binary returns: "The schema served from <https://opencode.ai/config.json> may describe V1 even though V2 configuration files include that URL for editor integration. Never use it to infer V2 field names or shapes." (followed by the V2-docs fallback clause).

NIT 2 — root cause and fix:
- Marker spelling verified: the actual marker is arggon:generated (double g); the item text's argon:generated is a typo.
- Emitter: cli/src/docs.ts stampGeneratedContent() inserts the YAML marker after the frontmatter opener and is not idempotent.
- Template: templates/docs/opencode/agents/arggon-maker.md and argon-verifier.md each carried a baked marker line (the only templates under templates/ that did; the pre-rename argon-prover.md already did, and its generated copy doubled back then too). Removed the line from both; regenerated via npm run build && node dist/cli.js init --no-commit; .opencode/agents/arggon-{maker,verifier}.md now each carry exactly one marker (grep -c arggon:generated = 1).
- Guards in cli/src/init-opencode.test.ts: (a) shipped templates/docs/opencode/{agents,commands}/*.md carry no arggon:generated line; (b) fresh init emits exactly one marker per generated agent/command and the committed seam matches. Negative control: before regeneration the guard failed with "expected [ …(2) ] to deeply equal [ Array(1) ]" on .opencode/agents/arggon-maker.md.

Ledger (ArggonManager/.convention.yml, checksums sha256sum-verified):
- .opencode/agents/arggon-maker.md f8246206…→899d4e84…
- .opencode/agents/arggon-verifier.md d8975729…→9e24ab68…
- .agents/skills/arggon-cli/references/exploration.md d9ab2e7d…→3553e0c6… — pre-existing drift: the destination is gitignored (per-checkout), its record predates the post-0.7.0 source edits (fe81a086), and any init run materializes the file, which makes provenance-audit.test.ts's repo-self check flag it. Refreshed in the fd581f9a/baca2f4e shape.
- Deliberately NOT committed: the regen's version/generatedAt churn (baca2f4e precedent) — CI's pin ARGGON_VERSION=0.7.0 lags the 0.9.0 build, and committed 0.9.0 stamps would trip the workflow's lag assertion.

Gates on 9ef55be9 (all green):
- npm run build; npm test — 154 files / 3349 tests passed; npm run lint; npm run test:structure — 5 passed; npm run arggon -- validate — ok, 0 warnings; npx prettier --check on the touched files.
- argon doctor --agents: the four .opencode/agents/* files and the 11 commands classify present; 0 stale, 0 missing (only opencode.jsonc is adopter-edited, pre-existing).
- CI drift emulation after the commit: node dist/cli.js init --no-commit leaves git status --porcelain (excluding the state file) empty.
- PR #788: https://github.com/Arggon/ArggonManager/pull/788

### handoff 2026-10-13 @ses_ec9dcc297ffe65zmdw5Lg4uIOi (session: ses_ec9dcc297ffe65zmdw5Lg4uIOi) — next: Delivery lead: review PR #788 (head 9ef55be9 + tracker commits); standards-reviewer verdict, then merge and flip done.
- branch: feat/task-seam-nits-v1-schema-and-marker
- open questions: exploration.md ledger refresh folded here or its own item?; docs cite runtime v2.0.26 while agents.md smoke evidence still says v2.0.12 (pre-existing).
