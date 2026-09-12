---
spec_id: spec-pipeline-002
title: Spec pipeline — arggon spec validate + spec new
status: implemented
created: 2026-09-11
---

# Spec: spec pipeline (spec-pipeline-002)

## Purpose

Feature specs (`docs/specs/spec-<slug>-NNN.md`) and implementation plans
(`docs/plans/plan-<slug>-NNN.md`) are written by agents, so agents must be able
to **trust and check** them mechanically. This spec formalizes read-only
tooling: `arggon spec validate` checks structure, `arggon spec new` scaffolds
new documents from the repo templates. Invariants:

- Validation is a **pure read** — it never edits the documents it checks.
- Scaffolding **never overwrites** an existing file.
- Same rules for humans and agents; no SaaS, no AI in the CLI.
- Lenient about section naming (the existing specs are Spanish: "Propósito" /
  "Synopsis" / "Aceptación" all count), strict about the presence of frontmatter
  fields and acceptance criteria.

## Synopsis

```bash
arggon spec validate [--file <path>]     # pure read; non-zero exit on errors
arggon spec validate --json              # v1 envelope { errors, warnings }
arggon spec new <slug> [--title <t>] [--plan]   # scaffold spec (and plan)
```

- `validate` checks `docs/specs/*.md` and `docs/plans/*.md` under the repo root
  (parent of `tasks/`). `--file <path>` validates a single file, also outside
  the standard directories (basename `plan-*` or parent dir `plans` = plan).
- Spec checks: frontmatter `spec_id` (kebab-case ASCII), `title`, `status`
  (`proposed` | `implemented` | `superseded`), `created` (`YYYY-MM-DD`); H2
  sections Purpose (or a non-empty intro), Synopsis/Design/Model-of-data, and
  Acceptance criteria.
- Plan checks: `plan_id`, `title`, `status`, `created`, and a `spec` frontmatter
  key pointing at an existing spec file (existsSync relative to the repo root).
- Cross-check: two specs sharing a `spec_id` is an error (`SPEC_DUPLICATE_ID`).
- Issues are `{ path, message, code }` like `validate`; codes include
  `SPEC_MISSING_FRONTMATTER`, `SPEC_MISSING_FIELD`, `SPEC_BAD_STATUS`,
  `SPEC_BAD_DATE`, `SPEC_BAD_ID`, `SPEC_MISSING_SECTION`, `PLAN_SPEC_NOT_FOUND`,
  `PLAN_DUPLICATE_ID`.
- `spec new` numbers globally: max existing NNN across `docs/specs` + `docs/plans`
  plus 1; the plan shares the spec's number. Templates live in
  `templates/spec.md` / `templates/plan.md` (rendered with `{{SLUG}}`, `{{NNN}}`,
  `{{ID}}`, `{{TITLE}}`, `{{DATE}}` placeholders; an embedded copy ships in the
  CLI module as fallback).

## Contrato JSON

- `--json` envelope mirrors `validate`: `{ ok, schemaVersion, conventionVersion,
  command: "spec", errors, warnings }`; `ok` is false iff `errors.length > 0`,
  and a failed run carries `error.code: "SPEC_FAILED"` (also used for
  `spec new` failures). `spec new` success emits `{ files: string[] }` (posix,
  relative to the repo root).

## Aceptación

- [x] The repo's real specs/plans (deps-001, sync-001) validate with zero errors
- [x] Each error code is produced by a dedicated test case
- [x] Two specs sharing a `spec_id` fail validation
- [x] `spec new` scaffolds the next NNN, never overwrites, and its output
      validates clean; `--plan` scaffolds the matching plan
- [x] `--file` mode validates a single file outside the standard directories
