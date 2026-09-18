---
type: task
status: in_progress
id: task-opencode2-seam-polish
title: "Seam polish: deferred review nits (present-skip docs, signature anchoring, tool permissions)"
assignee: Arggon
branch: feat/task-opencode2-seam-polish
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T13:06:52.341Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-seam-polish
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

### 2026-09-18 @Arggon
### 2026-09-18 @Arggon
### Seam polish evidence (MINOR-5, NIT-10..NIT-14)

Branch `feat/task-opencode2-seam-polish`. Files: `cli/src/docs.ts`,
`cli/src/init-opencode.test.ts`, `docs/json-output.md`,
`docs/specs/spec-opencode-seam-010.md`,
`templates/docs/opencode/agents/arggon-{reviewer,worker}.md`.

**NIT-14 probe (real headless V2 session, `opencode v2.0.8`, model
`opencode-go/deepseek-v4-flash`, `opencode run --format json --auto --agent ...`)**
Note: the machine's installed V2 binary is v2.0.8 (v2.0.7 is not fetchable
from the public channel); same V2 permission engine. Throwaway fixtures under
`/tmp/opencode/perm-probe-{1..4}` on a fresh `arggon init` tree whose
`opencode.jsonc` registers the `arggon` MCP server.

- `search` warm-up first (Code Mode's catalog starts cold; the first direct
  call fails `Unknown tool` for every tool, deny or not — probe 1 was discarded
  for that reason).
- deny `arggon_arggon_comment` (candidate): 2/2 runs → `search` listed 8 tools,
  `arggon_comment` **absent**; the call failed
  `Unknown tool 'arggon.arggon_comment'.` → normalized action name confirmed.
- deny `arggon_comment` (unprefixed control): call **succeeded** (`ok: true`,
  comment committed) → the `<server>_` prefix is required.
- deny `arggon_arggon_create` (positive control): `search` listed
  `arggon_comment`; the call succeeded — the flow itself allows non-denied tools.
- Shipped templates re-probed after the change:
  - generated `arggon-reviewer`: `arggon_update` absent from the catalog; call →
    `UPDATE:FAILED` (`Unknown tool 'arggon.arggon_update'.`); `arggon_comment` →
    `COMMENT:OK`.
  - generated `arggon-worker`: `arggon_create` absent; call → `CREATE:FAILED`;
    `arggon_comment` → `COMMENT:OK`.

Result: templates now deny reviewer `arggon_create`/`arggon_update`/
`arggon_handoff` (tracker mutations beyond `arggon_comment`) and worker
`arggon_create`; seam test asserts each rule.

**NIT-12** — `isArggonGeneratedConfig` now anchors the signature to the file's
leading comment line (first line whose trimmed content starts with `//`). New
test: an adopter `opencode.jsonc` that merely mentions the phrase in a string
value → `init --dry-run --json` reports
`plan[opencode.jsonc].decision === "present-skip"` and a real run keeps the
bytes. Under the old substring-anywhere check this file was claimed as arggon's
and degraded to `modified-skip`. MAJOR-1 and signature-removed tests stay green.

**MINOR-5** — `docs/json-output.md` now enumerates `present-skip` and
`project-name-unrecoverable` with one-line semantics. Fixture checks of the
emitted payload (small script against `dryRunInit`):
`present-skip entry: {"dest":"opencode.jsonc","decision":"present-skip",...}`;
`project-name-unrecoverable entries: 8 first: {"dest":".editorconfig",...}`.

**NIT-10** — redundant `DOC_PATH_MAP["opencode.jsonc"]` entry removed; the 1:1
fallback still resolves it (seam suite: created at root, present-skip on adopter
shapes, `x-generated` provenance recorded).

**NIT-11** — new exported `generatedYamlMarker()` sibling of
`generatedMarker()`; `stampGeneratedContent` uses it; the misleading
`renderGeneratedDoc` docstring ("marker line (except JSON destinations)") now
describes the HTML/YAML/`//`/none variants. Test covers the helper and the
stamped frontmatter.

**NIT-13** — already satisfied on `origin/opencode2`:
`docs/specs/spec-opencode-seam-010.md:70` reads "`default_agent` is
deliberately not set: agents are discovered from `.opencode/agents/`, and the
session default stays `build`." (added in ff08631, PR #322). No diff needed;
the spec's agent-permission contract was extended for NIT-14 instead.

**Gates** — `npm test` 69 files / 1116 tests passed; `npm run lint`,
`npm run build`, `arggon validate` (0 warnings), `arggon spec validate`
(16 docs, 0 warnings) green. One earlier full run failed only
`measure.test.ts` (its global `/tmp/arggon-budget-*` hygiene check collided
with a concurrent session's temp dir; no leftovers remained; isolated re-run
and clean full re-run green).

### handoff 2026-09-18 @Arggon (session: ses_f4b5fb92bffeCmAOyvyfbi93sj) — next: Review PR #332 (draft, base opencode2) with the evidence comment; verify the NIT-14 probe transcript and the anchored-detection test; then merge and flip the item to done.
- branch: feat/task-opencode2-seam-polish
- open questions: Probe ran on installed opencode v2.0.8 (v2.0.7 not fetchable from the public channel); NIT-13 was already satisfied on opencode2 (no diff) — confirm acceptance ticks read honestly.

### 2026-09-18 @Arggon
PR: https://github.com/Arggon/ArggonManager/pull/332 (draft, base `opencode2`).
