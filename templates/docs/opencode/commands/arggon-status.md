---
description: Summarize tracker state (progress, blockers, stale claims)
---

Summarize the tracker with the read-only native tools: `tools.arggon.report({})`
for per-container progress and `tools.arggon.list({ ... })` with filters
(`status:blocked`, `stale: true`) for blockers and stale claims. $ARGUMENTS

Keep it bounded: counts and the few items that need attention, not a full dump.
