---
type: bug
status: in_progress
id: bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
title: "The done gate's box scan counts fenced repro content: a bug item whose repro legitimately contains `- [ ]` can never be flipped done, and the auto-flip wedge follows ADR 0025's \"dated comment blocks excluded\" only sometimes"
assignee: arggon-delivery-lead
branch: fix/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
parent: methodology-improvements
labels: [spec-pipeline, kernel]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T13:00:31.335Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes.md
  Leaves live only under a story. id is the filename stem: bug-done-gate-whole-body-scan-counts-fenced-repro-boxes.
  CLI `arggon create bug done-gate-whole-body-scan-counts-fenced-repro-boxes` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The done gate's box scan counts fenced repro content: a bug item whose repro legitimately contains `- [ ]` can never be flipped done, and the auto-flip wedge follows ADR 0025's "dated comment blocks excluded" only sometimes

## Context

See the delivery lead's dated comment below (the two observed sessions). The
short version: the gate's box scan counted `- [ ]` rows it must not read — rows
inside a fenced code block, and (before ADR 0025 landed) rows inside a dated
comment block — so a bug item whose own repro legitimately contains `- [ ]`
could never be flipped done.

**Root cause of the observed refusals, measured:** both sessions reproduce
verbatim against the repo-global `arggon@0.5.0` install
(`~/.local/share/mise/installs/node/.../bin/arggon`), which predates ADR 0025
and scans the whole body. Against this checkout's kernel the prettier item's
body already read `{gated: false}` before this change, because ADR 0025's
live-section scoping and comment-block stripping had landed on 2026-10-06.
What was still genuinely broken here — and is what this item fixes — is the
FENCE: the region extractor parsed every surviving line, so a fenced `- [ ]`
inside the live section counted as a criterion, and a fenced
`### <date> @author` line opened a comment block that deleted the live section
below it. Both directions are now fixed.

## Acceptance

- [x] The done gate's scan ignores `- [ ]`/`- [x]` inside fenced code blocks — the fence is content, never a criterion, and a fenced `## Acceptance` heading opens no section while a fenced `### <date> @author` heading opens no comment block (an unclosed fence runs to the end of the body, CommonMark)
- [x] ONE rule implemented and recorded: the gate reads the live `## Acceptance` section with dated comment blocks (`### <date> @author`, `### Waiver <date>`) AND fenced code blocks excluded; it refuses when that section publishes no criterion at all (ADR 0025 decision 2) OR when the section's own boxes are unticked (ADR 0015 decision 1). Nothing else in the body gates the flip. Recorded in ADR 0025's 2026-10-11 amendment, `convention.md`, `agents.md`, `json-output.md` and the bundled skill
- [x] Tests cover the two observed shapes and both refusals stay refused: a fenced repro outside the live section (3 literal `- [ ]` rows), a fenced repro INSIDE the live section between two real criteria, the real `bug-prettier-glues-split-inline-code-span` body end-to-end, a ticked live section with an unticked filing comment, an unticked live box (refused), a live section whose only boxes are fenced (refused as `no-live-contract`), plus the fence grammar (tildes, 4-run, info-string backtick, unclosed), the container-cascade split, and the MCP surface both ways
- [x] `bug-prettier-glues-split-inline-code-span` flips done without a waiver and without editing its repro — demonstrated on a scratch branch (`scratch/verify-done-gate-fence` off `origin/main`) with the item restored to its pre-flip state: the pre-fix CLI refuses, the fixed kernel flips, the body is byte-identical to `origin/main`, no `### Waiver` written, all three fenced repro rows intact (the real flip is the delivery lead's after merge)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok — in the declared order

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context (observed today, twice).** ADR 0025 says the done gate reads the item's LIVE `## Acceptance` section with dated comment blocks excluded, and refuses the flip when that section publishes no criterion. The kernel in this checkout behaves differently: it refuses any flip while the body file contains `- [ ]` anywhere.

Two sessions of evidence:
1. `task-spec-deps-022-no-error-path`: live Acceptance fully ticked, but my FILING COMMENT carried the same criteria unticked — flip refused ("still has unchecked boxes"). Ticking the comment boxes let it pass. So comment blocks are NOT excluded in practice.
2. `bug-prettier-glues-split-inline-code-span` (PR #707 merged, live Acceptance 6/6 ticked): the bug's own REPRO — a fenced markdown block demonstrating what prettier does to a `- [ ]` list item — contains three literal `- [ ]` lines. The flip is refused and the auto-flip wedge never fires. The fence is content, not criteria; without a gate fix this item can never reach done. (The checkbox is load-bearing for that repro: measured today, a plain `- ` bullet does not drift, so the repro cannot be simplified away.)

**Why it matters beyond hygiene:** the done gate is the repo's completion contract. A gate that reads fenced content as criteria will wedge exactly the items whose subject matter IS markdown-shaped — formatter bugs, tracker-shaped repros, docs items — i.e. the tracker eating its own dogfood in reverse.

Acceptance:
- [x] The done gate's scan ignores `- [ ]`/`- [x]` inside fenced code blocks (the ADR 0025 live-section read is the contract; fences are content)
- [x] The scan honors ADR 0025's "dated comment blocks excluded" — a `### <date> @author` block's boxes do not gate the flip (today they do, per evidence 1). Pick ONE rule and implement it; record which
- [x] Tests cover: fence-embedded boxes, comment-block boxes, ticked live section with unticked comment (today's exact two shapes)
- [x] `bug-prettier-glues-split-inline-code-span` flips done without a waiver and without editing its repro, once this lands (the item stays in_progress until then — honest state)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
