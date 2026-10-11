---
type: task
status: todo
id: task-friction-fingerprint-separator-not-length-prefixed
title: "The friction fingerprint separator is not length-prefixed: a crafted `--command` containing U+001F can forge another tuple's digest — spec decision owed (length prefix or domain separation)"
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

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Filed from the T1 maker's report (PR #695): `spec-friction-capture-020` mandates `fingerprint = sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ "\x1f" ‖ harness ‖ "\x1f" ‖ majorVersion)`. U+001F stops the ORDINARY collision, but a crafted `--command` whose text itself contains U+001F can forge a different tuple's digest — the separator is not length-prefixed, so the concatenation is ambiguous. The maker implemented the spec formula verbatim and wrote a test that RECORDS the boundary rather than asserting a property the formula does not have.

**Impact, honestly bounded:** this is not a security boundary — an attacker gains nothing except mis-grouped friction records (dedupe noise on the shared local log; the log is never published raw — redaction (T3) and the human-gated publish path sit downstream). But it is a real correctness gap in the one field the whole dedupe design leans on, and the spec is the wrong place to be quietly ambiguous about it.

**Why it is its own item, not a T1 commit:** the change is a SPEC amendment (the formula is normative spec text), and T1's acceptance is "implements the spec's table and formula". Tightening the formula belongs here, with the maker of T2 (dedupe/report) as the natural consumer of the decision.

Acceptance:
- [ ] Decide and record the formula fix: length-prefix each component, or domain-separate (e.g. `sha256("v1|" + ...)` with explicit component boundaries), or record an explicit "keep verbatim formula; accepted ambiguity — <reason>" decision
- [ ] The decision is recorded in `spec-friction-capture-020` (the normative source) AND reflected in the T1 implementation + its recorded-boundary test, in the SAME change or a follow-up PR that names both items
- [ ] A test demonstrates the chosen property: two tuples whose components could collide under plain concatenation produce different fingerprints (for the length-prefix/domain-separation options)
- [ ] Backward compatibility addressed: existing log lines carry `v: 1` fingerprints under the old formula — either the reader continues to read them (grouping across the change degrades gracefully) or the record version bumps with a documented reason
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green
