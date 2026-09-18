---
type: task
status: done
id: task-opencode2-context-polish
title: "Context report polish: git-history robustness, helper tests, CI gate decision"
assignee: Arggon
branch: feat/task-opencode2-context-polish
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-context-polish
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-context-polish.md
  Leaves live only under a story. id is the filename stem: task-opencode2-context-polish.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Context report polish: git-history robustness, helper tests, CI gate decision

## Context

Non-blocking findings from the independent review of PR #329
(`task-opencode2-context`), filed per the repo rule.

- **F4 — history robustness.** `smoke/context-report.ts` hardcodes
  `references/json-contract.md` to detect the post-W5 split and unconditionally
  reads the working tree's references; on a pre-split checkout (bisect, revert)
  it throws instead of printing `unavailable`.
- **F5 — cosmetic column collision.** `pad()` returns text unchanged when it
  exceeds the column; the long `skill entry arggon-upgrade (description)` label
  runs into the size column.
- **F6 — CI gate decision.** `context:report --strict` is manual (not in CI);
  the pure helpers (`frontmatter`, `stripJsonComments`) have no unit tests.
  Decide: wire `--strict` into CI or document it as a manual/release gate, and
  add helper tests either way.
- **F7 — bases nuance.** The playbook paragraph mixes source bytes (references)
  with fixture bytes (on-demand table, 15,479 vs 15,804 B); label the bases so
  a reader cannot sum them wrongly.

## Acceptance

- [x] `reconstructBeforeAfter()` degrades to `unavailable` on checkouts without
      the W5 split; the detection no longer depends on a single hardcoded
      reference name.
- [x] Column padding handles over-width labels (no run-together output).
- [x] `--strict` gate decision recorded (CI wiring or documented manual gate)
      with rationale; unit tests cover the pure helpers.
- [x] Playbook bases labeled consistently.
- [x] Full suite + `context:report --strict` green; small PR to `opencode2`.

## Notes

- Report-only tool; none of this blocks W7.

### 2026-09-18 @Arggon
**F4 — history robustness (done).** `reconstructBeforeAfter()` now detects the
W5 split from the revision's own tree
(`git ls-tree -r --name-only <rev> -- skills/arggon-cli/references`), never one
hardcoded `json-contract.md`; it checks the working tree for the
`SKILL.md` + `references/` pair before walking revisions and never throws — it
returns an explicit reason, printed as `before/after: unavailable (<reason>)`
and surfaced in JSON as `skillBeforeAfterUnavailable` (`null` when measured).

- Probe `context-report-pre-split` (temp repo: post-split commit, then a
  simulated pre-W5 checkout with no `references/`): old script exit 1,
  `ENOENT ... readdirSync ... reconstructBeforeAfter`; fixed script exit 0,
  `before/after: unavailable (working tree has no skills/arggon-cli/SKILL.md +
skills/arggon-cli/references/ pair (pre-W5 checkout?): the after side cannot
be measured)`.
- Probe `context-report-shallow` (post-split tree, history depth 1, no
  pre-split revision): exit 0, `before/after: unavailable (no revision of
skills/arggon-cli/SKILL.md without a references/ tree in the available
history (shallow clone?))`.

**F5 — column collision (done).** The first table column grows to its longest
label (min 38, +2 gap) and `pad()` truncates over-width cells with `…` as a
backstop, so no cell can run into the next column. Before/after:
`skill entry arggon-upgrade (description)324` →
`skill entry arggon-upgrade (description)  324` (full label kept).

**F6 — strict gate decision (done). DECISION: `context:report --strict` stays
a manual/release gate; it is NOT wired into CI.** Rationale: the only bound CI
would newly enforce is the advisory MCP `tools/list` size (schema drift with
OpenCode/MCP versions would be red-CI noise, not a product regression); the
enforced bounds (AGENTS.md ≤ 2048 B, item block ≤ 1024 B) are already
test-enforced by the suite. Recorded in `docs/playbooks/opencode.md` (Context
budgets), the script's exit-code docblock, this comment and the PR body. New
`smoke/context-report.test.ts`: 13 unit tests (`frontmatter` 4,
`stripJsonComments` 6, `pad` 3), collected via a minimal
`smoke/**/*.test.ts` vitest include; the report body sits behind an
`isDirectRun()` guard so importing the helpers in tests spawns nothing (no
model calls anywhere).

**F7 — playbook bases (done).** The Context budgets baseline labels the W5
skill numbers as **source bytes** (repo `skills/arggon-cli/`, before marker
stamping) vs the report's **fixture bytes** (9,582 B umbrella / 15,804 B
references after `arggon init` stamping) and says not to sum the two bases.

**Gates (this branch).** `npm test` 70 files / 1157 passed (69/1112 before +
the new file) · `npm run lint` clean · `npm run build` clean · `arggon
validate --json` 0/0 · `arggon spec validate --json` 0/0 · `npm run
context:report -- --strict` exit 0, 0 regressions (AGENTS.md 1,863 B ≤ 2,048;
MCP `tools/list` 10,450 B ≤ 12,288 advisory; item block max 252 B ≤ 1,024;
before/after measured from `dc9fa40`). Draft PR follows; no merge, no status
flip from this worker.

### handoff 2026-09-18 @Arggon — next: Coordinator: review draft PR #340 (F4-F7 polish; strict-gate decision recorded as manual/release gate). Verify the F4 probes (pre-split + shallow), the pad before/after, the 13 helper tests and the g…
- branch: feat/task-opencode2-context-polish
- open questions: F4 probes used temp simulated repos (not a real bisect checkout); F5 keeps the pad() truncation backstop even though the dynamic column now prevents truncation for current labels; F6 decided manual/r…

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; fixes applied in 9af21be (snapshot refreshed from current tool output with a dated label: source 9,978/17,208, fixture 10,042/17,533, MCP 10,450, fixed surface 13,206 B; strict-gate wording now names the advisory MCP bound + the keep.tokens regression check); F4 degrades honestly in 4 broken-history scenarios (pre-split, shallow, no-git, bogus rev), F5 column collision fixed, F6 helper tests collected (70 files/1157) and import side-effect-free; manual/release gate decision documented; merged with cli pass. Closing.
