---
description: Write a structured handoff for an in-flight item
---

Write a bounded handoff on $ARGUMENTS with `arggon_handoff`:

- `--next`: the first concrete step for the resuming agent (≤200 chars).
- `--open-questions`: unresolved questions, `;`-separated.
- `--branch` only when it differs from the recorded one.

Then report the item id and the handoff summary. Handoffs are history: never
rewrite earlier sections.
