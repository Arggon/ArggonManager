---
plan_id: zcode-native-seam-012
title: Plan for ZCode native seam
spec: ArggonManager/docs/specs/spec-zcode-native-seam-012.md
status: implemented
created: "2026-09-29"
---

# Plan: ZCode native seam (zcode-native-seam-012)

Derived from `ArggonManager/docs/specs/spec-zcode-native-seam-012.md`. Each task
carries a verifiable acceptance criterion and links back to the spec.

## Tasks

### T1: MCP full tool surface — `task-mcp-full-surface` (this PR)

- Add `arggon_priority`, `arggon_sync`, `arggon_import_issues` (in-process
  kernel operations) and `arggon_start`, `arggon_branch`, `arggon_cleanup`
  (CLI spawn via argv array, `--json` envelopes) to `cli/src/mcp-server.ts`.
- Extend `mcp-parity.test.ts` option-surface invariant to the six tools;
  envelope parity for `priority`/`sync`; dispatch tests for the spawn path
  (unknown tool, child failure, timeout) in `mcp-server.test.ts`.
- Update `references/json-contract.md` (nine → fifteen tools).
- **Acceptance:** full suite + lint/typecheck green; `validate --json`
  `ok:true`; parity tests fail on schema drift.

### T2: ZCode plugin seam — `task-zcode-plugin-seam` (next PR, depends on T1)

- `templates/docs/zcode/`: plugin manifest, 11 commands (tool references
  rewritten to `mcp__arggon__*`), 3 agents (ZCode frontmatter), `hooks/`
  reviewer dispatch-scoped backstop + global git gate scripts.
- `cli/src/init.ts` generates `.zcode-marketplace/` with provenance,
  never-overwrite semantics; init tests extended.
- `docs/agents.md` init section documents the seam; headless smoke for the
  generated files.
- **Acceptance:** fresh-init tree carries a schema-valid plugin; backstop
  script unit tests pass; live ZCode install/trial listed as pending manual
  verification.
