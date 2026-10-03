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

### Added while working

- [x] Sweep the whole parity file for the same fragility: the 3 remaining bare `JSON.parse(cliProc.stdout)` sites (the validate-failure, report-`--since` and errors-match arms) now read through `readCli(..., false)`; every comparison goes through `expectSameEnvelope`, which names both sides and echoes both payloads
- [x] The MCP transport read treats the first `data` chunk as a whole frame (`output.on("data", …) => JSON.parse(chunk)`) — a `tools/list` response spanning two chunks would hand it a truncated frame. Now accumulates to a newline, per the newline-delimited JSON-RPC contract (ADR 0014)
- [x] Keep the JSON-only `--json` contract asserted on both surfaces (`expectJsonOnly`) so the locate-the-envelope fallback cannot absorb a product that prints a success line in `--json` mode

## Notes

**Product change: none.** Acceptance box 4 was checked after verifying the CLI's
`--json` path, not assumed — the human line is genuinely not wrong for `--json`
mode, so there is nothing to file separately.

**Where the fix lives.** `readEnvelope` + `EnvelopeReadError` in
cli/src/test-spawn.ts (the repo's existing shared harness-helper module, already
the home of `classifySpawnFailure`/`SpawnHarnessError` and their pinning tests),
consumed by cli/src/mcp-parity.test.ts. `readEnvelope` parses the whole text
first (the contract), then LOCATES the envelope object in surrounding text, and
otherwise raises with surface, command, `isError`, stdout and stderr attached. It
locates and never invents: text containing no JSON object still raises, so a
surface that produced no result cannot read as a passing parity run.

**Not weakened.** Parity is still envelope equality. Malformed envelopes still
raise. A genuine divergence still fails — the new
`a surface that emitted no envelope fails by name, and a real divergence still
fails parity` case asserts both halves: a dead spawn raises `EnvelopeReadError`
naming `MCP`/`arggon_branch`/`isError: true`, and two surfaces that both emit
envelopes but disagree fail `expectSameEnvelope` with "envelope mismatch".

**The `cascade.test.ts` sibling (PR #611) is a SEPARATE defect — not fixed
here.** Evidence: `spawnJson` (cli/src/cascade.test.ts:556-573) resolves `null`
on EMPTY stdout and `void err;` discards stderr entirely, so `round 0: null` is
"the child produced no output", not a lost update. An `update --json` failure
still writes an `ok:false` envelope to stdout, so a null can only mean the child
never got that far — a spawn/load failure. That is the same underlying trigger
as this item's, but a DIFFERENT symptom class and a different assertion (a bare
`toMatchObject` on a possibly-`null` value, with no producer named), in a
different helper. Same rule, same fix shape, different file — so it is reported
to the coordinator rather than folded in. Note its `expect(flip, \`round
${round}: …\`)`DOES carry a message, which is why that failure was already
readable in one line; the gap there is the discarded stderr, not the assertion.
Recommend filing:`cascade.test.ts`spawnJson resolves null on empty stdout and
discards stderr, so a spawn-lane failure reads as "null" instead of its cause —
it should use the shared`SpawnHarnessError`/`readEnvelope` classification.

**Evidence (expected vs observed).**

| Probe                                                                              | Expected                | Observed                                                                |
| ---------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Repro probe, dead `cliSpawn`                                                       | CI `SyntaxError` string | `Unexpected token 'a', "arggon bra"... is not valid JSON` — exact match |
| Parity suite ×20, pre-fix                                                          | intermittent failure    | 20/20 pass (cannot reproduce the flake in isolation)                    |
| Parity branch+cleanup ×20, post-fix                                                | 0 failures              | 20/20 pass                                                              |
| `mcp-parity.test.ts` ×3 post-fix                                                   | 0 failures              | 18 passed each                                                          |
| `cascade.test.ts` sibling ×20                                                      | to characterise         | 20/20 pass (flake not reproducible in isolation)                        |
| Full `npm test` ×3 (post-rebase)                                                   | 0 failures              | 122 files / 2286 tests passed, 3/3                                      |
| `npm run lint` / `validate` / `check:plugin` / `test:structure` / `lint:structure` | clean                   | all clean (build ran first)                                             |

Pre-fix flake NOT reproduced in 20 isolated iterations — reported as such rather
than claimed as fixed-by-construction. What IS pinned is the diagnosability: the
old symptom is now a regression case.



### 2026-10-03 @Arggon
Evidence — bug-mcp-parity-branch-test-json-parse-of-human-stdout (PR #612)

## Root cause reproduced: the text was NOT a human success line

The item title guessed that `arggon branch …` printed its human line ahead of the
envelope. It does not, and I verified rather than assumed: `branch`/`cleanup` gate
their whole stdout on `jsonEnabled` (cli/src/cli.ts:2250-2283, 2544-2621) and
`runBranch`'s git calls all pipe stdout (cli/src/branch.ts:43-55).

It was the MCP server's own tool-LEVEL error sentence: `spawnedOutcome`
(mcp-server.ts:905-935) throws `arggon <command> did not emit a JSON envelope
(<why>): <stderr>` when the spawned child emits nothing parsable, `dispatch`'s
catch makes that `isError: true` + the sentence as text, and `mcpCall` ran
`JSON.parse` on it at line 72 — before the caller could read `isError`.

Probe (throwaway test, deleted; dead `cliSpawn` entry):
  expected: the CI SyntaxError string
  observed: "arggon branch did not emit a JSON envelope (exit code 1): …"
            JSON.parse -> Unexpected token 'a', "arggon bra"... is not valid JSON
            => byte-exact match with CI. `"arggon cle"` is the same shape.
No product change; the CLI's --json path is correct.

## Gates (cwd = this worktree; `npm run build` ran first)

| Command | Expected | Observed |
| --- | --- | --- |
| `npm run build` | clean | clean |
| `npm test` x3 | 0 failures | 122 files / 2286 tests passed, 3/3 |
| `npm run lint` | clean | clean |
| `npm run arggon -- validate` | ok | ok (0 warnings, convention v5) |
| `npm run check:plugin` | no diff | no diff |
| `npm run test:structure` | pass | 3 passed, 0 failed |
| `npm run lint:structure` | clean | clean |

## Flake reproduction: attempted, NOT achieved

| Probe | Expected | Observed |
| --- | --- | --- |
| parity branch+cleanup x20, PRE-fix | intermittent | 20/20 pass |
| parity branch+cleanup x20, POST-fix | 0 failures | 20/20 pass |
| `mcp-parity.test.ts` x3, post-fix | 0 failures | 18 passed each |
| `cascade.test.ts` sibling x20 | characterise | 20/20 pass |

The pre-fix flake did not reproduce in 20 isolated iterations (it fired under
full-suite CI load), so I am NOT claiming it fixed-by-construction. What is pinned
is the diagnosability: the old symptom is a regression case that now fails with
the surface, command, isError flag and raw text attached.

## PR #611 sibling — SEPARATE defect, reported not fixed

`cascade.test.ts` `spawnJson` (lines 556-573) resolves `null` on EMPTY stdout and
discards stderr via `void err;`. Since `update --json` still writes an `ok:false`
envelope on failure, a `null` can only mean the child never produced one — a
spawn/load failure, not a lost update. Same trigger as this item, different
symptom class and different helper, so not folded in. Suggest filing:
"cascade.test.ts spawnJson resolves null on empty stdout and discards stderr, so
a spawn-lane failure reads as `null` instead of its cause — use the shared
SpawnHarnessError/readEnvelope classification."

## Notes

- `readEnvelope`/`EnvelopeReadError` live in cli/src/test-spawn.ts, the existing
  shared harness module (already home to classifySpawnFailure/SpawnHarnessError).
- Parity NOT weakened: envelopes must still be equal, malformed envelopes still
  raise, and `expectJsonOnly` asserts the strict --json JSON-only contract on both
  surfaces so the locate-the-envelope fallback cannot absorb a product printing a
  success line in --json mode.
- Also hardened in the sweep: the MCP transport read treated the first `data`
  chunk as a whole frame, so a tools/list response spanning two chunks would have
  fed JSON.parse a truncated frame; it now accumulates to a newline (ADR 0014).

