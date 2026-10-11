---
type: task
status: in_progress
id: task-friction-redaction-at-write
title: Redact friction records at write time (never at render)
assignee: arggon-delivery-lead
branch: feat/task-friction-redaction-at-write
parent: story-adopter-feedback
labels: [method]
priority: p1
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:28:35.044Z"
depends_on: [task-friction-capture-command]
worktree_path: /home/arggon/Projects/ArggonManager-task-friction-redaction-at-write
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

- [x] Redaction is applied on the write path; the persisted line and the `--report` output are byte-identical in their non-placeholder content.
- [x] `-----BEGIN … PRIVATE KEY-----` blocks are replaced whole.
- [x] `gh[pousr]_…`, `sk-…`, `npm_…`, `AKIA…`, JWTs and `key|token|secret|password|passwd|credential=<8+ chars>` assignments are replaced.
- [x] URLs keep the host; query and fragment are dropped.
- [x] `C:\Users\a\b`, `c:/Users/a/b`, `\\?\C:\Users\a\b`, `/c/Users/a/b` and `/private/var/folders/x` collapse to one placeholder (tests for every form).
- [x] A child path is replaced before its parent, so a replaced parent cannot orphan a leaked child (test).
- [x] At most 20 substitutions per field; a field whose redaction rate exceeds 50% is replaced wholesale with `[redacted: >50% of field]`.
- [x] The end-to-end path is covered: `arggon friction --evidence <file>` persists a redacted `--evidence` value (test with a file containing a private key and an absolute path).
- [x] `--error` values and `commandShape` are redacted through the same pass (a token can arrive in argv).
- [x] **Non-goal honored:** no "capture everything and scrub later" path exists — only the whitelisted fields are ever persisted.

### 2026-10-11 @Arggon
Maker evidence for task-friction-redaction-at-write (PR #701).

Run: build → test → check:plugin → lint → validate, all from the worktree.
Expected vs observed:

- npm run build — expected dist/cli.js emitted, observed exit 0 (lib + cli + typecheck + e2e, postbuild regenerated the plugin bundle).
- npm test — expected all suites green, observed 136 files / 2945 tests passed (lib/src/friction.test.ts: 46 → 64; cli/src/friction.test.ts unchanged at 15).
- npm run check:plugin — expected no diff, observed exit 0 after committing the regenerated bundle.
- npm run lint — expected clean, observed exit 0.
- npm run arggon -- validate — expected ok, observed "ok (0 warning(s), convention v5)".

Before/after on a hostile capture (observation with a ghp_ token, a Windows home path, a whole PEM block and a URL carrying sk- in the query; evidence file with a POSIX path and an apiKey assignment):

BEFORE (T1 write path, verbatim):
  narrative <raw input above>
  evidence  <raw file contents>
AFTER (this change, the persisted line):
  narrative "…the CLI rejected <redacted> when starting <path> and printed a full key block: <redacted>\nthen it tried https://github.com/Arggon/ArggonManager/issues/new and after that…"
  evidence  "Traceback (most recent call last):\n  File \"<path>\", line 1\n<redacted>\nValueError: boom"
Leak scan of the persisted line: ghp_aaaaaaaa, BEGIN RSA, MIIEowIB, sk-abcdefgh12345678, C:\Users\adopter, abcdef1234567890 — all absent. The narrative prose and the report-useful signal (Traceback/PermissionError) survive.

Negative/adversarial coverage: a crafted narrative (JWT + path inside a URL query, a PEM block, a quoted multi-word passphrase, and a decoy `key: -----BEGIN …` that would let the assignment rule's leftmost match orphan the block body) is covered by the rule set; one-dash-misspelled marker, fullwidth `＝`, zero-width-split token and newline-split name are asserted as recorded boundaries with reasons (see the test file).

Decisions the reviewer should confirm: path placeholders exempt from the 50% rate (a <path> is safe to publish); github_pat_ added to the gh family; quoted multi-word assignment values redacted while unquoted multi-word values stay a recorded boundary; PEM shapes run as their own pass before token/assignment shapes; redaction before capping; the append re-applies the idempotent pass as a log-level guard. All are commented in lib/src/friction.ts and listed in the PR description.
