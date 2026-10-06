---
type: task
status: todo
id: task-friction-redaction-at-write
title: Redact friction records at write time (never at render)
parent: story-adopter-feedback
labels: [method]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-friction-capture-command]
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-redaction-at-write.md
  Leaves live only under a story. id is the filename stem: task-friction-redaction-at-write.
  CLI `arggon create task friction-redaction-at-write` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Redact friction records at write time (never at render)

## Context

Plan task T2 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md).

Redaction runs in the **capture** path, not the render path, so no unredacted
byte ever exists on disk to leak from a later bug or a later `--report` bug. The
pixel-leak-class argument in
[exploration-adopter-feedback-channel-024](../../../docs/explorations/exploration-adopter-feedback-channel-024.md)
is structural (redact before render; whitelist capture), not incident-proven —
so the property has to come from the data flow, not from careful rendering.

Order matters: cross-OS path normalization first (one canonical placeholder), then
secret shapes, then URLs, longest-first and children before parents. Cross-OS
normalization is first because `C:\Users\a\b`, `c:/Users/a/b`,
`\\?\C:\Users\a\b` and `/c/Users/a/b` are the same path and a per-form regex pass
misses variants.

## Acceptance

- [ ] Redaction is applied on the write path; the persisted line and the `--report` output are byte-identical in their non-placeholder content.
- [ ] `-----BEGIN … PRIVATE KEY-----` blocks are replaced whole.
- [ ] `gh[pousr]_…`, `sk-…`, `npm_…`, `AKIA…`, JWTs and `key|token|secret|password|passwd|credential=<8+ chars>` assignments are replaced.
- [ ] URLs keep the host; query and fragment are dropped.
- [ ] `C:\Users\a\b`, `c:/Users/a/b`, `\\?\C:\Users\a\b`, `/c/Users/a/b` and `/private/var/folders/x` collapse to one placeholder (tests for every form).
- [ ] A child path is replaced before its parent, so a replaced parent cannot orphan a leaked child (test).
- [ ] At most 20 substitutions per field; a field whose redaction rate exceeds 50% is replaced wholesale with `[redacted: >50% of field]`.
- [ ] The end-to-end path is covered: `arggon friction --evidence <file>` persists a redacted `--evidence` value (test with a file containing a private key and an absolute path).
- [ ] `--error` values and `commandShape` are redacted through the same pass (a token can arrive in argv).
- [ ] **Non-goal honored:** no "capture everything and scrub later" path exists — only the whitelisted fields are ever persisted.
