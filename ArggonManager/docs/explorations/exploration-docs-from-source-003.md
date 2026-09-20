---
exploration_id: docs-from-source-003
title: docs-from-source — keeping CLI reference docs generated from the live CLI
status: open
created: 2026-09-15
---

# Exploration: docs-from-source (docs-from-source-003)

Spike backing task-skill-generated-command-reference: how do established tools
keep reference docs in sync with the CLI they document, and does the marker-region
pattern (chosen by the coordinator) hold up?

## Candidates

1. **Marker-region generation** (chosen): a generator renders a delimited region
   of an otherwise hand-written doc from the live source; a test regenerates and
   compares so drift fails CI.
2. **Fully generated doc files**: the whole reference doc is an artifact,
   regenerated wholesale (no hand-written prose preserved).
3. **Doc-from-help-text**: parse the CLI's own `--help` output at doc-build time.

## Criteria

- Drift must be impossible-by-construction or at least fail loudly in CI.
- Hand-written narrative (nuance, pitfalls, ordering rationale) must survive.
- Cheap to run locally (`skills:sync`) and in tests.

## Findings

- oclif's `readme` command injects generated usage and per-command help into a
  README between HTML comment markers (`<!-- usage -->`, `<!-- commands -->`,
  `<!-- toc -->`); regenerating after any command/description change is the
  documented workflow — the canonical marker-region precedent (source:
  https://github.com/oclif/oclif/blob/main/docs/readme.md, 2026-09-15; marker
  tags confirmed at https://www.joshcanhelp.com/building-a-cli-from-scratch-with-typescript-and-oclif/, 2026-09-15).
- terraform-docs extracts inputs/outputs/providers from Terraform module source
  and renders them into Markdown/AsciiDoc/JSON, injected into READMEs between
  BEGIN/END comment markers (`<!-- BEGIN_TF_DOCS -->`) and enforced in CI via
  GitHub Actions — marker regions again, with a config file controlling format
  (source: https://github.com/terraform-docs/terraform-docs, 2026-09-15; CI
  automation example https://skundunotes.com/2025/01/10/automate-terraform-modules-readme-generation-with-terraform-docs-and-github-actions/, 2026-01-10).
- Rust's clap ships `clap_mangen` (with the deprecated `clap_generate` replaced
  by `clap_complete`/`clap_mangen` in clap 4): man pages and completions are
  rendered at BUILD TIME from the same `Command` definition the binary uses —
  one source of truth, no prose to keep in sync, but output is a whole-file
  artifact with no hand-written content (source:
  https://crates.io/crates/clap_mangen, 2026-09-15; build-time recommendation
  https://lib.rs/crates/clap_mangen, 2026-09-15).
- Agent-era equivalent: skills-sync tools (AgentSync and similar) symlink or
  copy a single canonical SKILL.md into every agent's skills folder — they solve
  distribution duplication, not content drift against the CLI surface; none of
  the surveyed tools generate SKILL content from the CLI itself (source:
  https://lib.rs/crates/agentsync, 2026-09-15; https://blog.serghei.pl/posts/agent-skills-101/, 2026-09-15).

## Recommendation

Marker-region generation (candidate 1) is confirmed: it is the dominant pattern
(oclif, terraform-docs) precisely because it lets hand-written narrative and
generated reference share one file, and a regenerate-and-compare test turns any
drift into a CI failure. Whole-file generation (clap_mangen) can't preserve the
SKILL's narrative sections; help-text scraping is fragile against wrapped,
column-formatted output. Our variant strengthens the pattern by introspecting the
commander definitions in `cli/src/cli.ts` source (the same parse the mcp-parity
harness uses) instead of scraping `--help` text, and by guarding the net with a
cross-check that every user-facing command is documented somewhere.

## Decision

Covered by the coordinator's design decision on task-skill-generated-command-reference
(marker regions, generator in cli/src/sync-skills.ts); no separate ADR — this
spike records the backing research.
