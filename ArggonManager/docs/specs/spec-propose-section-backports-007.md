---
spec_id: propose-section-backports-007
title: propose — section-level backports for completed docs
status: implemented
created: 2026-09-17
depends_on:
  - bug-project-name-dir-derived (clean renders before section matching)
---

# Spec: propose — section-level backports for completed docs

## Purpose

The first `init --propose` pilot on a fully-adopted repo (task-init-propose-acked-updates,
2026-09-17) produced 11 whole-file proposals and every one was a REGRESSION against
curated adopter content (generic skeletons with TODOs vs completed docs). For a
completed doc the realistic upgrade need is not "re-render the whole file" but
"the upstream template GAINED or CHANGED a region since this doc was generated —
backport that region", leaving the adopter's content alone.

This spec adds section-level proposals as the DEFAULT mode of `init --propose`,
with whole-file proposals kept as an explicit opt-in (`--propose-whole-file`) and
as the automatic fallback when the as-generated baseline cannot be recovered.

## Design

### Baseline recovery (the as-generated render)

The structural question "what did the template gain since generation?" needs the
render the dest file was generated FROM. That baseline is recoverable from git
history: the destination file's FIRST committed version (init auto-commits what it
writes, task bug-init-leaves-docs-untracked) is exactly what the old template
rendered.

- `git rev-parse --show-toplevel` (from the target root) → repo toplevel; the
  dest path is relativized to it.
- `git log --diff-filter=A -n1 --format=%H -- <rel>` → the add-commit hash.
- `git show <hash>:<rel>` → baseline content.
- Any failure (no git, untracked dest, git absent) → `null` → whole-file
  fallback (today's behavior).

If the project name is unrecoverable the render is refused
(`renderGeneratedDoc` → `null`) and NO proposal is emitted for that dest —
unchanged from the shipped behavior; a divergence signal built on a guessed
directory basename would be a false positive.

### Region extraction

A pure line-based LCS diff (same LCS core as the existing `diffSummary`)
baseline → current render, walked forward and grouped: every maximal run of
non-matching lines becomes ONE region with

- `kind`: `"added"` (0 baseline lines consumed) or `"changed"` (>0);
- `added`/`removed` line counts;
- `content`: the region's new-render lines (what to insert);
- `anchorBefore`/`anchorAfter`: up to 3 UNCHANGED baseline lines immediately
  before/after the region — verbatim text the adopting agent can search for in
  THEIR (curated) file to locate the insertion point.

REMOVED-only diffs (the template lost content the adopter has): never proposed
as deletions of adopter content. A dest whose diff yields zero added/changed
regions gets an `informational` entry (no side file written).

### Proposal shape (ONE side file per dest, delimited region blocks)

Same filename as today — `<dest>.proposed-<arggonVersion>` — so the existing
idempotency/absorbed/stale version-suffix rules work unchanged. Section-mode
content replaces the whole-file render:

```
<!-- arggon:proposed-update dest="..." version="..." generated="..." mode="sections";
     the template changed N region(s) since this doc was generated — apply each
     region to YOUR file at the quoted anchors, then re-ack via arggon adopt --ack
     and delete this file -->

## region 1 of N — added (+12/-0)
anchor-before (insert after the matching text in YOUR file):
    ...
insert:
    ...
anchor-after (insert before the matching text in YOUR file):
    ...
```

Region bodies are indented (4 spaces), not fenced, so embedded backticks in
template content cannot break the block. The adopting agent merges regions
manually and re-acks — the outer flow (propose → diff/merge → re-ack → delete)
is unchanged.

### Mode selection

- `--propose-whole-file` → whole-file for every dest (today's behavior).
- Otherwise section-level, with automatic whole-file fallback when the
  baseline is unrecoverable (no git history / untracked dest).
- Absorbed/stale/idempotency rules are mode-independent (same filename):
  same-version overwrite on re-run, absorbed removal when disk matches render,
  older-version side files reported stale and never deleted.

### Surfaces

- `--json` (additive within `schemaVersion: 1`): proposals entries gain
  `mode: "sections" | "whole-file"`, `regions?: [{ kind, added, removed }]`
  (section mode), `note?` (informational), plus the existing totals
  `added`/`removed` (region sums in section mode). New `decision` value
  `"informational"`.
- Human output: section proposals list each region with `+N/-M`; informational
  entries print an `info` line. Whole-file output unchanged.
- `--dry-run --propose` lists the same decisions, writes nothing (unchanged).

## Acceptance criteria

- [ ] A doc whose template gained a section since init gets a section-level
      proposal containing ONLY the new section (plus anchors), not the rest of
      the doc; the original stays byte-identical.
- [ ] No git history (or untracked dest) → whole-file proposal, exactly today's
      behavior and JSON shape (plus the additive `mode` field).
- [ ] Removed-only template content → `informational` entry, NO side file, no
      deletion of adopter content.
- [ ] `--propose-whole-file` → whole-file proposal for the same fixture.
- [ ] Idempotency (same-version overwrite), absorbed cleanup, stale reporting,
      and `--dry-run --propose` writes-nothing all still hold.
- [ ] README + ArggonManager/docs/json-output.md document the new default, the flag, and the
      additive JSON fields.
