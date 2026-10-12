---
type: task
status: todo
id: task-mcp-doc-contract-scan-surface-widened
title: 'The MCP doc-contract scan covers 5 files + 5 dirs, but the PR claims "anywhere in the corpus" — `docs/opencode2.md`, `docs/playbooks/**`, non-`templates/docs` trees and `labs/` are outside the gate'
parent: methodology-improvements
labels: [docs, tests]
created: "2026-10-03"
updated: "2026-10-03"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-mcp-doc-contract-scan-surface-widened.md
  Leaves live only under a story. id is the filename stem: task-mcp-doc-contract-scan-surface-widened.
  CLI `arggon create task mcp-doc-contract-scan-surface-widened` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The MCP doc-contract scan covers 5 files + 5 dirs, but the PR claims "anywhere in the corpus" — `docs/opencode2.md`, `docs/playbooks/**`, non-`templates/docs` trees and `labs/` are outside the gate

## Context

The MCP tool-surface doc contract (`cli/src/mcp-doc-contract.test.ts`, from `bug-agents-md-says-nine-mcp-tools`) pins the `arggon mcp` registry (`TOOLS` in `cli/src/mcp-server.ts`) against the documents that enumerate the whole surface, plus a never-names-an-unshipped-tool sweep. Its sweep reads `CORPUS_FILES` (`README.md`, `ArggonManager/docs/agents.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/json-output.md`) and `CORPUS_DIRS` (`skills/arggon-cli`, `templates/docs`, `.zcode-marketplace`, `.opencode/agents`, `.opencode/commands`) — five files plus five trees.

Outside that gate sit agent-facing surfaces that also name tools: `docs/opencode2.md`, `docs/playbooks/**`, non-`templates/docs` doc trees, and `labs/`. The suite's own scope note deliberately exempts ADRs, plans, specs, explorations and tracker items as dated records (supersede, don't rewrite) — but the surfaces above are carriers a reader acts on as current, not dated records, so an "anywhere in the corpus" claim overstates the gate. The question is scope: widen the scan, narrow the claim, or record why each outside surface stays out.

## Acceptance

- [ ] Enumerate the current `CORPUS_FILES` / `CORPUS_DIRS` in `cli/src/mcp-doc-contract.test.ts` and confirm which of `docs/opencode2.md`, `docs/playbooks/**`, non-`templates/docs` trees and `labs/` name `arggon_*` tools today
- [ ] Decide for each outside surface: widen the gate to read it, or record in the suite's scope note why it stays out (dated record vs carrier a reader acts on)
- [ ] Whatever is decided, the suite's "anywhere in the corpus" claim matches its actual sweep — no absolute guarantee on scenario-bounded evidence
- [ ] `npx vitest run cli/src/mcp-doc-contract.test.ts` green on the decided scope, and `npx prettier --check` clean on any doc touched

## Notes
