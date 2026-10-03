---
type: bug
status: todo
id: bug-mcp-parity-branch-test-json-parse-of-human-stdout
title: "mcp-parity \"branch checks out identically\" test JSON.parses a CLI line that can be the human \"arggon branch …\" success message, not the --json envelope"
parent: methodology-improvements
labels: [tests, mcp, ci-blocking]
priority: p1
created: "2026-10-02"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-mcp-parity-branch-test-json-parse-of-human-stdout.md
  Leaves live only under a story. id is the filename stem: bug-mcp-parity-branch-test-json-parse-of-human-stdout.
  CLI `arggon create bug mcp-parity-branch-test-json-parse-of-human-stdout` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# mcp-parity "branch checks out identically" test JSON.parses a CLI line that can be the human "arggon branch …" success message, not the --json envelope

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] The test parses the JSON envelope robustly (find the envelope in stdout, or assert both surfaces are JSON-only in this mode) so a human success line cannot produce a bare `SyntaxError`
- [ ] A failing assertion names WHICH surface produced the bad output (CLI vs MCP) and echoes the raw text, so the next occurrence is diagnosable in one read
- [ ] The test still asserts real parity — do not weaken it into "both parse somehow"; a genuine CLI/MCP divergence must still fail
- [ ] The fix is in the test/harness (the reader), not a change to `arggon branch` output, unless the human line is genuinely wrong for `--json` mode — if so, file that separately

## Notes

### handoff 2026-10-03 @ses_f0012889dffeCYbPnHJZ04IJ3Y (session: ses_f0012889dffeCYbPnHJZ04IJ3Y) — next: Review PR #612; the spawn-under-load trigger itself is the known flake (bug-cli-spawn-suites-exit-1-flake), this PR only fixes the reader.
- branch: main
- open questions: cascade.test.ts spawnJson null-on-empty-stdout + `void err;` is a SEPARATE defect; file it? Suggested: use shared SpawnHarnessError/readEnvelope classification.
