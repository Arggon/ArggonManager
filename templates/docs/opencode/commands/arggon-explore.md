---
description: Run an exploration spike before a stack or design decision
---

Explore $ARGUMENTS as a recorded spike — not a chat summary.

1. Create `ArggonManager/docs/explorations/exploration-<slug>-NNN.md` directly
   with your write/edit tools (next free number; no scaffolding command),
   following `templates/exploration.md`.
2. Research the candidates yourself: current versions and best practices with
   dated sources, recorded under the template's candidates / criteria / findings
   / recommendation sections.
3. End with one recommendation and its trade-offs. If the decision is
   cross-cutting, the follow-up is an ADR (`/arggon-adr`) that links this
   exploration; file any follow-up work as a tracked item with
   `tools.arggon.create`.
4. Report the path, the recommendation and any follow-up work.
