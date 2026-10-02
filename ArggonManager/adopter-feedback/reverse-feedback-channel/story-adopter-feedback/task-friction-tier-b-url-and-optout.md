---
type: task
status: todo
id: task-friction-tier-b-url-and-optout
title: Tier B prefilled publish URL and the friction opt-out keys
parent: story-adopter-feedback
labels: [method]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-friction-dedupe-and-report]
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-tier-b-url-and-optout.md
  Leaves live only under a story. id is the filename stem: task-friction-tier-b-url-and-optout.
  CLI `arggon create task friction-tier-b-url-and-optout` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tier B prefilled publish URL and the friction opt-out keys

## Context

Plan task T4 for [spec-friction-capture-017](../../../docs/specs/spec-friction-capture-017.md).

Tier B is the load-bearing piece of the whole design: it is what lets the
recommended channel exist **without** violating `docs/agents.md` §0 ("Do not open
new GitHub issues"). The agent's job ends at emitting a prefilled URL; a human
clicks submit. `ce-ai#426`'s tiered output dissolves the auth objection the same
way — no `gh`, no token.

Convergent evidence: `mastepanoski/ce-ai#426` (shipped),
`chriscase/ContextDesk#325` (shipped), `jedbjorn/subfloor#543` (published the
architecture, declined the automation).

**No YAML front matter** in the body: GitHub Issue Forms parse query params, and
no surveyed project parses front matter out of an issue body — front matter is a
file-format convention for in-tree Markdown, not a GitHub issue convention. The
machine-readable part is a fenced `arggon-fingerprint` block plus a stable title
prefix so a later `gh issue list --search` finds it.

Opt-out semantics are the ADR 0020 §3 ruling and are easy to get wrong: the keys
gate **capture**, never **discoverability**.

## Acceptance

- [ ] `--tier a` (default) prints the report only and works with no `gh` on `PATH`, no token and no network (test with `PATH` stripped).
- [ ] `--tier b` additionally prints `https://github.com/Arggon/ArggonManager/issues/new?title=…&body=…&labels=adopter-friction`.
- [ ] The URL's `title` starts `[adopter-friction] ` and is ≤120 chars after the prefix.
- [ ] The URL's `body` is human-readable markdown ending in a fenced `arggon-fingerprint` block carrying the fingerprint and the stable fields; it contains **no YAML front matter** (test asserts).
- [ ] No tier auto-submits; no code path writes to GitHub. (Non-goal, ADR 0020 §4.)
- [ ] `x-friction: false` in `ArggonManager/.convention.yml` → records are not written, `--report` renders empty with `optedOut: true`, exit 0 (test).
- [ ] `ARGGON_NO_FRICTION=1` → same (test).
- [ ] Opting out does **not** remove the trigger text from generated agent files and does not make the command undiscoverable — asserted by a test that the agent-file carrier is untouched by the opt-out.
- [ ] An unknown nested key inside `x-friction` is ignored (extension policy); a scalar `x-friction` is a parse error (test both).
- [ ] `arggon friction --clear` removes the whole log, is idempotent on an empty or missing file, and reports `cleared: 0` rather than an error.
- [ ] `--report` and `--clear` are mutually exclusive with a capture position, and the conflict is a named error.
