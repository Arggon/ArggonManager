---
# arggon:generated template="opencode/commands/arggon-review.md"
description: Review a worker's changes against the engineering review bar
agent: arggon-reviewer
subagent: true
---

Review $ARGUMENTS. Read the item, the diff and the project rules
(`ArggonManager/docs/engineering.md`, `ArggonManager/docs/agents.md`), run the project gates, and post a
severity-ordered verdict with file references and smoke evidence **on the item**
via `arggon_comment`. End with a merge / no-merge recommendation.
