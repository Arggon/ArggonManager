---
type: story
status: done
id: story-claude-adapter
title: "Claude Code adapter (spec S6, follow-on)"
parent: native-agent-adapters
labels: []
created: "2026-10-02"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/story-claude-adapter.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Claude Code adapter (spec S6, follow-on)

## Context

Implements [spec-methodology-adapters-017 §S6](./../docs/specs/spec-methodology-adapters-017.md)
through its follow-on spec,
[spec-claude-code-adapter-024](./../docs/specs/spec-claude-code-adapter-024.md).
Contract: a Claude Code adapter as a **bounded port of the shipped ZCode seam**
(ADR 0014), carrying the post-rename role vocabulary
(`arggon-maker` / `arggon-standards-reviewer`; ADR 0021 §6.1/§6.2a′), with the
delivery lead's contract riding the generated `CLAUDE.md` -> `@AGENTS.md` carriers.
No implementation in the spec-filing wave (`task-claude-adapter-spec`).

Honest starting floor (what an `arggon init` tree already gives this client with
no bundle): the generated `CLAUDE.md` -> `@AGENTS.md` pointer and the generated
`.mcp.json` -> `arggon mcp` registration, per the `claude` row of
`adapters/capability-matrix.json`.

## Acceptance

- [x] `templates/docs/claude/**` exists: marketplace catalog, plugin manifest, the two agent files, the command set, the hooks pair, the seam README; nothing is written under `adapters/**`
- [x] `arggon init` materializes `.claude-marketplace/**` with provenance, never overwrites an adopter-edited file, and `--json` reports per-file `written`/`skipped` with honest counts
- [x] `arggon init --agents opencode,zcode` and `--no-agents` do not generate the bundle; an unknown agent name is still refused by name with nothing written
- [x] The generated tree contains exactly the agents `arggon-maker` and `arggon-standards-reviewer`; no file names a lead agent, and every lead reference resolves to the generated `CLAUDE.md`/`AGENTS.md` carriers
- [x] Exactly one MCP server is registered, keyed `arggon`, byte-equal in `command`/`args` to the generated `.mcp.json` entry; a live stdio round-trip against a fixture tracker returns the documented envelope
- [x] The gate denies force-push and `--no-verify` for every session and denies writes for the reviewer window opened by the reviewer's `SubagentStart` and closed by `SubagentStop`, counting parallel dispatches and clearing on `Stop`
- [x] The gate's reviewer matcher is bound to the id read out of the shipped `agents/arggon-standards-reviewer.md`, and the review command dispatches that same id — the backstop cannot be disarmed by a rename
- [x] `skills/arggon-cli/**` in the bundle is byte-equal to `skills/arggon-cli/**` modulo the generated marker (one skill, two destinations)
- [x] `cli/src/init-claude.test.ts` covers every box above and passes in CI with the `claude` binary absent; binary-present probes are recorded as `skipped: claude not installed`, never as passes
- [x] `arggon doctor --agents` reports the bundle files with the documented status set and the `claude` gap rows, and no gap row is reported closed that the bundle does not close
- [x] `ArggonManager/docs/agents.md` gains a Claude Code seam section beside §ZCode naming the marketplace install step, the one-server rule, the two-agent rule and the namespaced component names, with impact class stated as **Behavioral**
- [x] `arggon validate`, the full test suite, lint, and `arggon spec analyze` are green with no new finding naming this story

## Notes
