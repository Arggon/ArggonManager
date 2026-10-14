---
type: task
status: in_progress
id: task-zcode-maker-lesson-trigger
title: ZCode maker prompt does not carry the ADR 0027 lesson-promotion trigger (opencode seam got it; parity missing)
assignee: arggon-delivery-lead
branch: feat/task-zcode-maker-lesson-trigger
parent: story-zcode-adapter
labels: [methodology, zcode-seam]
created: "2026-10-13"
updated: "2026-10-14"
claimed_at: "2026-10-14T10:58:29.536Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-maker-lesson-trigger
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/task-zcode-maker-lesson-trigger.md
  Leaves live only under a story. id is the filename stem: task-zcode-maker-lesson-trigger.
  CLI `arggon create task zcode-maker-lesson-trigger` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode maker prompt does not carry the ADR 0027 lesson-promotion trigger (opencode seam got it; parity missing)

## Context

`task-lesson-promotion-implementation` (PR #795, merged) landed ADR 0027's lesson-promotion rule in `ArggonManager/docs/agents.md` and the trigger sentence in `templates/docs/opencode/agents/arggon-maker.md` (plus the regenerated seam copy) — deliberately scoped to the opencode template path. The ZCode seam ships its own maker agent (`templates/docs/zcode/arggon/agents/arggon-maker.md`, regenerated into `.zcode-marketplace/arggon/agents/`), and it carries no trigger, so ZCode adopters would not receive the write-path half of ADR 0027. Raised as an open question by the PR #795 maker; the delivery lead judged it a real parity gap rather than noise.

## Acceptance

- [x] the ZCode maker prompt carries the ADR 0027 trigger (bound ≤160 chars + mandatory citation, the same carrier list), in the seam's own wording
- [x] the template and the generated `.zcode-marketplace/arggon/agents/arggon-maker.md` stay byte-consistent; provenance/checksums refreshed; any seam test updated
- [x] impact class stated (Behavioral — agent contract change; ADR 0016 channel noted); `arggon validate` + affected suites green; prettier clean

## Notes

### 2026-10-14 @ses_ec5ee8018ffe1WwukJV8sz0wW9
## Evidence — PR #802 (task-zcode-maker-lesson-trigger)

**Trigger shipped** in `templates/docs/zcode/arggon/agents/arggon-maker.md` (regenerated into `.zcode-marketplace/arggon/agents/arggon-maker.md`), in the seam's own register:

> If the work **repeats** a class another item already met, promote the lesson into the carrier that owns the topic: **one line, ≤ 160 characters excluding the citation, and the citation is mandatory** (`— <item-id>` or `— ADR NNNN`). Loop/tool mechanics go to the `arggon-cli` skill's `references/pitfalls.md`, technology behaviour to `ArggonManager/docs/playbooks/<tech>.md`, a refuted approach to a tracker item's `## Context`, a cross-cutting decision to an ADR. No lesson store and no lessons section in the item body; the rule is `ArggonManager/docs/agents.md` §Promoting lessons.

Same contract as the OpenCode seam (bound, mandatory citation, four carriers, rule pointer), reflowed as the ZCode seam's declarative list; no OpenCode code-mode spelling.

**Byte-consistency + provenance**
- `sed '2d' .zcode-marketplace/arggon/agents/arggon-maker.md | diff - templates/docs/zcode/arggon/agents/arggon-maker.md` → identical (generated copy = template + `# arggon:generated template="zcode/arggon/agents/arggon-maker.md"` after `---`).
- Regenerated with the CI drift gate's own generator: `node dist/cli.js init --no-commit`; only the maker copy (+ the state file the gate excludes) moved.
- Ledger `ArggonManager/.convention.yml`: checksum `3fc55b3b…` → `a6ab9fb3…` = `sha256sum` of the new bytes; `arggon init --dry-run` still classifies the dest `updated` (propagation intact, not adopter-modified). The regen's `arggonVersion`/`generatedAt` churn across the ledger is NOT committed (task-lesson-promotion-implementation precedent; task-adopter-template-family-followups).

**Test (evidence travels with behavior)**
- `cli/src/init-zcode.test.ts` → "both seams' maker prompts carry the ADR 0027 lesson-promotion trigger": bound + citation syntax + four carriers + rule pointer, checked on BOTH seams' maker templates, plus the ZCode prompt must not carry `tools.arggon.`.
- Falsifier: with the template reverted the test fails — `AssertionError: zcode maker prompt is missing: 160 characters excluding the citation` (re-run then restored).

**Gates** — all green on the committed tree: `npm run build`; `npm test` (156 files / 3383 tests); `npm run lint`; `npm run test:structure`; `npm run arggon -- validate` (0 warnings); `npm run check:plugin` (bundle current); `npx prettier --check` on all four touched files.

**Impact class: Behavioral** — an agent contract change (`docs/agents.md` §Changing the methodology itself). Adopters meet it through the ADR 0016 propose channel: `templates/**` is never overwritten, so an adopter-modified ZCode prompt gets a `.proposed-<version>` side file to merge and re-ack.

**Finding reported, not fixed (delivery lead's call):** `ArggonManager/docs/agents.md` §ZCode names the retired ids brace-elided — `agents/arggon-{worker,reviewer}.md` — and the live-doc guard in `cli/src/agent-id-doc-contract.test.ts` is substring-based (`arggon-worker` ≠ `arggon-{worker`), so the elision ships green. Third instance of the class two `done` items already met (`bug-retired-agent-ids-in-doc-samples`, `bug-adr-0021-s5-lists-retired-agent-ids`). No item filed (maker files nothing) and no lesson promoted — the mechanism's citation belongs to the item that fixes the guard.

### handoff 2026-10-14 @ses_ec5ee8018ffe1WwukJV8sz0wW9 (session: ses_ec5ee8018ffe1WwukJV8sz0wW9) — next: Delivery lead: review PR #802 (2 files + ledger line + seam test), verify the falsifier and the drift gate on CI, then merge and flip done.
- branch: feat/task-zcode-maker-lesson-trigger
- open questions: File a bug for agents.md:683 brace-elided retired ids evading the substring guard?; drop the uncommitted ledger version/generatedAt churn or leave it (task-adopter-template-family-followups)?; run th…
