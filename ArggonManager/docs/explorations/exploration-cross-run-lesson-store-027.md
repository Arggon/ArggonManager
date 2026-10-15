---
exploration_id: cross-run-lesson-store-027
title: Cross-run lesson store — keep the lessons, discard the dead ends, without a second loop
status: open
created: 2026-10-13
---

# Exploration: Cross-run lesson store — keep the lessons, discard the dead ends, without a second loop (cross-run-lesson-store-027)

Spike record for `task-spike-cross-run-lesson-store`, the follow-up [ADR 0022](../adr/0022-decline-autoharness-autocontext-autocompact.md) point 5 filed from [F6 of exploration-020](./exploration-autoharness-autocontext-autocompact-020.md). The question is whether a **durable cross-run lesson store** earns its keep on our substrate — `autoctx`'s distinguishing move (keep the lessons, discard the dead ends, across runs) re-derived here rather than imported. Adopting `autoctx` is out of scope by ADR 0022; the bar is that record's: the answer must not be a **second loop**, a **second executor** outside the permission perimeter, or a **generated moving part** in the tree.

Measurements in this record were taken in this item's worktree on 2026-10-13 with the surfaces named in each finding.

## Classification (Phase 0 — the gate, walked first)

**Bounded.** The deliverable is a decision recorded in carriers that already exist; every admitted shape writes into a document that is already read by the loop, and no new interface is created for anyone to depend on.

- **Why not "spike" alone:** a spike is one open question with a throwaway answer that feeds a bounded task. The answer here is not throwaway — it fixes where lessons live, so it is a bounded decision with a formal record, not a prototype.
- **Why not greenfield:** ADR 0017 gates work with **no existing flow to read**. The flow exists and was read: the review bar (`docs/engineering.md` §Review bar), the documentation-maintenance table (`docs/agents.md` §Documentation maintenance), the self-improvement protocols (`docs/labs/`), the playbook pipeline with its staleness mechanism, and the ADR 0016 adopter channel. Nothing in the admitted answer requires a package, a schema, a command or a gate.
- **The ratchet, recorded one-way (nothing downgrades):** if the follow-up implementation turns out to need **a new command** (`arggon lessons`), **a new generated surface** (a lessons block injected into the item block or into the generated `AGENTS.md`), **a new gate**, or **a new top-level package**, the classification upgrades to **greenfield** and stops at ADR 0017's six-phase protocol until a spec exists and `arggon spec analyze` reports no NEW findings. This record does not design that, and the budget findings below (F1) are the reason it is unlikely to be needed.
- **No spec is owed for the follow-up:** ADR 0017's hard gate is greenfield-only, and the bounded form of this decision is a prompt line plus a table row — an edit, not a feature.

## The gap, stated before any design

The acceptance's test, answered against today's loop (`next` → `start` → `show` → work → gates → PR → `handoff`): **what does an agent do today that it would do differently if last run's lesson were on the item?**

A lesson learned while working lands today in exactly one of four places, and none of them carries it to the next agent on the same class:

1. **A dated comment or handoff on _this_ item** — read by whoever resumes _this_ item, never by the next item. `arggon show` bounds it (`--tail-comments`) and the injected item block does not carry it at all (F2).
2. **The item's `## Notes` prose** — same scope, same readership.
3. **A new `bug`/`task` item**, when the lesson is a defect. Durable and greppable — but found by whoever thinks to grep for the class, not carried.
4. **A carrier someone decided deserved it** — `skills/arggon-cli/references/pitfalls.md`, a `docs/playbooks/<tech>.md`, a `docs/labs/` protocol, an ADR. This path works (F4) and it is the only one that travels.

What would change, concretely — the two behaviours, stated so they can be falsified:

- **(a) First-attempt correctness on a known trap.** A maker that hits a trap another item already recorded re-derives it, because the record is scoped to that item. With the lesson on the carrier that owns the topic, the first attempt applies the known workaround. _Measurable:_ the count of comment records that restate a trap already present in the topic's carrier.
- **(b) Not re-attempting a refuted approach.** A dead end recorded in another item's comment thread does not stop the next attempt; the refutation is only recovered by accident. With the refutation promoted into the class's carrier or a tracker item's Context, the second attempt is skipped. _Measurable:_ the count of items that re-attempt a class where an earlier item recorded the refutation. **This half is not measured below** — this record claims no number for it and says so rather than implying one.

What does **not** change, stated to keep the claim honest: nothing here makes an agent read a carrier it has no reason to open; a promotion reduces the _second_ attempt, not the first-time cost. This record's value hypothesis is narrower than "agents stop relearning": it is "the second item on a class pays less, and the class stops being refiled."

### Evidence the gap is real

- **The record is already written — in bulk, per item, unindexed.** Own measurement (2026-10-13) over the tracker's 746 item documents (6,959,940 B): **423 items carry a dated comment record**, and those sections total **3,647,836 B — 52.4 % of the whole tracker**. **352 items** have a comment record larger than a third of the body; the largest single record is **131,535 B** in one item (`task-zcode-goal-mode`, body 134,081 B). Retrospection is not missing; retrieval is.
- **The repo measured a promotion failure itself.** ADR 0024's context records "**10 items are repeat reports of the same class**" — the same class rediscovered and refiled because nothing promoted it.
- **A named lesson stayed per-item.** `bug-mcp-budget-contradicted-across-docs` (created 2026-10-03) carries, inside its own acceptance line, "**same lesson as the baseline-date mismatch:** every surface that prints a number must print the right one" — naming `bug-context-report-baseline-date-mismatch` (created 2026-10-02). Two items, one lesson, both still `todo`; the lesson's only durable home is the second item's body. The same class recurs a third time as `task-schema-budgets-near-exhaustion` (created 2026-10-12).
- **The reader contract exists; the writer contract does not.** `references/pitfalls.md` opens "Traps that have actually bitten agents in this codebase — read before mutating the tracker or merging", and no rule anywhere tells an agent to _write_ a lesson there (F5). A reader-facing file with no write path ages by luck.

Designs that cannot answer the question above are rejected by this record; the test is applied to each candidate in §Candidates.

## Candidates

The item names three shapes; a fourth is the baseline that must be beaten, and the status quo is the reference.

| #      | Candidate                                                                                                                       | Shape                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **C0** | Status quo — per-item comment record only                                                                                       | reference                                                     |
| **C1** | **(a)** a lessons section in the item body                                                                                      | store inside the item                                         |
| **C2** | **(b)** a per-area note file the agent must read before claiming                                                                | store beside the item, mandatory read                         |
| **C3** | **(c)** a `docs/labs`-style synthesized playbook promoted by a human — in its existing form: pitfalls reference / tech playbook | curated carrier, read on demand                               |
| **C4** | Automatic capture and replay of lessons (the `autoctx` move, `.context.yaml`-shaped)                                            | generated store + implicit second loop — declined by ADR 0022 |

## Criteria

What "better" means, weighted by ADR 0022's consequences and ADR 0006's budget, in this order:

1. **Not a second loop.** No parallel goal/evaluation cycle with its own notion of done or its own history.
2. **Not a second executor** outside the permission perimeter — anything that runs work must be one of the four roles, bound by claim discipline, never-steal/never-reopen and least-privilege permissions.
3. **Not a generated moving part** in the tree — no artifact that rewrites itself inside the tree it describes (ADR 0006 direction 4: _budget and point, never generate_).
4. **Bounded cost**, measured on a surface that already exists (ADR 0006; not an afterthought).
5. **Travels** — reaches the agent who needs it (this repo) and, where it is a methodology artifact, reaches adopters through ADR 0016's propose channel.
6. **Has a staleness mechanism**, and a **contradiction mechanism**, not an intention for either.

## Findings

- **F1 — The fixed per-session surfaces are effectively exhausted; a new always-loaded line or tool has nowhere to go.** `npm run context:report -- --strict` (2026-10-13, worktree): generated `AGENTS.md` **2,031 B ≤ 2,048 B → 17 B free**; native `arggon` tool catalog **12,189 B ≤ 12,288 B → 99 B free**; MCP `tools/list` **16,296 B ≤ 16,384 B advisory → 88 B free**; fixed per-session total 31,632 B. Consequence: **shape (a)'s section or a new `arggon lessons` command cannot be paid for** without displacing an existing line or re-cutting a budget — and a new command is the ratchet's greenfield trigger anyway (Phase 0).
- **F2 — The injected item block is frontmatter-only, so the item body is invisible to the next agent until it is explicitly read.** `buildItemBlock` (`opencode/plugins/arggon/index.ts`, W3) carries `id`, `type`, `status`, `title`, `parent`, `branch`, `assignee`, `priority`, `labels`, `worktree` — nothing from the body or the comment record — under `ITEM_BLOCK_MAX_BYTES` = 1 KiB; measured max 252 B of the 1,024 B bound (fixture items 193 B / 252 B; W3 smoke 181–204 B). So a body section costs 0 B per session: cheap on the budget axis, absent on the travel axis.
- **F3 — Where lessons actually go today is the per-item record, and it is unbounded and unindexed** — 52.4 % of the tracker's bytes across 423 items, largest record 131,535 B (§Evidence). Any shape that adds _capture_ increases a mass that is already the dominant one; the deficit is promotion and retrieval.
- **F4 — The repo already runs the curated-carrier shape twice, deliberately, and it works.** `skills/arggon-cli/references/pitfalls.md` (9,476 B, **read on demand** — 0 B of the fixed surface; its header states a _read_ contract "before mutating the tracker or merging") and `docs/playbooks/<tech>.md` with `playbook status` staleness (`docs/agents.md` §Technology playbooks). Shape (c) is therefore not a proposal — it is the existing, working mechanism whose missing part is the write path.
- **F5 — The missing rule is the write path, and it is missing in exactly one document.** `docs/agents.md` §Documentation maintenance maps **change types** to docs (CLI flag → `README` + `json-output.md`; frontmatter → `convention.md`; cross-cutting decision → ADR). No row says what to do with "a trap that bit you" or "an approach this item refuted", and `references/pitfalls.md` states a reader contract only. ADR 0022 point 5 named this gap; this is it, located.
- **F6 — Shape (a) is free on the budget axis and expensive at the reader boundary.** A `- [ ]` row anywhere in the body is counted by the whole-body acceptance reader that the container cascade asks (`docs/convention.md` §Acceptance rows), so a lessons section written with checkbox syntax can silently withhold a container's auto-completion (`cascadeSkipped`); written as prose bullets it is a second prose region nobody parses, indistinguishable in cost from the record that already exists (F3) — and it dies with the item, which is the original gap.
- **F7 — Shape (b) has no trigger and no enforcement point.** "The agent must read it before claiming" is not a mechanism: the claim path (`arggon start`) reads the item and nothing else, so a mandatory read degrades to advice. One note per area means a set of files an agent has no reason to open; one note for everything is either always-loaded (unaffordable, F1) or self-rewriting (the ADR 0006 direction 4 prohibition). ADR 0024 already paid for this lesson: a sanctioned route that lives in the wrong place is **absent**, and the friction is "absorbed into the session" — silent loss that looks like success.
- **F8 — Dead ends are already durable when they are filed; they are lost when they stay in a thread.** A refuted approach recorded in an item's `## Context` is greppable, linked and terminal — that is the "discard the dead ends" half, and the tracker is its store. What fails is the refutation that lives only in a comment: 52.4 % of tracker bytes (F3) is where those refutations are, and no index reaches them by class.
- **F9 — Contradiction has a precedent in this repo, and it is supersede-with-a-record.** The ADR lifecycle is "superseded by a later ADR, **never silently rewritten**" (`docs/engineering.md` §ADR process), and ADR 0024 carries two dated renumbering notes stating what changed and why. Two lessons that disagree must resolve the same way — the second supersedes the first with a date and a reason — never by appending a contradicting bullet beside it, which yields a carrier that contains both answers and no way to choose.
- **F10 — ADR 0016's propose/absorb channel is the adopter channel, not an in-repo merge mechanism.** Its side-file proposal exists because acked adopter docs are never overwritten and adopters have no shared history to merge; in this repo git already _is_ propose/absorb, and applying 0016 in-tree would create a second, weaker channel for the same edit. Where it does apply is unchanged and already correct: a lesson that ships in `skills/arggon-cli/**` or in `templates/**` reaches adopters as a proposal, and the carrier's edit states its impact class (`docs/agents.md` §Changing the methodology itself).
- **F11 — Staleness: the playbook clock does not transfer to a mechanism lesson.** A technology playbook rots on a **clock** because "researched 90 days ago" is a real risk signal about versions. A lesson about our own mechanics does not become false with age — it becomes false when the mechanism changes, which is an **event** with an author and a PR. Copying the 90-day clock onto mechanism lessons would fire on true lessons and stay silent on the one that just broke.
- **F12 — The existing carrier already drifts fat where it is not bounded.** `references/pitfalls.md` is 141 lines, longest line 137 chars, and its longest single lesson (blank-line separated) is **4,110 chars** — the worktree entry. A promoted carrier that is not bounded at entry becomes a second unbounded record (F3) with better branding.

## Where the lesson lives so it travels

The answer to the acceptance's "decides where the lesson lives so it travels", with the budget and the measurement attached:

| Lesson kind                           | Carrier (exists today)                                                 | Read when                      | Measured cost                                                                                   | Staleness                                           |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Loop/tool mechanics, repo conventions | `skills/arggon-cli/references/pitfalls.md`                             | Skill load, on demand          | 9,476 B on demand, **0 B** fixed per session                                                    | Citation is the invalidation pointer (F11)          |
| Technology behaviour                  | `docs/playbooks/<tech>.md`                                             | `AGENTS.md` pointer; on demand | Same class: on demand                                                                           | `playbook status`, 90 d, `x-playbooks.max-age-days` |
| A refuted approach (a dead end)       | A tracker item's `## Context`                                          | `grep`/`list` by class         | 0 — the tracker is the store                                                                    | Item is terminal; a new item supersedes it          |
| A cross-cutting decision              | `docs/adr/NNNN-*.md`                                                   | When a carrier links it        | 0                                                                                               | Supersede, never rewrite                            |
| **The rule that promotes a lesson**   | `docs/agents.md` (the rule) + the generated maker prompt (the trigger) | Every maker session            | ~1 line in a 3,375 B prompt template (room); **not** the generated `AGENTS.md` — 17 B free (F1) | n/a — the doc that owns it                          |

**Bounded size and measurement (ADR 0006, as the acceptance requires).**

- **One line per lesson: one claim, ≤ 160 characters excluding the citation, and a mandatory citation (`— <item-id>` or `— ADR NNNN`).** Rationale prose stays in the item that produced the lesson. The citation is what makes the line checkable and supersedable (F9, F11); the bound is what stops a carrier from becoming the record it was meant to index (F12).
- **Where the trigger goes, and where it cannot.** The generated `AGENTS.md` is at 2,031 B of a 2,048 B budget — **17 B free** (F1) — so the trigger belongs in the **generated maker prompt** (`templates/docs/opencode/agents/arggon-maker.md`, 3,375 B, room to spare), which is precisely the placement ADR 0024 §2 settled on for the same problem: "the trigger must live in the generated agent files, not only in a skill reference", and those files are in `config.generated`, so `doctor` reports the template as `outdated` if a repo lags.
- **Measurement, using surfaces that already exist — no new surface.** `npm run context:report -- --strict` owns the generated `AGENTS.md`, the item block and the native catalog bounds; `arggon doctor --budget` owns the ADR 0006 surfaces including the live MCP `tools/list`. The only _new_ number is the carrier's own ceiling: propose **≤ 12,288 B for `references/pitfalls.md`** (currently 9,476 B), read with `wc -c` at the same moment the file is edited, and reviewed like any other bound. A section that cannot fit keeps the truth by shortening or superseding a line, never by raising the ceiling in the same PR.
- **Travel to adopters is already decided.** `references/pitfalls.md` and `templates/**` ship through `init`/`init --propose`; the edit states its impact class and adopters absorb it as a proposal (ADR 0016, F10). Nothing new is needed.

## Staleness

Answered per carrier, not by one rule:

- **Technology lessons inherit the clock they already have.** `docs/playbooks/<tech>.md` is flagged by `arggon playbook status` after `x-playbooks.max-age-days` (default 90), and the repo already carries the follow-through per stale playbook. No change.
- **Mechanism lessons carry no clock, and the record names why (F11):** a mechanics lesson expires on an **event** — the mechanism changes — not on the passage of a date, so a 90-day rule would fire on lines that are still true and stay silent on the line that just became false. The mitigation is the mandatory **citation**: the line points at the item or ADR that produced it, so the PR that changes the mechanism finds it by that pointer, and the review bar (`docs/engineering.md` §Review bar — "docs that travel with code are part of done") makes the carrier edit part of that PR.
- **The cost is accepted and stated:** without a clock, a stale mechanics line can survive until someone reads it. This record does not pretend the citation is a tripwire; it is a pointer, and the alternative (a clock whose signals are wrong) is worse. A repo that later wants a check gets it cheaply in `spec validate`'s spirit — report-only, on the carrier's own cited ids.

## Contradiction

Three cases, each with its mechanism:

1. **Two items learn opposite lessons from one area.** The second **supersedes** the first: the line is rewritten in place with a dated note naming what changed and which item produced it (`superseded 2026-11-02 by <item-id>: <reason>`), exactly the ADR lifecycle's "superseded …, never silently rewritten" (F9). Appending a contradicting bullet beside the first is forbidden — two answers in one carrier with no way to choose is worse than either. Git keeps the old text; the carrier keeps one answer.
2. **A lesson stops being true after a change.** Same mechanism, triggered by the change: the citation on the line is the pointer (F11), and the change's own PR updates or removes the line — a carrier edit is part of "done" under the existing review bar, so this needs no new gate.
3. **ADR 0016's propose/absorb channel, evaluated as the acceptance asks.** It is the right mechanism where lessons travel as **managed docs** to adopters (F10): a `references/pitfalls.md` change is a skill edit and reaches adopters by proposal, never by overwrite. It is the wrong mechanism **in-tree**: git already proposes and absorbs, and a side-file channel for one's own history would be a second, weaker record. So: inherited where it applies, declined where it does not, with the reason recorded rather than the mechanism copied.

## Recommendation

**C3, in its existing form — and no new store. Promote lessons into the carriers that already own the topic, bounded and cited, with one trigger sentence where a maker already reads.**

Concretely, the bounded change this decision implies (to be implemented as its own item, not in this spike):

1. **One rule in `docs/agents.md`:** a trap that bit you, or an approach this item refuted, goes to the carrier that owns the topic — `references/pitfalls.md` for loop/tool mechanics, `docs/playbooks/<tech>.md` for technology behaviour, the item's `## Context` for a refuted approach — as **one line, ≤ 160 characters, with a citation**. No store, no section, no new file.
2. **One trigger sentence in the generated maker prompt** (`templates/docs/opencode/agents/arggon-maker.md`), placed where the maker already reports what it found, and reaching adopters through the ADR 0016 channel.
3. **The promotion moment is the second occurrence:** a maker promotes when the work **repeats** a class another item already met; the standards reviewer checks it like any other doc that must travel with the change; the delivery lead may consolidate a class the tracker shows repeating. No new ceremony at merge.

**Why the others lose.**

- **C1 (item-body section) loses on travel and on the reader boundary.** It costs 0 B per session (F2) but is read only by whoever resumes that item, dies with it, and — written as checkboxes — is counted by the whole-body acceptance reader the container cascade asks (F6). It adds to the 52.4 % (F3) without adding a retrieval path.
- **C2 (per-area note, mandatory read) loses on mechanism.** There is no trigger and no enforcement point (F7), and a route that lives in the wrong place is absent — the failure ADR 0024 measured on `deftai`. It cannot be made true without a gate, and a gate for it is the ratchet's greenfield trigger.
- **C4 (automatic capture/replay) was already declined by ADR 0022** on the three grounds this record re-checks: a second loop (its own goal/evaluation cycle, its own notion of done), an executor outside the perimeter, and a generated moving part in the tree — plus F1, which says there is no budget for its artifacts, and F3, which says capture is not the deficit.

**Trade-offs, honestly.**

- **It depends on a trigger sentence firing.** That is the `deftai` risk, and the mitigation is placement (generated prompt, doctor-visible when stale) plus a falsifier (§The falsifiable question). Not dismissed: a social trigger can fail.
- **It does not retrieve.** There is no index of lessons by class; a maker that does not think to open the carrier still misses it. The honest fallback is `grep` and the review bar. An index is the thing that would need a new command — out of scope by the ratchet, and unaffordable by F1.
- **It keeps human/review mediation, so it stays slower than `autoctx`.** ADR 0022 recorded that cost as real; this record reduces it, it does not remove it.
- **It ships nothing this PR.** The spike's deliverable is the decision and the ADR; the carrier edits are a bounded follow-up the delivery lead sequences.

## The falsifiable question ADR 0022 set

**"If this spike shows no value, is that evidence to revisit `autoctx`?" — decided now, before anyone is invested.**

1. **This spike does show value, and that is not evidence about `autoctx`.** The gap is measured (§Evidence), and the value is in a _promotion rule_ — a human/review-mediated write path. `autoctx`'s claim is a different capability: automatic capture and replay with its own evaluation cycle. "Manual promotion is worth doing" does not become "automatic capture is worth adopting"; they are not substitutes, and the second is what ADR 0022 declined.
2. **The revisit condition is written as a falsifier, not a feeling.** Adopt the rule; then measure. If, after the rule ships, the tracker still shows the **same class filed a third time** — the pattern §Evidence already recorded three times for the "every surface that prints a number must print the right one" class — then the manual path has failed **on its own evidence**, and that is the moment to re-open the question with a number rather than an opinion.
3. **Even then, the load-bearing objection is unchanged.** ADR 0022's disqualifier was never popularity: it was two loops, two notions of done, two histories, and an executor outside the perimeter. A candidate that **captures and replays lessons inside our loop** — bound by claim discipline, least-privilege permissions and the blocking smoke gate — would change the calculus and deserves evaluation against the recurrence number. A second loop does not, however many duplicates we count. So: **no automatic adoption on this evidence; the falsifier above is the trigger, and it must arrive with a candidate that satisfies condition (b) of ADR 0022's revisit clause.**
4. **The default if nobody acts:** nothing is built, lessons keep being promoted by hand, and the measurement in (2) is available to whoever asks next — the exploration is the durable record of that answer.

## Decision

Recorded as [ADR 0027 — Cross-run lessons: promote into the carriers that already own the topic](../adr/0027-cross-run-lessons-promote-into-existing-carriers.md) (Status: Proposed; Accepted on merge, per `docs/engineering.md` §ADR process).

Decision in one line: **no lesson store is built; lessons are promoted, bounded and cited, into the carriers that already exist and already travel — and the manual path carries its own falsifier.**

Out of scope by the Phase 0 ratchet: a new command, a generated lessons surface, a new gate, a new package.
