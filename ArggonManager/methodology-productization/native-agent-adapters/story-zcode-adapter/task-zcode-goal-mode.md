---
type: task
status: todo
id: task-zcode-goal-mode
title: ZCode goal-mode template from item checklist (plan T5)
parent: story-zcode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/task-zcode-goal-mode.md
  Leaves live only under a story. id is the filename stem: task-zcode-goal-mode.
  CLI `arggon create task zcode-goal-mode` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode goal-mode template from item checklist (plan T5)

## Context

Generated goal-mode template: objective + verification contract derived from the claimed item's acceptance checklist; never spans worktrees

## Acceptance

- [ ] template generation test
- [ ] goal contract parses the checklist
- [ ] documented: one goal per claimed item

## Notes

### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD
verdict: request-changes (derivation does not reuse the done gate's predicate; vendored ZCode seam left stale)

## Scope reviewed

PR #605 (branch `feat/task-zcode-goal-mode`, draft) against item `task-zcode-goal-mode`. Read: `cli/src/goal-mode.ts`, `goal-mode.test.ts`, the `goal` wiring in `cli/src/cli.ts`, `templates/docs/zcode/arggon/{templates/goal-mode.md,commands/arggon-goal.md,.zcode-plugin/plugin.json}`, `templates/docs/zcode/marketplace.json`, the doc diffs (`agents.md`, `README.md`, `docs/json-output.md`, `skills/arggon-cli/**`), the vendored `.zcode-marketplace/`, the spec/plan (`methodology-adapters-017` S5 / T5), `lib/src/items.ts`, `lib/src/update.ts`, `lib/src/show.ts`, `lib/src/frontmatter.ts`, and the seam gate `templates/docs/zcode/arggon/hooks/gate.mjs`. I ran no project gates.

---

## Verified by reading — claims that hold

**2. Bounded output is structural, and the "boundaries always survive" inversion does not occur.** `runGoal` computes the boundary block first, then budgets the *filled template* at `MAX_GOAL_CONTRACT_BYTES - byteLength(block) - 2` and clips to that, then appends `block` verbatim. The clip can only ever shrink adopter/template prose; the block is concatenated afterwards and never clipped. I measured the block at **1,974 B** against the 12,288 B cap, so the template budget is 10,312 B and the worst case lands exactly on 12,288 B. The boundaries/refusals constants are structurally immune to a hostile item or an inflated template — this is the property you asked me to hunt for and it holds. Per-line bounds check out: `clip(live[0], 240)`, `clip(line, 200)`, `live.slice(0, 8)` with `verificationOmitted = live.length - inlined.length` (overflow **counted, never pasted**). `MAX_GOAL_PROSE_BYTES` (32 KiB) is applied to `shown.prose` *before* `parseAcceptanceRows`, and `MAX_GOAL_TEMPLATE_BYTES` (8 KiB) at read time — both genuinely pre-parse. The `clip` helper counts the 3-byte ellipsis inside the budget, so a clipped line stays at or under max.

**3. Boundaries are appended from CLI constants — confirmed, and an adopter cannot delete them.** `GOAL_BOUNDARIES`/`GOAL_REFUSALS` are module constants; `renderBoundaryBlock` reads only those. The template file is read for the *shape* only, and `fillSlots` fills just five slots. Stripping the template's own boundary prose cannot remove the appended block. The test "keeps the boundaries when the adopter's template copy is stripped down" discriminates: it overwrites the file with a two-line stub, then asserts the boundaries survive.

**4. Refusals are refusals, correctly decided, no override.** All seven codes are declared in `GoalErrorCode`; there is no override flag in `cli.ts` (`.argument("<id>")` plus `.option("--json")` only); and no path converts a refusal into a mode — every throw in `assertClaimed`/`assertWorktree`/`loadGoalTemplate` propagates to `goalOperation` as `ok:false`, exit 1. **Foreign claim is the important one and the core of it is right**: `assertClaimed` throws `GOAL_FOREIGN_CLAIM` when `item.assignee !== login`, and `assertWorktree` independently refuses any checkout whose realpath differs from the recorded `worktree_path`, so a goal cannot reach into another session's worktree even if the claim check is bypassed. See B2 for the one hole in the claim check itself.

**5. The ZCode seam really can reach it.** `hooks/gate.mjs` denies only `/\b(?:arggon|arggon-manager)\s+(?:--?[a-z-]+\s+)*(?:update|create|branch|start|cleanup|priority|sync|import-issues|migrate)\b/` — `goal` is absent, so `arggon goal` passes the gate, including during a reviewer dispatch, which is correct for a pure read. `plugin.json` already declares "Requires the arggon CLI on PATH", and `/arggon-board` sets the precedent for a seam command that shells to the headless bin. ADR 0020's "adapters use their agent's native mechanisms" is satisfied: Bash is native to ZCode. **No MCP tool is the right call** — it mutates nothing, and adding one would touch the fifteen-tool count in `agents.md`/`opencode2.md`/`json-contract.md` plus `mcp-parity` for zero added capability. The worker flagged this as an open question rather than deciding silently, which is right.

**6. Leaving spec/plan at `proposed` is correct.** S5 bundles the goal-mode template *and* the automation templates, and the spec's own acceptance box reads "ZCode adapter: goal-mode template derives the objective...; automation templates run read-only scans and file items via `arggon create`". Sibling `task-zcode-automations` is still `todo` and unclaimed. The PR touches neither spec nor plan and claims S5 nowhere.

**7. The command doc names the real surface.** `arggon-goal.md` cites `arggon goal <item-id>` and `--json`, both of which exist; `mcp__arggon__arggon_show`/`arggon_start` match the spelling used by the other twelve command docs; `$ARGUMENTS` is the convention. Provenance plus never-overwrite are pinned in `init-zcode.test.ts`, and `TIER1_DOCS` carries the new template. `skills:sync` was run: `.agents/skills/arggon-cli/` matches `skills/arggon-cli/` modulo the generated header.

**Packaged fallback is sound.** `package.json` `files` ships `templates/`, so `bundledTemplatesDir()` resolves for an npm-installed bin, and the adopter-copy-wins-then-package order matches never-overwrite.

---

## Blocking findings

### B1 — The derivation does NOT reuse the done gate's predicate, and the code, docs and PR all claim it does

The claim under review is "empty `- [ ]` are skipped via the kernel's `parseAcceptanceRows` — the same predicate the done gate (ADR 0015) enforces". **That is false.** There are two independent implementations, in two different packages:

- done gate — `lib/src/items.ts:329` `acceptanceComplete(body)`, regex `/^[ \t]*[-*] \[( |x|X)\][ \t]*[^\s]/gm`, applied to `item.body` at `lib/src/update.ts:526` (and `:1046` for the cascade);
- this feature — `cli/src/board.ts:724` `parseAcceptanceRows(prose)`, regex `/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/`, applied to `shown.prose` at `goal-mode.ts:387`.

`parseAcceptanceRows` lives in the **board** module (a rendering helper for the TUI/serve drawer), not in the kernel, and it is not the predicate the done gate runs. goal-mode then adds a *third* filter of its own (`live = unchecked.filter(row => row.length > 0)`). So "the goal reads exactly the checklist the done gate gates on" is untrue, and **the two can drift — they already do**. I ran both regexes side by side over a fixture matrix:

~~~
AGREE   | plain                 gate_unchecked=true  goal_has_criterion=true
AGREE   | indented              gate_unchecked=true  goal_has_criterion=true
AGREE   | star                  gate_unchecked=true  goal_has_criterion=true
AGREE   | empty box / no trail  gate_unchecked=false goal_has_criterion=false
DIVERGE | two spaces before box gate_unchecked=false goal_has_criterion=true   ("-  [ ] x")
DIVERGE | crlf                  gate_unchecked=true  goal_has_criterion=false  ("- [ ] x\r")
~~~

Both divergence classes are reachable, not hypothetical:

- **CRLF** — `lib/src/frontmatter.ts:9-13` explicitly tolerates `---\r\n` and splits YAML on `/\r?\n/`, so a CRLF tracker file loads fine. Its body keeps the `\r`; `.` in the board regex does not match `\r`, so `parseAcceptanceRows` returns **no row**, while the gate sees an unchecked criterion. The goal then renders "DEFINE THE GOAL FIRST — this item carries no unchecked acceptance criterion" for an item the done gate is actively refusing to close. That is precisely the inversion this review was told to hunt for. The kernel still holds the line, so it is not a safety hole — but the contract tells the agent the opposite of the truth.
- **Two spaces** (`-  [ ] criterion`, a hand-edit typo): the gate treats it as *no checklist at all* (so the item flips to `done` freely) while the goal loops on it as a criterion.

The inaccurate claim is load-bearing prose in five places: `goal-mode.ts:16` ("the same rule the done gate applies"), `goal-mode.ts:198` ("Rows come from the kernel's own acceptance parser, so the goal reads exactly the checklist the done gate gates on"), the module header, `ArggonManager/docs/agents.md` section ZCode ("exactly as the done gate reads it"), `README.md` under `arggon goal`, and the item Notes plus the PR body.

**Fix:** export one row/criteria parser from `@arggondev/lib` next to `acceptanceComplete` (already exported at `lib/src/index.ts:46`) and have the done gate, `board.ts` and `goal-mode.ts` all consume it, then add a parity test asserting the surfaces agree over the same body. If you would rather not refactor the board in this PR, at minimum delete the "same predicate"/"exactly as the done gate" claims and record the divergence — but the shared predicate is the cheap, correct answer, and it is what the item's third acceptance box rests on.

### B2 — `GOAL_FOREIGN_CLAIM` is skipped entirely when the caller identity is unresolved

`goal-mode.ts:387-391` does `assertClaimed(item, identity ?? undefined)`, and inside `assertClaimed` the check is `if (login !== undefined && item.assignee !== login)`. An unresolved identity therefore *disables* the foreign-claim refusal rather than falling back to refusing. The rendered contract does warn ("Caller identity could not be resolved... confirm `arggon show <id> --meta` names you before the first write") and a test pins that warning, so this is deliberate — but it means the docs' flat "a goal never targets another identity's claim" holds only when `GITHUB_USER`/`GITHUB_ACTOR`/`gh`/`git config` resolve. Given this is a pure read and the worktree check still applies, either refuse when an assignee exists but identity is unknown, or state the conditional in `agents.md`/README the way the contract text already does. As shipped, the docs overstate the invariant.

### B3 — The vendored `.zcode-marketplace/` in this repo is left stale, against established precedent

This repo's own ZCode marketplace **is checked in** (`git ls-files .zcode-marketplace` returns 19 files). The PR regenerates neither it nor its manifest. On the branch:

- `.zcode-marketplace/marketplace.json` still reads ".../arggon commands, agents and hook gates (ADR 0014)" while `templates/docs/zcode/marketplace.json` now says "..., the goal-mode contract template and hook gates";
- `.zcode-marketplace/arggon/.zcode-plugin/plugin.json` makes no mention of the goal-mode template;
- `.zcode-marketplace/arggon/commands/` still holds **12** commands (no `arggon-goal.md`);
- `.zcode-marketplace/arggon/templates/` **does not exist** (no `goal-mode.md`).

That is 12 commands and no template against the template source's 13 plus 1. The precedent is explicit: PRs **#589** (`9e6a6fc0`) and **#596** (`4e169383`) both regenerated the vendored `.zcode-marketplace/` copies in the same commit as the template change, and #596's body states the rule outright — "the coordinator prompts (both template sources plus their generated `.opencode/` and `.zcode-marketplace/` copies, **verified byte-identical to the templates**)". (`f045d6b6`, the `/arggon-board` addition, is the counterexample, but it predates the codified rule.) No CI gate catches this, so it will merge silently. Run `arggon init` in the worktree, commit the regenerated `.zcode-marketplace/`, and assert the vendored copy is byte-equal to the templates modulo the generated header — as a test, since `init-zcode.test.ts` already pins the fresh-init shape.

### B4 — A methodology-carrier change with no impact class

`ArggonManager/docs/agents.md` and `skills/arggon-cli/**` are methodology carriers. `engineering.md` review bar: "PRs touching the methodology carriers state their **methodology impact class** (advisory / behavioral, with an ADR 0016 reference when behavioral)"; `agents.md` section "Changing the methodology itself": "Reviewers check the impact statement like any review-bar item; a behavioral change without it is a change request." This adds a new command contract that agents must know about plus new loop boundaries in `references/orchestration.md` — **behavioral** under the stated definition ("a rule, a gate, a command contract"). Neither the PR body nor the item states a class. Add it with the ADR 0016 adopter-upgrade reference.

---

## Non-blocking findings — these become items, per AGENTS.md

1. **Only one of the seven refusal codes is asserted.** `goal-mode.test.ts` asserts `GOAL_UNCLAIMED` via `envelope.error.code`; the other four refusal tests match the *message* (`toThrow(/claimed by 'Someone-else'/)`, `/never spans worktrees/`, `/no longer exists/`). Renaming a code breaks nothing. `GOAL_TEMPLATE_UNAVAILABLE` and `GOAL_FAILED` have **no test at all** — the fallback test only covers the adopter copy being absent. The code-to-case mapping is the documented contract in `docs/json-output.md`, so assert the codes.
2. **The prose clip is untested.** `clip(shown.prose, MAX_GOAL_PROSE_BYTES)` can be deleted without failing a single test: the 40x200 KB case drives `deriveGoal` directly, bypassing the read path. Output stays bounded via `deriveGoal` regardless (the clip is defense-in-depth for cost), but one oversized-body fixture would pin it.
3. **A dropped prose clip is reported as complete.** The `.clipped` flag from the prose clip is discarded (`.text` only), so criteria lost past 32 KiB leave `truncated: false` and `checklistNote` asserting "Every unchecked acceptance criterion is inlined above". Fold the prose-clip flag into `truncated`.
4. **`conventionVersion: 0` on the refusal path.** `goalOperation` reads it from `result.root` on success but from `opts.cwd` on failure; `readConventionVersion` -> `trackerAt` requires the tracker at that exact path, so a refusal invoked from a subdirectory (`cli/src`) emits `CONVENTION_VERSION_DEFAULT`, which is **0**. Hoist the root resolution above the `try`.
5. **Boundaries assert "runs inside the item's recorded worktree" but the code allows the repo root when no worktree is recorded** (`assertWorktree`: `if (!recorded) return;`). Not a cross-session hazard, but the appended boundary states the rule absolutely while enforcement has an unstated fallback. Either refuse or name the fallback in the boundary text.
6. **`MAX_GOAL_CONTRACT_BYTES` is a soft cap.** The `Math.max(1024, ...)` floor means that once the block exceeds roughly 11,262 B the floor engages and the contract exceeds the exported constant. Currently 1,974 B, so about 9.3 KB of headroom, and the envelope test would catch growth — worth a comment at the constant.
7. **`goal-mode.ts` imports `./board.js`** — a 2,958-line module — to reach one 8-line regex. Neutral for bundle size (`check:plugin` is byte-identical, and `cli.ts` already pulls board in), but architecturally backwards: the rule belongs in `@arggondev/lib`. Fold into B1's fix.
8. **Clipping the template can delete the slots themselves.** An adopter template over 8 KB loses `{{GOAL_OBJECTIVE}}` and friends while `goal.objective` still reports them in `--json`. Inherent to clip-then-fill ordering; acceptable, worth a line in the docs.

---

## Unverified / what I did not run

Per the review role I executed **no project gates**. The worker's reported evidence (120 files / 2229 tests, lint, `validate`, `check:plugin` byte-identical) I did not reproduce. Everything above comes from reading source, history and the diff; the two regex-divergence tables are the only executions I performed, and they are pure function comparisons of the two published predicates, not project gates.

## Probes needed

Run by the prover (or coordinator) in `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode`:

1. `npm test -- cli/src/goal-mode.test.ts cli/src/init-zcode.test.ts cli/src/done-gate.test.ts cli/src/cascade.test.ts`
   — *demonstrates*: the goal-mode suite is green and the done-gate/cascade suites still pass, so B1's refactor has a safe landing zone. *Would change*: a failure here blocks the B1 fix.
2. A parity harness comparing `acceptanceComplete(body)` (`lib/src/items.ts`) against `parseAcceptanceRows(body)` plus goal-mode's `live` filter, over fixtures including `-  [ ] x` and a CRLF body.
   — *demonstrates*: the two predicates disagree on exactly the two classes reported and agree elsewhere; the output becomes the new parity test. *Would change*: if it reports agreement, B1 drops from blocking to a docs-only correction.
3. `npm run arggon -- init` in a scratch clone of the branch, then `diff -r` `.zcode-marketplace/` against `templates/docs/zcode/` modulo the `# arggon:generated` header.
   — *demonstrates*: the regenerated vendored copy is byte-consistent with the template source (B3's fix). *Would change*: if the regen produces a larger diff than the four files implicated, the finding widens.
4. `npm run arggon -- goal task-zcode-goal-mode`, the same with `--json`, and one from a subdirectory (`cd cli && npm run arggon -- goal task-zcode-goal-mode --json`) to observe `conventionVersion`.
   — *demonstrates*: the blocking smoke probe `engineering.md` requires for a CLI change — objective, three inlined criteria, appended boundaries, exit 0 — and confirms finding #4's `conventionVersion: 0` on a subdirectory invocation. *Would change*: the verdict cannot move to approve without the command actually being run on a fixture, whatever the unit tests say.
5. `npm run arggon -- goal <an-item-claimed-by-someone-else> --json`, and one from a foreign checkout.
   — *demonstrates*: `GOAL_FOREIGN_CLAIM` and `GOAL_WORKTREE_MISMATCH` fire in the shape an agent actually hits them, not just in a fixture. *Would change*: if either degrades into a rendered mode, escalate.

## Recommendation

**No merge.** B1 is the substance of the item's third acceptance box ("documented: one goal per claimed item") resting on a predicate claim that is false and already divergent; B3 leaves the repo's own vendored seam contradicting the template it ships; B4 is an explicit review-bar item; B2 overstates a refusal in shipped docs. All four are small and none requires re-architecting the feature — the design calls in points 2, 3 and 5 are sound and worth keeping. Per AGENTS.md each finding above needs a follow-up `task`/`bug` under `story-zcode-adapter` before merge; the non-blocking ones are already enumerated and ready to file. PR #605 is still a **draft** and should not leave draft until B1-B4 land.
