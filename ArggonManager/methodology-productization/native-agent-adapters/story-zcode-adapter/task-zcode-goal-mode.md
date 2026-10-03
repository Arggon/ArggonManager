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

### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD
verdict: request-changes (round 2 — B2, B3, B4 and all 8 non-blocking are closed; B1 is closed except for one input-level inversion that re-opens the same defect on 21 of 280 live items)

## Round-2 scope

Re-reviewed the branch as it stands (`origin/feat/task-zcode-goal-mode` @ `61e80edb`, 9 commits, PR still **draft**). No gates run by me. Everything below is from reading the branch, plus four pure function/parser comparisons of published logic (no project gate, no build, no test suite).

**Closed and verified:**

- **B2 — genuinely closed.** `assertIdentityResolvable` (`goal-mode.ts:451`) now REFUSES with a new `GOAL_IDENTITY_UNKNOWN` instead of downgrading the claim check; `identity` is typed `string` (not `string | null`) so an unrenderable-for-unknown-caller state is unrepresentable. Order is most-specific-cause-first — `assertNotClosed` -> `assertIdentityResolvable` -> `assertClaimed` -> `assertWorktree` (lines 517-520) — so a closed item never gets an environment remedy. Both directions are asserted: the code is in the table-driven refusal suite *and* `identity` can no longer be null anywhere in `GoalContract`. Correct.
- **B3 — closed for what this PR owns.** I byte-compared all 21 vendored `.zcode-marketplace/` files against `templates/docs/zcode/` modulo the generated marker on the branch worktree: **all identical**, including the new `commands/arggon-goal.md` and `templates/goal-mode.md`. (`hooks/gate.mjs` is the one file my first pass flagged; that was a false positive from my marker filter — its marker is `// arggon:generated`, not `#`. Re-checked: identical, on main and branch.) `.convention.yml` gains exactly the two new entries for the goal files.
- **B4 — closed.** Impact class is line 4 of the PR body ("**Impact class: Behavioral**" + ADR 0016 reference), and repeated in the item. Where required.
- **All 8 non-blocking — closed, each verified in code or test, not just claimed:**
  - (1) all eight codes asserted through a table-driven loop on `envelope.error.code` (`goal-mode.test.ts:496`), including `GOAL_TEMPLATE_UNAVAILABLE` via the new `templatesDir` injection point (a real empty tree, no mock) and `GOAL_FAILED` via a non-existent id;
  - (2) prose clip tested in **both** directions — clipped-past-the-checklist yields `renderable:false` + `gateUnchecked:true`, clipped-only-the-tail yields `renderable:true` + `truncated:true` — and `truncated: derived.truncated || prose.clipped` is wired in (line 535);
  - (3) `conventionVersionFor()` (lines 588-594) resolves the tracker root before falling back to raw cwd; `conventionVersion: 5` asserted on every refusal envelope;
  - (4) the no-worktree fallback is now named in the boundary itself (line 131: "An item that records no worktree at all ... is scoped to the repo root you are standing in");
  - (5) soft cap documented at the constant, with the measured block size and headroom;
  - (6) clip-before-fill documented at `MAX_GOAL_TEMPLATE_BYTES`;
  - (7) the `board.js` import now carries an explicit deferral comment;
  - (8) clip-before-fill consequence documented on the contract field.
- **(c) the parity corpus is real.** `goal-mode.test.ts:120-210` asserts `hasGoal === !acceptanceComplete` across: no checklist, one unchecked, all ticked, mixed, empty box, `*` bullet, indentation, uppercase `X`, tab-after-box, `- [ ]x` (renderable:false), `- [ ] x`, plus a dedicated CRLF test that pins the gate at `false` and the raw row parser at `[]` before normalizing. That is the right shape of test.
- **(d) the false claim is gone everywhere it shipped.** I grepped every file in the diff for "kernel's own", "same rule the done gate", "exactly as the done gate", "exactly the checklist the done gate": the only hits are my round-1 verdict quoted in the item file, plus unrelated pre-existing uses elsewhere in the repo. Module header, `deriveGoal`, test header, README, `agents.md` §ZCode, `json-output.md`, both skill references, the ZCode command doc and the goal template are all corrected. The new header is honest about there being TWO parsers and names the follow-up.
- **Probe evidence is present and the CRLF case shows exactly what it should**: `arggon update task-crlf --status done --json` -> `{'ok': False, 'error': 'UPDATE_FAILED'}` while `arggon goal task-crlf --json` -> `{"objective": "crlf criterion", "hasGoal": true, "renderable": true, "gateUnchecked": true}`. Gate refuses, goal reports work remains, they agree. The subdirectory `conventionVersion: 5` probe is there too.

---

## Still blocking — B1 residual: the gate's verdict is read from the WRONG STRING

The fix took the verdict from the right predicate but fed it a **different input than the done gate does**:

~~~
lib/src/update.ts:526    const gated = ... && !acceptanceComplete(item.body);      // the gate
cli/src/goal-mode.ts:526  const gateUnchecked = !acceptanceComplete(shown.prose);    // the goal
~~~

`item.body` is the **full body including `arggon comment` sections**. `shown.prose` is the body truncated at the first `### YYYY-MM-DD @author` heading (`lib/src/show.ts:63-79`, `parseComments`) — comments excluded. So the two read different strings.

This is not hypothetical: **filing an acceptance checklist as a comment is a first-class supported shape in this repo**, precisely because `arggon create` has no `--body` flag — `bug-empty-template-checkbox` carries the acceptance box "Items whose acceptance lives in a comment flip via auto-done without manual surgery". I ran both predicates over every item in this tracker:

~~~
items with comments: 280 | items where gate(body) and goal-mode(prose) DISAGREE: 21  (7.5%)
  gate_closes_item=false  goal_reports_nothing_left=true
    .../task-plugin-test-type-coverage.md
    .../task-arm-strict-worktree-writes.md
    .../task-cycle-set-canonical.md
    .../task-done-gate-acceptance-waiver.md
    .../bug-harness-config-churn.md   (+16 more)
~~~

Isolated, on a minimal body:

~~~
done gate acceptanceComplete(body) = false -> done flip REFUSED
goal-mode acceptanceComplete(prose) = true -> gateUnchecked = false
INVERSION: the gate REFUSES to close, the goal contract reports NO work remains.
~~~

So the contract still emits **"DEFINE THE GOAL FIRST ... nothing verifiable to loop on"** for an item the kernel is actively refusing to close — the exact harm B1 was filed for, reached through the input rather than through the parser. Everything built to prevent it (`gateUnchecked`, `renderable`, `UNRENDERABLE_OBJECTIVE`, the parity corpus) is correct and gets bypassed here, because `gateUnchecked` was computed from a string the gate never sees.

Three things make this cheap to close rather than defer:

1. `runGoal` already holds the full item — `const item = shown.item` at line 509, and `WorkItem.body` is the same field `update.ts` passes the gate. **The fix is one line:** `acceptanceComplete(shown.item.body)`.
2. The two code comments that describe this call assert the *gate's* input, not the code's: line 194 says `!acceptanceComplete(item body)` and line 255 says `!acceptanceComplete(body)`. They are wrong as written. Given B1's whole lesson was that a comment naming the wrong owner re-introduces the bug, these need to say what is actually passed.
3. The parity corpus cannot catch it because its helper (line 116) passes the full `body`, not `shown.prose` — so it does not exercise the production input path. Add one case with the checklist inside a comment; it will fail on today's code.

Separately: `bug-three-acceptance-parsers-diverging`'s acceptance box 3 scopes the invariant to CRLF only ("the done gate refuses, and the board and goal contract ALSO report the unchecked boxes"). Extend it to name the comment/prose input case, or this same defect will be re-raised a third time.

---

## Ruling requested: the linear rebase

**Recommendation: squash-merge, do not rebase.**

The branch is `CONFLICTING` against main, but the conflict is confined to a single file — `task-zcode-goal-mode.md` — and both sides are **purely additive**: main added my round-1 verdict (113 lines), the branch added its Notes/acceptance work (373 lines). No other file in the diff is touched by both sides (merge base `ba808947`). This is the textbook squash case: GitHub's squash-merge collapses the nine commits without needing a force-push, which is what the policy denial was protecting.

The conflict still has to be resolved by hand either way, and the resolution is the union of both additions — keep my verdict comment and the branch's round-1 responses, Notes and acceptance block. Squash-merge is strictly better than a rebase here: it needs no privileged push, it produces one reviewable commit for a feature whose history is currently four rounds of review archaeology, and it is the only option available under the stated policy. Do **not** force-push the linear rebase.

Two smaller notes for the merge:

- The PR should leave **draft** until the residual above lands, then be marked ready with the squash as the merge method.
- **The stamp evidence is undercounted, and the direction of the news is good.** I verified every `x-generated` checksum against the committed bytes on both refs: main has **15** mismatches and 9 stamps for files that are gitignored; the branch has **the same 15** and the same 9, plus the 2 new correct entries. So the PR neither introduced nor worsened any drift — the pre-existing agent-copy and `.opencode/**` mismatches date from #589/#596, which regenerated the files but reverted the stamps per the documented decision ("the stamps go back to origin/main"). And `.github/workflows/arggon.yml` excludes `.convention.yml` from the drift gate **by design** ("`init` refreshes the per-doc generatedAt bookkeeping on every run, so the state file is excluded"), so committing the bumped `generatedAt` and the corrected `index.ts` checksum cannot turn CI red. Leaving `arggon adopt --ack` to a human is correct. Only the count in the PR body ("three agent copies + four `.opencode/**` copies") should be corrected to 15, since a reviewer counting 7 will not find 15.

---

## Judgment on the deferral (asked as item 3)

**Deferring parser unification is right, and the worker's reasoning holds.** `acceptanceComplete` returns a boolean, not rows, so unifying means first deciding what a row *is* — which is a behavior change to the done gate and belongs in its own item with its own parity corpus, not inside a seam feature PR. Guessing at it here would have produced a fourth parser or an unrequested change to `done` refusals. `bug-three-acceptance-parsers-diverging` is a well-formed home for it: three named call sites, two named divergence classes, a corpus-shaped acceptance list, and an explicit "no behavior change to the done gate's refusals" boundary. Good call; I would not have wanted that refactor inside this PR.

**But the contract is still unsound without the one-line input fix, and that part is not covered by the deferral.** Parser unification is about which *shapes* count as rows; this is about which *string* the gate's own predicate is handed. They are independent. The deferral is sound, and shipping with the inversion is not.

---

## Probes needed

For the coordinator/prover in `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode`, after the residual fix lands:

1. `npm test -- cli/src/goal-mode.test.ts cli/src/done-gate.test.ts cli/src/cascade.test.ts cli/src/init-zcode.test.ts`
   — *demonstrates*: the corpus, the eight-code refusal table and the seam suites stay green with `acceptanceComplete(shown.item.body)`. *Would change*: a failure means the one-line fix disturbed the gate-parity assumption.
2. `npm run arggon -- goal <an item whose checklist lives in a comment> --json` plus `arggon update <same id> --status done --json`.
   — *demonstrates*, on a real tree, the case the unit corpus missed: expected gate `UPDATE_FAILED` and goal `gateUnchecked: true`. Pick one of the 21 (e.g. `task-plugin-test-type-coverage`). *Would change*: if the goal still reports `gateUnchecked: false`, the fix is incomplete.
3. A corpus re-run over all tracker items comparing `acceptanceComplete(item.body)` against what `arggon goal` renders.
   — *demonstrates*: the 21-item disagreement class is closed with no residual. *Would change*: any remaining disagreement reopens this.
4. `gh pr view 605` mergeability after the squash.
   — *demonstrates*: the item-file conflict is the only one and resolves as the union of both additions.

## Recommendation

**No merge yet — one blocking finding, and it is a one-line fix.** Everything else I asked for in round 1 landed, and landed properly: B2 refuses instead of degrading, B3 regenerated the vendored seam and left pre-existing drift where the documented decision puts it, B4 states the impact class, all eight non-blocking items are closed with real tests rather than assertions of intent, the false claim is corrected everywhere it shipped, the parity corpus is the shape I asked for, and the CRLF probe shows the two surfaces agreeing. The CRLF inversion is genuinely dead.

What remains is the same defect B1 was filed for, arriving through the input instead of the parser: the gate's verdict is now authoritative but is read from `shown.prose` while the gate reads `item.body`, which disagrees on **21 of the 280 items in this tracker** — every item whose acceptance checklist was filed as a comment, the shape `arggon create` produces by design. Fix line 526, correct the two comments that describe the call as taking `body`, add one comment-borne case to the corpus, and extend the follow-up item's acceptance to name this case. Then squash-merge — no rebase, no force-push.

### 2026-10-03 @ses_efe0cc7a9ffekSptdyYXLmvnoT
verdict: request-changes (round 3 — the feature is verified sound; three mechanical preconditions, one of them a push, no design round needed)

## Scope reviewed

Worktree `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode` @ `93ec81b5` (reviewed content), plus the git metadata that describes what was actually published (`.git/refs/heads/feat/task-zcode-goal-mode`, `logs/refs/remotes/origin/feat/task-zcode-goal-mode`, the worktree `logs/HEAD` and `COMMIT_EDITMSG`), and the primary checkout @ `main` `22741459` for the diff lens. Read: `cli/src/goal-mode.ts`, `goal-mode.test.ts`, `cli/src/cli.ts` (goal wiring), `cli/src/board.ts` (`parseAcceptanceRows`), `cli/src/adapter-selection.test.ts` (doctor snapshot), `cli/src/init-zcode.test.ts` (seam pins), `cli/src/skill-copy.test.ts`, `lib/src/items.ts` (the merged kernel), `lib/src/update.ts` (gate call site), `lib/src/show.ts` (`parseComments`/`runShow`), the carriers (`README.md`, `ArggonManager/docs/agents.md`, `ArggonManager/docs/json-output.md`, `ArggonManager/docs/convention.md`, `skills/arggon-cli/**` + the `.agents/` copies), the seam sources and the vendored `.zcode-marketplace/`, `ArggonManager/.convention.yml`, `package.json`, `.github/workflows/arggon.yml`, and this item's file on both refs. **No project gate was executed by me** — no build, no test suite, no smoke. One pure-logic check was run (the merged kernel's three published regexes over the corpus and the probe table, transcribed from `lib/src/items.ts`); it is a function comparison of published predicates, not a gate.

---

## Verified by reading — the four claims, each now true

**1. "there are TWO parsers, not one" → there is one. TRUE.**
`cli/src/goal-mode.ts:482-484` reads `acceptanceRows(body)` / `acceptanceUnchecked(body)` over `body = acceptanceBody(item)`; the module's imports are `@arggondev/lib` + `./package-assets.js` only — no board parser, no `docs.js`, no regex. `cli/src/board.ts:765-767` is now `export function parseAcceptanceRows(body) { return acceptanceRows(body); }` with "There is deliberately NO regex below" — and `board.ts` is **byte-identical to `main`**, i.e. that thin wrapper is PR #611's work, not this PR's, so "one grammar" is true tree-wide and not merely true for the goal path. The structural guard exists on `main`: `tools/ast-grep/rules/acceptance-rows-use-kernel.yml`, run by `test:structure`.

**2. "the board parser is CRLF-blind" → the kernel walks the whole LineTerminator set. TRUE, and no special case is needed.**
`ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/` (`items.ts:359`) and `acceptanceRows` splits on it, so `- [ ] x\r` never reaches `ACCEPTANCE_MARKER` with a CR in the tail. My evaluation of the three published regexes over the corpus: `acceptanceRows(crlf) === acceptanceRows(lf)` → **true**; `- [x] a\u2028- [ ] b\n` → 1 unchecked criterion, gate refuses, objective `b`; same for \u2029. `ArggonManager/docs/convention.md` §Acceptance rows (on `main`, **byte-identical** in this branch, so PR #613 owns it) states the row rule as the marker `^[ \t]*[-*] \[( |x|X)\][ \t]*` **including the trailing `[ \t]*`** and the gate rule separately as "the first character after the box, after any spaces or tabs, is non-whitespace". That is precisely the shape that falsified the six-word biconditional in #613's round 2 — the doc does not repeat that failure mode.

**3. `normalizeEol` "not cosmetic" → not needed, removed. TRUE, and removal is the right answer.**
`acceptanceBody` is `return source.body;` verbatim, with the reason already recorded in the kernel: "LF normalization would be *sound* (the marker above is CRLF-safe) but adds a second representation of the same document for no gain". No `normalizeEol` reference survives in `goal-mode.ts` / `goal-mode.test.ts` / any carrier; the remaining users (`docs.ts`, `init.ts`, `doctor.ts`, `eol-provenance.test.ts`) are the docs pipeline, untouched and unrelated. The worker's reasoning — drop the step rather than re-justify it — is the correct call, and it is stated as removal, not as a new rationale.

**4. `UNRENDERABLE` is unreachable, removed. TRUE, and the unreachability is structural, not incidental.**
`GoalContract` has no `renderable`; `deriveGoal` has exactly two shapes. The claim that the old third shape cannot recur is stronger than "the parser agrees": verdict and text come from the *same array* `unchecked`, and a row in it is a criterion, and `criterion === true` (`ACCEPTANCE_TEXT = /^\S/` over the tail after the marker's `[ \t]*`) implies a non-blank tail, so `oneLine(row.text)` can never empty it. "Rows exist but none could be read" is unrepresentable. `goal-mode.test.ts:326-340` pins both shapes and asserts the objective does **not** match `/READ THE ITEM BODY FIRST/`; `json-output.md:563` states the negative explicitly ("There is no `renderable` field and no 'could not read the text' shape").

**No fifth stale claim survives.** I grepped the tree for `second parser|two parsers|TWO parsers|CRLF-blind|not cosmetic|exactly as the done gate|same predicate the done gate|gate's own acceptance parser|renderable|READ THE ITEM BODY FIRST|MAX_GOAL_PROSE_BYTES|UNRENDERABLE`. Every hit is either a **historical record** (this item's Notes quoting round 1/2; `bug-three-acceptance-parsers-diverging`; the parity suite's pre-fix oracle comments) or an explicit **negation** ("There is no second parser left to disagree", "NOT CRLF-blind", "There is no `renderable` field"). One stale forward-looking sentence does survive, in a file this PR does not touch — see **N2**.

**The worker's framing holds, and it does not overstate.** "The one live hazard is the INPUT, not the grammar" is carried by `agents.md` §ZCode (line 599) with the two guards kept distinct: "Kernel parity corpus: `cli/src/acceptance-parity.test.ts`; this adapter's own corpus (including the comment-filed case) is in `cli/src/goal-mode.test.ts`". That is the honest version of the sentence the coordinator was worried about — it does **not** claim the parity suite enforces the input. And for *this* consumer the input claim is actually backed by tests, not convention alone: the parity corpus cannot see the call site (it hands `deriveAsRun` the body), but `goal-mode.test.ts` carries the round-2 regression in two places — a prose-stripped body that inverts (`:270-283`) and an **end-to-end** case that runs a real `arggon comment` through `runGoal` and asserts `gateUnchecked: true` + `objective === "criterion filed in a comment"` (`:436-456`) — plus a 512 KB-body case (`:395-408`) that fails if anyone re-caps the input. Reverting `acceptanceBody(item)` to `shown.prose` fails the e2e case; re-adding a body clip fails the 512 KB case. I reproduced the underlying inversion with the kernel's own regexes: full body → gate refuses; prose-only → 0 unchecked; shipped path → `hasGoal: true`.

---

## The two removals are safe, not convenient

**`normalizeEol`:** `acceptanceBody` returns `source.body` untouched (no trim, no EOL rewrite, no clip), and the split on the LineTerminator set means no CR ever survives into a marker match. Verified above with the kernel's own constants. There is no path by which re-adding a CRLF-gated row comes back through this module.

**`MAX_GOAL_PROSE_BYTES`:** the row bound plus the template cap are sufficient, structurally. Output paths: `clip(live[0], 240)`, `live.slice(0, 8)`, `clip(line, 200)]` (`goal-mode.ts:278-281`), `clip(raw, MAX_GOAL_TEMPLATE_BYTES)` at read (`:346`) and `clip(fillSlots(...), templateBudget)` after fill (`:506-515`) — so `verificationOmitted`/the counts are **numbers**, never pasted text, and the row count cannot grow the contract past `MAX_GOAL_CONTRACT_BYTES` no matter how many rows exist. Three tests pin it: the 40×200 KB derivation (`:309-324`, per-line ≤200 B and objective ≤240 B), the 30-criteria end-to-end with `contract` ≤ cap (`:380-393`), and the 512 KB-body case (`:395-408`). The quoted probe (objective 238 B, lines ≤200 B, contract 5203 B ≤ 12288 B) is consistent with those bounds. One arithmetic note: `clip` puts the 3-byte `…` inside the budget, so an all-ASCII criterion yields **240** B, not 238 — the *bound* is what the code guarantees, and 238 is fixture-dependent (trailing whitespace or multi-byte text). Not a defect; the exact figure is unverified by me (**P4**).

**What the removal does change, stated plainly:** the "no unbounded read" property now rests on `runShow` (which already loads the whole item body) rather than on this module's clip. `deriveGoal` materialises `live` = *every* unchecked criterion before slicing to 8, so the peak is one extra copy of the unchecked text plus a linear pass. That is a linear factor on an input that is already fully in memory — no new class of exposure — but it is the honest consequence of removing a reader cap, and it belongs in the record rather than implied away.

---

## Probe table: honest, and the A/B cases really discriminate

I recomputed every mapping from the merged kernel, not from the prose:

| case | claim | recomputed from `ACCEPTANCE_MARKER/TEXT/LINE_BREAK` |
| --- | --- | --- |
| 1 | objective "first criterion", `gateUnchecked` true | ✅ first unchecked criterion |
| 2 | DEFINE THE GOAL FIRST, gate ALLOWS the flip | ✅ 0 unchecked ⇒ `acceptanceComplete` true |
| 3 | CRLF: gate `UPDATE_FAILED`, objective "crlf criterion" | ✅ gate refuses; rows identical to the LF body |
| 3b | comment-filed: gate `UPDATE_FAILED`, objective "criterion filed in a comment" | ✅ only reachable because the canonical body is read |
| **3c** | `-  [ ] x` / `-\t[ ] x`: gate allows, `hasGoal` false | ✅ both are **not** rows (exactly one space) — same verdict on both surfaces |
| **3d** | `- [ ]x` / `- [ ] x`: both rows, objective "x", verification ["x","x"] | ✅ 2 rows, objective `x`, verification `["x","x"]` |
| 3e | U+2028 body: gate `UPDATE_FAILED`, objective "second line row" | ✅ 1 unchecked criterion, gate refuses |
| 8 | 5000-char criterion: objective 238 B, lines ≤200 B, contract 5203 B ≤ 12288 B | ✅ bounds hold (exact byte count fixture-dependent, see above) |

3c/3d are the pair that earns the PR its reason to exist: they are the two shapes on which the old board parser and the gate disagreed, and they now agree because both surfaces read one grammar. All 15 corpus cases in `goal-mode.test.ts` reproduce against the kernel's own regexes, including the two the worker added (`-  [ ] x` and a tab before the box → NOT rows → no goal) and the rewrites (`- [ ]x` → one-character criterion `x`, not the old "READ THE ITEM BODY FIRST" shape; CRLF rows equal LF rows; U+2028/U+2029 like LF). The corpus pins `!acceptanceComplete(source) === <hand-written expectation>` per case, so it discriminates a loosened marker (e.g. `\s+` instead of one space) rather than merely re-asserting the kernel at itself.

---

## The `doctor --agents` snapshot delta is exactly one derived number

`cli/src/adapter-selection.test.ts` differs from `main` by **one line** (19 → 21 in both the total and the "present" count) and nothing else. It is not a hardcoded constant that can drift silently: the snapshot is taken from `formatDoctorReport(runDoctor({ cwd: dir, agents: true }))` over a **fresh `runInit`** in a temp dir, so the pipeline derives the count and the inline snapshot **fails** whenever the seam's shape changes — the test's own comment says so ("the file counts themselves FAIL the snapshot whenever the seam's shape changes"). 21 = 19 + this PR's two new files, and the seam's file list in `agents.md` §ZCode ("the thirteen `commands/arggon-*.md` … `templates/goal-mode.md`") is consistent.

Related, verified: `.convention.yml` differs from `main` by exactly the two new entries (`.zcode-marketplace/arggon/commands/arggon-goal.md`, `.../templates/goal-mode.md`) + three refreshed checksums (`.opencode/plugins/arggon/index.ts`, `marketplace.json`, `.zcode-plugin/plugin.json` — all three of which this PR does change) + 33 `generatedAt` stamps; and CI excludes `*.convention.yml` from the drift gate by design (`.github/workflows/arggon.yml`: `git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml' …`). The 15 pre-existing stamp mismatches stay stated-not-fixed, with `arggon adopt --ack` named as the human step — correct.

---

## Blocking (merge preconditions — mechanical, no design change)

**B1 — the PR head is not the reviewed tip; the pushed head is the one CI rejected.** The reviewed worktree is at `93ec81b5` ("chore(seam): regenerate the ZCode goal-mode seam after the round-3 template edit"). The last recorded push on this branch moved `954559b2 → 9686798d` ("update by push"); **there is no `update by push` entry for `93ec81b5`** in `logs/refs/remotes/origin/feat/task-zcode-goal-mode`, and `refs/remotes/origin/feat/task-zcode-goal-mode` still reads `9686798d`. The worker's own commit message says why that matters: the `.zcode-marketplace/` copies "still carried the round-1 bytes — the `tasks-validate` seam drift gate caught exactly that (it builds this checkout and diffs the committed seam against what its own generator produces)". So on the published head the committed seam contradicts its template source — round 1's **B3**, re-created one commit later — and the drift gate is red there. My byte comparison on the reviewed content confirms the fix is real: `.zcode-marketplace/arggon/templates/goal-mode.md` and `.../commands/arggon-goal.md` are byte-identical to their templates after stripping the one `# arggon:generated` marker line, and `marketplace.json` / `.zcode-plugin/plugin.json` are byte-identical with no marker. **Do not squash at `9686798d`.** Push `93ec81b5` (fast-forward; the branch already contains `origin/main`, so no force is needed) and let the drift gate run on that sha.

**B2 — a botched sentence in the README** (`README.md:377`): "Bounded output: byte-clipped lines, at most 8 inlined criteria, counted overflow, **a clipped rows** (a fixed number inlined, the rest counted …)". That reads as a mechanical substitution of "a clipped prose" → "a clipped rows" in a user-facing doc; the `agents.md` parallel sentence is correct. One sentence: drop the parenthetical (it restates what precedes it) and keep "byte-clipped rows, at most 8 inlined, counted overflow, and a clipped template copy".

**B3 — the item file's union resolution altered a historical verdict and glued a comment heading.** Both dated verdicts are present on the branch (6 `### YYYY-MM-DD @` headers vs 2 on `main`; the union happened), but:
- `task-zcode-goal-mode.md:67` now reads `… goal_has_criterion=true ("- [ ] x")` where `main` has `… ("-  [ ] x")` — **one space dropped from the row whose entire point is two spaces**, so the preserved evidence now shows a shape that actually *agrees*. The column padding was reflowed throughout that table.
- `task-zcode-goal-mode.md:884` runs the round-2 verdict's heading onto the previous line: `… deferred to bug-three-acceptance-parsers-diverging### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD`. `lib/src/show.ts` `parseComments` matches `^### (\d{4}-\d{2}-\d{2}) @(\S+)\s*$` — a heading that is not at line start is invisible to it, so the round-2 verdict is attributed to the worker's handoff. Same class as the input defect this PR exists to fix: a comment-boundary marker mangled by a text operation. Two characters to fix.

## Non-blocking (file as follow-ups per AGENTS.md; do not block on them)

1. **`cli/src/board.ts:757-759` (on `main`, untouched by this PR) is now false in one clause**: "This local name is kept because the ZCode goal contract (`cli/src/goal-mode.ts`) and the drawer tests import it". This PR removed that import. The wrapper still earns its name (drawer tests import it), so the fix is to drop the `goal-mode.ts` clause — worth doing here rather than leaving a claim that names the wrong owner.
2. **No refreshed probe for `GOAL_WORKTREE_MISMATCH`** in the round-3 table (cases 4-7 cover FOREIGN_CLAIM from root *and* subdir, IDENTITY_UNKNOWN, UNCLAIMED, FAILED). It is the cross-session hazard and the one round-1 asked for by probe; it is unit-covered in the eight-code table, so this is a coverage note, not a gap.
3. **`convention.md:150` still says** the parity suite "asserts each consumer reads `acceptanceBody(item)`" — the overstatement already filed as `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` (and F3 on `bug-convention-md-acceptance-terminator-framing`). Inherited from #613 and out of this PR's diff, but `agents.md` §ZCode now links readers straight to that section, so the careful sentence in `agents.md` sits next to an overstatement in the doc it defers to.
4. Delivery wording: the round-3 note says the push "was a fast-forward `38db079d..954559b2`"; the published history actually ran to `9686798d`, and the tip is a fourth commit further (**B1**). The note also says the union kept "main's frontmatter" — it kept the *branch's* (claim fields included), which is the correct outcome; only the wording is off.

## What I verified about delivery discipline

- **No force-push, none attempted.** The reflog shows an abandoned interactive rebase (`rebase (abort)`), then two real merges of `origin/main` (`commit (merge): merge origin/main into feat/task-zcode-goal-mode (item file resolved as union)`, then `merge origin/main: Merge made by the 'ort' strategy`) — exactly the round-2 ruling. The branch ref then moved monotonically forward.
- **The primary checkout holds none of this branch's commits.** `refs/heads/main` == `refs/remotes/origin/main` == `22741459`; `main`'s reflog entries are all `chore(tasks)`; `cli/src/goal-mode.ts` and `goal-mode.test.ts` do not exist on `main`, and `agents.md` on `main` has no §Goal Mode. No stashing was used.
- **Recorded on `main`: the merged kernel** (`ACCEPTANCE_MARKER` / `ACCEPTANCE_LINE_BREAK` / `acceptanceBody` present in `main:lib/src/items.ts`) and `convention.md` §Acceptance rows — so #611/#613 really merged and this branch is built on them.
- `.agents/skills/arggon-cli/{SKILL.md,references/json-contract.md,references/orchestration.md}` are byte-equal to `skills/arggon-cli/**` after stripping the generated marker line, and `cli/src/skill-copy.test.ts` asserts exactly that.
- `arggon goal <id> [--json]` in `cli.ts` has **no override flag**; the human path prints `contract`, the `--json` path emits the envelope with the command's exit code.

## Smoke bar

Correctly handled, and I record the exemption explicitly: the applicable bar for a CLI change is `engineering.md` §Smoke test — *probe the changed command on a fixture and record expected vs observed in the verdict, preferring `--json`*. The refreshed probe table is that evidence, case by case, and I have recomputed every expected value from the merged kernel. `smoke:opencode` / `smoke:opencode:wave` are **model-driven, maintainer-run, quota-bound** harnesses scoped to the **OpenCode** seam and the native worktree/start path (`CONTRIBUTING.md:133-150`, `agents.md:295`); this PR touches the ZCode seam and no worktree/start code, so they are out of scope — and they are **red on clean `main`** (`task-file-smoke-opencode-red-on-main`, filed, `todo`), so requiring them here would gate on a pre-existing failure. No UI/TUI surface is touched, so the real-browser and pty bars do not apply.

## Unverified / what I did not run

No gates, no build, no test suite, no smoke — by role. I did not reproduce `npm run build`, `npm test` (worker: 127 files / 2631 passed), `npm run lint`, `arggon validate`, `check:plugin`, `test:structure`, `lint:structure`, or CI's own lanes; green CI is necessary and I take the coordinator's word for the current run, but see **B1** for why the run that matters is the one on `93ec81b5`. I could not read the PR #605 body (no `gh`/shell in this session), so "full transcript in the PR body" is a claim I could not check — the item's table is the substance and it reproduces. I could not compute the `.convention.yml` checksums (no crypto in this runtime), so those two new entries and three refreshed ones are unverified against the bytes; they are pipeline-written by `arggon init`, and the two new files I byte-verified against their templates by hand.

## Probes needed

Run by the prover/coordinator in `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode`:

1. `git rev-parse HEAD origin/feat/task-zcode-goal-mode && git status --porcelain && git diff --stat origin/feat/task-zcode-goal-mode..HEAD`
   — *demonstrates* **B1**: that the published head equals the reviewed tip and that the only unpushed commit is the seam regeneration. *Would change*: if `HEAD != origin/…` the merge must wait; the diff should list only `.zcode-marketplace/` + `.convention.yml` + the item file.
2. `npm ci && npm run build && node dist/cli.js init --no-commit && git status --porcelain`
   — *demonstrates* the drift gate on the pushed head: expected **empty** (seam current). *Would change*: any dirty `.zcode-marketplace/` path re-creates B3 and blocks the merge.
3. `npm run arggon -- goal <a fresh fixture item> --json` and the same with `--json` from `cd cli && …`, plus `npm run arggon -- goal <an item claimed by someone else> --json`
   — *demonstrates* the refresh of cases 1/4-7 end-to-end through the built bin: expected objective + `gateUnchecked: true` + boundaries appended + exit 0, and `GOAL_FOREIGN_CLAIM` with `conventionVersion: 5` from both cwds. *Would change*: any refusal degrading into a rendered contract escalates.
4. The probe transcript for case 8 (paste the raw `--json` line)
   — *demonstrates* the exact objective byte count (238 B reported vs 240 B implied by `clip` for an ASCII criterion). *Would change*: nothing structural; a `contract` above 12288 B or a line above 200 B would.
5. `npm test -- cli/src/goal-mode.test.ts cli/src/init-zcode.test.ts cli/src/acceptance-parity.test.ts cli/src/done-gate.test.ts cli/src/cascade.test.ts`
   — *demonstrates* the rewritten corpus, the seam pins and the gate-parity suites stay green after the kernel unification. *Would change*: a failure here reopens the corpus rewrite.

## Recommendation

**Do not merge yet — three mechanical steps, all minutes of work, and no further design round is warranted.**

The feature itself is verified sound against the merged kernel: all four stale claims are now true in code, in both test headers, and in every carrier they shipped in; both removals are safe for the reasons above; the two removals leave a bound that is structural rather than conventional; the corpus rewrites reproduce exactly against `ACCEPTANCE_MARKER` / `ACCEPTANCE_TEXT` / `ACCEPTANCE_LINE_BREAK`; the probe table is honest and its 3c/3d pair is the discriminating evidence the PR exists for; the snapshot delta is one derived number; and delivery shows two real merges of `origin/main`, no force-push, and a primary checkout free of the branch's commits. Round 1's four blockers and round 2's one blocker are all genuinely closed — the round-2 input fix landed as `acceptanceBody(item)`, and this time the hazard is named as the *input* with the adapter's own corpus named as the thing that holds that line for this consumer.

What is left is delivery state and two one-line text defects: **push `93ec81b5`** (the pushed head is the one the seam drift gate rejected, and merging it as-is would re-create round 1's B3), fix the README sentence, and repair the two characters the union took out of the item's own record. Then squash-merge — no rebase, no force-push — and flip the item.

Operational note for the coordinator: this verdict is written with `tools.arggon.comment`, which resolves the tracker root to **this session's cwd** (the primary checkout), so it lands on `main`'s copy of the item — the pre-claim `status: todo` one, same as rounds 1 and 2. Because the branch already contains `origin/main`, the branch must merge `origin/main` once more (or the item-file conflict must be resolved as a union that includes this verdict) before the squash, or the merged item file will not carry it.
