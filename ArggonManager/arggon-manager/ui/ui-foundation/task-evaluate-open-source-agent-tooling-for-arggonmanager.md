---
type: task
status: in_progress
id: task-evaluate-open-source-agent-tooling-for-arggonmanager
title: Evaluate open-source agent tooling for ArggonManager
assignee: Arggon
parent: ui-foundation
labels: [research, agents, tooling]
created: "2026-09-24"
updated: "2026-09-24"
claimed_at: "2026-09-24T14:01:05.692Z"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-evaluate-open-source-agent-tooling-for-arggonmanager.md
  Leaves live only under a story. id is the filename stem: task-evaluate-open-source-agent-tooling-for-arggonmanager.
  CLI `arggon create task evaluate-open-source-agent-tooling-for-arggonmanager` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Evaluate open-source agent tooling for ArggonManager

## Context

Research the current open-source agent tooling ecosystem and identify the
highest-leverage, lowest-risk improvement for ArggonManager. Preserve the
accepted native-first architecture: the Markdown tracker is canonical, all
mutations use the shared kernel, agent context is budgeted, and the published
web/TUI surfaces remain dependency-free. Distinguish tools that improve agent
development/acceptance from tools that should become product dependencies.

The comparison is recorded in
`ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md`.
The working recommendation is to fix the existing P1 native worktree-readiness
failure first, then adopt low-context CLI/test tooling (`ast-grep`,
`fast-check`, Playwright/axe), standardize local code-graph intelligence, and
pilot the native V2 `opencode2-shell-tasks` plugin server-only for long-running
interactive jobs. `opencode-chromium@1.7.2` remains on hold pending a fixed
release and real v2.0.16 browser registration. No product code change is part
of this task.

## Acceptance

- [x] Current ArggonManager architecture, context budgets, UI backlog, tests,
      worktree-readiness failure, and OpenCode V2 version are measured and
      recorded with local evidence.
- [x] Native OpenCode V2 plugins and MCP/self-hosted alternatives are compared
      by fit, license, context cost, operational risk, and source-of-truth
      impact, with dated sources.
- [x] One primary recommendation, one fallback, explicit non-fits, and a
      time-boxed pilot/decision gate are recorded, including the native V2
      background-task permission boundary and browser-release hold.
- [x] No runtime dependency, generated configuration, tracker source-of-truth
      change, or product behavior change is introduced.
- [ ] If the pilot is approved later, its exact versions, safety policy,
      schema budget, and rollback procedure are recorded in a dev-only
      playbook/ADR.

## Notes

The exploration is intentionally left `open`: it recommends a pilot, not an
accepted technology decision. No ADR is created until the pilot produces
repeatable evidence.

### 2026-09-24 @Arggon
Draft PR ready: https://github.com/Arggon/ArggonManager/pull/416
Branch/head: research/agent-tooling-2026-09-24 @ d40ce18981478f6c0c4ed781dcfba76560756b47
Files: tracked item + exploration-open-source-agent-tooling-013.md only.

Gates/evidence (all run in /home/arggon/Projects/ArggonManager-agent-tooling):
- npm ci: pass (Node v26.7.0; engine >=22.12)
- npm test -- --reporter=dot: 95 files / 1,611 tests pass
- npm run lint: pass
- npm run build: pass
- npm run check:plugin: pass, no bundle drift
- npm run arggon -- validate and --json: ok, 0 errors/warnings, convention v5
- npm run arggon -- spec validate --json: ok, 0 errors/warnings
- prose-format targeted test: 3/3 pass; local link/frontmatter/heading checks pass
- UI smoke intentionally skipped: docs-only PR is exempt under docs/engineering.md; no product/UI behavior changed.
- Optional npx prettier --check is not a gate here and reports authored Markdown is not byte-clean; repo prose policy checks formatter invariants instead, and that test is green.

Review corrections: reproduced doctor --budget values as 2,020 B AGENTS.md / 768 B show; recorded branch-doc graph coverage as missing/direct-read; separated similarly named ast-grep-mcp npm and Python projects; recorded shell-tasks V2-beta runtime precondition; corrected Chromium doctor wording to include missing Bun/optional skills and no browser E2E claim. No runtime/config/tracker-source/product changes. Conditional future ADR/playbook checkbox remains unchecked; no follow-up item filed.

### handoff 2026-09-24 @Arggon (session: ses_f2c22e8bfffefNl32ha3H7kKPn) — next: Coordinator reviews and merges draft PR #416 after the research-only diff and gate evidence are accepted.
- branch: research/agent-tooling-2026-09-24
- open questions: Shell-task pilot needs a package-supported V2 beta runtime; Chromium waits for a fixed release and real registration/E2E; future ADR/playbook remains conditional.

### 2026-09-24 @Arggon
Head-SHA clarification: the earlier evidence comment recorded d40ce189 (the code/documentation head before tracker handoff commits). After the required native comment/handoff auto-commits, the final pushed PR #416 head is 5029f4a6895108347af5abf6fed4f935ae87de27. Item remains in_progress and assigned to Arggon.

### 2026-09-24 @Arggon
Note: this clarification itself creates the next tracker auto-commit, so any SHA quoted in a tracker comment is necessarily the pre-comment head. The authoritative final head is the remote PR #416 head reported in the worker handoff; no product or runtime state changed.

### 2026-09-24 @Arggon-reviewer
## Provisional lead-architect review (subagent; coordinator owns final verdict)

Reviewed PR #416 at `d168d95bac92359e4f79f7fdd083c6a2bf65d227`, the item checklist/comments, the complete two-file diff, and `ArggonManager/docs/engineering.md`.

### Findings (severity order)

1. **P2 / merge-blocking evidence correction — the context-budget numbers are not reproducible as written.** `ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md:78` records generated `AGENTS.md` = **2,020 B** and `show` = **768 B**, and the item evidence comment repeats that these were “reproduced” (task file:81). On the stated base (`35ee8435`) and in this worktree, `npm run --silent arggon -- doctor --budget --json` returns **2,021 B / 769 B**. This is not merely a missing test: `cli/src/measure.ts:217-219` puts the process PID in the throwaway measurement-tree name, and `cli/src/docs.ts:667-670` derives a fresh project name from that basename; the exact byte counts therefore vary with PID/path length. Please either record a current, explicitly qualified observation (or stable rounded/budget-relative values) in both the exploration and tracker evidence, rather than calling these exact figures reproducible. This does not change the conclusion that both remain under budget.

2. **P2 / bounded external-integration caveat — qualify the `@playwright/mcp` OpenCode setup.** The recommendation at exploration:317-321 and 335-340 calls the package’s OpenCode configuration explicit and recommends enabling it. In the published `@playwright/mcp@0.0.82` README, however, the OpenCode snippet is legacy-shaped (`mcp` plus `enabled`), while this repo’s V2 policy requires `mcp.servers`/`disabled` (see `ArggonManager/docs/agents.md:123-129` and `ArggonManager/docs/playbooks/opencode.md:123-129`). The report should say that the package snippet is not a V2-ready config to copy and require verification against the current V2 schema before any fallback pilot. This is conditional tooling documentation, not a current product dependency.

### Verified / not merge findings

- The native/CLI asymmetry is accurate: `nativeStart` (`opencode/plugins/arggon/index.ts:2197-2356`) has no `linkNodeModules`/workspace-build preparation and returns an `ok:true` envelope after `updateOperation`; CLI `startInWorktree` (`cli/src/start.ts:638-814`) links, builds, then commits/pushes. `commitTrackerMutation` is explicitly best-effort (`lib/src/tracker-commit.ts:265-270, 426-438`). The report does not claim the bug is fixed.
- External package/security claims checked against the dated tarballs/metadata are bounded: shell-tasks pins the beta SDK and the five-low/no-fix audit observation; Chromium 1.7.2 is held pending the cited post-release security fix and real registration/E2E. The report does not claim those pilots passed.
- The diff is exactly the new tracker item plus the exploration; no package/config/generated artifact or unrelated formatting drift. All three CI jobs at the reviewed head are green (`cli`, `tasks-validate`, and `ui-smoke`). UI smoke was not required for this docs-only PR, and the green run is stronger evidence than the exemption.
- I did not run a real OpenCode shell/browser pilot or browser E2E; those are explicitly conditional/unverified claims. The main graph index is only best-effort evidence; the two branch Markdown files were read directly.

The unchecked conditional ADR/playbook item is appropriate and is not a finding. **Recommendation: NO-MERGE until finding 1 is corrected or explicitly qualified; address finding 2 in the same docs correction if retained.**

### 2026-09-24 @Arggon
Current correction to the earlier evidence comment (historical text intentionally retained): `doctor --budget` generated-AGENTS/show byte counts are process/path-qualified because the throwaway project name derives from a temporary path/PID. Five current runs on 2026-09-24 returned 2,021 B / 769 B; the earlier observation was 2,020 B / 768 B. The exploration now reports the observed 2,020–2,021 B / 768–769 B range; list/MCP values remain stable and both surfaces stay under budget. The same PR correction qualifies the @playwright/mcp legacy snippet and requires current V2 mcp.servers/disabled translation plus registration verification before any opt-in fallback pilot.
