---
type: bug
status: done
id: bug-ack-baseline-regen-loss
title: adopt --ack baseline is destroyed by the next init re-run (content loss)
assignee: Arggon
branch: fix/bug-ack-baseline-regen-loss
parent: story-adopt
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adopt/bug-ack-baseline-regen-loss.md
  Leaves live only under a story. id is the filename stem: bug-ack-baseline-regen-loss.
  CLI `arggon create bug ack-baseline-regen-loss` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt --ack baseline is destroyed by the next init re-run (content loss)

## Context

Found by the guardian adoption agent (2026-09-13): after `arggon adopt --ack` records sanctioned sweep edits as the checksum baseline, the NEXT `arggon init --full` re-run classified those docs as "untouched" (hash matches the recorded baseline) and REGENERATED them from template — destroying the sanctioned content (5 docs lost, restored from git). The "untouched -> silently regenerate" path assumes the baseline equals the TEMPLATE output, but ack baselines equal the adopter's edited content. The agent lost content 5 times during experiments; git was the net.

## Acceptance

- [x] Regenerate-on-untouched only happens when the file content actually equals the current template render (or ack marks entries as diverged and re-runs skip diverged files); acked+edited docs must never be silently overwritten
- [x] Tests: ack -> template bump -> re-run leaves acked content intact (or applies the merge strategy that lands); content-loss scenario impossible
