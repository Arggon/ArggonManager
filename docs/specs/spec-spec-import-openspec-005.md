---
spec_id: spec-import-openspec-005
title: spec import openspec: mechanical OpenSpec migration with zero-loss check
status: implemented
created: 2026-09-16
---

# Spec: spec import openspec (spec-import-openspec-005)

`arggon spec import openspec` turns an OpenSpec corpus (`<path>/specs/<capability>/spec.md`, one capability per directory) into Arggon spec docs under `docs/specs/`, mechanically and reproducibly. Rollout step 2 of the spec-corpus migration proposal: the ArggonStores-am adoption (2026-09-15) migrated 138 capability specs with an ad-hoc script — repeatable but not reproducible by default. This command makes the most error-prone step (section mapping + zero-loss assertion) part of the CLI.

Invariants, in priority order:

1. **Nothing is ever overwritten.** Every target file must be new; numbering never reuses an existing NNN.
2. **All-or-nothing per run.** The run is two-phase: map + assert every source file first, then write all targets. Any failure (parse, mapping, zero-loss mismatch, collision) writes nothing at all.
3. **Zero-loss per file.** The re-assembled mapped content must equal the source body after normalization. On mismatch the run fails loudly with a per-file diff.
4. **Mechanical, deterministic.** No AI, no prompts; the same corpus yields the same output given the same next spec number.

## Synopsis

```bash
arggon spec import openspec <path> [--dry-run] [--json]
```

- The command is `spec import <format> <path>` — the first positional selects the corpus format (currently only `openspec`; an unknown format fails with `SPEC_IMPORT_FAILED` naming the supported set). `arggon spec import openspec <path>` is the canonical invocation.
- `<path>` — OpenSpec corpus root; must contain `specs/<capability>/spec.md` for each capability directory. Capabilities are processed in sorted directory order.
- For each capability the command scaffolds a new Arggon spec (same mechanics as `spec new`: global sequential NNN numbering across `docs/specs` + `docs/plans`, never overwrite) with the mapped content. Spec id and filename derive from the capability directory name: `spec_id: <capability>-NNN`, file `docs/specs/spec-<capability>-NNN.md`.
- `--dry-run` — inventories the run (files discovered, per-file mapping preview, next spec ids) and writes nothing.
- `--json` — additive v1 envelope, `command: "spec"`; success payload carries `created` (or `inventory` under `--dry-run`); failures use `error.code: "SPEC_IMPORT_FAILED"` with per-file details. See [docs/json-output.md](../docs/json-output.md).

### Section mapping (proven in production at ArggonStores-am)

| OpenSpec source                     | Arggon spec target                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `## Purpose` section body           | `## Purpose` section body (verbatim)                                               |
| `## Requirements` section body      | `## Acceptance criteria` section body (verbatim, plus the insertions below)         |
| `### Requirement:` blocks           | kept verbatim inside Acceptance criteria                                            |
| `#### Scenario:` blocks (Given/When/Then) | kept verbatim; each yields one checkbox in the requirement's checklist         |
| — (inserted)                        | `### Verification checklist` after each requirement's content, checkbox items derived from its scenarios (or statements when a requirement has none) |
| — (inserted)                        | italic provenance line at the end of Acceptance criteria: `*Source: <source-rel-path> — migrated <YYYY-MM-DD> via arggon spec import openspec.*` |

Generated frontmatter: `spec_id: <capability>-NNN`, `title: <capability, hyphens as spaces> (migrated from openspec)`, `status: proposed`, `created: <date>`. Generated sections: `## Purpose`, `## Synopsis` (one-line command surface + pointer to this spec), `## Acceptance criteria` (mapped + insertions). Generated docs must pass `arggon spec validate` with zero errors.

### Zero-loss invariant and normalization

For each source file, the assertion re-extracts the mapped regions **from the generated output** (Purpose body; Acceptance criteria body minus `### Verification checklist` subsections and provenance lines), re-assembles `## Purpose` + `## Requirements` from them, and compares against the source body (file content minus the leading `# H1` line) after normalization. Normalization is: strip a trailing `\r`, trim trailing whitespace per line, collapse runs of blank lines to a single blank line, trim leading/trailing blank lines. Any difference fails the whole run with a per-file line diff (`- source` / `+ output`) in the error payload.

### Id sequencing and collision refusal

- The next number is computed once per run from the current `docs/specs` + `docs/plans` maximum; capabilities receive consecutive numbers in sorted order (`NNN`, `NNN+1`, …).
- Before writing anything, every target filename is checked for existence. Any existing target — or a capability directory whose name is not kebab-case ASCII (`^[a-z0-9]+(-[a-z0-9]+)*$`) — fails the run with nothing written. Nothing is ever overwritten.
- The next number is injectable in tests (`startNumber`), which is how the numbering-then-write race that collision refusal guards against is exercised deterministically.

### Format adapter extension point

The OpenSpec parsing/mapping lives in its own module (`cli/src/spec-import.ts`) behind an adapter-shaped API so future corpus formats (other OpenSpec layouts, ADR/RFC corpora) plug in without touching the command:

```ts
export type CorpusAdapter = {
  format: string;                                        // e.g. "openspec"
  discover(corpusRoot: string): DiscoveredFile[];        // { capability, absPath, sourceRel }
  parse(raw: string, file: DiscoveredFile): ParsedSpec;  // { purpose, requirements }
  map(parsed: ParsedSpec, meta: MapMeta): string;        // full Arggon spec doc
};
```

`runSpecImport` orchestrates: discover → read → parse → map → zero-loss assert (per file, all files first) → collision check → write all. A new format only implements the adapter; assertions and orchestration are shared. On the command surface a format is a positional of `spec import`, so adding one is an adapter plus a dispatch entry — no new command tree.

## Acceptance criteria

### Requirement: mechanical migration with the documented mapping

The command migrates each `specs/<capability>/spec.md` into `docs/specs/spec-<capability>-NNN.md` applying the section mapping table above; OpenSpec `## Purpose` becomes the spec Purpose, `## Requirements` becomes Acceptance criteria verbatim, each requirement gains a `### Verification checklist`, and each file gets a provenance line.

#### Scenario: golden corpus

- Given a corpus with one capability whose spec has a Purpose and two requirements with Given/When/Then scenarios
- When `arggon spec import openspec <path>` runs
- Then one Arggon spec is created with the mapped content, checklists, and provenance line, and it passes `spec validate` with zero errors

#### Scenario: multiple capabilities number consecutively

- Given a corpus with three capability directories
- When the import runs
- Then the created specs receive consecutive global NNN numbers in sorted capability order

#### Scenario: verification checklists are derived

- Given a requirement with two scenarios and a requirement with none
- When the import runs
- Then the first requirement's checklist has one checkbox per scenario and the second has a single statement-derived checkbox

### Verification checklist

- [ ] Scenario: golden corpus
- [ ] Scenario: multiple capabilities number consecutively
- [ ] Scenario: verification checklists are derived

### Requirement: zero-loss assertion fails loudly with a per-file diff

For each source file the re-assembled output must equal the source body after the documented normalization; on mismatch the run fails with a per-file diff and writes nothing.

#### Scenario: mutated source is detected

- Given a source file containing content the mapper would drop
- When the import runs
- Then it exits non-zero reporting the capability, the mismatch, and a line diff, and no file under `docs/specs/` is created

### Verification checklist

- [ ] Scenario: mutated source is detected

### Requirement: all-or-nothing per run and collision refusal

The run is two-phase; any failure — parse, mapping, zero-loss, or an existing target file — writes nothing, and existing files are never overwritten.

#### Scenario: one bad file among several

- Given three capabilities where the second fails the zero-loss assertion
- When the import runs
- Then the run fails and zero files are written for any capability

#### Scenario: collision refusal

- Given a corpus whose first capability would target an existing `docs/specs/spec-<capability>-NNN.md`
- When the import runs
- Then it fails before writing anything and the existing file is unchanged

### Verification checklist

- [ ] Scenario: one bad file among several
- [ ] Scenario: collision refusal

### Requirement: dry-run inventories without writing

`--dry-run` reports discovered files, per-file mapping preview, and the next spec ids, and writes nothing.

#### Scenario: dry-run is side-effect free

- Given any corpus
- When `arggon spec import openspec <path> --dry-run` runs
- Then the inventory lists every capability with its target file and spec id, the `docs/` tree is byte-identical to before, and a subsequent real import produces the same plan

### Verification checklist

- [ ] Scenario: dry-run is side-effect free

### Requirement: extensible adapter architecture

The format parsing/mapping lives in a separate adapter module with a documented `CorpusAdapter` API; the command only orchestrates discover → parse → map → assert → write.

#### Scenario: adapter is swappable

- Given a second corpus format
- When an adapter implements `discover`/`parse`/`map` for it
- Then `runSpecImport` runs it unchanged, reusing the shared zero-loss assertion and collision logic

### Verification checklist

- [ ] Scenario: adapter is swappable

*Source: openspec/specs/spec-import-openspec/spec.md — migrated 2026-09-16 via arggon spec import openspec.*
