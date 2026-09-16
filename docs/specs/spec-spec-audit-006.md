---
spec_id: spec-audit-006
title: spec audit: pairwise duplication detection with evidence
status: implemented
created: 2026-09-16
---

# Spec: spec audit: pairwise duplication detection with evidence (spec-audit-006)

## Purpose

During the ArggonStores-am spec-corpus migration, duplication detection was an
ad-hoc script: 9,453 pairwise comparisons over ~133 specs (shingle-Jaccard
similarity + shared verbatim requirement/scenario titles) plus manual reading
of the candidates, finding 1 diverging duplicate, 6 consolidations and ~130
healthy specs. `spec audit` makes that detection a first-class, repeatable
command so future corpora get the same evidence-driven triage without a
throwaway script.

Invariant: **report-only** — the command reads `docs/specs/*.md` and writes
nothing but stdout. It never edits, creates or deletes any file, including the
specs it audits.

## Synopsis

```bash
arggon spec audit [--json]
arggon spec audit --duplicate-threshold 0.85 --merge-threshold 0.45
```

Flags (defaults documented in `--help`):

| Flag | Default | Meaning |
|---|---|---|
| `--duplicate-threshold <n>` | `0.85` | similarity at/above this classifies a pair DUPLICATE |
| `--merge-threshold <n>` | `0.45` | similarity at/above this classifies a pair MERGE |
| `--min-shared-titles <n>` | `2` | shared requirement/scenario titles at/above this (with similarity >= `--shared-title-floor`) classify a pair MERGE — the "diverging duplicate" shape (same requirements, rewritten prose) |
| `--shared-title-floor <n>` | `0.15` | minimum similarity for the shared-titles MERGE path |
| `--report-floor <n>` | `0.15` | pairs below this similarity AND with zero shared titles are not reported (only counted) |
| `--json` | off | one JSON envelope on stdout (agent contract, `command: "spec"`) |

## Design

Scope: every pair (i < j, sorted by filename) over the `*.md` files directly in
`docs/specs/` (top level only, matching `spec validate`/`spec analyze` scope).
No `docs/plans` scan; no single-spec mode (keep scope to the corpus audit).

**Normalization** (documented, deterministic): strip YAML frontmatter, strip
fenced code blocks (``` … ``` — code samples are boilerplate, not spec prose),
lowercase, keep only `[a-z0-9]+` word tokens, collapse whitespace.

**Similarity metric**: word-shingle Jaccard with shingle size k = 3 (three
consecutive normalized words joined with a single space; k=3 balances noise
against sensitivity — k=1 over-flags shared vocabulary, k>3 misses paraphrase).
Each document becomes a Set of shingles; similarity = |A∩B| / |A∪B|. A pair of
two empty sets (degenerate, no words) is defined as 1.0.

**Shared-title signal**: `### Requirement:` and `#### Scenario:` heading titles
are extracted VERBATIM (text after the prefix, trimmed) from the whole
document; per pair the intersection of the two title sets is reported verbatim.

**Classification** (first match wins, per pair):

1. similarity >= `duplicate-threshold` → `DUPLICATE`
2. similarity >= `merge-threshold` → `MERGE`
3. shared titles >= `min-shared-titles` AND similarity >= `shared-title-floor` → `MERGE`
   (the diverging-duplicate shape: identical requirements, rewritten prose —
   Jaccard alone would miss it)
4. similarity >= `report-floor` OR at least 1 shared title → `KEEP_SEPARATE`
   (evidence in hand; a human decides)
5. otherwise → below the reporting floor: not reported, only counted.

Threshold rationale: 0.85 for DUPLICATE leaves room for differing ids/titles
/frontmatter while still catching near-identical prose (real duplicates land
~0.9+); 0.45 for MERGE catches heavy overlap that is not verbatim; the
0.15 report floor keeps distinct topics (typically < 0.1 with no shared
requirement titles) out of the noise. All thresholds are flags so corpora of
different sizes/phrasing can be tuned without code changes.

**Complexity**: O(P) shingle-set comparisons for P = N·(N−1)/2 pairs; each
comparison is linear in the union size of the two shingle sets (~ document
length). For a 133-spec corpus this is 8,778 comparisons — well under a second.

**Failure policy**: failures are structural (missing `docs/specs` dir, empty
corpus, unreadable file, invalid threshold values — NaN, outside [0,1], or
`duplicate-threshold` < `merge-threshold`) and fail the run with
`error.code: "SPEC_FAILED"`, exit 1 (reusing the `spec` domain code; findings
themselves never fail the run — report-only, exit 0 with findings).

JSON contract (additive under the `spec` command, `ok: true` on a completed
run — even with findings):

```json
{
  "ok": true,
  "schemaVersion": 1,
  "conventionVersion": 0,
  "command": "spec",
  "specs": 3,
  "pairs": 3,
  "thresholds": {
    "duplicateThreshold": 0.85,
    "mergeThreshold": 0.45,
    "minSharedTitles": 2,
    "sharedTitleFloor": 0.15,
    "reportFloor": 0.15
  },
  "findings": [
    {
      "classification": "duplicate|merge|keep-separate",
      "files": ["docs/specs/a.md", "docs/specs/b.md"],
      "similarity": 0.87,
      "sharedTitles": ["### Requirement: x"],
      "note": "one-line evidence summary"
    }
  ],
  "counts": { "duplicate": 1, "merge": 0, "keepSeparate": 0, "belowFloor": 2 }
}
```

Human output groups findings under DUPLICATE / MERGE / KEEP-SEPARATE sections
with per-pair evidence (file pair, similarity to 2 decimals, shared titles
verbatim, one-line note) and a summary (pairs scanned, per-class counts,
thresholds in effect).

## Acceptance

- [ ] `arggon spec audit` classifies a near-identical pair (different ids/titles) as DUPLICATE
- [ ] A diverging duplicate (same `### Requirement:`/`#### Scenario:` titles verbatim, rewritten prose) classifies MERGE via the shared-titles path, not high Jaccard
- [ ] A healthy corpus (distinct topics) reports no DUPLICATE/MERGE; below-floor pairs are counted, not reported
- [ ] Threshold boundary flips: similarity just above/below a threshold changes the classification deterministically; invalid threshold values fail cleanly (SPEC_FAILED, exit 1)
- [ ] Report-only: an fs snapshot before/after a run is byte-identical (unit + e2e)
- [ ] `--json` envelope matches the contract above; missing/empty `docs/specs` fails cleanly (SPEC_FAILED, exit 1)
- [ ] Thresholds documented in `--help`, README and this spec; validated against the ArggonStores-am corpus known outcome (1 diverging duplicate + 6 consolidations among ~130 healthy)
