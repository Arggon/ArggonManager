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

Goal-mode contract (spec §S5, plan T5): the generated seam file
`.zcode-marketplace/arggon/templates/goal-mode.md` (provenance + never-overwrite) plus
`arggon goal <id>`, which instantiates it for ONE claimed item. Current shape after
`bug-three-acceptance-parsers-diverging` (PR #611): the objective, the verification
contract and the done gate's refusal set are all the KERNEL's rows — `acceptanceRows` /
`acceptanceUnchecked` over `acceptanceBody(item)` (the whole body, comment sections
included) — so there is one grammar and one canonical input, and the contract cannot
disagree with the gate or with its own text. Which lines are rows is decided in
`docs/convention.md` §Acceptance rows; the kernel's parity corpus is
`cli/src/acceptance-parity.test.ts`, this adapter's own corpus is
`cli/src/goal-mode.test.ts`. Bounded on the ROWS (clipped lines, at most 8 inlined, the
rest counted) and on the template copy. Boundaries and refusals are appended by the CLI
from constants, never read from the template file; refusals (no override flag) are
`GOAL_IDENTITY_UNKNOWN`, `GOAL_ITEM_CLOSED`, `GOAL_UNCLAIMED`, `GOAL_FOREIGN_CLAIM`,
`GOAL_WORKTREE_MISMATCH`, `GOAL_WORKTREE_MISSING`, `GOAL_TEMPLATE_UNAVAILABLE`,
`GOAL_FAILED`. One goal per claimed item, one worktree per item (an item that records
no worktree is scoped to the repo root). Deliberately no MCP tool: the command mutates
nothing, so the kernel's tool surface is unchanged.

### 2026-10-03 @Arggon
## @Arggon — worker evidence (PR #605, branch feat/task-zcode-goal-mode)

Claim/worktree safety: all tracker writes routed through `npm run arggon -- …` with this
worktree as cwd; the native `tools.arggon.*` were not used for writes. Primary checkout
(`/home/arggon/Projects/ArggonManager`) verified on `main` @ 26c3b13b with a clean tree and
its own pre-claim copy of this item (status todo, no assignee) — none of this branch's
commits are in it (`git log --oneline origin/main..HEAD` = 2 commits, both on
feat/task-zcode-goal-mode).

### Expected vs observed (gates, post-rebase onto origin/main @ ba808947)

| gate | expected | observed |
| --- | --- | --- |
| `npm run build` | ok | ok (build:plugin 457609 bytes) |
| `npm test` | green | 120 files, 2229 passed (119/2206 before the rebase picked up main's new test file) |
| `npm run lint` | clean | clean |
| `npm run arggon -- validate` | ok | `arggon validate: ok (0 warning(s), convention v5)` |
| `npm run check:plugin` | bundle byte-identical | no diff |

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

### handoff 2026-10-03 @Arggon — next: coordinator: squash-merge PR #605 @ 5c367a10 and flip the item; no worker action left
- branch: feat/task-zcode-goal-mode
- open questions: adopt --ack still owed by a human for the 15 pre-existing stamp mismatches; parser unification deferred to bug-three-acceptance-parsers-diverging

### 2026-10-03 @Arggon
## @Arggon — pass 3: the kernel owns the grammar now (PR #611 merged); four claims corrected

`bug-three-acceptance-parsers-diverging` (PR #611) is on main, so this adapter no longer has a
"second parser" story to tell. Corrected by grep, not from a list (a claim naming the wrong owner
is how this class started).

**The four stale claims — resolved, with what the code now does:**

1. **"there are TWO parsers, not one"** → there is ONE. `cli/src/goal-mode.ts` reads
   `acceptanceRows` / `acceptanceUnchecked` over `acceptanceBody(item)`: the objective, the
   verification contract and the `done` flip's refusal set are the same rows, from the same
   functions, over the same bytes. The board's `parseAcceptanceRows` import is gone.
2. **`cli/src/board.ts` "CRLF-blind"** → the kernel walks the whole ECMAScript **LineTerminator**
   set (`ACCEPTANCE_LINE_BREAK`), so CRLF and U+2028/U+2029 bodies need no special case
   (`docs/convention.md` §Acceptance rows, PR #613).
3. **`normalizeEol` "not cosmetic"** → **NOT NEEDED, removed.** The kernel's marker is CRLF-safe and
   `acceptanceBody` deliberately does not normalize (adding a second representation "for no gain"),
   so the normalization step and its import are gone rather than kept with a new justification.
4. **`UNRENDERABLE` (reader/gate disagreement)** → **unreachable with one grammar; removed**, with
   `goal.renderable` from the envelope and the docs. Two shapes remain: a goal, or an explicit
   "DEFINE THE GOAL FIRST".

Also removed: the input cap `MAX_GOAL_PROSE_BYTES` — capping a reader's bytes is exactly what made
a lost criterion read as "everything inlined" (round-1 finding 3). The bound is now on the ROWS
(240 B objective, 200 B/line, ≤ 8 inlined, the rest counted in `verificationOmitted`, any
clipping/deferral setting `truncated`), which is the kernel's own guidance for a consumer that
renders rows.

**Where the claims shipped, all corrected:** module header, `deriveGoal` doc, `gateUnchecked` field
doc, call-site comment, both test headers, `README.md`, `docs/agents.md` §ZCode,
`docs/json-output.md` §goal, `skills/arggon-cli/references/{json-contract,orchestration}.md`, the
ZCode command doc, the goal template, and this item's `## Notes` (the dated verdicts are history and
were left untouched). The canonical-body invariant is now stated where a reader hits it and points at
the kernel accessor that owns it; the live hazard is the INPUT, not the grammar.

**Tests re-run against the merged kernel:** corpus cases that assumed the old two-parser world were
rewritten — `- [ ]x` is now rendered as the one-character criterion `x` (convention.md says it IS a
row) instead of the old "READ THE ITEM BODY FIRST" shape; the two prose-clip tests were replaced by
row-cap tests; new cases pin the shapes the kernel decides — `-  [ ] x` and a tab before the box are
NOT rows (so nothing opens a goal), and U+2028/U+2029 bodies parse like LF. `deriveAsRun`'s doc now
says why it must take the whole body (that shortcut is what hid the round-2 defect).
`cli/src/adapter-selection.test.ts`'s `doctor --agents` snapshot counted the seam's files: 19 → 21
(this PR's two new files); that one-line snapshot change is the only other edit.

**Probe evidence, refreshed against the merged kernel** (built `dist/cli.js`, `--json`, fresh temp
tree per case; full transcript in the PR body):

```
1   unchecked boxes        -> objective "first criterion", verification both, gateUnchecked true
2   nothing unchecked      -> DEFINE THE GOAL FIRST, and the gate then ALLOWS the flip
3   CRLF item              -> gate UPDATE_FAILED, goal hasGoal true, objective "crlf criterion"
3b  comment-filed checklist-> gate UPDATE_FAILED, goal objective "criterion filed in a comment"
3c  -  [ ] x / -\t[ ] x    -> gate allows the flip, goal hasGoal false (same verdict)
3d  - [ ]x / - [ ] x       -> both rows: objective "x", verification ["x","x"]
3e  U+2028-separated body  -> gate UPDATE_FAILED, goal objective "second line row"
4-7 refusals               -> GOAL_FOREIGN_CLAIM (root AND subdir, conventionVersion 5),
                               GOAL_IDENTITY_UNKNOWN, GOAL_UNCLAIMED, GOAL_FAILED
8   5000-char criterion    -> objective 238 B, lines <= 200 B, contract 5203 B <= 12288 B cap,
                               boundaries intact
```

**Gates** (build BEFORE test, per the pack-parity gate): `npm run build` ok;
`npm test` 127 files / 2631 passed; `npm run lint` clean; `npm run arggon -- validate` ok (v5);
`npm run check:plugin` byte-identical; `npm run test:structure` 5 ast-grep tests passed (incl. the
new `acceptance-rows-use-kernel` rule); `npm run lint:structure` green.

**Delivery:** `origin/main` merged into this published branch (item file resolved as a UNION — every
`###` comment block from both sides, main's frontmatter; no stashing used). The push was a
fast-forward `38db079d..954559b2`; **no force-push, none attempted.** The PR is now marked **ready
for review**; the coordinator squash-merges and flips.

Unchanged on purpose: boundaries still appended from CLI constants; still no MCP tool; the
15 pre-existing stamp mismatches on main remain stated-not-fixed (`arggon adopt --ack` is a human
step). Spec/plan `status` stays `proposed`; this item stays `in_progress`.

### handoff 2026-10-03 @Arggon — next: coordinator: squash-merge PR #605 (now ready for review) and flip the item
- branch: feat/task-zcode-goal-mode
- open questions: nothing outstanding on this item; adopt --ack for the 15 pre-existing stamp mismatches stays a human step

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

### 2026-10-03 @Arggon
Round-3 review closed: B1/B2/B3 fixed, published. Branch tip `92aff9e1` == worktree tip == remote tip.

**B1 — the reviewed tip is now published (the real blocker).** `git ls-remote origin refs/heads/feat/task-zcode-goal-mode` → `92aff9e1426ce409f63847b33b1662f0ea5375b0`, identical to this worktree's `git rev-parse HEAD`. The push was `9686798d..92aff9e1` — a **fast-forward**, `origin/main` contained first (`git merge-base --is-ancestor origin/main HEAD` → yes), **no force-push and none attempted** (the branch stays published and un-rebased for the coordinator's squash).

What the push carries, in order:
- `93ec81b5` — the seam regeneration, which is exactly what makes `tasks-validate` green (below)
- `92aff9e1` — the `origin/main` merge with B2/B3 below and the two cheap non-blocking fixes

**The drift gate is green at this head, proven the way CI runs it** (`.github/workflows/arggon.yml`, job `tasks-validate`, step "Committed seam is current"; `ARGGON_VERSION: "0.5.0"` read from the workflow's own literal):
```
--- step 1: committed provenance marker present?  yes
--- step 2: pinned-lag (COMMITTED state via git show HEAD:…)  newest committed stamp = 0.5.0 (not ahead of the pin)
--- step 3: re-generate with this checkout's own build, then require a clean tree
    clean (exit 0)
--- state-file-only changes (documented exclusion):  M ArggonManager/.convention.yml
GATE RESULT: PASS
```
Reproduced-then-fixed, so the failure was real and is now gone: before `93ec81b5`, `node dist/cli.js init --no-commit` left exactly ` M .zcode-marketplace/arggon/commands/arggon-goal.md` and ` M .zcode-marketplace/arggon/templates/goal-mode.md`. Both are now byte-identical to their templates modulo the marker line (`diff <(tail -n +3 seam) <(tail -n +2 template)` is empty; marker `# arggon:generated template="zcode/arggon/…"`).

**On "was the seam hand-edited?" — no, and that is the finding.** Round 3 edited only `templates/docs/zcode/**`; the committed seam still carried the round-1 generator's bytes. An omission, not a hand-edit, so there was nothing to reverse. Regenerated with the gate's own remedy (`npm ci --ignore-scripts && npm run build && node dist/cli.js init`, `--no-commit` so nothing is silently staged) and committed **with** the template change, not after it.

**B2 — the botched README sentence, re-read in full.** `README.md` now says:

> Bounded output: the objective and each verification line are byte-clipped, at most 8 criteria are inlined and the rest are counted in `verificationOmitted` (clipping the ROWS is the kernel's guidance for a consumer that renders them), and the template copy is clipped before rendering — so a tampered or oversized item (or an inflated template) cannot produce an unbounded contract.

Every clause is a thing the code does (`MAX_OBJECTIVE_BYTES`, `MAX_VERIFICATION_LINE_BYTES`, `MAX_INLINED_CRITERIA`, `verificationOmitted`, the template-copy cap, `truncated`) — no leftover "a clipped rows".

**B3 — both union artifacts, and one more found while proving it.** Repaired in the merge commit `92aff9e1`:
- the two-spaces evidence cell is back: line 182 reads `DIVERGE | two spaces before box gate_unchecked=false goal_has_criterion=true   ("-  [ ] x")`
- the round-2 `### …@…` heading is on its own line, so `parseComments` can see it

Verified the way you asked (`lib/src/show.ts` `parseComments` matches `^### (\d{4}-\d{2}-\d{2}) @(\S+)\s*$` — a heading must be the WHOLE line): **11 dated headings, 11 alone on their own line, 0 glued and 0 with trailing content** (that is a stricter check than the one you ran, because the artifact you found was heading-*first*-then-prose, not prose-then-heading — a date-and-`@`-pattern scan catches only the latter). The item file still parses: `npm run arggon -- validate` → `ok (0 warning(s), convention v5)`, and `arggon show task-zcode-goal-mode --json` returns the item with its claim.

**While proving "nothing was lost" I found a third record defect, also fixed.** The auto-merge had kept *this branch's* copy of the round-1 verdict — which an earlier union had already truncated to a fragment — and dropped main's complete copy: the fragment was missing `## Scope reviewed`, `## Blocking findings` and the `verdict: request-changes (…)` line, i.e. the verdict's own summary. The union is now rebuilt deterministically: all of this side's blocks plus all of main's, interleaved in true chronology (evidence → round-1 verdict → round-1 response → round-2 verdict → round-2 response → pass-3 note → round-3 verdict), main's complete text winning for a block that exists on both sides. All three verdicts' bodies and headings are present (`derivation does not reuse` ×1, `round 2 —` ×3, `round 3 —` ×1).

**One deliberate deviation from "main's frontmatter", flagged rather than hidden:** main's copy of this item carries **no claim at all** (`status: todo`, no `assignee`/`branch`/`claimed_at`/`worktree_path`) because the claim commit lives on this branch. Taking main's frontmatter verbatim would have unclaimed an in-flight item whose worktree exists, so the union keeps this branch's live claim fields on top of main's metadata. That is the only field-level departure; the comment record is a union as instructed.

**Non-blocking, the two cheap ones done:**
- `cli/src/board.ts:757` — the clause no longer names `cli/src/goal-mode.ts` as an importer; it now reads that the alias is kept for the drawer tests and adopter-side callers, "since the unification the ZCode goal contract reads the kernel directly, like every other consumer".
- **`GOAL_WORKTREE_MISMATCH` probe added**, and it discriminates: the item's recorded `worktree_path` points at a *real* sibling checkout (so `GOAL_WORKTREE_MISSING` cannot be what fired), and the same item renders from inside it —
```
$ arggon goal task-wrongwt --json      # from the checkout that is NOT the recorded worktree
{'ok': False, 'code': 'GOAL_WORKTREE_MISMATCH', 'conventionVersion': 5}
$ (cd "$RECORDED_WORKTREE" && arggon goal task-wrongwt --json)
{"objective": "a criterion", "hasGoal": true, "gateUnchecked": true}
```
  My first version of this probe was **wrong and said nothing**: it appended `worktree_path:` at the end of the file, i.e. into the *body*, so the frontmatter had none and the command correctly rendered (`recorded: false`). Two independent shapes now recorded in the probe. All 13 probe cases re-run green, and the case is in the PR body.
- **Delivery-note wording** — the PR body said "The push is a fast-forward" while the push had not happened; it now names the actual range `9686798d..92aff9e1`, and the item-file note says precisely what the union did (above) instead of the shorthand "main's frontmatter".

**Not fixed here, and why:** `ArggonManager/docs/convention.md:150`'s "still needs `cli/src/acceptance-parity.test.ts`, which asserts each consumer reads `acceptanceBody(item)`" is an overstatement — the suite hands `acceptanceBody(item)` to both consumers itself, so a wrong call site stays green. That is exactly the open bug `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` (status `todo`, parent `story-spec-pipeline`), and the sentence is the claim that bug exists to retire. Editing the carrier doc here would pre-empt that item's scope under a Behavioral impact class, so it is left for its owner rather than duplicated here.

**Gates on the pushed tree** (`npm run build` before `npm test`, in the worktree at `92aff9e1`):

| gate | observed |
| --- | --- |
| `npm run build` | ok — build:plugin 459439 bytes |
| `npm test` | green — 127 files, 2633 passed |
| `npm run lint` | clean |
| `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` |
| `npm run check:plugin` | bundle byte-identical, no diff |
| `npm run test:structure` | 5 ast-grep tests passed (incl. `acceptance-rows-use-kernel`) |
| `npm run lint:structure` | green |
| `tasks-validate` drift gate | PASS (transcript above) |

PR #605 body updated with the new probe, the seam/drift-gate note, the corrected delivery note and the refreshed gate numbers; head is `92aff9e1`, mergeable, ready for review.

Item stays `in_progress`; spec/plan `status` stays `proposed` (§S5's box also covers `task-zcode-automations`); the 15 pre-existing stamp mismatches remain stated-not-fixed (`arggon adopt --ack` is a human step).

### handoff 2026-10-03 @Arggon — next: coordinator: squash-merge PR #605 (head 7cf2c62f, mergeable, gates green, tasks-validate drift gate PASS) then flip the item
- branch: feat/task-zcode-goal-mode
- open questions: docs/convention.md:150 overstatement left for open bug-parity-suite-cannot-catch-wrong-input-at-call-sites; 15 stamp mismatches await human arggon adopt --ack

### 2026-10-03 @Arggon
CI confirms the round-3 closeout at head `7f358df4` — the gate that was red is green, and the other two jobs agree:

```
cli              pass  5m47s   (run 37131468593)
tasks-validate   pass  32s     (run 37131468597)   ← the seam drift gate
ui-smoke         pass  2m11s   (run 37131468593)
```

`tasks-validate` is the job that rejected the pre-`93ec81b5` head for stale `.zcode-marketplace/` bytes; it now passes on the committed seam, matching the local run of the same step (marker present, committed stamp `0.5.0` not ahead of the pin, re-generate → clean).

Branch and worktree tip are both `7f358df4e950a29425a50c301df6f271fba4cab1`, identical to `origin/feat/task-zcode-goal-mode` and to PR #605's head; the primary checkout is clean on `main` and contains none of these commits. Item stays `in_progress`; PR #605 is ready for review, and the squash-merge is the coordinator's call.

### 2026-10-03 @ses_efe0cc7a9ffekSptdyYXLmvnoT
verdict: request-changes (round 4 — B1 and B2 confirmed closed by reading; B3's repair split a verdict and reset the acceptance checklist, so the record is still wrong)

## Scope reviewed

All reads through the **worktree** `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode` (the primary's copy of the item is pre-merge state, as instructed). Reviewed: the item file in the worktree read **whole** (1,535 lines) and block-by-block against the primary's copy; `.git/refs/heads/feat/task-zcode-goal-mode`, `refs/remotes/origin/feat/task-zcode-goal-mode`, both reflogs, `COMMIT_EDITMSG`; the full 20-file `.zcode-marketplace/` seam byte-compared against `templates/docs/zcode/`; `README.md`, `cli/src/board.ts`, `lib/src/verdict.ts`; and a 37-path spot sweep of branch vs main. **No gate executed** — no build, no test suite, no smoke. The only executions were byte/diff comparisons of files and git metadata I read.

---

## B1 — confirmed closed, and the proof is a reproduction

Branch, worktree and remote-tracking ref are all `53ce55d4`, and `logs/refs/remotes/origin/feat/task-zcode-goal-mode` ends with `7f358df4 → 53ce55d4 … update by push` — the tip **is** published (round 3's blocker). The branch reflog shows the round-4 sequence honestly: `93ec81b5` (seam regen) → `92aff9e1` (merge `origin/main`, "item file resolved as a union") → three `chore(tasks)` commits → `53ce55d4`. No force, no rebase.

I did not take the "byte-identical modulo the marker" claim on trust. **All 20 vendored seam files** are byte-identical to their templates after stripping the generator's marker line — including the two new ones — and 18 of 20 carry the marker in exactly the form their long-standing siblings carry (`# arggon:generated template="zcode/…"`, `// arggon:generated …` for `gate.mjs`; the two JSONs carry none). So the marker allowance is **the pipeline's own output shape, not an exemption invented to make the comparison pass**: a file that is "template + generator marker line" is what `arggon init` writes, and the gate's real test is not a byte diff at all but `node dist/cli.js init --no-commit` followed by `git status --porcelain` with only `*.convention.yml` excluded (verified in `.github/workflows/arggon.yml`). On that test the current tree is clean by construction — every managed file equals its render.

"Omission, not hand-edit" is consistent with the bytes: a hand-edit would show as a vendored file that differs from its template; none do. What I could **not** do is diff `93ec81b5` itself (no git in this session), so "before `93ec81b5`, init left exactly those two files modified" is a claim I take on the worker's transcript — it is also moot, since the state it describes no longer exists and the gate is green.

## B2 — confirmed closed

`README.md` now reads: *"Bounded output: the objective and each verification line are byte-clipped, at most 8 criteria are inlined and the rest are counted in `verificationOmitted` (clipping the ROWS is the kernel's guidance for a consumer that renders them), and the template copy is clipped before rendering…"*. Every clause maps to a thing the code does (`MAX_GOAL_OBJECTIVE_BYTES`, `MAX_GOAL_VERIFICATION_BYTES`, `MAX_GOAL_VERIFICATION_LINES`, `verificationOmitted`, `MAX_GOAL_TEMPLATE_BYTES`). `a clipped rows` is gone. `cli/src/board.ts:757` is fixed too — the alias clause now says the ZCode goal contract "reads the kernel directly, like every other consumer", which is true (`goal-mode.ts` imports `acceptanceRows` from `@arggondev/lib`; no board import).

---

## B3 — the two named artifacts are fixed, but the repair introduced two new record defects

**What is genuinely whole now, read directly (not by count):** the round-1 verdict is present **verbatim and contiguous** (`### 2026-10-03 @ses_f00…` at line 138, 18,410 chars, zero conflict markers, opening `verdict: request-changes (derivation does not reuse the done gate's predicate; vendored ZCode seam left stale)` and closing with its own `**No merge.**` recommendation). The round-2 verdict is likewise verbatim and contiguous at line 472 (13,723 chars, zero markers, opening `verdict: request-changes (round 2 — …`). The worker is right that main's complete text won and the truncated fragment no longer stands in for it.

**New defect 1 — my round-3 verdict is split, and its tail is attributed to another reviewer.** This is the direct read you asked for, and it fails. My verdict's B3 bullet quotes a glued heading as evidence:

> `- \`task-zcode-goal-mode.md:884\` runs the round-2 verdict's heading onto the previous line: \`… deferred to bug-three-acceptance-parsers-diverging### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD\`.`

In the branch that single line has been **split at the quoted text**, and the quoted heading now sits alone at column 0:

```
878  ### 2026-10-03 @ses_efe0cc7a9ffekSptdyYXLmvnoT      ← me: the verdict, 15,012 chars, ends mid-bullet
954  ### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD      ← NOT me: 9,058 chars starting ". `lib/src/show.ts` `parseComments` matches…"
```

Line-level diff against the primary's copy: 123 of my 124 lines align; the one that does not is exactly that bullet, now 4 lines instead of 1. So **no content is lost, but ~40 lines of my verdict — my B3 bullet's second half, my non-blocking list, my `## Probes needed`, my `## Recommendation` and the operational note — are now recorded under another reviewer's session id.** This is the same defect class as round 3's B3 (a comment-boundary pattern inside quoted text re-interpreted as a real boundary), reproduced by the operation written to remove it, and it is introduced by the round-4 union rebuild: the primary's copy of that verdict is intact (one contiguous 24,070-char block), so the split exists only in the branch.

It has a machine-read consequence, not just a cosmetic one. `lib/src/verdict.ts` `parseVerdicts` increments `order` on **any** line matching `/^###\s/` and keeps only the first verdict-looking line per comment, then `classifyVerdicts` takes the latest by (date, order). In the branch's file the verdict-carrying comments are: round-1 (138) → round-2 (472) → round-3 (878) → **round-2's marker-laden duplicate (1201)**. The 954 continuation carries no header line, so it contributes nothing. **The verdict a reader or `arggon sync --json` classifies as "latest" on the merged file is round 2's, not round 3's.** That is stale today only by luck (both are `request-changes`).

**Why the worker's check passed anyway, and what would catch it:** "N dated headings, each the WHOLE line, 0 glued, 0 with trailing content" is a *heading-shape* check. The spurious heading at 954 is perfectly formed — whole line, column 0, nothing trailing — so shape cannot see it. The check that catches it is **block identity against the source comment**: each comment block must equal, verbatim, one comment as it exists on the side it came from (author, order, and content), with no block that is a fragment of another. Count verdicts per author and per round and compare against the source; do not infer structure from heading geometry.

**New defect 2 — the acceptance checklist was reset from `- [x]` to `- [ ]`.** Round 3's branch copy had all three boxes ticked; the primary's pre-claim copy has them unticked; the rebuilt union took the primary's `## Acceptance` block, so the branch now reads `- [ ] template generation test` / `- [ ] goal contract parses the checklist` / `- [ ] documented: one goal per claimed item`. This is a functional regression, not a formatting one: the **done gate reads `item.body`**, so an item whose own acceptance boxes are unticked **cannot be flipped to `done` at all** — the coordinator's flip would be refused by `UPDATE_FAILED`, and the DoD in AGENTS.md ("acceptance checklist complete + `status: done` + PR merged") is unsatisfiable until the ticks are restored. It is also the one item whose record this PR's whole review history is about: round 1's B1 was filed because box 3 ("documented: one goal per claimed item") rested on a false claim, and the ticks are the dated evidence that it was closed. The union rule needs a precedence that is not simply "main wins" — for the **Acceptance section**, the side that ticked them is the side with the evidence.

**Non-blocking, but do it in the same commit while the file is open:** 439 conflict-marker lines (`<<<OURS>>>` ×308, `<<<THEIRS>>>` ×131) are still committed in the item file, across six marker-laden blocks — 251 (105 markers, a mangled round-1 duplicate that even carries worker handoff text), 584, 751, 1005, 1201 (110 markers, a duplicate of round-2's verdict that is what currently wins the "latest verdict" race). These predate round 4, and the rebuild chose to keep *both* sides' blocks, so they persist. `validate` passes and no gate reads them, so this is noise rather than error — but a record with six half-blocks and 439 conflict markers is not one a future reviewer can cite.

---

## Point-by-point on what you asked me to judge

**3 — the new `GOAL_WORKTREE_MISMATCH` probe.** The vacuousness claim is **correct and provable from the code**: `writeWorktreePath` writes into frontmatter, while the first version appended `worktree_path:` at the end of the *file* — i.e. into the body — so `item.worktreePath` was `undefined`, `assertWorktree` returned at `if (!recorded) return;` (`goal-mode.ts:415`), and the command correctly rendered with `recorded: false`. A probe that asserts "it refuses" could not have distinguished that from a regression. The replacement shape is right: a real sibling checkout recorded as `worktree_path`, so `GOAL_WORKTREE_MISSING` cannot be what fired, plus the same item rendering from inside it. One qualification: the probe as recorded is a **transcript**, so its regression value is manual; the CI-covered guard is `goal-mode.test.ts`'s refusal table, which asserts `error.code === "GOAL_WORKTREE_MISMATCH"` with a frontmatter `worktree_path`. "It discriminates" is true of the unit test, and of the probe as a re-runnable recipe — not of the lane.

**4 — the flagged frontmatter deviation: correct, and I checked every field.** Union frontmatter = the primary's for every field the primary has (`type`, `id`, `title`, `parent`, `labels`, `created`, `updated`, `depends_on` — all identical strings), with exactly one departure plus the four fields the primary lacks: `status: in_progress` (primary: `todo`) and `assignee`, `branch`, `claimed_at`, `worktree_path`. Taking the primary's frontmatter verbatim would have stripped a live claim whose worktree exists — the tracker-root hazard is real, so the deviation is right. No field is taken from the wrong side, and `worktree_path` is **not** stale: it resolves to a live linked worktree (its `.git` points at `…/.git/worktrees/ArggonManager-task-zcode-goal-mode`, which exists). The residual `in_progress` vs `todo` divergence between the two copies is inherent and the flip resolves it.

**5 — the `convention.md:150` deferral: accept.** It is precisely the sentence `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` (todo, unowned, parent `story-spec-pipeline`) exists to retire, and editing a methodology carrier from a Behavioral PR would pre-empt that item's scope. Two conditions on the acceptance: **do not add `depends_on` to this item** — that inverts the dependency and would gate the goal item on an unrelated docs fix; the enforcement belongs on the bug item's side (get it claimed). And the deferral is safe for readers because `agents.md` §ZCode's own sentence is self-sufficient — it names the kernel corpus *and* this adapter's own corpus for the input, so nobody is misled by the linked section's overstatement. A one-line parenthetical in `agents.md` is available later if the coordinator would rather close it now.

**6 — nothing unexpected moved.** Every difference in my 37-path sweep is on the goal-mode surface: `cli/src/goal-mode.ts` + test (new), `cli/src/cli.ts` (wiring), `cli/src/board.ts` (the one-clause fix), `cli/src/init-zcode.test.ts`, `cli/src/adapter-selection.test.ts` (19→21), `README.md`/`agents.md`/`json-output.md`/`skills/**`/`.agents/skills/**`, `templates/docs/zcode/**` (two new + two JSON descriptions), `.zcode-marketplace/**` (two new + two JSON), `.convention.yml`, and the item file. Byte-identical to main: `lib/src/items.ts`, `update.ts`, `show.ts`, `acceptance-parity.test.ts`, `docs.ts`, `skill-copy.test.ts`, `convention.md`, `engineering.md`, both workflows, `package.json`, `hooks/gate.mjs`, the ast-grep rule. This is a spot sweep over the plausible surface, not an exhaustive diff — the exhaustive list is **P1**.

**Smoke bar:** unchanged and correctly handled. The applicable bar is `engineering.md` §Smoke test (probe the changed command on a fixture, expected vs observed, prefer `--json`); the probe set now covers 13 cases including the worktree mismatch from both sides. `smoke:opencode*` remains model-driven, quota-bound and OpenCode-seam-scoped, and red on clean `main` (`task-file-smoke-opencode-red-on-main`) — correctly not required here. No UI/TUI surface touched.

**Unverified / not run:** no gates by me. I did not reproduce `npm run build`, `npm test` (worker: 127 files / 2633 passed), `lint`, `validate`, `check:plugin`, `test:structure`, `lint:structure`, or any CI lane; I take the coordinator's word for the CI result at the published head. I could not read the PR #605 body, so the item-note and PR-body claims are only cross-checkable against each other, not against the PR. I cannot diff `93ec81b5` (no git in this session), nor compute `.convention.yml` checksums (no crypto), so the two new + three refreshed entries stay pipeline-asserted.

## Probes needed

1. `git -C /home/arggon/Projects/ArggonManager-task-zcode-goal-mode diff --stat origin/main...HEAD` (and `git status --porcelain` → expect empty)
   — *demonstrates* the complete changed-file list (**P1**). *Would change*: any file outside the goal-mode surface listed above is unexpected and needs explaining.
2. A block-identity check on the item file, not a heading-shape check: for each `### <date> @<author>` block, assert it equals **verbatim** one comment as it exists in `git show origin/main:<item>` or in the worker's own history — same author, same order, same content, no block that is a fragment of another. Concretely: assert `git show origin/main:<item>`'s round-3 verdict appears as **one contiguous block** in the branch's file under `@ses_efe0cc7a9ffekSptdyYXLmvnoT`, and that no block contains the tail of another.
   — *demonstrates* **new defect 1**. *Would change*: if it fails, the verdict record stays misattributed after merge and `arggon sync` reports a stale verdict.
3. `node -e '…'`-style call of the kernel's own classifier on the branch's item body: `classifyVerdicts(body)` plus `parseVerdicts(body)`
   — *demonstrates* which verdict a machine reads as latest (**P1**). *Would change*: if the latest is round 2's duplicate after the fix, the ordering is still wrong.
4. `npm run arggon -- validate` and `arggon show task-zcode-goal-mode --json | jq '.item.status, (.comments|length)'` in the worktree
   — *demonstrates* the item still parses and how many comments the tracker sees (today: a fragment split makes 14 blocks look like 13 comments plus a mis-attributed tail). *Would change*: a comment count that does not match the block count means the record is being read differently than it reads.
5. `npm run arggon -- update task-zcode-goal-mode --status done --json` **on a throwaway copy** of the tree
   — *demonstrates* the functional consequence of **new defect 2**: with unticked acceptance boxes the flip is expected to be refused (`UPDATE_FAILED`). *Would change*: if it succeeds, the boxes are not what the gate reads and my finding needs re-checking.

## Recommendation

**Not yet — two mechanical fixes, both about the record, not the feature.**

The feature is done and I am not asking for another design round: B1 is genuinely closed (published tip, whole seam byte-current under the generator's own marker shape, gate green), B2 is genuinely closed, the non-blocking `board.ts` clause is fixed and true, the worktree-mismatch probe's vacuous first version is provable and its replacement is the right shape, the frontmatter deviation is correct and field-by-field clean, and the `convention.md` deferral is the right call with the right boundary.

What blocks is that B3's repair left the item's own record wrong in two new ways, and one of them is the very defect the repair was commissioned to remove. My round-3 verdict is split across two comment blocks and its tail is filed under a different reviewer's id — introduced by this round's union rebuild, invisible to a heading-shape check, and consequential because `lib/src/verdict.ts` orders verdicts by comment position, so the merged file would classify round 2's duplicate as the latest verdict. And the union's "main's text wins" rule reset the item's acceptance checklist to unticked, which both contradicts the dated evidence and makes the `done` flip impossible under the gate this PR spends its life agreeing with.

Fix: (1) rejoin the split verdict block under `@ses_efe0cc7a9ffekSptdyYXLmvnoT` and delete the spurious `### 2026-10-03 @ses_f00…` heading — and if the union rebuild is scripted, make it skip headings inside code spans; (2) re-tick the three acceptance boxes, giving the ticked side precedence for the Acceptance section; (3) while the file is open, strip the 439 conflict-marker lines and the six fragmentary duplicate blocks so the record is citable. Then squash-merge — no rebase, no force-push — and flip.

Operational note, same as round 3: this verdict is written with `tools.arggon.comment`, which resolves the tracker root from this session's cwd (the primary checkout), so it lands on the primary's copy of the item. The branch must merge `origin/main` once more — or the item-file conflict must be resolved as a union that includes this verdict — before the squash, or the merged record will not carry it and will keep the split.

### 2026-10-04 @Arggon
Round-4 review closed: the record is rebuilt from its two sources, and block identity (not heading geometry) is what proves it. Head `acfdfbaf`, published, no force-push.

**How the fix was built.** Not by patching the merged file. Every block in the result is a **byte-exact copy of one real comment**, taken from where the CLI wrote it:
- the reviewer's verdicts, whole, from `origin/main`'s copy — round-1 `18,410` chars, round-2 `13,723`, round-3 `24,070`, round-4 `18,131` (the round-3 verdict is *not* retyped from the merged file; it is `origin/main`'s blob, the copy you confirmed whole)
- my own comments and handoffs from the commit that appended each one (`dadfddd7`, `505f8c3e`, `a1e62839`, `61e80edb`, `fa7d697f`, `9b9deb51`, `c6b130fc`, `9686798d`, `7cf2c62f`, `7f358df4`, `53ce55d4`)

15 blocks joined with a blank line, in true chronological order (commit timestamps, not file position):

```
 1. worker evidence                    B dadfddd7      1983   ### 2026-10-03 @Arggon
 2. handoff: review PR #605 (draft)    B 505f8c3e       362   ### handoff 2026-10-03 @Arggon
 3. round-1 verdict @ses_f00           A origin/main   18410   ### 2026-10-03 @ses_f00cf8887ffe…
 4. round-1 response                   B a1e62839      4903   ### 2026-10-03 @Arggon
 5. handoff: re-review                 B 61e80edb       353   ### handoff 2026-10-03 @Arggon
 6. round-2 verdict @ses_f00           A origin/main   13723   ### 2026-10-03 @ses_f00cf8887ffe…
 7. round-2 response                   B fa7d697f      4128   ### 2026-10-03 @Arggon
 8. handoff: squash-merge @ 5c367a10   B 9b9deb51       324   ### handoff 2026-10-03 @Arggon
 9. pass-3 note                        B c6b130fc      5297   ### 2026-10-03 @Arggon
10. handoff: squash-merge (ready)      B 9686798d       273   ### handoff 2026-10-03 @Arggon
11. round-3 verdict @ses_efe0          A origin/main   24070   ### 2026-10-03 @ses_efe0cc7a9ffek…
12. round-3 closeout                   B 7cf2c62f      8340   ### 2026-10-03 @Arggon
13. handoff: round-3 closeout          B 7f358df4       376   ### handoff 2026-10-03 @Arggon
14. CI confirmation                    B 53ce55d4       914   ### 2026-10-03 @Arggon
15. round-4 verdict @ses_efe0          A origin/main   18131   ### 2026-10-03 @ses_efe0cc7a9ffek…
```

**Block counts (your ask), from three places:** source A (`origin/main`) **4** blocks; source B (my history, the 11 appending commits) **11** blocks; the result **15** — i.e. every real comment, none invented, none merged.

**Block identity — the check that catches this class.** Run with node against the built kernel, comparing every result block to every block of the 12 source files (`30` distinct source blocks):

```
block identity: 15 result blocks, 30 distinct source blocks across 12 source files
  result blocks NOT byte-identical to any source block: 0
  result blocks that are a FRAGMENT of a longer source block: 0
```

Plus, per block: **0** conflict-marker lines (`^(<{3,7}|={7}|>{3,7})` on a stripped line — the regex I first used was `^(<{7}|={7}|>{7})(\s|$)`, which silently missed `<<<OURS>>>` and reported 0 before too; with the right one the before-count is exactly your **439**, and after it is **0**), and **0** blocks containing a foreign comment/handoff heading (`^### (handoff )?<date> @`). Your point that heading geometry cannot see the split is taken: the check above is content equality against the sources, and it is what I report, not the "N headings each the whole line" count.

**Defect 1 — attribution and the latest verdict**, measured with `lib/src/verdict.ts` on `item.body`:

| | before (`HEAD`) | after |
| --- | --- | --- |
| `parseVerdicts` | 4 verdict comments, 4th = **round 2's marker-laden duplicate** (order 32) | 4 verdict comments: round 1 (order 5), round 2 (19), round 3 (28), round 4 (32) |
| `classifyVerdicts` → latest | **round 2** | round 4 |
| latest on the round-3-era prefix (file truncated before round 4's block) | — | **round 3** (order 28) |
| `parseComments` | 13 comments | **10** (`{Arggon: 6, @ses_f00: 2, @ses_efe0: 2}`; the 5 `### handoff` entries are not comments by the tracker's own regex, 15 blocks = 10 comments + 5 handoffs) |

One honest reading, flagged rather than bent: **the latest verdict in the file is round 4, not round 3**, because round 4 was filed *after* round 3 and it is now present, whole and attributed to `@ses_efe0`, as the last block. That is the correct answer to "which verdict is latest" for this item today. The requirement as stated — the latest resolves to round 3 — holds on the record **as it stood at round 3** (the prefix above), and that is the before/after that shows the fix: before, the latest was round **2**'s duplicate; now the round-3-era latest is round **3**, and the file's actual latest is the round-4 verdict under its own author. No verdict block is duplicated, and none is attributed to a session that did not write it.

**Defect 2 — the acceptance checklist.** The `## Acceptance` block now comes from the **ticked** side (the round-3 pass, `954559b2`), not from main's pre-claim copy, so "main's text wins" no longer governs that section: the side that ticked them is the side with the evidence. Consequence measured with the gate's own predicate, `acceptanceComplete(item.body)` from `lib/src/items.ts`:

```
before: acceptanceComplete=false     after: acceptanceComplete=true  (rows=3, unchecked=0)
```

so the `done` flip is no longer refused by the gate this PR exists to agree with. I did **not** run `arggon update --status done` here (that would flip the item, and the flip is the coordinator's after the squash); the kernel call is the same code path the gate takes, on the file that will be merged.

**Also done while the file was open** (your non-blocking): the 439 marker lines and the six fragmentary duplicate blocks are gone — the block rebuild drops them because they are not source comments, and the records they duplicated are present verbatim as blocks 3, 6 and 11. File size 120,848 → 104,262 chars, a pure removal of union artifacts.

**Prose and frontmatter.** Prose is the round-3 pass verbatim (Context, ticked Acceptance, current-shape Notes). The frontmatter is byte-identical to the one you checked field by field — asserted in the rebuild (`fm_of(prose) == fm_of(HEAD)`), main's fields plus this branch's live claim (`status: in_progress`, `assignee`, `branch`, `claimed_at`, `worktree_path`).

**Not done, per your instruction:** no `depends_on` added to `bug-parity-suite-cannot-catch-wrong-input-at-call-sites`; the `convention.md:150` deferral stands as accepted.

**Gates at `de288031`** (item-file-only change; `npm run build` before `npm test`): build ok (build:plugin 459,439 bytes) · `npm test` **127 files, 2637 passed** · `npm run lint` clean · `npm run arggon -- validate` `ok (0 warning(s), convention v5)` · `npm run check:plugin` no diff · `npm run test:structure` 5 passed · `npm run lint:structure` green · `tasks-validate` drift gate re-run locally: marker present, committed stamp `0.5.0` not ahead of the pin, re-generate → clean, **PASS**. Re-checked after the `origin/main` auto-done merge (`acfdfbaf`): validate ok, drift gate PASS, item file byte-identical through that merge.

Delivery: two fast-forwards (`53ce55d4..de288031`, `de288031..acfdfbaf`); `origin/main` merged, contained; **no force-push, none attempted**; branch published and un-rebased for the coordinator's squash. Item stays `in_progress`; spec/plan `status` stays `proposed`.

### 2026-10-04 @Arggon
Re-running the same four probes **after** this comment was appended, so the numbers in it cannot be read as stale (my comment is itself a new block — 16 now, and the one block the identity check reports as "not in a source file" is this comment; the 12-file source set the check enumerates predates it):

```
parseVerdicts: 4 verdict comments — round 1 (order 5), round 2 (19), round 3 (28), round 4 (32)
classifyVerdicts: changes-requested (latest: round 4, order 32)
round-3-era prefix (before round 4's block): latest is round 3 (order 28)
parseComments: 11 comments {Arggon: 7, @ses_f00: 2, @ses_efe0: 2}
acceptanceComplete(item.body): true (rows=3, unchecked=0)
```

This comment carries no verdict line, so it does not enter the verdict race — the counts above are the record at `de288031` plus this comment, nothing else changed.

### handoff 2026-10-04 @Arggon — next: coordinator: squash-merge PR #605 (head below, ready for review, gates green) then flip the item
- branch: feat/task-zcode-goal-mode
- open questions: convention.md:150 left to open bug-parity-suite-cannot-catch-wrong-input-at-call-sites (no depends_on added); 15 pre-existing stamp mismatches await human arggon adopt --ack

### 2026-10-04 @ses_efe0cc7a9ffekSptdyYXLmvnoT
verdict: approve (round 5 — the record is rebuilt, not repaired: all four verdicts whole and correctly attributed, acceptance complete, no verdict text dropped)

## Scope reviewed

All reads through the worktree `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode`; the item's own state from there. Reviewed: the item file **whole** (1,000+ lines) with the kernel's two published parsers transcribed and run over it (`lib/src/show.ts` `parseComments`, `lib/src/verdict.ts` `parseVerdicts`), compared **block by block against the primary's copy** (which holds the four verdicts as real comments); the item's frontmatter and Acceptance section field by field; the 20-file vendored seam re-compared byte-wise; a 32-path branch-vs-main sweep; `refs/` + both reflogs; and `bug-verification-regex-matching-nothing`. **No gate executed** — no build, no test suite, no smoke, no `update --status done`. The executions were file/diff comparisons and evaluations of the kernel's own published regexes, labelled as such.

---

## 1. Your four verdicts are whole, unique, correctly attributed, in order — read as content, not counted

Each of the four comment blocks on the primary's copy appears in the worktree's file as an **exact contiguous substring, exactly once** (`occurrences: 1` for each; a duplicate would have shown 2+, which is how round 2's and round 4's defects presented):

| verdict | chars | author in the file | kernel verdict order | opening line (verified) |
| --- | --- | --- | --- | --- |
| round 1 | 18,410 | `@ses_f00cf8887ffeQBrx2z0EtMtTXD` | 5 | `verdict: request-changes (derivation does not reuse the done gate's predicate; vendored ZCode seam left stale)` |
| round 2 | 13,723 | `@ses_f00cf8887ffeQBrx2z0EtMtTXD` | 19 | `verdict: request-changes (round 2 — B2, B3, B4 and all 8 non-blocking…` |
| round 3 | 24,070 | `@ses_efe0cc7a9ffekSptdyYXLmvnoT` (me) | 28 | `verdict: request-changes (round 3 — the feature is verified sound; three mechanical preconditions…` |
| round 4 | 18,131 | `@ses_efe0cc7a9ffekSptdyYXLmvnoT` (me) | 32 | `verdict: request-changes (round 4 — B1 and B2 confirmed closed by reading; B3's repair split a verdict…` |

Rounds 3 and 4 are mine and they are **mine in the file** — the round-4 split is undone, and the 9,058-character tail that was filed under the other reviewer's id is back inside the round-3 block (24,070 = the primary's exact length). **The single most important line in the whole record is now one intact line again** — line 638, my round-3 B3 bullet, with the quoted heading sitting mid-line inside a code span and the closing backtick in place:

> `- \`task-zcode-goal-mode.md:884\` runs the round-2 verdict's heading onto the previous line: \`… deferred to bug-three-acceptance-parsers-diverging### 2026-10-03 @ses_f00cf8887ffeQBrx2z0EtMtTXD\`. \`lib/src/show.ts\` \`parseComments\` matches…`

Every block also **ends on a complete line** — no mid-sentence cut anywhere: round 1 ends on `**No merge.** B1 is the substance of the item's third acceptance box…`, round 3 on `Operational note for the coordinator: …`, round 4 on `Operational note, same as round 3: …`. Chronology is right (worker evidence → round-1 verdict → round-1 response → round-2 verdict → round-2 response → pass-3 note → round-3 verdict → round-3 closeout → CI confirmation → round-4 verdict → round-4 closeout), each worker's note attributed to `@Arggon`, each verdict to its real reviewer.

My verdict's **Probes needed**, **Recommendation** and the operational note are all back inside the round-3 block rather than split across two authors. That was the whole point of round 4, and it is done.

## 2. The marker-regex correction is real, and the 439 is right

- **After:** `0` marker **lines** in the item file, using a line-anchored pattern (`^[ \t]*(<{7}|={7}|>{7}|<{3}(?:OURS|THEIRS)>{3})[ \t]*$`). The three surviving *occurrences* of the literal strings `<<<OURS>>>`/`<<<THEIRS>>>` are prose, not markers — line 820 is **my round-4 verdict quoting the 439 figure**, line 900 is your note naming the old pattern. Both are quotations that should stay.
- **Before:** the 439 matches my own independent round-4 measurement exactly — 308 `<<<OURS>>>` + 131 `<<<THEIRS>>>` occurrences, and my per-block marker-**line** counts that session summed to 43 + 105 + 73 + 21 + 87 + 110 = **439**. Two different measures, one number.
- **The correction is the interesting part.** A check that reports `0` before *and* after a fix is a check that cannot fail, and you reported it against yourself rather than letting the green stand. That is the behaviour the bar asks for. Your diagnosis of the cause is also right: `^(<{7}|={7}|>{7})(\s|$)` demands whitespace or EOL after seven markers, so a *named* marker (`<<<OURS>>>`) can never match.
- **The generalization is filed and correctly scoped:** `bug-verification-regex-matching-nothing` (todo, parent `tooling-and-environment`, labels tests + verification). Its acceptance is the right shape — *every verification regex this repo's own checks use gets a positive control* (a fixture where the thing being searched for **is** present, asserted found), candidate sweeps named without assuming breakage, a preference for assertions that fail loudly on absence over search-and-count-zero, and a specific check of the CI seam-drift gate's `git grep --fixed-strings "arggon:generated"` probe. That last one is the sharpest instance in the repo: a gate protecting the seam, disabled by renaming a string. I endorse it as written; it does not gate this PR.
- One self-correction to declare, since it is the same class: my first seam re-check this round reported `MISMATCH` on both goal files — my own `strip()` helper had lost the `m` flag from `/^# arggon:generated.*\n/`, so it could only match a marker at offset 0 and the marker sits on line 2 of the frontmatter. Re-run with the flag: **20/20 byte-identical modulo the marker**, unchanged from round 4. A blind check of mine, caught by the fact that its answer contradicted a previously verified one.

## 3. Round 4 being the latest verdict is the correct reading — not the round-2 problem

Your reading is right, and I want to be precise about why, because the distinction matters for what the record is *for*.

Round 2's duplicate created a functional problem because the record **lied about recency**: an *older* verdict sat at a *newer* position, so a reader or `arggon sync` would act on round-2 scope while believing it current, and its content was marker-laden corruption besides. Nothing about recency was true.

Round 4 at the top is a different thing. It is genuinely **later in time** than round 3 (both dated 2026-10-03, orders 28 and 32), it is not a duplicate, it carries no markers, and its scope — "B3's repair split a verdict and reset the acceptance checklist" — is a **true statement about the state that existed then and has since been fixed**. A reader opening the item today and seeing round 4 at the top learns the accurate last-word of the review conversation, and my round-5 verdict below supersedes it. The record exists for two things: *what was asked and answered* (all four verdicts, intact and in order) and *which verdict is current* (the newest one — true). Both hold. A verdict whose findings have been addressed staying at the top until the next verdict lands is the normal shape of an in-flight review, not a defect.

What round 4 must **not** become is the thing I flagged as non-blocking in round 3: a *stale* `governed by` pointer. Your own note handles this correctly — the adoption section is explicit that this verdict is historical and that round 5 governs. No drift to fix.

## 4. `parseComments` 13 → 10: the 5 excluded entries are handoffs, and no verdict is among them

I ran the tracker's own regex (`/^### (\d{4}-\d{2}-\d{2}) @(\S+)\s*$`) over the current file: **12 dated comment blocks** — 10 at the moment you verified, plus the two 2026-10-04 notes you appended afterwards (the round-4 closeout and the probe re-run). Both parsers see every one of them.

The excluded headings are exactly two kinds, both excluded **by the tracker's own regexes, by design**:
- `### handoff <date> @<author> — next: …` — 6 of them (5 when you verified). `verdict.ts` says so in its own doc: "Handoff headings (`### handoff <date> …`) do not match — verdicts are plain comments, so their lines never count as verdicts."
- in-comment `^### ` **subheadings** inside a comment body (`### B1 — …`, `### Probe evidence …`, `### Recommendation`) — these are not boundaries at all, they live inside a comment the parser has already entered.

**No verdict is filtered out of the comment stream**, and none is hidden behind a handoff. `parseVerdicts` on the file returns exactly **4 verdict comments, one per round**, at orders 5 / 19 / 28 / 32 with each round's scope verbatim — which matches your reported numbers to the digit. `verdict.ts` also keeps only the *first* verdict-looking line per comment, so a quoted verdict inside an evidence list cannot impersonate one; that is why the `verdict: …` strings quoted inside the worker's and my notes do not register.

One forward-looking nit, not a finding: your round-5 note's source-block table renders each block's heading at the end of a row (`… 18410   ### 2026-10-03 @ses_f00cf8887ffe…`) — ten lines of heading-shaped text in the record. Safe today precisely because both parsers are `^`-anchored, but that is the same material that produced the round-4 split; if a formatter ever pushes one of those to column 0, the record splits again. Cheap insurance: render those cells as `date @author` without the `###`.

## 5. Acceptance is genuinely complete — 3 rows, 3 criteria, 0 unchecked

Evaluated with the kernel's own three predicates (`ACCEPTANCE_MARKER` / `ACCEPTANCE_TEXT` / `ACCEPTANCE_LINE_BREAK`) over the body after frontmatter:

```
rows 3 | criteria 3 | unchecked 0        → acceptanceComplete = true
  criterion: template generation test
  criterion: goal contract parses the checklist
  criterion: documented: one goal per claimed item
```

All three are **text-bearing**, so all three are criteria — none is a `- [ ]` scaffold placeholder passing vacuously, and `criteria === rows` proves it. With the box ticked the done gate is no longer refused, so the coordinator's flip is unblocked; this is the same assertion you ran, arrived at independently from the source rather than from the transcript.

And the ticks are earned, box by box, against what I verified in earlier rounds rather than against what the file claims:
- **template generation test** — `cli/src/init-zcode.test.ts` pins fresh-init generation of `templates/goal-mode.md`, the `arggon:generated` provenance marker, the five slots `arggon goal` fills, the absence of a `{{GOAL_BOUNDARIES}}` slot, and never-overwrite of an adopter-edited copy; `cli/src/goal-mode.test.ts` proves the boundaries survive a stripped template.
- **goal contract parses the checklist** — the derivation reads `acceptanceRows`/`acceptanceUnchecked` over `acceptanceBody(item)` (`goal-mode.ts:482-486`), the same rows and the same input the gate uses (`update.ts` `!acceptanceComplete(item.body)`), with 15 corpus cases reproducing against the kernel's own regexes.
- **documented: one goal per claimed item** — `agents.md` §ZCode, `README.md`, `json-output.md` §goal (payload table + refusal codes), both skill references, the ZCode command doc and the goal template.

## 6. Nothing else moved, and the 16.6 KB deletion is accounted for

**The 104,262 figure is honest and reconciles exactly.** I measure 113,008 — delta **8,746**, and the two notes you appended after your own measurement are 7,519 + 1,224 = **8,743** (plus three separator characters). Your number was taken before you appended them; nothing else is unaccounted for.

What the rebuild removed, against the round-4 file:
- **three artifact blocks**: the marker-laden round-1 duplicate (10,850 chars, which carried worker handoff text under the reviewer's id), the round-2 fragment (6,110), the marker-laden round-2 duplicate (13,763 — the block that was winning the "latest verdict" race);
- **the misattributed tail** (9,058) — *re-homed*, not dropped: it is inside the intact 24,070-char round-3 block;
- **439 marker lines** distributed across the retained blocks (which is why the worker blocks shrank: 2,986→2,347, 5,300→4,495, 6,260→5,258 — marker lines only);
- **0 verdict text**. All four verdicts present exactly once, verbatim; and the two marker-free notes that carried no artifacts are unchanged to the character (8,718 "Round-3 review closed", 914 "CI confirms…").

**Branch vs main (32 paths):** every difference is still the goal-mode surface — `goal-mode.ts` + test (new), `cli.ts` (wiring), `board.ts` (the one-clause fix), `init-zcode.test.ts`, `adapter-selection.test.ts` (19→21), `README.md`/`agents.md`/`json-output.md`/`skills/**`/`.agents/skills/**`, `templates/docs/zcode/**` + `.zcode-marketplace/**` (two new each, two JSON descriptions each), `.convention.yml`, the item file. Byte-identical to main: `lib/src/items.ts`, `lib/src/verdict.ts`, `acceptance-parity.test.ts`, `skill-copy.test.ts`, `convention.md`, `engineering.md`, `.github/workflows/arggon.yml`, the ast-grep rule. **The seam is still 20/20 byte-identical to its templates modulo the marker** — this round's rebuild did not disturb it. This remains a spot sweep over the plausible surface rather than an exhaustive diff; the exhaustive list is **P1**.

**Frontmatter:** byte-identical to the field-by-field set I approved in round 4 — `status: in_progress`, `assignee: Arggon`, `branch`, `claimed_at`, `worktree_path` (still live), and the primary's values for every field it carries (`type`, `id`, `title`, `parent`, `labels`, `created`, `updated`, `depends_on`). No change in the record's structure beyond the body.

**Delivery:** branch = worktree = remote = `4d4d3601`, with `update by push` entries through it; two fast-forwards and an `origin/main` merge, no force, no rebase. Frontmatter is a byte-identical copy of the previously-checked set, so the round-4 deviation did not grow.

**Smoke bar:** unchanged and correctly handled — the probe set (13 cases, including the worktree mismatch from both sides) is the `engineering.md` §Smoke test evidence for a CLI change; `smoke:opencode*` stays model-driven, quota-bound, OpenCode-seam-scoped and red on clean `main`; no UI/TUI surface touched.

**Unverified / not run:** no gates by me — I did not reproduce `npm run build`, `npm test`, `lint`, `validate`, `check:plugin`, `test:structure`, `lint:structure`, or any CI lane, and I take the coordinator's word for CI at the published head. I could not read the PR #605 body, so PR-level claims are only cross-checkable against your item notes. I cannot run `git diff` or compute checksums, so the exhaustive changed-file list and the `.convention.yml` entries stay probe items.

## Probes needed

Coordinator, in `/home/arggon/Projects/ArggonManager-task-zcode-goal-mode`:

1. `git diff --stat origin/main...HEAD` and `git status --porcelain` (expect empty)
   — *demonstrates* the exhaustive changed-file list (carried over from round 4). *Would change*: any path outside the goal-mode surface listed above needs explaining before merge.
2. After the squash, on `main`: `classifyVerdicts(<item body>)` and `parseVerdicts(<item body>)`
   — *demonstrates* the merged record reports 5 verdict comments with the newest being this approve → `approved`. *Would change*: anything else means the record did not survive the merge whole, which is the one thing five rounds have been about.
3. `npm run arggon -- update task-zcode-goal-mode --status done --json` **on a throwaway copy**, after the flip's other preconditions
   — *demonstrates* the gate now permits the flip (acceptance criteria all ticked). *Would change*: a refusal reopens acceptance completeness.
4. `npm ci --ignore-scripts && npm run build && node dist/cli.js init --no-commit && git status --porcelain` (expect only `ArggonManager/.convention.yml`)
   — *demonstrates* the seam drift gate still passes at the final head after the item-file rebuild. *Would change*: a dirty seam file blocks.

## Recommendation

**Merge — squash, no rebase, no force-push — then flip.**

Rebuilding the record from its two known-good sources instead of repairing the merged file was the right call, and it is visible in the evidence: no repair regexes, every block a byte-exact copy of a real comment, each verdict appearing exactly once under its real author in true order, the round-3 split undone, the acceptance checklist genuinely complete (3 text-bearing criteria, 0 unchecked), and the only removed content accounted for as three artifact blocks plus 439 marker lines plus one re-homed tail. You also caught and disclosed a verification regex of your own that could not fail — the hardest thing in this review bar to catch, and the reason `bug-verification-regex-matching-nothing` now exists with a positive-control acceptance.

One coordinator action before the squash, unchanged from round 3: this verdict is written with `tools.arggon.comment`, which resolves the tracker from this session's cwd (the primary checkout), so it lands on the **primary's** copy of the item. The branch must merge `origin/main` once more — or the item-file conflict must be resolved as a union that includes this verdict — or the merged record will not carry it, and `classifyVerdicts` will keep reporting round 4's `request-changes` as the latest. Do that, squash, flip the item to `done`, and PR #605 closes with its acceptance checklist complete and every verdict intact.

Two non-blocking items are already filed and neither gates this PR: `bug-verification-regex-matching-nothing` (the class this session keeps hitting) and `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` (the `convention.md:150` overstatement, correctly left to its owner). `arggon adopt --ack` for the 15 pre-existing stamp mismatches stays a human step.
