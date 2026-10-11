---
type: task
status: todo
id: task-claude-adapter-spec
title: "Claude Code adapter: spec + story filing (plan T6)"
parent: story-claude-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-opencode-prompt-stamp, task-opencode-event-panel, task-zcode-goal-mode, task-zcode-automations]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-adapter-spec.md
  Leaves live only under a story. id is the filename stem: task-claude-adapter-spec.
  CLI `arggon create task claude-adapter-spec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude Code adapter: spec + story filing (plan T6)

## Context

File the Claude Code adapter story with acceptance: plugin bundle (skills/agents/hooks/commands/MCP), marketplace manifest, headless smoke bar; no code in this wave

## Acceptance

- [ ] story filed with checklist linked from spec S6
- [ ] no implementation in this wave

## Notes

### 2026-10-11 @ses_ed4c5d320ffeScEzxxks3AMgTV
verdict: approve (spec 024 + §S6 superseded-detail, docs + tracker only)

## What I read

- git -C /home/arggon/Projects/ArggonManager-task-claude-adapter-spec diff main...HEAD — 3 files, all under ArggonManager/: the new 416-line spec, a 6-line edit to spec-methodology-adapters-017.md §S6, and the item file.
- ArggonManager/docs/specs/spec-claude-code-adapter-024.md in full (416 lines) and templates/spec.md (the scaffold agents.md §Specs and plans points at).
- ArggonManager/docs/agents.md §Specs and plans (L487-498) and §Changing the methodology itself (L516-523).
- The whole specs directory listing, ArggonManager/docs/adr/ (0014, 0016, 0017, 0021 all present) and ArggonManager/docs/plans/ (plan-methodology-adapters-017.md present).
NaN

## What I checked, expected vs observed

**(a) Structure and frontmatter conform.** Expected: the shape agents.md §Specs and plans declares. Observed: frontmatter carries spec_id: claude-code-adapter-024, title, status: proposed, created: "2026-10-11" — exactly the four fields the convention names (the adr: field is a fifth, and there is precedent: spec-deps-022.md and spec-show-item-003.md both carry it). Body opens with "# Spec: Claude Code adapter (claude-code-adapter-024)" — the template's heading form with the id in parens — and then Purpose, Synopsis, Acceptance, which is the template's section set, plus Decision-pipeline classification, Invariants, Roles a Claude Code tree can express, The honest starting floor, Hook gates, MCP wiring, Marketplace, Headless smoke parity bar, Failure and error paths, Impact class, Non-goals and Open questions. A superset of the scaffold and richer than its nearest sibling (spec-zcode-native-seam-012), which is the right direction for a reviewable contract.

**(b) 024 was the next free number, not last+1.** Expected: the highest number in use in that directory plus one. Observed: I listed ArggonManager/docs/specs/ — 24 files, numbers 001-023 with exactly one gap-free run up to 023 (spec-update-channel-023.md) and no existing -024. So 024 = highest-in-use (023) + 1. It is emphatically not "whatever the last one was, plus one": the directory's last entries alphabetically are spec-worktree-env-contract-016 and spec-zcode-native-seam-012, which would have given 017 — already taken. plans/ carries its own 024-free set (max 020), so no cross-directory collision either. The maker also records that arggon spec new scaffolded it and never overwrites, which is the tool that enforces exactly this rule.

**(c) Claims checkable, invariants stated, non-goals honest.** Expected: every assertion falsifiable. Observed: nine invariants (One logic path, Same rules for humans and agents, Parity with the kernel, Generated with provenance / never overwrites, One server one name, No shell assembly, Hooks fail open, Adapters are enhancers), a five-row failure-and-error-path table, twelve acceptance boxes each phrased as an observable outcome ("the bundle registers exactly one MCP server, keyed arggon, byte-equal in command/args to the generated .mcp.json entry; a live stdio round-trip against a fixture tracker returns the documented envelope"), and seven non-goals including the honest ones — no verifier plugin agent, no second copy of the skill, no cursor/codex/gemini adapter, no blocking CI gate on adapter freshness. The "what the bundle is expected to move, and nothing more" table is the strongest part: it lists the three rows that stay delivered, the one row that closes, and the one row (docs-travel-with-code) that explicitly stays a gap because a plugin has no session-context hook. That is a spec declining to overclaim.

**(d) The greenfield-vs-port decision is argued.** Expected: reasons, not an assertion. Observed: §Decision-pipeline classification (ADR 0017) is four numbered, checkable points — the structure is decided (ADR 0014), the role vocabulary and the which-roles-a-client-can-express rule are decided (ADR 0021 §6.1/§6.2a′, and docs/agents.md §ZCode states the rule extends to S6), the invariant-for-invariant contract to mirror exists (spec-zcode-native-seam-012 plus its evidence shape cli/src/init-zcode.test.ts), and the client surface is documented, shipped and versioned. It then names the ADR 0017 one-way ratchet in operational terms: a plugin format that cannot carry a component, or a marketplace that refuses a repo-local root, stops the wave, files the exploration and leaves the implementation tasks unclaimed. Decisions argued, and the failure mode of the decision stated.

**(e) External-source claims.** Expected: dated, marked and verifiable. Observed: dated and marked — the client-surface facts are headed "Client surface facts the bundle is built against (Claude Code, accessed 2026-10-11)", which is the access date the convention asks for. **Not verifiable**: the list carries no citations, and the spec's own classification section then says "the plugin manifest reference and the hooks reference, cited above" — a reference that points at a list citing nothing. Non-blocking (see finding 1), because the residual unknowns are already quarantined into the three named open questions, each of which says it will be resolved by a recorded probe. But a recorded probe needs a source, so this should be closed before the implementation wave claims its tasks.

**(f) No implementation leaked.** Expected: docs + tracker only. Observed: the entire non-tracker diff is one new file under ArggonManager/docs/specs/ and a six-line edit inside spec-methodology-adapters-017.md §S6. No templates/docs/claude/** subtree, no cli/** or lib/** change, no adapters/capability-matrix.json edit, no package.json change, no smoke. The §S6 edit is itself the honest docs-travel fix: it records that the ids in §S6 are pre-rename and that adapters/claude/ is not the shipped bundle location, and points at 024, so the stale names in 017 stop propagating into a second bundle rather than being copied forward.

## Findings (none blocking)

1. **The external-source list has no citations, and the spec claims it does.** "the plugin manifest reference and the hooks reference, cited above" describes a list that cites nothing. Since the three open questions are explicitly "resolved by a recorded probe rather than an assumption", and the ADR 0017 ratchet is only triggerable against a concrete contradiction, a reader cannot re-verify the client facts from this document alone. Add the two URLs to the facts list (or drop the "cited above" clause). This is the one finding I would want closed before the implementation wave, and it belongs as a small task under story-claude-adapter rather than blocking a spec-filing wave.
2. The frontmatter adr: field is written as a repo-root-relative path (ArggonManager/docs/adr/0014-zcode-native-seam.md) while every other link in the file is relative (../adr/0014-…). Both resolve; the inconsistency is cosmetic but worth normalising while the file is new.
3. The last live acceptance box on task-claude-adapter-spec (the story body write) is correctly left unticked and correctly assigned: notes.md §Acceptance rows says the done gate reads the LIVE ## Acceptance section with dated comment blocks excluded, so a box ticked in a comment would not satisfy the gate. The drafted story body is complete and internally consistent (its Context links 024, and 024's header already links the story, so both directions resolve once the write lands).

## What remains unverified

Execution. I ran no gate. spec validate (38 docs / 0 warnings), spec analyze (4 findings across 24 specs, the same four as the 23-spec baseline), spec audit (276 pairs, 0 duplicates), argong validate and prettier on the two spec files are all unverified by me. What I did verify by reading is that 024 is the only -024 in the directory, that the ADRs and the plan the spec cites exist, that the story path in the header resolves, and that the non-spec diff is six lines inside §S6.

## Probes needed

1. cd /home/arggon/Projects/ArggonManager-task-claude-adapter-spec && npm run arggon -- spec validate && npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json — demonstrates the new spec is structurally valid and introduces no NEW finding. This is the load-bearing gate: ADR 0017's "no implementation task is claimed before a spec with clean spec analyze" is only satisfied if the baseline is genuinely unchanged, so a NEW finding here blocks the wave, not the spec.
2. Same cwd: npm run arggon -- spec audit — demonstrates spec 024 is not a duplicate or a merge candidate against spec-zcode-native-seam-012 / spec-methodology-adapters-017 (the two it most resembles). A DUPLICATE/MERGE verdict would mean the bounded-port argument in (d) has gone too far.
