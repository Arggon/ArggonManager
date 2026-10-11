---
type: task
status: done
id: task-friction-fingerprint-separator-not-length-prefixed
title: "The friction fingerprint separator is not length-prefixed: a crafted `--command` containing U+001F can forge another tuple's digest — spec decision owed (length prefix or domain separation)"
assignee: arggon-delivery-lead
branch: feat/task-friction-fingerprint-separator-not-length-prefixed
parent: story-adopter-feedback
labels: [method, spec]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-fingerprint-separator-not-length-prefixed.md
  Leaves live only under a story. id is the filename stem: task-friction-fingerprint-separator-not-length-prefixed.
  CLI `arggon create task friction-fingerprint-separator-not-length-prefixed` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The friction fingerprint separator is not length-prefixed: a crafted `--command` containing U+001F can forge another tuple's digest — spec decision owed (length prefix or domain separation)

## Context

`spec-friction-capture-020` mandated a separator-joined fingerprint pre-image,
which is ambiguous by construction: a crafted `--command` could forge another
tuple's digest in the one field the whole dedupe design leans on. Full context,
the bounded impact and the accept/reject reasoning live in the filing comment
below (`### 2026-10-11 @arggon-delivery-lead — context + acceptance`).

## Acceptance

- [x] The formula fix is decided and recorded — **length-prefix each component** (Option A) — in `spec-friction-capture-020` §Fingerprint discipline (the normative source) and in `lib/src/friction.ts`
- [x] The decision is reflected in the T1 implementation (`frictionFingerprint`), and its recorded-boundary test is replaced by a property test — same change, naming `task-friction-capture-command` (PR #695) and this item
- [x] A test demonstrates the chosen property: two tuples whose components could collide under plain concatenation produce different fingerprints (`lib/src/friction.test.ts`)
- [x] Backward compatibility addressed with the reason recorded: `v` stays `1`, the reader keeps reading pre-amendment lines and groups by the fingerprint each line carries (recorded in the spec §Fingerprint discipline and in the reader test)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green (plus `arggon validate`)

## Notes

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Filed from the T1 maker's report (PR #695): `spec-friction-capture-020` mandates `fingerprint = sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ "\x1f" ‖ harness ‖ "\x1f" ‖ majorVersion)`. U+001F stops the ORDINARY collision, but a crafted `--command` whose text itself contains U+001F can forge a different tuple's digest — the separator is not length-prefixed, so the concatenation is ambiguous. The maker implemented the spec formula verbatim and wrote a test that RECORDS the boundary rather than asserting a property the formula does not have.

**Impact, honestly bounded:** this is not a security boundary — an attacker gains nothing except mis-grouped friction records (dedupe noise on the shared local log; the log is never published raw — redaction (T3) and the human-gated publish path sit downstream). But it is a real correctness gap in the one field the whole dedupe design leans on, and the spec is the wrong place to be quietly ambiguous about it.

**Why it is its own item, not a T1 commit:** the change is a SPEC amendment (the formula is normative spec text), and T1's acceptance is "implements the spec's table and formula". Tightening the formula belongs here, with the maker of T2 (dedupe/report) as the natural consumer of the decision.

Acceptance:

- [x] Decide and record the formula fix: length-prefix each component, or domain-separate (e.g. `sha256("v1|" + ...)` with explicit component boundaries), or record an explicit "keep verbatim formula; accepted ambiguity — <reason>" decision
- [x] The decision is recorded in `spec-friction-capture-020` (the normative source) AND reflected in the T1 implementation + its recorded-boundary test, in the SAME change or a follow-up PR that names both items
- [x] A test demonstrates the chosen property: two tuples whose components could collide under plain concatenation produce different fingerprints (for the length-prefix/domain-separation options)
- [x] Backward compatibility addressed: existing log lines carry `v: 1` fingerprints under the old formula — either the reader continues to read them (grouping across the change degrades gracefully) or the record version bumps with a documented reason
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green

### 2026-10-11 @arggon-maker

Maker evidence for task-friction-fingerprint-separator-not-length-prefixed. This change also amends the recorded-boundary test that `task-friction-capture-command` (T1, PR #695) shipped, so it names both items.

**Decision: Option A — length-prefix each component.**

Rationale, including why the alternatives lost:

- **Option B (domain separation) names the same guarantee**, so it is one mechanism rather than two: a structured encoding "with explicit component boundaries" is what a length prefix already produces. And there is exactly one derivation over this material — `reporterId` hashes a different tuple, and no second fingerprint derivation exists yet — so a domain tag would guard against a collision that does not exist.
- **Option C (keep the verbatim formula) is rejected**: the boundary would stay recorded-in-a-test rather than fixed, and an accepted ambiguity should be a decision this spec makes out loud, not one it inherits from a sentence nobody re-read.

**Spec text, before → after** (`ArggonManager/docs/specs/spec-friction-capture-020.md`, the normative source).

Before (§The record table row, and the formula it pointed at):

    fingerprint = sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ "\x1f" ‖ harness ‖ "\x1f" ‖ majorVersion)

After (table row + new §Fingerprint discipline → "The formula is length-prefixed (amended 2026-10-11)"):

    each component encoded as <len>:<value>, len in UTF-16 code units — the unit the caps
    truncate in, so the prefix describes the value that is actually hashed rather than an
    estimate of it; an absent errorCode hashes as the empty string, which encodes as 0:
    the four encodings concatenated with no separator

    fingerprint = sha256( len(commandShape)+":"+commandShape
                        + len(errorCode)+":"+errorCode
                        + len(harness)+":"+harness
                        + len(majorVersion)+":"+majorVersion )

Why: a separator delimits by VALUE, so `(a, U+001F‖b, c, d)` and `(a‖U+001F, b, c, d)` produce byte-identical material — the forge a crafted `--command` needed. A length prefix delimits by COUNT, so the parse of an encoded string is deterministic (read the digits, consume exactly that many characters) and no second tuple can encode to the same pre-image. Injective over tuples: only a hash collision can still merge two classes, which is the honest residual boundary of a digest truncated to 16 hex chars.

**Implementation** (`lib/src/friction.ts`): new exported `frictionFingerprintMaterial` (exported so the property can be asserted on the pre-image itself, exactly, with no truncation in the way) + `frictionFingerprint` hashing it. `frictionReporterId` is deliberately unchanged: its salt is fixed-width (exactly 64 hex chars, enforced by `SALT_HEX`), so where the salt ends and the path begins was never in doubt. That reasoning is now a comment on it rather than an accident.

**Tests** (`lib/src/friction.test.ts` — the boundary-RECORDING test is replaced by tests that ASSERT the property):

1. `cannot be forged: a crafted component cannot shift a field boundary` — the old collision pair `("a\u001fb","c")` vs `("a","b\u001fc")` now differs, AND the test first asserts that pair really is byte-identical under the old separator encoding, so the property is about that ambiguity rather than about two arbitrary inputs.
2. `is injective over tuples wherever the boundary moves (property)` — a seeded fast-check property through `test/property-runner.ts` (25 runs, seed 20260928, the shared bounded/seeded policy): generated (head, tail, harness, version); the boundary-injected tuple and the boundary-shifted tuple must never share a digest. Never vacuous — the two commandShapes always differ.
3. `encodes every component unambiguously (exhaustive over the adversarial alphabet)` — every 4-tuple over `{"", "a", U+001F, "a\u001f"}` (4^4 = 256 tuples) yields its own pre-image AND its own digest.
4. `keeps the separator's ASCII neighbours from shifting a boundary` — the realistic case a separator also had right (space, dash) plus a length-looking component (`3:abc`) that must stay data and never become a boundary marker.
5. Reader: `reads a v:1 line written under the pre-amendment fingerprint formula` — the compatibility decision below, asserted end to end.

**Backward compatibility: `v` stays `1`, deliberately (reason recorded in the spec and in the test).** A record's `v` answers "can this reader parse this line", NOT "does this line carry the fingerprint formula I compute now". Bumping to `2` would make an upgraded `arggon` **skip** every `v: 1` line the adopter already recorded — the reader's documented behaviour for an unknown `v` — destroying a local history that is cache-like and cheap to re-earn, to fix a grouping ambiguity the bump does not fix either (two logs written either side of the change would still split the class). Staying at `1` degrades honestly instead: the reader never recomputes a fingerprint, it groups by the one each line carries, so a log spanning the change shows one class as two rows (a count split, never a wrong merge) and rotation ages the old-formula lines out within the 5000-line bound.

**Gates** — declared order, all from the worktree:

- `npm run build` — expected exit 0, observed exit 0 (lib + cli + typecheck + e2e; postbuild regenerated `opencode/plugins/arggon/index.bundle.ts`, committed with this change).
- `npm test` — expected all suites green, observed 136 files / 2971 tests passed (was 2945; `lib/src/friction.test.ts` 46 → 68).
- `npm run check:plugin` — expected no diff, observed exit 0 after committing the regenerated bundle.
- `npm run lint` — expected clean, observed exit 0.
- `npm run arggon -- validate` — expected ok, observed `ok (0 warning(s), convention v5)`.

**Scope:** the spec (table row + new subsection) and the item's acceptance boxes, `lib/src/friction.ts`, `lib/src/friction.test.ts`, one export line in `lib/src/index.ts`, the regenerated plugin bundle. The report renderer (T2, `task-friction-dedupe-and-report`), the redaction rules (merged), the MCP surface / `json-output.md` (T5) and the baseline JSONs are untouched.

**Impact class: behavioral** — a derived field changes value for identical inputs. The record schema, the caps, the reader contract and the `v` discipline do not change.

### handoff 2026-10-11 @arggon-maker — next: Review and merge PR #704 (length-prefixed fingerprint pre-image): confirm the recorded decision in spec-friction-capture-020, then unblock T2 task-friction-dedupe-and-report.

- branch: feat/task-friction-fingerprint-separator-not-length-prefixed
- open questions: Does the reviewer want the exhaustive adversarial-alphabet check moved into a *.property.test.ts file, or is it fine in friction.test.ts? Should a pre-amendment fingerprint ever be re-derived for com…
- [x] Decide and record the formula fix: length-prefix each component, or domain-separate (e.g. `sha256("v1|" + ...)` with explicit component boundaries), or record an explicit "keep verbatim formula; accepted ambiguity — <reason>" decision
- [x] The decision is recorded in `spec-friction-capture-020` (the normative source) AND reflected in the T1 implementation + its recorded-boundary test, in the SAME change or a follow-up PR that names both items
- [x] A test demonstrates the chosen property: two tuples whose components could collide under plain concatenation produce different fingerprints (for the length-prefix/domain-separation options)
- [x] Backward compatibility addressed: existing log lines carry `v: 1` fingerprints under the old formula — either the reader continues to read them (grouping across the change degrades gracefully) or the record version bumps with a documented reason
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge (PR #704)

Reviewed against engineering.md §Review bar: the decision (length-prefix, Option A) is argued, not asserted — a separator delimits by value (the exact forge), a length prefix delimits by count; Option B is shown to name the same guarantee and C is rejected on the record. The spec (the normative source) is amended with the old formula kept verbatim, the new encoding, the ambiguity argument and the rejected alternatives — documentation travels with the behavior change, and the impact class (behavioral) is stated in the PR. Evidence travels: the boundary-recording test became a real property test that first asserts the old pair really is byte-identical under the old encoding (so the property is about that ambiguity), plus an exhaustive 4-alphabet 256-tuple check and a fast-check injectivity run; the backward-compatibility decision (v stays 1; the reader never recomputes — a log spanning the change shows one class as two rows, a count split, never a wrong merge) is recorded in the spec and asserted end-to-end in the reader test. Scope stayed on the item. Gates + CI green. Confirmed: the depends_on edge and the done flips riding this PR are my intended tracker state.
