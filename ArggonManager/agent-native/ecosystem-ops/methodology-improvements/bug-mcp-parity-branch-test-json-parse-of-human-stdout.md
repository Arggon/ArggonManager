---
type: bug
status: done
id: bug-mcp-parity-branch-test-json-parse-of-human-stdout
title: "mcp-parity \"branch checks out identically\" test JSON.parses a CLI line that can be the human \"arggon branch …\" success message, not the --json envelope"
assignee: arggon-delivery-lead
parent: methodology-improvements
labels: [tests, mcp, ci-blocking]
priority: p1
created: "2026-10-02"
updated: "2026-10-05"
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

> Ticked by the coordinator at merge; the worker's evidence rows were appended under a `### Added while working` comment header, which the tracker stores as history rather than as this section. Evidence for each box is in the coordinator comment dated 2026-10-03 and in the round-2 reviewer verdict.


- [x] The test parses the JSON envelope robustly (find the envelope in stdout, or assert both surfaces are JSON-only in this mode) so a human success line cannot produce a bare `SyntaxError`
- [x] A failing assertion names WHICH surface produced the bad output (CLI vs MCP) and echoes the raw text, so the next occurrence is diagnosable in one read
- [x] The test still asserts real parity — do not weaken it into "both parse somehow"; a genuine CLI/MCP divergence must still fail
- [x] The fix is in the test/harness (the reader), not a change to `arggon branch` output, unless the human line is genuinely wrong for `--json` mode — if so, file that separately

## Notes

### handoff 2026-10-03 @ses_f0012889dffeCYbPnHJZ04IJ3Y (session: ses_f0012889dffeCYbPnHJZ04IJ3Y) — next: Review PR #612; the spawn-under-load trigger itself is the known flake (bug-cli-spawn-suites-exit-1-flake), this PR only fixes the reader.
- branch: main
- open questions: cascade.test.ts spawnJson null-on-empty-stdout + `void err;` is a SEPARATE defect; file it? Suggested: use shared SpawnHarnessError/readEnvelope classification.

### 2026-10-03 @arggon-reviewer
verdict: approve (findings below are non-blocking; one merge precondition: rebase the duplicate tracker commits off this branch)

## The refutation of the item's premise is correct — verified, not plausible

Read, not assumed:
- `branch --json` gates ALL of stdout on `jsonEnabled` — `successJson` then `return`, catch arm `failJson` then `return` (`cli/src/cli.ts:2250-2283`); `cleanup --json` is the same shape (`cli.ts:2594-2621`, every `console.log` sits below the `if (json) { … return; }`). In `--json` mode those two commands have exactly one writer each (`lib/src/json.ts:75,102,123`).
- `runBranch`'s git runner pipes (`cli/src/branch.ts:45-49`, `stdio: ["ignore","pipe","pipe"]`), so git chatter cannot reach stdout either.
- The real producer: `spawnedOutcome` (`cli/src/mcp-server.ts:905-935`) throws `arggon <command> did not emit a JSON envelope (<why>): <stderr>`; the `tools/call` catch turns that into `{content:[{text: <sentence>}], isError:true}` (`mcp-server.ts:807-814`); the old `mcpCall` parsed that text at line 72, before the caller could read `isError`.
- Byte-exactness of the CI string: I evaluated the two `JSON.parse` failures locally on the two sentences — `Unexpected token 'a', "arggon bra"... is not valid JSON` and `"arggon cle"` — matching the captured CI strings character for character (V8 truncates the snippet at 10 chars, which is what pins `arggon bra`/`arggon cle`). The diagnosis is the only reading of the evidence that produces those exact strings.
- Acceptance box 4 was therefore checked on evidence, not waved through: **no product change is correct**, and there is nothing to file separately.

## Finding 1 [medium — merge precondition, no code change]: the branch carries two duplicate tracker commits that are already on main

`38d7df72` (+133) and `67b2d839` (+33), both `chore(tasks): commented bug-three-acceptance-parsers-diverging`, are the PR #611 reviewer's verdict — and the same text is **already on main** (`main:…/story-spec-pipeline/bug-three-acceptance-parsers-diverging.md` has the 2× `verdict: request-changes` plus a later `verdict: approve`; the item is now `done` with the worker's evidence). So this branch re-adds an older, superseded copy of a verdict on a DONE item.

Action before merge: `git rebase` onto current main so those two commits drop out. If a union is done by hand, **delete** the duplicated reviewer comments — do not union them into the done item (the precedent commit `89b7a31c` did the opposite of what is needed here). No code conflict is expected: main has not touched `cli/src/test-spawn.ts` or `cli/src/mcp-parity.test.ts` (the two-dot and three-dot deltas for both files are identical), so the merge is confined to the tracker files.

Related, out of scope for this PR but worth an item under DoD #6: the reviewer's comment + the coordinator's `handoff` both wrote to the PRIMARY checkout while the work happened in a claimed worktree. The handoff record itself is intact (see finding 5) — the defect is that a tracker write from a coordinator session lands on `main` where a union is needed later.

## Finding 2 [low]: `expectJsonOnly` covers only the two arms that failed

`expectJsonOnly(mcpResult, cliResult)` is called at exactly the two failing paths (branch `:530`, cleanup `:544`) — both surfaces, as required. The other 13 arms lost the accidental strictness they used to get from a bare `JSON.parse(proc.stdout)`: a human line in `--json` mode on `create`/`update`/`list`/`next`/`report`/`validate`/`handoff`/`priority` would now be located and absorbed there.

That hole is smaller than it looks, and I checked rather than assumed: those commands' own suites still bare-parse `--json` stdout (`validate.test.ts`, `report.test.ts`, `handoff.test.ts`, `show.test.ts`, `success-stdout.test.ts`, `row-table-stdout.test.ts`, …), and `docs/json-output.md:3` states the contract. Non-blocking; the cheap completion is one `expectJsonOnly(...)` per arm, or a follow-up item.

## Finding 3 [low]: `readEnvelope`'s brace pass is O(candidates × line length), and the budget bounds candidates, not characters

`ENVELOPE_SCAN_BUDGET` decrements per candidate, but each `balancedObjectSlice` can walk to the end of its line. A child that emitted a single unparsable line with ≥2000 `{` would make the reader do 2000 × line-length work — in the very lane whose failure mode this PR exists to make diagnosable. Bounded in practice: the CLI path is capped by `spawnSync`'s default 1 MB maxBuffer, the MCP path by the server's `clipTail`; the shape needed is contrived. Suggested hardening: charge the budget per character scanned (or cap a candidate slice) so the scan is O(text), plus one pin. Non-blocking.

## Finding 4 [info — follow-up candidate, correctly not merged]: the same reader shape still exists in two sibling suites

`cli/src/mcp-server.test.ts:125` (`textContent`) and `cli/src/mcp-smoke.test.ts:130` both do `JSON.parse(result.content[0]!.text)` without naming the surface or reading `isError` — the same shape as the fixed `mcpCall`. Out of the item's scope (which scoped the sweep to the parity file), and `readEnvelope` is now exported, so each is a one-import follow-up. Per DoD #6 this wants an item rather than a code TODO.

## Finding 5 [info]: the handoff incident lost nothing — the branch carries the record

The coordinator's `tools.arggon.handoff` auto-committed to the primary checkout as `8a21b350`, and `a17b0b4c` wrote the claim frontmatter there too. Diffing `main:` against `HEAD:` for this item file: the branch side is **purely additive** — the `### handoff 2026-10-03 @ses_f0012889…` block appears as UNCHANGED CONTEXT, i.e. byte-identical on both sides — plus the claim frontmatter (`assignee`, `branch`, `claimed_at`, `worktree_path`), the corrected Context, the ticked acceptance, and the worker evidence comment. Nothing from main is missing from the branch. Merge may still need a union on this one file; that is routine.

## Parity is not weakened — and the tests discriminate

- Read assertions, not intent:
  - `readEnvelope` tries whole-text first (`exact:true`), then lines, then balanced-brace candidates (`exact:false`). A genuinely malformed payload still raises: `{"ok":true,"schemaVers` (unbalanced), `arggon: error: no tracker root found`, `""`, `[1,2,3]` are pinned to throw `EnvelopeReadError` (`test-spawn.test.ts:376-415`). The "prose that merely mentions json" case is pinned too and is NOT vacuous: `{ok:true}` has an unquoted key, so `JSON.parse` rejects the candidate slice (I evaluated it: `Expected property name or '}' in JSON at position 1`) and the reader falls through to the raise — I nearly called this a hole and checked instead.
  - The masked case the coordinator asked about needs a *valid* JSON object inside garbage. Where that could happen, an existing assertion still fires first: `mcpCall` now reads with `isError` in hand, and every success arm calls `expectOk` before comparing, while the three failure arms assert `isError === true`; the branch/cleanup arms additionally assert `exact === true`. A tool-level error therefore cannot be read as a passing parity run.
  - Real divergence still fails: `expect(() => expectSameEnvelope(divergent, cliResult)).toThrow(/envelope mismatch/)` in the new parity case is exactly that check.
  - The regression half discriminates against the old code: pre-fix, the dead-spawn arm threw a bare `SyntaxError` from the helper, so `toBeInstanceOf(EnvelopeReadError)` would be red. The dead-`cliSpawn` repro (`{ command: process.execPath, args: ["/nonexistent/entry.js"] }`) produces the CI sentence by construction (`mcp-server.ts:929-934`), which is why the repro is deterministic.
- Sweep completeness: the only `JSON.parse` left in the parity file is the transport frame (`:133`, now accumulate-to-newline and raising a named `[parity] MCP transport frame is not JSON: …`) and `normalize`'s own round-trip (`:220`). One inline envelope comparison remains and it is inside `expectSameEnvelope`. `readEnvelope` has exactly one consumer, so "anything else sharing that helper" is empty — see finding 4 for the siblings that do not share it yet.
- Transport fix is correct: `mcp-server.ts:575` always appends a newline to each frame, and `mcp-server.test.ts:56-80` already had the accumulating reader — the parity file was the outlier, and `nextFrame` now matches the in-repo pattern and ADR 0014.

## Its two honest non-claims: both hold up

(a) **Not reproducing the flake is the right scope.** 20/20 pre-fix passes is reported as "cannot reproduce", not as "fixed". The trigger is load-dependent and tracked as `bug-cli-spawn-suites-exit-1-flake`; re-deriving a load-sensitive spawn failure belongs there. What this PR owns — a reader that cannot emit a bare `SyntaxError` — is pinned by a case that fails against the old code. Correct split.
(b) **Leaving `cascade.test.ts` out was right.** `spawnJson` resolving `null` on empty stdout and discarding stderr via `void err;` is a different symptom class (a `null` sentinel, not an unparsable string) in a different helper, and its `expect(flip, "round N: …")` already carries a message. Folding it in would have widened a p1 that is unblocking CI. The coordinator filed it as `bug-test-spawn-spawnjson-null-drops-stderr` — separation confirmed.

## Gates (I ran none; these are read, not executed)

- CI on this head is **green**, not pending: `cli` SUCCESS, `tasks-validate` SUCCESS, `ui-smoke` SUCCESS (run 37096614813 / 37096614822, completed 04:27–04:32Z).
- Claimed locally and consistent with the tree: `npm test` ×3 (122 files / 2286 tests), `lint`, `validate`, `check:plugin`, `test:structure`, `lint:structure`.
- Smoke bar: not applicable — no CLI behavior changed (verified: no product diff outside `cli/src/test-spawn.ts`, `cli/src/test-spawn.test.ts`, `cli/src/mcp-parity.test.ts`), no UI/TUI surface touched. The dead-`cliSpawn` probe is the closest thing to an end-to-end drive of the MCP path and it exercises the real server.
- Docs: no contract changed, so no doc line is owed; the harness contract is recorded in the code comment and on the item.

## Probes needed

```
# 1. The one claim I did not execute and would change the verdict if it contradicts CI.
cd /home/arggon/Projects/ArggonManager-bug-mcp-parity-branch-test-json-parse-of-human-stdout
npx vitest run cli/src/test-spawn.test.ts -t "genuinely malformed"
# expected: 1 passed (5 raise cases incl. the prose-mentions-json one, plus head-clip and stderr echo)
# what it changes: if red, the "it locates and never invents" claim is false and this becomes request-changes

# 2. The discriminating halves of the parity gate, run alone.
npx vitest run cli/src/mcp-parity.test.ts -t "emitted no envelope fails by name"
# expected: passed — EnvelopeReadError on MCP/arggon_branch/isError:true AND /envelope mismatch/ for a real divergence
# expected against the PRE-fix tree: FAILED with SyntaxError (proves the test is not vacuous)

# 3. Re-run the sweep assertions mechanically after the rebase from finding 1.
grep -n "JSON.parse" cli/src/mcp-parity.test.ts        # expect only :133 (transport, named error) and :220 (normalize)
grep -n "expectJsonOnly(" cli/src/mcp-parity.test.ts   # expect the definition + the branch and cleanup arms
git log --oneline main..HEAD -- '*.md'                 # after rebase: no bug-three-acceptance-parsers-diverging commits
```

**Merge: recommended**, after rebase (finding 1). No product change, gates green in CI and locally, tests discriminate against the old code, and the two deferrals (flake trigger, `cascade.test.ts`) are correctly scoped and tracked. Findings 2-4 are follow-up material, not merge blockers.

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

### 2026-10-03 @ses_efea22f4affeuwm0UHxi45fb2I

### 2026-10-03 @Arggon
Coordinator note on the checklist shape before merge: the worker's evidence rows were appended under a `### Added while working` comment header, which the tracker records as HISTORY rather than as the acceptance section — so the four original boxes are still unticked and the done gate would (correctly) refuse. Ticking them here with the evidence each was verified against, drawn from the worker's own record and the round-2 reviewer verdict on this item (not re-derived by me).

- **Box 1 — robust envelope read.** `readEnvelope` in `cli/src/test-spawn.ts` parses the WHOLE text first (the contract), then locates an envelope inside surrounding text, and otherwise raises `EnvelopeReadError` naming surface, command, `isError`, stdout and stderr. The bare `SyntaxError` from the old bare `JSON.parse` can no longer surface. The strict contract is not lost: `expectJsonOnly` still asserts JSON-only stdout on BOTH surfaces, on the two arms that failed.
- **Box 2 — a failure names the surface.** `readEnvelope` names which surface, which command, and whether `isError` was set, and echoes both stdout and stderr; `expectSameEnvelope` names both sides and echoes both payloads. One read is enough to diagnose the next occurrence.
- **Box 3 — parity is not weakened.** The new case FAILS against the old code (bare `SyntaxError` from inside the helper, before any caller could read `isError`), and half (b) of the test still asserts that a genuine CLI/MCP divergence fails `expectSameEnvelope`.
- **Box 4 — no product change, and that is the correct call.** Verified rather than waved through: `branch` and `cleanup` gate their entire stdout on `jsonEnabled` (`cli/src/cli.ts:2250-2283` and `:2594-2621`), so in `--json` mode `successJson`/`failJson` are the only writers, and `runBranch`'s git pipes do not reach stdout. The text that actually broke the parity test was the MCP server's OWN tool-level error sentence. So the fix belongs in the harness, and there is nothing separate to file.

**Scope the worker was honest about, unchanged by this tick:** the load-dependent TRIGGER is not fixed — 20 pre-fix iterations all passed, it only fires under full-suite CI load. That is tracked separately as `bug-cli-spawn-suites-exit-1-flake`, and this item fixes the reader so the next occurrence is diagnosable instead of a bare `SyntaxError`. The `cascade.test.ts` `null`-on-empty-stdout sibling is a different helper with a different symptom and is filed as `bug-test-spawn-spawnjson-null-drops-stderr`.

One merge precondition from the review is satisfied: the duplicate `bug-three-acceptance-parsers-diverging` verdict commits are off this branch (rebased), and the current merge is a union that keeps main's authoritative frontmatter plus every comment block from both sides.

### 2026-10-05 @arggon-delivery-lead
verdict: approve (delivery-lead merge verification, re-run after the stale-branch catch-up)

**Why this verdict exists:** this item sat at `todo` with no assignee, branch or `worktree_path` while its work sat in a worktree and an open PR (#612). That is the tracker-blindness described by `bug-native-arggon-tools-resolve-tracker-root-to-session-cwd` — the native tools resolve the tracker root from process cwd, so a session working inside a worktree writes its tracker state into the primary checkout. Reconciliation was the prerequisite to merging, not new work.

**Finding 1 (the named merge precondition) is discharged by the branch itself, not waived.** `486c6fc3` is a "merge origin/main (item file union) + acceptance ticks with evidence" and `2e9ec5eb` restores the round-2 approve verdict; the two duplicate `chore(tasks): commented bug-three-acceptance-parsers-diverging` commits are absent from `git log origin/main..HEAD`. Evidence, not assertion.

**Staleness catch-up.** The branch was 230 commits behind `origin/main`. `git diff --stat <merge-base>..origin/main` over `cli/src/test-spawn.ts`, `cli/src/test-spawn.test.ts` and `cli/src/mcp-parity.test.ts` returned **empty** — the product diff carried no conflict surface, as the reviewer predicted. Conflicts were confined to this item file and were genuine two-sided unions (main's reviewer verdict vs the branch's maker evidence); both sides were concatenated, 0 markers left.

**Acceptance verified by reading the code, not the maker's summary:**
- box 1 — `readEnvelope` (`cli/src/test-spawn.ts:335-372`) tries whole text, then per-line, then balanced-brace candidates, and raises rather than inventing a result.
- box 2 — `EnvelopeReadError` (`:238-266`) carries `readonly surface: EnvelopeSurface`; the message emits `surface: <CLI|MCP> (<command>) produced no JSON envelope` plus `--- <surface> stdout ---` and `--- <surface> stderr ---`. Names the surface and echoes raw text: met.
- box 3 — parity is not weakened: `expectSameEnvelope` (`cli/src/mcp-parity.test.ts:181`) still throws `CLI <-> MCP envelope mismatch` and is called on every arm (12 call sites); `expectJsonOnly` (`:207`) keeps the strict JSON-only assertion so the locate-the-envelope fallback cannot absorb a success line.
- box 4 — no product change: the only non-`.test.ts` file in the diff is `cli/src/test-spawn.ts`, the shared **test harness** module (already home to `classifySpawnFailure`/`SpawnHarnessError`), not shipped product code. `git diff --name-only origin/main..HEAD -- 'cli/src/*' 'lib/src/*'` shows no other source file. Nothing to file separately.

**Gates — executed, expected vs observed:**
- `npx vitest run cli/src/test-spawn.test.ts cli/src/mcp-parity.test.ts` → expected 34 pass; **observed 2 files / 34 tests passed**.
- First run was **19 failed / 15 passed**, and the cause was environmental rather than the change: the worktree's `lib/dist` was 230 commits stale, so the spawned child CLI died with `SyntaxError: The requested module '@arggondev/lib' does not provide an export named 'containersMissingAcceptance'` (`cli/src/spec.ts:16`). Remedy applied: `npm run build --workspace @arggondev/lib` in the worktree → green.
- **Gap worth recording:** the `start` receipt reported `ready: true` with `install: "existing"` and `builtWorkspaces: []`. A reused install on an *attached* worktree is not rebuilt, so the readiness receipt does not cover a stale `lib/dist` — `ready: true` did not mean the gate could actually boot the CLI. Same failure signature as `bug-test-suite-lib-dist-rebuild-race`.
- `npm test` (full) → **1 failed | 127 passed (128) files; 1 failed | 2668 passed (2669) tests**. The single failure is `cli/src/headless-ci.test.ts:849` (twin-checkout `init --json` determinism) and is **not this branch's**: the branch never touches that file, and it fails identically in the primary checkout on clean `origin/main` (`1 failed | 6 passed (7)`). Filed as `bug-headless-ci-twin-init-nondeterministic` under `tooling-and-environment` — `main` is red on its own, independent of this item.
- Smoke bar: not applicable — no product behavior, no CLI command, no UI/TUI surface. The dead-`cliSpawn` probe is the closest end-to-end drive and it exercises the real MCP server.

**Findings 2-4 remain non-blocking follow-up material** (the `expectJsonOnly` sweep to the other 13 arms; per-character budget charging in `readEnvelope`; the two sibling bare-parse sites at `mcp-server.test.ts:125` and `mcp-smoke.test.ts:130`). These belong on the tracker rather than as code TODOs; not filed here to keep this PR scoped to the reviewed change.

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
Merged: PR #612 landed as `2f36bd70` with all three lanes green (`cli`, `tasks-validate`, `ui-smoke`) on the rebased head. The claim frontmatter (`assignee`/`branch`/`worktree_path`) was resolved from `main` during the branch merge and did not survive it, so the item came back as `todo` with no assignee while the change was already merged — recorded here rather than papered over. Re-claimed and completed in two steps (never `todo` → `done`). Acceptance checklist: 7 ticked, 0 unchecked, verified against the code rather than the maker's summary (see the merge-verification verdict above).

Post-merge follow-up filed during this verification: `bug-headless-ci-twin-init-nondeterministic` — `cli/src/headless-ci.test.ts` fails its twin-checkout `init --json` determinism assertion **on clean `origin/main`**, so `main` is independently red. Not caused by this change and not fixed here.
