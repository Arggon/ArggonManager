---
type: task
status: todo
id: task-zcode-lead-role-belongs-to-the-main-session
title: ZCode lead role belongs to the main session
parent: native-zcode-integration
labels: []
created: "2026-10-09"
updated: "2026-10-09"
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

- [ ] `templates/docs/zcode/arggon/agents/arggon-delivery-lead.md` is removed from the ZCode seam (maker + standards-reviewer remain; verifier joins as a subagent when it ships), and the seam is regenerated so the committed `.zcode-marketplace/` copy and `x-generated` provenance match (no stale-record drift — see `bug-stale-x-generated-records-goal-mode-seam-pair`).
- [ ] The lead's contract reaches the main session through the carriers: the init-generated docs (or the seam README) state that in ZCode the main session IS the delivery lead, and no shipped ZCode surface tells the main session to "Dispatch" a lead.
- [ ] Generator/tests updated for the new agent inventory (the `readdirSync`-driven parity and doctor `--agents` file-count snapshots), plus the init test that asserts the 2026-10-01 artifact audit's "agents/ name-for-name parity with .opencode/agents" — that rule is relaxed to parity modulo the primary/subagent mode split, with the reason recorded.
- [ ] Gates green: build, targeted init/adapter tests, lint, `arggon validate`, `check:plugin`; CI on the PR.
- [ ] Live surface (needs the install + one restart): the dispatchable `arggon:arggon-delivery-lead` entry no longer appears in a fresh session's agent list, and `arggon:arggon-maker` / `arggon:arggon-standards-reviewer` still do.

## Notes
