---
# arggon:generated template="opencode/commands/arggon-explore.md"
description: Run an exploration spike before a stack or design decision
---

Explore $ARGUMENTS as a recorded spike — not a chat summary.

1. Scaffold with the CLI: `arggon stack explore <topic>` →
   `docs/explorations/exploration-<slug>-NNN.md` (never hand-create it).
2. Research the candidates yourself: current versions and best practices with
   dated sources, recorded under the template's candidates / criteria /
   findings / recommendation sections.
3. End with one recommendation and its trade-offs. If the decision is
   cross-cutting, the follow-up is an ADR (`/arggon-adr`) that links this
   exploration.
4. Report the path, the recommendation and any follow-up work.
