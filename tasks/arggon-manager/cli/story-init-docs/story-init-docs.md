---
type: story
status: todo
id: story-init-docs
title: Init scaffolds the governing document set
parent: cli
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/story-init-docs.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Init scaffolds the governing document set

## Context

`arggon init` today scaffolds only the tasks/ tree; the governing documents (AGENTS.md, CONTRIBUTING.md, SECURITY.md, docs/convention.md, ...) exist as examples inside this repo and must be copied by hand into every adopter. Research (2026-09-12): AGENTS.md is the de facto cross-agent standard (60k+ repos; Copilot/Codex/Cursor/Gemini read it natively; Claude Code needs a one-line CLAUDE.md shim with `@AGENTS.md`), and the enterprise doc set (ARCHITECTURE.md, CODEOWNERS, SECURITY.md, runbooks, docs-as-code) is well established. Init should generate it all from master templates — never hand-duplicated.

## Acceptance

- [ ] `arggon init` generates the tier-1 set by default (AGENTS.md, CLAUDE.md shim, .github/copilot-instructions.md pointer, CONTRIBUTING.md, SECURITY.md, .editorconfig, CODEOWNERS placeholder, PR/issue templates); `--full` adds ARCHITECTURE.md, project-local docs/convention.md + docs/engineering.md templates, CHANGELOG.md, SUPPORT.md, docs/runbooks/
- [ ] Never overwrites existing files; generated-from-source templates with placeholders; --json reports created/skipped
