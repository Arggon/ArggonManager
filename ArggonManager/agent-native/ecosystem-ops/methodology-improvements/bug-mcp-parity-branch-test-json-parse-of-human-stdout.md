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

### 2026-10-03 @ses_efea22f4affeuwm0UHxi45fb2I
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
