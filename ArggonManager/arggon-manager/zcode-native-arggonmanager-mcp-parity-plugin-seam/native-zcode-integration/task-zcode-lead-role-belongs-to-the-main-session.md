---
type: task
status: in_progress
id: task-zcode-lead-role-belongs-to-the-main-session
title: ZCode lead role belongs to the main session
assignee: arggon-delivery-lead
branch: feat/task-zcode-lead-role-belongs-to-the-main-session
parent: native-zcode-integration
labels: []
created: "2026-10-09"
updated: "2026-10-09"
claimed_at: "2026-10-09T21:49:37.502Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-lead-role-belongs-to-the-main-session
---
<!--
  Placement (v0): ArggonManager/arggon-manager/zcode-native-arggonmanager-mcp-parity-plugin-seam/native-zcode-integration/task-zcode-lead-role-belongs-to-the-main-session.md
  Leaves live only under a story. id is the filename stem: task-zcode-lead-role-belongs-to-the-main-session.
  CLI `arggon create task zcode-lead-role-belongs-to-the-main-session` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode lead role belongs to the main session

## Context

Found by the product owner in-session, 2026-10-10, reviewing the wave report: the ZCode seam ships `agents/arggon-delivery-lead.md` as a plugin agent — which in ZCode can only ever be a **dispatchable subagent** — but the role model puts the delivery lead in the opposite position. `ArggonManager/docs/agents.md` §Orchestration marks maker / standards-reviewer / verifier "(subagent)" and leaves the lead unmarked because the lead is the primary worker who interacts with the **product owner** — the main session's role, exactly as ADR 0021 §6.1/§6.2a′ and the engineering.md role table define it. The OpenCode seam (the reference implementation) gets this right: its `arggon-delivery-lead.md` carries `mode: primary`, making it a session agent.

ZCode has no primary/session-agent concept to express that: the plugin system surfaces agents under "Settings → Subagents" and the Agent tool only (zcode-configuration-guide; verified against the client). Two concrete harms in the shipped copy:

1. **Inverted hierarchy by invitation.** The shipped `description` says "Dispatch with the Agent tool for orchestrated, multi-item work" — so the main session reading its agent list is *told* to spawn a lead-child. A child lead has nobody above it to take decision briefs from and no product-owner channel; the lead's actual channel (decision brief → owner) runs through the main session. Dispatching it contradicts the single-writer claim model this repo itself works under.
2. **The role already works without it.** In the 2026-10-10 wave, the main session acted as delivery lead (claims stamped `arggon-delivery-lead`, wave planning, reviews, merge verification, done flips) guided purely by the methodology carriers (`AGENTS.md` → `docs/agents.md` §Orchestration). The plugin's lead agent contributed nothing the carriers don't already carry.

Direction recorded from the product owner (in-session, 2026-10-10): the delivery lead is who the user interacts with — the main agent — not a subagent. The fix is to stop materializing the lead as a ZCode subagent and let the carriers carry the main-session role, keeping maker/standards-reviewer as the seam's subagents. The OpenCode seam keeps `mode: primary` unchanged (there the lead IS selectable as the session agent). The S6 Claude adapter should inherit the lesson: materialize per-client only the roles the client can express (Claude Code plugin agents are subagents too; the lead role belongs in `CLAUDE.md`/instruction material there).

## Acceptance

- [x] `templates/docs/zcode/arggon/agents/arggon-delivery-lead.md` is removed from the ZCode seam (maker + standards-reviewer remain; verifier joins as a subagent when it ships), and the seam is regenerated so the committed `.zcode-marketplace/` copy and `x-generated` provenance match (no stale-record drift — see `bug-stale-x-generated-records-goal-mode-seam-pair`). (2026-10-10: template removed; `npm run build && node dist/cli.js init` from the worktree reaped the committed `.zcode-marketplace/arggon/agents/arggon-delivery-lead.md` and its `x-generated` record and wrote the README record (init commit 553fb2ff); `provenance-audit.test.ts` repo-self block green.)
- [x] The lead's contract reaches the main session through the carriers: the init-generated docs (or the seam README) state that in ZCode the main session IS the delivery lead, and no shipped ZCode surface tells the main session to "Dispatch" a lead. (2026-10-10: the init-generated seam README `templates/docs/zcode/arggon/README.md` states "the main session IS the delivery lead" and forbids dispatching a lead; `ArggonManager/docs/agents.md` §ZCode carries the carrier statement; the retired id survives in no generated artifact except the README's own prohibition — pinned by the init-zcode test.)
- [x] Generator/tests updated for the new agent inventory (the `readdirSync`-driven parity and doctor `--agents` file-count snapshots), plus the init test that asserts the 2026-10-01 artifact audit's "agents/ name-for-name parity with .opencode/agents" — that rule is relaxed to parity modulo the primary/subagent mode split, with the reason recorded. (2026-10-10: `cli/src/init-zcode.test.ts` pins the relaxed rule as a derived test (opencode modes readdir'd; every ZCode agent must be an OpenCode `mode: subagent` role of the same name, the primary role is exactly what the seam omits, the v1 verifier gap asserted by name) with the reason in the test comment; the derived `BY_AGENT`/`PER_AGENT_COUNT` doctor `--agents` fixtures follow the inventory automatically; TIER1_DOCS + the init-opencode carrier test updated.)
- [x] Gates green: build, targeted init/adapter tests, lint, `arggon validate`, `check:plugin`; CI on the PR. (2026-10-10: build / targeted 235 / full suite 2858 / lint / validate / check:plugin all green in the worktree; CI on PR #677 green — cli, tasks-validate, ui-smoke all pass.)
- [x] Live surface (needs the install + one restart): the dispatchable `arggon:arggon-delivery-lead` entry no longer appears in a fresh session's agent list, and `arggon:arggon-maker` / `arggon:arggon-standards-reviewer` still do. (2026-10-10: after the manual reinstall of the client cache from the committed seam and the user's second restart, this session's dispatchable agent surface lists exactly `arggon:arggon-maker` and `arggon:arggon-standards-reviewer` — the lead entry that appeared in every prior turn of this session is gone; cache `arggon/agents/` holds those two files only. The installed gate also came up as the fixed build, verified live: a Bash command merely QUOTING a denied form (`echo "… git push --force origin main …"`) passes with exit 0, while an executed force-push in a remoteless throwaway repo is denied pre-execution with the gate's reason.)

## Notes

### 2026-10-09 @Arggon
Owner direction recorded (in-session 2026-10-10): 'delivery-lead is a subagent but this one should be the one who the user interact main agent not a subagent' — the lead is the main session's role; the seam should stop shipping it as a dispatchable ZCode subagent. This item is claimable as scoped.

### 2026-10-10 @Arggon
Implementation pushed — PR #677. Methodology impact class: **Behavioral** (ADR 0016) — the ZCode agent inventory changed (the dispatchable arggon-delivery-lead is retired from the seam) and agents must re-learn who the lead is: in ZCode the main session IS the delivery lead, per the new init-generated seam README and ArggonManager/docs/agents.md §ZCode (the carrier statement). Skill copies untouched (no skills/arggon-cli/** change, so the byte-equal clause is trivially satisfied). Evidence: templates/docs/zcode/arggon/agents/arggon-delivery-lead.md removed; templates/docs/zcode/arggon/README.md added; templates/docs/zcode/arggon/.zcode-plugin/plugin.json description updated; ArggonManager/docs/agents.md:642 rewritten (three agents → two + the main-session rule); parity rule (2026-10-01 artifact audit 'agents/ name-for-name parity with .opencode/agents') relaxed to parity modulo the primary/subagent mode split, pinned by a derived test in cli/src/init-zcode.test.ts with the reason recorded (ZCode has no primary/session-agent concept; OpenCode keeps mode: primary). Regenerated with npm run build && node dist/cli.js init from the worktree: init reaped the committed .zcode-marketplace copy and its x-generated record and wrote the README record (commit 553fb2ff), no stale-record drift. Gates run here: build green; targeted init/adapter/provenance/doctor tests 235/235; full suite 2858/2858; lint green; arggon validate ok (0 warnings); check:plugin green. Live-reinstall box (AC 5) left unticked — needs the live client restart, next wave.

verdict: approve
PR https://github.com/Arggon/ArggonManager/pull/677 merged in wave 2 (merge-order chain: stale records -> gate pattern -> lead role) after a standards-review approve and green CI.
Maker summary: review approved; CI gate for https://github.com/Arggon/ArggonManager/pull/677
Flip not attempted (acceptance incomplete) — item stays open.

### 2026-10-10 @Arggon
2026-10-10 reinstall half of AC 5 done (delivery lead, after the user's restart): ground truth first — the client swept known_marketplaces at this restart (lastUpdated 01:50Z) but did NOT re-sync the installed cache (mtime Oct 9 16:27, lead agent still present), so restart alone is insufficient; the acceptance's 'reinstall' term is load-bearing. Reinstalled by hand the way the client's update path would: backed up the old cache (/tmp/arggon-zcode-cache-backup-20261010T015237Z), then rsync'd the committed seam (origin/main .zcode-marketplace) over ~/.zcode/cli/plugins/cache/arggon-local/arggon/0.1.0/ — diff -r vs origin/main: identical; agents/ now arggon-maker.md + arggon-standards-reviewer.md only (lead gone); 13 commands; README carries the main-session-is-lead rule. REMAINING for the tick: one more client restart, then a fresh session's agent list shows exactly the two subagents (user can confirm in Settings - Subagents); tick on that evidence.
