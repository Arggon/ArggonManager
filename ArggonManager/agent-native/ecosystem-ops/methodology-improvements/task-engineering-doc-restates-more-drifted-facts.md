---
type: task
status: todo
id: task-engineering-doc-restates-more-drifted-facts
title: "engineering.md restates four MORE facts that drifted: the cli job's last step, the workflow count, a @playwright/cli dep this repo does not have, and ADR 0005's status in a dated exploration"
parent: methodology-improvements
labels: [docs]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-engineering-doc-restates-more-drifted-facts.md
  Leaves live only under a story. id is the filename stem: task-engineering-doc-restates-more-drifted-facts.
  CLI `arggon create task engineering-doc-restates-more-drifted-facts` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# engineering.md restates four MORE facts that drifted: the cli job's last step, the workflow count, a @playwright/cli dep this repo does not have, and ADR 0005's status in a dated exploration

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @Arggon
Found by the worker on PR #618 (`bug-engineering-doc-stale-adr-statuses`), 2026-10-03, during the sweep it was told not to widen the PR into. All four are the SAME class as the one that item fixed: a carrier restates a fact that changed elsewhere, and the restatement was never updated.

The worker verified the item's premise and then found the class is wider than the item said. `engineering.md` has 10 ADR references; only `:230` stated a status, so that one was the whole of the reported defect. But the carrier restates OTHER facts too, and these are stale:

- **`engineering.md:100`** — "the **last step** of the `cli` job runs `smoke:native-start-cold`" is **no longer true**. `ci.yml:82` added a Playwright lane after it.
- **`engineering.md:44`** — the `.github/workflows/` comment enumerates 2 of 5 workflows.
- **`engineering.md:97`** — prescribes `@playwright/cli`, which is not a dependency of this repo.
- **`explorations/exploration-cheap-path-to-prod-001.md:16`** — ADR 0005 is listed as `Proposed`; it is `Accepted`. This is a **fourth instance of the exact ADR-status class** the sibling item fixed, in a file the sibling item's new check does not read.

Why this is one item and not four: the fix shape is identical for each — either delete the restatement and point at the authority, or make a check read the authority. That decision was already made in PR #618 (delete; the ADR index is the register), so applying it here is not a new judgment.

Acceptance:
- [ ] Each of the four claims is either deleted-and-pointed-at, or verified correct against its authority (`.github/workflows/arggon.yml`, `ci.yml`, `package.json`) — and the verification is by reading the authority, not by re-asserting the carrier
- [ ] `explorations/exploration-cheap-path-to-prod-001.md:16` — same decision as PR #618. The default read is that a **dated exploration is an input record** and its status mentions should be left as written, because the ADR is where the correction belongs; but a status that was WRONG AT THE TIME it was written is a different case from one that went stale later, and only the second is in scope
- [ ] `engineering.md:100`'s "last step" claim: this one is load-bearing for anyone debugging CI, and it is the kind of ordering fact that cannot be maintained by prose. Consider a check against `ci.yml`'s actual step list, or delete the ordering claim and name the lane instead
- [ ] Report whether `engineering.md` restates anything else this sweep did not find; the worker has now twice swept this file and the class keeps yielding, which suggests the carrier is a general restatement surface rather than a document
- [ ] Impact class stated per `docs/agents.md` §Changing the methodology

Depends on PR #618 only if that PR's check is widened to read `explorations/**` — otherwise independent.

### 2026-10-03 @Arggon
Fifth instance, added by the round-1 reviewer of PR #618 (2026-10-03): `README.md:177` also restates a fact that drifted. Not assigned to any worker yet — the reviewer read it while sweeping every ADR reference across all four carriers and found the carriers clean on the ADR-status field, so this one lives outside the carrier set.

Add to the acceptance list:
- [ ] `README.md:177` — identify the claim, check it against its authority, and apply the same delete-don't-correct decision PR #618 made. `README.md` also turned out to be a silent restatement surface on a DIFFERENT class (PR #615 found the nine-tool MCP list there with NO count word at all, so it had drifted invisibly), which is worth noting when deciding whether README gets a doc-contract check of its own.
