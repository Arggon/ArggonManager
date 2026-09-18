---
type: task
status: todo
id: task-opencode2-seam-polish
title: "Seam polish: deferred review nits (present-skip docs, signature anchoring, tool permissions)"
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-seam-polish.md
  Leaves live only under a story. id is the filename stem: task-opencode2-seam-polish.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Seam polish: deferred review nits (present-skip docs, signature anchoring, tool permissions)

## Context

Deferred (non-blocking) findings from the independent review of PR #322
(`task-opencode-v2-spec`), recorded in the review verdict comment on that item.
The blocking change requests were addressed in-PR; this item closes the rest so
they do not get lost ([docs/agents.md](../../../../docs/agents.md) §0).

Findings to resolve:

- **MINOR-5** — `init --dry-run --json` now emits the `present-skip` decision,
  but `docs/json-output.md` does not document it (nor the pre-existing
  `project-name-unrecoverable`). Extend the `plan[].decision` enumeration.
- **NIT-10** — `DOC_PATH_MAP["opencode.jsonc"]` is redundant (the 1:1 fallback
  already maps it); remove the duplicate source of truth.
- **NIT-11** — `renderGeneratedDoc`'s docstring still says "marker line (except
  JSON destinations)"; the YAML marker string is hardcoded next to
  `generatedMarker()` instead of coming from a sibling helper.
- **NIT-12** — `isArggonGeneratedConfig` uses a substring-anywhere check; anchor
  the signature to the leading comment line of the generated file.
- **NIT-13** — record in `spec-opencode-seam-010` that `default_agent` is
  deliberately not set (agents are discovered; the session default stays
  `build`), so the omission does not read as an oversight.
- **NIT-14** — encode least privilege at the tool level for the generated
  agents (reviewer: deny tracker mutations beyond `arggon_comment`; worker:
  deny `arggon_create`) — **verify the normalized MCP action name first**
  (server + tool naming), then add the rules to the templates.

## Acceptance

- [ ] `docs/json-output.md` documents every `plan[].decision` value emitted by
      `init --dry-run --json` (including `present-skip` and
      `project-name-unrecoverable`).
- [ ] `cli/src/docs.ts` has a single source for the `opencode.jsonc` path
      mapping; the redirect docstring is accurate; the YAML marker comes from a
      named helper.
- [ ] Signature detection anchors to the generated comment line, with a test
      proving an adopter config that merely contains the phrase is not claimed.
- [ ] `spec-opencode-seam-010` notes the `default_agent` decision.
- [ ] Agent templates carry the tool-level permission rules **after** a probe
      confirms the normalized action names on a real V2 session; the probe is
      recorded in the item.
- [ ] Full suite green; `arggon validate` and `spec validate` clean; changes
      land in one small PR to `opencode2`.

## Notes

- None of these blocks W2 (plugin); schedule after the W1 wave merges.
- If the tool-level permission probe shows confusing normalization (the arggon
  server hosts tools already named `arggon_*`), file the finding and keep the
  guidance in the agent prompts instead.
