---
spec_id: priority-field-008
title: priority field: schema v4 on all item types
status: implemented
created: 2026-09-17
depends_on:
  - exploration-priority-model-008 (decision c + ranking i, item A)
---

# Spec: priority field: schema v4 on all item types (priority-field-008)

## Purpose

Priorities exist today only as a label convention (`labels: [p2]`) with no schema
meaning: any string passes, nothing validates, and `next` cannot see them
(41 of the tracker's items carry a pN label; 149 carry none). Per
[exploration-priority-model-008](../explorations/exploration-priority-model-008.md)
(decision c, item A), this spec first-classes an optional `priority` field on
ALL five item types (initiative, epic, story, task, bug) as **convention v4**,
with validate coverage, create/update flags, a `priority:` filter field, a
board chip, additive JSON payloads, and a one-shot `arggon priority migrate`
that moves the existing label convention into the field.

Ranking changes are OUT of scope: `next` is untouched here and consumes the
field in the follow-up item (task-next-priority-ranking). Judgment priority
(orchestrator: how important?) and flow ordering (downstream weight) stay
orthogonal by design.

## Synopsis

```bash
# Frontmatter (v4, all types) — optional, absent = unprioritized
priority: p1              # enum: p0 | p1 | p2 | p3 (lowercase)

# Flags
arggon create task "Fix login" --parent story-x --priority p1
arggon update task-fix-login --priority p2
arggon update task-fix-login --priority ""     # empty value CLEARS the field

# Filter (composes and negates like every other field)
arggon list --filter "status:todo priority:p1"
arggon list --filter "priority:none"           # the orchestrator's unprioritized worklist
arggon list --filter "!priority:p0"

# One-shot migration of the label convention into the field
arggon priority migrate [--dry-run] [--json]
```

## Design

### Field semantics (convention v4)

- `priority` is OPTIONAL on every type. Absent (or `null`) = unprioritized —
  the field is never defaulted: `create` without `--priority` writes nothing,
  and nothing anywhere backfills a default.
- Value set: `p0 | p1 | p2 | p3`, lowercase, exact (p0 = drop everything …
  p3 = lowest). Anything else is a validate error.
- `CONVENTION_VERSION` bumps 3 → 4 (the v1/v2/v3 precedent: each official
  field bumps the version and `init` scaffolds new trees at it). The field
  itself is **additive** and version-gate-free: exactly like `depends_on` in
  v3, `priority` parses and validates on EVERY tree version — a v0–v3 tree
  that adopts the field early keeps validating, and trees without it are
  unaffected. `validate` still rejects only trees with a version NEWER than
  supported, so v4 trees stay readable by this CLI and v3 trees stay valid.

### Validate rule

| Code               | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| `PRIORITY_INVALID` | `priority` present but not exactly one of `p0`,`p1`,`p2`,`p3` |

- `priority` leaves the "reserved for later" key list (`order`/`rank`,
  `blocked_by`, `estimate` stay reserved) and becomes an official key, so it
  no longer warns as `UNKNOWN_KEY` either.
- The rule is additive and runs regardless of tree version (no v3/v4 gate —
  the `depends_on` precedent). Uppercase (`P1`), numeric (`3`), and unknown
  tokens all fail with `PRIORITY_INVALID`.

### Flags (create/update)

- `create <type> <title> --priority pN` records the field at creation. An
  empty value is treated as "not requested" (create has nothing to clear).
- `update <id> --priority pN` sets it (only a change writes/commits, like
  every other field); `update <id> --priority ""` CLEARS it (the key is
  removed from the frontmatter — absent, not empty).
- Values are validated at the kernel boundary (`PRIORITY` enum); malformed
  values fail before anything is written.
- `--json` payloads are additive within `schemaVersion: 1`: the `WorkItem`
  contract gains `priority: string | null` on `create`, `update`, `show`,
  `list`, and every other payload that embeds a WorkItem. Absent =
  `null` in the full shape; the compact ADR 0006 default omits the key
  (same treatment as `milestone`/`issue`). `--full` restores it.

### Filter field

- `FILTER_FIELDS` gains `priority`. `priority:p1` is an exact enum match;
  `priority:none` matches UNSET items (the unprioritized worklist);
  `!` negation composes (`!priority:p1` = everything not exactly p1,
  including unset items).
- `list` validates predicate values: an unknown priority token (anything
  except `none` and the enum) fails with `LIST_FAILED`.

### Migration — `arggon priority migrate`

- Scans every item under `tasks/` (all five types). An item participates when
  its `labels` list contains a token matching `^p[0-9]$` (exactly one digit —
  `p10`, `p2x`, `P2` are left alone).
- For each participating item the destination value is the HIGHEST priority
  found among its pN labels (lowest number: labels `[p2, p3]` → `p2`).
- ALL pN labels are removed from the label list; non-priority labels ride
  along untouched (labels stay a generic mechanism).
- Field-absent items get `priority` written from the label; items that
  ALREADY carry an explicit `priority` keep it (an explicit field set via
  create/update wins over the legacy label — the label is still removed) and
  the entry reports the conflict. This keeps a deliberate field value from
  being clobbered by stale labels.
- Writes are atomic per item (temp file + rename, shrink-guarded — same
  writer as generated docs) and bump `updated` like every other frontmatter
  mutation.
- **No auto-commit, by decision.** Unlike `create`/`update`, migrate never
  commits — not per item, not once. A bulk rewrite is a planning act the
  caller should review (`git diff`) and land as ONE explicit commit; this
  mirrors `adopt --ack`, which writes state without committing. (Per-item
  auto-commit would spray 41 `chore(tasks)` commits into the history.)
- `--dry-run` writes nothing and prints/plans exactly what a real run would
  change (same entry list). `--json` is additive:
  `{ dryRun, scanned, changed, entries: [{ id, type, path, priority, labelsRemoved, prioritySource, previousPriority? }] }`
  with `prioritySource: "label" | "kept-explicit"`. Human output lists one line
  per changed item. Failures use `error.code: "PRIORITY_FAILED"`.
- Idempotent: after a run no item carries a pN label, so a second run scans,
  finds zero participants, and changes nothing.

### Board chip

Cards with a `priority` render a small chip next to the type badge in the
card head (`p0`–`p3`, per-level accent color, HTML-escaped); unprioritized
cards render byte-identical to before (additive-only change to the static
render).

## Acceptance

- [ ] `priority` parses/serializes on all five types; absent stays absent (no default ever written)
- [ ] validate errors with `PRIORITY_INVALID` on unknown values (any tree version); valid values pass on v0–v4 trees
- [ ] `create --priority p1` and `update --priority p2` work; `--priority ""` clears; `--json` payloads carry `priority` (null when absent, omitted in compact)
- [ ] filter: `priority:p1` exact, `priority:none` matches unset, `!priority:p1` negation — all tested
- [ ] `arggon priority migrate` moves pN labels to the field (highest = lowest number), removes ALL pN labels, keeps explicit fields, idempotent, `--dry-run` writes nothing, `--json` additive, never auto-commits
- [ ] board renders a priority chip on prioritized cards; unprioritized output unchanged
- [ ] ArggonManager/docs/convention.md v4 section, ArggonManager/docs/json-output.md payloads, README workflow docs; SKILL generated region gains `priority migrate` (`npm run skills:sync`)
- [ ] gates: validate ok, suite green, lint/build clean, doctor 0 modified / 0 drifted
