---
type: task
status: in_progress
id: task-zcode-goal-mode
title: ZCode goal-mode template from item checklist (plan T5)
assignee: Arggon
branch: feat/task-zcode-goal-mode
parent: story-zcode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T23:58:06.586Z"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-goal-mode
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

- [x] template generation test
- [x] goal contract parses the checklist
- [x] documented: one goal per claimed item

## Notes

What landed (spec §S5, plan T5):

- **Generated template** `templates/docs/zcode/arggon/templates/goal-mode.md` →
  `.zcode-marketplace/arggon/templates/goal-mode.md` (tier-1, provenance +
  never-overwrite through the existing docs pipeline), plus the
  `/arggon-goal` command doc. Provenance + never-overwrite asserted in
  `cli/src/init-zcode.test.ts`.
- **Derivation** `cli/src/goal-mode.ts`: whether work remains is the **kernel's**
  answer — `acceptanceComplete` (the predicate a `done` flip is refused by), so
  the contract never tells an agent "nothing left" on an item the gate still
  refuses to close. Objective = the first unchecked criterion, verification =
  every unchecked one, clipped (240 B objective, 200 B/line, ≤ 8 inlined,
  overflow counted); gate satisfied → explicit "DEFINE THE GOAL FIRST". The
  criterion TEXT comes from a second reader (the board renderer's row parser
  over LF-normalized prose), so a disagreement renders "read the item body
  first" instead of an invented goal. Bounded prose/template reads, so a
  tampered or oversized item cannot produce an unbounded contract.
- **Boundaries appended by the CLI, not read from the template file**, so an
  adopter-edited copy cannot drop them: one goal per claimed item, one
  worktree per item, never another item's worktree, never steal/reopen, a
  reviewer dispatch stays read-only, kernel is the enforcement of record.
- **Refusals (no override flag)**: `GOAL_ITEM_CLOSED`, `GOAL_IDENTITY_UNKNOWN`,
  `GOAL_UNCLAIMED`, `GOAL_FOREIGN_CLAIM`, `GOAL_WORKTREE_MISMATCH`,
  `GOAL_WORKTREE_MISSING`, `GOAL_TEMPLATE_UNAVAILABLE`, `GOAL_FAILED`. Documented in
  `ArggonManager/docs/agents.md` §ZCode, README (`arggon goal`),
  `docs/json-output.md` (`goal`), skill `references/{json-contract,orchestration}.md`.
- **CLI surface**: `arggon goal <id> [--json]` (pure read, no lock/commit,
  no tracker auto-commit). Deliberately **no MCP tool** — it mutates nothing,
  so the fifteen-tool kernel surface is unchanged; the ZCode seam reaches it
  through the headless bin (the gate already treats `arggon …` shell
  invocations as the CLI path).

Gates: `npm run build`, `npm test` (2206 passed / 119 files), `npm run lint`,
`npm run arggon -- validate` (ok, convention v5), `npm run check:plugin`
(byte-identical). Spec/plan `status` left at `proposed` — S5's acceptance box
also covers the automations templates (sibling `task-zcode-automations`), so
it is not ticked by this item.

### 2026-10-03 @Arggon

## @Arggon — worker evidence (PR #605, branch feat/task-zcode-goal-mode)

Claim/worktree safety: all tracker writes routed through `npm run arggon -- …` with this
worktree as cwd; the native `tools.arggon.*` were not used for writes. Primary checkout
(`/home/arggon/Projects/ArggonManager`) verified on `main` @ 26c3b13b with a clean tree and
its own pre-claim copy of this item (status todo, no assignee) — none of this branch's
commits are in it (`git log --oneline origin/main..HEAD` = 2 commits, both on
feat/task-zcode-goal-mode).

### Expected vs observed (gates, post-rebase onto origin/main @ ba808947)

| gate                         | expected              | observed                                                                           |
| ---------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| `npm run build`              | ok                    | ok (build:plugin 457609 bytes)                                                     |
| `npm test`                   | green                 | 120 files, 2229 passed (119/2206 before the rebase picked up main's new test file) |
| `npm run lint`               | clean                 | clean                                                                              |
| `npm run arggon -- validate` | ok                    | `arggon validate: ok (0 warning(s), convention v5)`                                |
| `npm run check:plugin`       | bundle byte-identical | no diff                                                                            |

### Behavior, live (from this worktree)

- `npm run arggon -- goal task-zcode-goal-mode` → objective `template generation test`,
  verification 1–3 = the three unchecked boxes, `## Boundaries (hard)` +
  `## Refusals (stop and report …)` appended, `Claim holder: Arggon`.
- same command with `--json` from the primary checkout →
  `{"ok":false,…,"error":{"code":"GOAL_UNCLAIMED"}}`, exit 1 (that checkout has no claim).

### Not done here (deliberate)

- No MCP tool for `goal`: it mutates nothing, so the fifteen-tool kernel surface stays as
  it is; the ZCode seam reaches the command through the headless bin. Flagging in case the
  reviewer wants an MCP wrapper instead — that would touch the tool-count docs
  (`agents.md`, `opencode2.md`, `json-contract.md`) and `mcp-parity`.
- Spec §S5 acceptance box also covers the automation templates (`task-zcode-automations`),
  so spec/plan `status` stays `proposed` and this box is not ticked.

### handoff 2026-10-03 @Arggon — next: review PR #605 (draft): goal-mode template + `arggon goal`; decide whether an MCP wrapper is wanted instead of the headless bin

- branch: feat/task-zcode-goal-mode
- open questions: MCP wrapper for goal? would touch the fifteen-tool surface docs; goal template location (plugin templates/ dir) unverified against live ZCode

### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD

verdict: request-changes (derivation does not reuse the done gate's predicate; vendored ZCode seam left stale)

## Scope reviewed

PR #605 (branch `feat/task-zcode-goal-mode`, draft) against item `task-zcode-goal-mode`. Read: `cli/src/goal-mode.ts`, `goal-mode.test.ts`, the `goal` wiring in `cli/src/cli.ts`, `templates/docs/zcode/arggon/{templates/goal-mode.md,commands/arggon-goal.md,.zcode-plugin/plugin.json}`, `templates/docs/zcode/marketplace.json`, the doc diffs (`agents.md`, `README.md`, `docs/json-output.md`, `skills/arggon-cli/**`), the vendored `.zcode-marketplace/`, the spec/plan (`methodology-adapters-017` S5 / T5), `lib/src/items.ts`, `lib/src/update.ts`, `lib/src/show.ts`, `lib/src/frontmatter.ts`, and the seam gate `templates/docs/zcode/arggon/hooks/gate.mjs`. I ran no project gates.

---

## Verified by reading — claims that hold

**2. Bounded output is structural, and the "boundaries always survive" inversion does not occur.** `runGoal` computes the boundary block first, then budgets the _filled template_ at `MAX_GOAL_CONTRACT_BYTES - byteLength(block) - 2` and clips to that, then appends `block` verbatim. The clip can only ever shrink adopter/template prose; the block is concatenated afterwards and never clipped. I measured the block at **1,974 B** against the 12,288 B cap, so the template budget is 10,312 B and the worst case lands exactly on 12,288 B. The boundaries/refusals constants are structurally immune to a hostile item or an inflated template — this is the property you asked me to hunt for and it holds. Per-line bounds check out: `clip(live[0], 240)`, `clip(line, 200)`, `live.slice(0, 8)` with `verificationOmitted = live.length - inlined.length` (overflow **counted, never pasted**). `MAX_GOAL_PROSE_BYTES` (32 KiB) is applied to `shown.prose` _before_ `parseAcceptanceRows`, and `MAX_GOAL_TEMPLATE_BYTES` (8 KiB) at read time — both genuinely pre-parse. The `clip` helper counts the 3-byte ellipsis inside the budget, so a clipped line stays at or under max.

**3. Boundaries are appended from CLI constants — confirmed, and an adopter cannot delete them.** `GOAL_BOUNDARIES`/`GOAL_REFUSALS` are module constants; `renderBoundaryBlock` reads only those. The template file is read for the _shape_ only, and `fillSlots` fills just five slots. Stripping the template's own boundary prose cannot remove the appended block. The test "keeps the boundaries when the adopter's template copy is stripped down" discriminates: it overwrites the file with a two-line stub, then asserts the boundaries survive.

**4. Refusals are refusals, correctly decided, no override.** All seven codes are declared in `GoalErrorCode`; there is no override flag in `cli.ts` (`.argument("<id>")` plus `.option("--json")` only); and no path converts a refusal into a mode — every throw in `assertClaimed`/`assertWorktree`/`loadGoalTemplate` propagates to `goalOperation` as `ok:false`, exit 1. **Foreign claim is the important one and the core of it is right**: `assertClaimed` throws `GOAL_FOREIGN_CLAIM` when `item.assignee !== login`, and `assertWorktree` independently refuses any checkout whose realpath differs from the recorded `worktree_path`, so a goal cannot reach into another session's worktree even if the claim check is bypassed. See B2 for the one hole in the claim check itself.

**5. The ZCode seam really can reach it.** `hooks/gate.mjs` denies only `/\b(?:arggon|arggon-manager)\s+(?:--?[a-z-]+\s+)*(?:update|create|branch|start|cleanup|priority|sync|import-issues|migrate)\b/` — `goal` is absent, so `arggon goal` passes the gate, including during a reviewer dispatch, which is correct for a pure read. `plugin.json` already declares "Requires the arggon CLI on PATH", and `/arggon-board` sets the precedent for a seam command that shells to the headless bin. ADR 0020's "adapters use their agent's native mechanisms" is satisfied: Bash is native to ZCode. **No MCP tool is the right call** — it mutates nothing, and adding one would touch the fifteen-tool count in `agents.md`/`opencode2.md`/`json-contract.md` plus `mcp-parity` for zero added capability. The worker flagged this as an open question rather than deciding silently, which is right.

**6. Leaving spec/plan at `proposed` is correct.** S5 bundles the goal-mode template _and_ the automation templates, and the spec's own acceptance box reads "ZCode adapter: goal-mode template derives the objective...; automation templates run read-only scans and file items via `arggon create`". Sibling `task-zcode-automations` is still `todo` and unclaimed. The PR touches neither spec nor plan and claims S5 nowhere.

**7. The command doc names the real surface.** `arggon-goal.md` cites `arggon goal <item-id>` and `--json`, both of which exist; `mcp__arggon__arggon_show`/`arggon_start` match the spelling used by the other twelve command docs; `$ARGUMENTS` is the convention. Provenance plus never-overwrite are pinned in `init-zcode.test.ts`, and `TIER1_DOCS` carries the new template. `skills:sync` was run: `.agents/skills/arggon-cli/` matches `skills/arggon-cli/` modulo the generated header.

**Packaged fallback is sound.** `package.json` `files` ships `templates/`, so `bundledTemplatesDir()` resolves for an npm-installed bin, and the adopter-copy-wins-then-package order matches never-overwrite.

---

## Blocking findings

### B1 — The derivation does NOT reuse the done gate's predicate, and the code, docs and PR all claim it does

The claim under review is "empty `- [ ]` are skipped via the kernel's `parseAcceptanceRows` — the same predicate the done gate (ADR 0015) enforces". **That is false.** There are two independent implementations, in two different packages:

- done gate — `lib/src/items.ts:329` `acceptanceComplete(body)`, regex `/^[ \t]*[-*] \[( |x|X)\][ \t]*[^\s]/gm`, applied to `item.body` at `lib/src/update.ts:526` (and `:1046` for the cascade);
- this feature — `cli/src/board.ts:724` `parseAcceptanceRows(prose)`, regex `/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/`, applied to `shown.prose` at `goal-mode.ts:387`.

`parseAcceptanceRows` lives in the **board** module (a rendering helper for the TUI/serve drawer), not in the kernel, and it is not the predicate the done gate runs. goal-mode then adds a _third_ filter of its own (`live = unchecked.filter(row => row.length > 0)`). So "the goal reads exactly the checklist the done gate gates on" is untrue, and **the two can drift — they already do**. I ran both regexes side by side over a fixture matrix:

```
AGREE   | plain                 gate_unchecked=true  goal_has_criterion=true
AGREE   | indented              gate_unchecked=true  goal_has_criterion=true
AGREE   | star                  gate_unchecked=true  goal_has_criterion=true
AGREE   | empty box / no trail  gate_unchecked=false goal_has_criterion=false
DIVERGE | two spaces before box gate_unchecked=false goal_has_criterion=true   ("-  [ ] x")
DIVERGE | crlf                  gate_unchecked=true  goal_has_criterion=false  ("- [ ] x\r")
```

Both divergence classes are reachable, not hypothetical:

- **CRLF** — `lib/src/frontmatter.ts:9-13` explicitly tolerates `---\r\n` and splits YAML on `/\r?\n/`, so a CRLF tracker file loads fine. Its body keeps the `\r`; `.` in the board regex does not match `\r`, so `parseAcceptanceRows` returns **no row**, while the gate sees an unchecked criterion. The goal then renders "DEFINE THE GOAL FIRST — this item carries no unchecked acceptance criterion" for an item the done gate is actively refusing to close. That is precisely the inversion this review was told to hunt for. The kernel still holds the line, so it is not a safety hole — but the contract tells the agent the opposite of the truth.
- **Two spaces** (`-  [ ] criterion`, a hand-edit typo): the gate treats it as _no checklist at all_ (so the item flips to `done` freely) while the goal loops on it as a criterion.

The inaccurate claim is load-bearing prose in five places: `goal-mode.ts:16` ("the same rule the done gate applies"), `goal-mode.ts:198` ("Rows come from the kernel's own acceptance parser, so the goal reads exactly the checklist the done gate gates on"), the module header, `ArggonManager/docs/agents.md` section ZCode ("exactly as the done gate reads it"), `README.md` under `arggon goal`, and the item Notes plus the PR body.

**Fix:** export one row/criteria parser from `@arggondev/lib` next to `acceptanceComplete` (already exported at `lib/src/index.ts:46`) and have the done gate, `board.ts` and `goal-mode.ts` all consume it, then add a parity test asserting the surfaces agree over the same body. If you would rather not refactor the board in this PR, at minimum delete the "same predicate"/"exactly as the done gate" claims and record the divergence — but the shared predicate is the cheap, correct answer, and it is what the item's third acceptance box rests on.

### B2 — `GOAL_FOREIGN_CLAIM` is skipped entirely when the caller identity is unresolved

`goal-mode.ts:387-391` does `assertClaimed(item, identity ?? undefined)`, and inside `assertClaimed` the check is `if (login !== undefined && item.assignee !== login)`. An unresolved identity therefore _disables_ the foreign-claim refusal rather than falling back to refusing. The rendered contract does warn ("Caller identity could not be resolved... confirm `arggon show <id> --meta` names you before the first write") and a test pins that warning, so this is deliberate — but it means the docs' flat "a goal never targets another identity's claim" holds only when `GITHUB_USER`/`GITHUB_ACTOR`/`gh`/`git config` resolve. Given this is a pure read and the worktree check still applies, either refuse when an assignee exists but identity is unknown, or state the conditional in `agents.md`/README the way the contract text already does. As shipped, the docs overstate the invariant.

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

1. **Only one of the seven refusal codes is asserted.** `goal-mode.test.ts` asserts `GOAL_UNCLAIMED` via `envelope.error.code`; the other four refusal tests match the _message_ (`toThrow(/claimed by 'Someone-else'/)`, `/never spans worktrees/`, `/no longer exists/`). Renaming a code breaks nothing. `GOAL_TEMPLATE_UNAVAILABLE` and `GOAL_FAILED` have **no test at all** — the fallback test only covers the adopter copy being absent. The code-to-case mapping is the documented contract in `docs/json-output.md`, so assert the codes.
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
   — _demonstrates_: the goal-mode suite is green and the done-gate/cascade suites still pass, so B1's refactor has a safe landing zone. _Would change_: a failure here blocks the B1 fix.
2. A parity harness comparing `acceptanceComplete(body)` (`lib/src/items.ts`) against `parseAcceptanceRows(body)` plus goal-mode's `live` filter, over fixtures including `-  [ ] x` and a CRLF body.
   — _demonstrates_: the two predicates disagree on exactly the two classes reported and agree elsewhere; the output becomes the new parity test. _Would change_: if it reports agreement, B1 drops from blocking to a docs-only correction.
3. `npm run arggon -- init` in a scratch clone of the branch, then `diff -r` `.zcode-marketplace/` against `templates/docs/zcode/` modulo the `# arggon:generated` header.
   — _demonstrates_: the regenerated vendored copy is byte-consistent with the template source (B3's fix). _Would change_: if the regen produces a larger diff than the four files implicated, the finding widens.
4. `npm run arggon -- goal task-zcode-goal-mode`, the same with `--json`, and one from a subdirectory (`cd cli && npm run arggon -- goal task-zcode-goal-mode --json`) to observe `conventionVersion`.
   — _demonstrates_: the blocking smoke probe `engineering.md` requires for a CLI change — objective, three inlined criteria, appended boundaries, exit 0 — and confirms finding #4's `conventionVersion: 0` on a subdirectory invocation. _Would change_: the verdict cannot move to approve without the command actually being run on a fixture, whatever the unit tests say.
5. `npm run arggon -- goal <an-item-claimed-by-someone-else> --json`, and one from a foreign checkout.
   — _demonstrates_: `GOAL_FOREIGN_CLAIM` and `GOAL_WORKTREE_MISMATCH` fire in the shape an agent actually hits them, not just in a fixture. _Would change_: if either degrades into a rendered mode, escalate.

## Recommendation

**No merge.** B1 is the substance of the item's third acceptance box ("documented: one goal per claimed item") resting on a predicate claim that is false and already divergent; B3 leaves the repo's own vendored seam contradicting the template it ships; B4 is an explicit review-bar item; B2 overstates a refusal in shipped docs. All four are small and none requires re-architecting the feature — the design calls in points 2, 3 and 5 are sound and worth keeping. Per AGENTS.md each finding above needs a follow-up `task`/`bug` under `story-zcode-adapter` before merge; the non-blocking ones are already enumerated and ready to file. PR #605 is still a **draft** and should not leave draft until B1-B4 land.

## @Arggon — round-1 review response (verdict: request-changes)

**Impact class: Behavioral** (docs/agents.md §Changing the methodology itself —
this touches the carriers `docs/agents.md` and `skills/arggon-cli/**`). Agents
must re-learn: a new command contract (`arggon goal <id>`, its eight refusal
codes, `GOAL_IDENTITY_UNKNOWN` included) and a new invariant (the goal takes
"is there work left" from the DONE GATE). Per ADR 0016 the adopter-upgrade
channel applies: the change ships in the generated seam + this CLI, and the
skill and its `.agents/` copy are byte-equal in the same PR (`skills:sync` +
`cli/src/skill-copy.test.ts`).

**B1 — the central claim was false; withdrawn and fixed.** `parseAcceptanceRows`
is the BOARD renderer's parser, not the kernel's, and the done gate's predicate
is `acceptanceComplete` (`lib/src/items.ts`). `cli/src/goal-mode.ts` now asks
`acceptanceComplete` whether work remains (its verdict is exposed verbatim as
`goal.gateUnchecked`), normalizes prose to LF through the CLI's single
`normalizeEol` helper before the row parser runs, and renders an explicit
"read the item body first" shape if the gate finds work the text reader cannot.
Unification is owned by `bug-three-acceptance-parsers-diverging` (named in the
code + docs). The false claim is corrected in all five places it shipped:
module header + `deriveGoal` docstring, the test-file header, `README.md`,
`ArggonManager/docs/agents.md` §ZCode, `ArggonManager/docs/json-output.md`, the
skill references, the ZCode command doc, the goal template, and this item's
Notes.

Round-1 inversion, isolated (both regexes on the same CRLF body):

```
board rows: 0 -> []
gate criteria: 2 acceptanceComplete: false
round-1 goal said: no unchecked criterion -> true
round-1 gate said: cannot close        -> true
```

**B2 — an unresolvable identity now REFUSES** (`GOAL_IDENTITY_UNKNOWN`) instead
of disabling the foreign-claim check: the lease invariant cannot be enforced
without knowing who is asking, so nothing renders. Both directions tested
(resolved identity renders; unresolvable refuses), plus the ordering rule (a
closed item is reported before the environment, so the remedy is never
misleading).

**B3 — the checked-in `.zcode-marketplace/` was regenerated** through the real
pipeline (`arggon init --no-commit --json`: the two JSON descriptions, the new
`commands/arggon-goal.md` and `templates/goal-mode.md`), and every checked-in
copy is now byte-identical to its template modulo the generated marker line
(verified for all 19 tracked files + the 2 new ones; JSON carries no marker).
`ArggonManager/.convention.yml` carries the refreshed checksums.
Observation, NOT actioned (a coordinator/human call): the three
`.zcode-marketplace/arggon/agents/*.md` copies and four `.opencode/**` copies
are byte-identical to their templates yet still classified `modified` — their
recorded checksums predate the current marker form, so `arggon init` classifies
them adopter-modified and skips them, and their on-disk marker still reads
`template="zcode/…"` (pre-`docs/`). The sanctioned re-baseline is
`arggon adopt --ack` (a human step per docs/agents.md §Adoption sweep), so this
worker did not run it.

**B4 — impact class stated above** (Behavioral + ADR 0016), per the review-bar
item in `engineering.md`.

**Non-blocking findings, all closed:**

- every one of the eight refusal codes is now asserted against a real tree
  (table-driven in `cli/src/goal-mode.test.ts`), including
  `GOAL_TEMPLATE_UNAVAILABLE` (new `templatesDir` injection point, mirroring
  `currentGeneratedTemplatesFrom` in docs.ts) and `GOAL_FAILED`;
- a **parity corpus** pins the goal against the gate on CRLF, `- [ ]x`,
  `- [ ] x`, `*` bullets, indentation, tabs, empty boxes and uppercase `X`;
- the bounded prose read is now tested both ways (criteria inside the budget →
  inlined; criteria beyond it → the clip cannot invert the gate);
- a refusal envelope invoked from a **subdirectory** reports the tree's real
  `conventionVersion` (5) instead of the default 0 — the tracker root is
  resolved before the version is read.

Deliberately unchanged (reviewer-verified): boundaries are still appended from
CLI constants, and there is still no MCP tool for `goal`.

Gates: `npm run build`, `npm test` (120 files, 2249 passed), `npm run lint`,
`npm run arggon -- validate` (ok, convention v5), `npm run check:plugin`
(byte-identical), plus CI's `lint:structure` and `test:structure`. Probe
evidence (expected vs observed, through the built `dist/cli.js`, `--json`) is in
the PR #605 body. Spec/plan `status` stays `proposed` (S5's box also covers
`task-zcode-automations`); this item stays `in_progress`.

### 2026-10-03 @Arggon
## @Arggon — round-1 response shipped (PR #605 updated to b369506c)

**Impact class: Behavioral** (docs/agents.md §Changing the methodology itself; carriers
`docs/agents.md` + `skills/arggon-cli/**`), with the ADR 0016 adopter-upgrade channel: the
change ships in the generated seam + the CLI, the skill and its `.agents/` copy are byte-equal
in this PR, and every doc statement it falsifies was updated here.

### B1 — claim withdrawn, gate made authoritative

`parseAcceptanceRows` is the board renderer's parser, not the kernel's; the gate's predicate is
`acceptanceComplete`. `arggon goal` now asks `acceptanceComplete` whether work remains and
publishes that verdict as `goal.gateUnchecked`; the row parser supplies text only, over
LF-normalized prose; a disagreement renders an explicit "READ THE ITEM BODY FIRST" shape
(`renderable: false`) instead of an invented goal. Unification is owned by
`bug-three-acceptance-parsers-diverging` — named in the code and the docs, and the reason the
parser is NOT moved into the kernel in this PR (that is that item's design decision; moving it
here risks a fourth parser). Corrected in all five+ places it shipped (module header,
`deriveGoal` docstring, test header, README, agents.md §ZCode, json-output.md, skill
references, ZCode command doc, goal template, item Notes).

Parity corpus in `cli/src/goal-mode.test.ts` pins `hasGoal === !acceptanceComplete` over CRLF,
`-  [ ] x`, `- [ ]x`, `- [ ] x`, `*`, indentation, tabs, empty boxes and `X`.

### B2 — unresolvable identity refuses

`GOAL_IDENTITY_UNKNOWN` (new): without knowing who is asking, the lease invariant cannot be
enforced, so nothing renders. Order is by most specific cause (closed item → identity → claim →
checkout), so a closed item is never reported with an environment remedy. Both directions
tested.

### B3 — the checked-in `.zcode-marketplace/` was regenerated

Through the real pipeline (`arggon init`, `--no-commit`): the two JSON descriptions plus the new
`commands/arggon-goal.md` and `templates/goal-mode.md`, with refreshed checksums in
`.convention.yml`. Every checked-in copy verified byte-identical to its template modulo the
generated marker (19 tracked + 2 new). No CI gate covers this class, so it is stated in the PR
body too. NOT actioned (human step): three agent copies + four `.opencode/**` copies stay
`modified` from pre-existing checksum drift (recorded `sha256:bce74f…` vs on-disk
`sha256:5b749f…` for `agents/arggon-worker.md`) — the sanctioned remedy is `arggon adopt --ack`.

### B4 — stated (Behavioral + ADR 0016).

### Non-blocking — all closed

1 codes asserted for all eight refusals (incl. `GOAL_TEMPLATE_UNAVAILABLE` via a new
`templatesDir` injection point and `GOAL_FAILED`); 2+3 the bounded prose read is tested both
ways AND the clip's `clipped` flag now folds into `truncated`; 4 subdirectory invocations report
the real `conventionVersion` (5, was 0); 5 the boundary text now names the no-worktree fallback
(repo root, never a sibling's); 6 the soft cap is documented (measured block 1,974 B, ~9.3 KB
headroom); 8 clip-before-fill ordering documented. 7 deferred on purpose — see B1.

### Probe evidence (built `dist/cli.js`, `--json`, fresh temp tree per case)

Expected → observed, full transcript in the PR body:
- unchecked boxes → objective `first criterion`, verification both, `hasGoal/renderable/
  gateUnchecked` all true;
- nothing unchecked → `DEFINE THE GOAL FIRST`, and the gate then allows the flip (`ok: true`);
- **CRLF item → gate refuses the flip (`UPDATE_FAILED`) while the goal says work remains with
  readable text — they agree** (round 1 had them inverted);
- foreign claim → `GOAL_FOREIGN_CLAIM` with `conventionVersion: 5`, from the root AND from
  `sub/dir/`;
- unresolvable identity → `GOAL_IDENTITY_UNKNOWN`; unclaimed → `GOAL_UNCLAIMED`; unknown id →
  `GOAL_FAILED`;
- 5000-char criterion → objective 238 B, lines ≤ 200 B, contract 5,046 B ≤ 12,288 B cap,
  boundaries intact.

Gates: `npm run build`; `npm test` 120 files / 2251 passed; `npm run lint` clean;
`npm run arggon -- validate` ok (v5); `npm run check:plugin` byte-identical; CI's
`lint:structure` + `test:structure` green; the verdict's own probe list
(`goal-mode + init-zcode + done-gate + cascade`) → 4 files / 89 tests passed.

### History: no force-push

A rebase onto origin/main was prepared and verified (the item-file conflict resolved by keeping
BOTH records — this verdict plus my evidence/handoff/round-1 response). Publishing it would need
a force-push, which is refused; instead the published history is intact and the round-2 commits
sit on top (fast-forward `505f8c3e..b369506c`), content-identical to the rebased tip for every
file this PR owns. The linear rebase, if you prefer it, is yours to force-push.

Item stays `in_progress`; spec/plan `status` stays `proposed` (S5 also covers
`task-zcode-automations`).

### handoff 2026-10-03 @Arggon — next: re-review PR #605 at b369506c: B1/B2/B3/B4 + all non-blocking addressed; probe evidence in the body
- branch: feat/task-zcode-goal-mode
- open questions: want the linear rebase (force-push, yours)?; three agent copies need adopt --ack (human step); parser unification left to bug-three-acceptance-parsers-diverging

### 2026-10-03 @Arggon
## @Arggon — round-2 finding fixed: the gate verdict now reads the canonical body (PR #605 @ 5c367a10)

One blocking finding survived, and it was the input, not the predicate:

```
lib/src/update.ts:526    !acceptanceComplete(item.body)      // done gate
cli/src/goal-mode.ts     !acceptanceComplete(shown.prose)    // goal  <-- comment sections stripped
```

`shown.prose` drops comment sections, and a checklist filed as an `arggon comment` is a
first-class shape here (`create` has no `--body` flag; `bug-empty-template-checkbox` is the stale
empty box that shape leaves behind). Per the reviewer's measurement (21 of 280 commented items
disagree), a goal could say "nothing left to do" on an item the gate still refused to close.

**Fix:** both the verdict and the criterion text now read `item.body` — the same canonical input
`update.ts:526` reads. The invariant is stated where a future reader hits it ("one canonical
body, every predicate — a reader that trims or filters before calling has changed the question"):
module header, `deriveGoal` doc, the `gateUnchecked` field doc, and an inline comment at the call
site naming `update.ts:526` plus the comment-filed shape.

**Tests (three added, and the corpus helper's contract made explicit):**
1. corpus case — the ONLY boxes live in a comment section (`gateUnchecked: true`, objective read
   from the comment);
2. its twin — checked-in-a-comment only ⇒ gate satisfied, "DEFINE THE GOAL FIRST";
3. a regression test that pins the defect itself: a comment-stripped input still yields
   `hasGoal: false` while `acceptanceComplete(full body)` is false — i.e. the round-2 build's
   inversion, asserted rather than described;
4. end-to-end: a real `arggon comment` is appended and gate/goal agreement is asserted.

`deriveAsRun` was passing the full body by construction — that is exactly why the corpus never
saw this; its doc comment now says so. Verified the e2e test bites: with the two reverted lines,
1 failed / 40 passed; with the fix, 41 passed.

### Probe (built `dist/cli.js`, `--json`) — before/after on the same fixture

```
before (round-2 build):  gate {'ok': False, 'error': 'UPDATE_FAILED'}
                         goal {"objective": "DEFINE THE GOAL FIRST: …", "hasGoal": false,
                               "gateUnchecked": false, "checklist": {"total": 0, …}}
after:                  gate {'ok': False, 'error': 'UPDATE_FAILED'}
                         goal {"objective": "criterion filed in a comment", "hasGoal": true,
                               "renderable": true, "gateUnchecked": true,
                               "checklist": {"total": 1, "unchecked": 1, "checked": 0}}
```

### PR body corrected

The stamp drift is **15** mismatches, not the 7 I first reported — main already carries the same
15; this PR adds two `x-generated` entries (`.zcode-marketplace/arggon/commands/arggon-goal.md`,
`.zcode-marketplace/arggon/templates/goal-mode.md`) plus refreshed checksums for the two JSON
destinations, and all four match their committed bytes byte-for-byte. The three agent copies I
cited first are inside that pre-existing 15 (recorded `bce74f…` vs on-disk `5b749f…` for
`arggon-worker.md`, stamps predating the hand-synced #589 change). Nothing introduced, nothing
worsened; CI excludes `.convention.yml` by design, so the drift is ungated — stated, not fixed.
The re-baseline (`arggon adopt --ack`) is a human step and was not run.

### Merge

Acting on the reviewer's ruling: **squash-merge**, no force-push needed and none attempted (the
push was a fast-forward `61e80edb..5c367a10`). The conflicting state is confined to the item
file and both sides are additive. The coordinator performs the squash and the flip.

### Gates (build BEFORE test, per the pack-parity gate)

`npm run build` → ok; `npm test` → 120 files, 2255 passed; `npm run lint` → clean;
`npm run arggon -- validate` → ok (0 warnings, convention v5); `npm run check:plugin` →
byte-identical. Parser unification deliberately untouched (`bug-three-acceptance-parsers-diverging`).

Item stays `in_progress`; spec/plan `status` stays `proposed`.
