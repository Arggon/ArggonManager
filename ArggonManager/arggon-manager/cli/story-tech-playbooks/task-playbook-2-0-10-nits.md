---
type: task
status: in_progress
id: task-playbook-2-0-10-nits
title: "Playbook 2.0.10 nits: exploration-010 tension + plugin header probe note"
assignee: Arggon
branch: feat/task-playbook-2-0-10-nits
parent: story-tech-playbooks
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-22"
claimed_at: "2026-09-22T01:09:24.973Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-playbook-2-0-10-nits
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tech-playbooks/task-playbook-2-0-10-nits.md
  Leaves live only under a story. id is the filename stem: task-playbook-2-0-10-nits.
  CLI `arggon create task playbook-2-0-10-nits` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Playbook 2.0.10 nits: exploration-010 tension + plugin header probe note

## Context

Non-blocking nits from the PR #373 review (`task-playbook-opencode-2-0-10`):

1. `ArggonManager/docs/explorations/exploration-opencode2-native-010.md` still
   lists the playbook pin refresh in its "Open tensions" section as open; it
   landed in #373 (2026-09-20).
2. `opencode/plugins/arggon/index.ts` header cites only the 2.0.8 A/B re-probe;
   the 2.0.10 re-probe (2026-09-20) is now the current evidence. The plugin was
   out of scope for the docs-only PR; update the comment here (or when W3
   touches the plugin).

## Acceptance

- [ ] Pin statements refreshed outside the accepted set: `docs/adr/0011` §7,
      `ArggonManager/docs/specs/spec-native-first-011.md` ("Pinned runtime
      2.0.10") and `ArggonManager/docs/plans/plan-native-first-011.md`.
- [ ] `exploration-opencode2-native-010` F4.1 (:244) still says "pin 2.0.10" —
      refresh it with the tensions line.
- [ ] `opencode.md:451,458` prettier de-indents 2 continuation lines (base was
      clean) — same family as `bug-formatter-glues-markdown-spaces`.
- [ ] The playbook's Context budgets snapshot matches `context:report --json`
      after the W7 trim + PR #384 skill sync (11.821 / 25.275 / 12.885+19.604).

- [ ] Exploration 010 "Open tensions" marks the pin refresh as landed.
- [ ] The plugin header references the 2.0.10 re-probe date (or points to the
      playbook's research record).
- [ ] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; cosmetic.

### 2026-09-22 @Arggon
## Worker evidence — PR #392 (5e22a53 + tracker commits)

Branch `feat/task-playbook-2-0-10-nits`, worktree `../ArggonManager-opencode2-task-playbook-2-0-10-nits`. Draft PR: https://github.com/Arggon/ArggonManager/pull/392 (base `opencode2`).

### 1. exploration-opencode2-native-010

- F4.1 (:244): now "pin 2.0.12 in the playbook (F1.16)".
- "Open tensions": the playbook pin refresh is marked **landed** (2.0.10 on 2026-09-20 → re-drift refreshed to 2.0.12 on 2026-09-21, F1.16); the follow-ups list gains `task-playbook-opencode-2-0-12`.

### 2. Plugin header + bundle

- `opencode/plugins/arggon/index.ts` header: the dependency-free-import note cites the A/B re-probes through **2.0.12 (2026-09-21)**, with the earlier 2.0.8 (2026-09-18) and 2.0.10 (2026-09-20) dates, and points at the playbook research record (`docs/playbooks/opencode.md`).
- `npm run build:plugin` → 39 modules inlined, 338,583 B; the bundle is **byte-identical** (esbuild drops comments: 0 occurrences of the header text in `index.bundle.ts`). `npm run check:plugin` exit 0.

### 3. Stale pins → 2.0.12

- `docs/adr/0011` §7 → 2.0.12, refresh filed as `task-playbook-opencode-2-0-12`.
- `docs/specs/spec-native-first-011.md` "Pinned runtime" → 2.0.12.
- `docs/plans/plan-native-first-011.md` API-churn risk → pin 2.0.12.

### 4. Playbook Context budgets — re-measured 2026-09-21 (`npm run context:report --json`)

| surface                              | previous           | now                 |
| ------------------------------------ | ------------------ | ------------------- |
| native `arggon` tools (15, 9 pinned) | 12,182 B           | 11,821 B            |
| fixed per-session total              | 25,636 B           | 25,275 B            |
| arggon-cli umbrella (source)         | 11,942 B           | 12,995 B            |
| references (source)                  | 18,100 B           | 20,625 B            |
| fixture umbrella + references        | —                  | 13,059 B + 20,950 B |
| MCP `tools/list` / AGENTS.md         | 10,507 B / ~2.0 KB | 10,507 B / 2,005 B  |

`arggon-upgrade` adds 4,250 B on load; `keep.tokens` 15,000. The W5 bullet is now scoped to W5 and defers to the snapshot.

`opencode.md:451,458` prettier de-indent: already repaired on the base by PR #391 (`task-code-span-repair-sweep`, the #387 technique). Verified `prettier --check` clean and the byte-stability rule in `cli/src/prose-format.test.ts` covers the file; my edits keep it stable.

### Gates (5e22a53)

`npm test` 92 files / **1498 tests** ✅ · `npm run lint` ✅ · `npm run build` ✅ · `npm run check:plugin` exit 0 ✅ · `arggon validate` ok, 0 warnings (convention v5) ✅ · `arggon spec validate` 18 docs, 0 warnings ✅ · `context:report --strict` all bounds pass ✅ · focused re-run after the last header edit (`prose-format` + `plugin-copy` + plugin `index.test`): 56 ✅.

### Observation (out of scope, coordinator's call)

`opencode/plugins/arggon/index.ts` is **not** prettier-clean on the base: the committed source is semicolon-free while `.prettierrc.json` defaults to semicolons, and `.prettierignore` only excludes the generated bundle — so `npm run format` would rewrite ~1.5k lines. I applied the header edit with a shell patch to keep this diff at 6 lines. No item filed.
