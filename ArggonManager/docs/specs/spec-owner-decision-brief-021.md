---
spec_id: owner-decision-brief-021
title: The decision-brief convention, its answer grammar, and the unanswered-brief report-only finding
status: proposed
created: 2026-10-06
---

# Spec: The `decide:` decision brief, the `decided:` answer grammar, and the unanswered-brief report-only finding (owner-decision-brief-021)

Specifies [ADR 0026](../adr/0026-owner-decision-brief.md) §1–§8 (from
[exploration-owner-decision-brief-025](../explorations/exploration-owner-decision-brief-025.md),
recommendation C1). ADR 0017 gate item: no implementation task below this one may be
claimed before it exists and `arggon spec analyze` reports no NEW findings — which
includes `task-wire-decision-brief-carriers`, blocked behind it.

ADR 0026 §Consequences → "How it ships" names what the record itself left open:
_"Not decided here: which read-only surface reports a brief that was never answered,
and the carrier text that teaches the convention. Both belong to the spec and the
carriers that follow this record, in that order."_
([0026:290–296](../adr/0026-owner-decision-brief.md)). This spec is the first half: the
convention's grammar, the routing rule, and the answer grammar in full, plus the
report-only unanswered-brief finding and the read-only surface that carries it. The
second half — carrier text — is `task-wire-decision-brief-carriers`; §Boundary with the
carriers item below names exactly what that item will do.

## Purpose

The methodology already defines how a decision is **answered** (`accept:`, ADR 0021
§4) and how a change is **judged** (`verdict:`,
[`docs/engineering.md:186`](../engineering.md) §Review bar → Review verdicts). ADR
0026 §Context (:26–36) records the missing third: **nothing says how a decision is
asked.** So the question has no home, lands wherever the session happens to be, and the
answer — when it comes — has nowhere durable to live.

This spec turns ADR 0026's decision into something a maker can implement without
re-deciding anything: the six brief fields, the `decide:` and `decided:` header
grammars, the routing rule that bounds when a brief is owed, and one additive
report-only finding for a brief nobody answered.

**Invariants**

- **Report-only, never a gate** (ADR 0026 §6, :219–237). No transition consults a
  brief or an answer; no command refuses because one is missing; no automated check
  fails on one. The reasoning is inherited and kept, not just the conclusion: the
  tracker has no identity layer — a session id is correlation metadata only
  ([`docs/agents.md:444`](../agents.md) §MCP server, "correlation metadata only: never
  authentication or authorization") — so a gate here would be forgeable or unusable,
  and ADR 0026 §6 calls both worse than not having one.
- **Prose, never schema** (ADR 0026 §6:235–237). No frontmatter field, no command
  flag, no CLI/MCP/native-tool parameter. The existing `arggon comment` already writes
  the record; the header grammar already has two proven siblings.
- **Opt-in, and a project with no product owner stays silent.** The
  unanswered-brief finding fires only under the **existing** arming
  `x-tracker.product-acceptance: true` (`docs/convention.md:560` §`x-tracker`;
  declared as `productAcceptance` in `lib/src/convention.ts:106–115`). No new config
  key: arming says "we have a product owner and we want the record", and that is the
  same act for a brief as for an acceptance. Absent or `false` ⇒ zero new findings,
  zero new statuses, no behaviour change.
- **Additive within `schemaVersion` 1** ([`docs/json-output.md`](../json-output.md)), the
  same rule the `acceptance` field shipped under (spec `promotion-policy-018` AC 3).
- **Nothing migrates.** Briefs live in item bodies, which already exist; a superseded
  brief is answered by a later `decided:` comment, never rewritten (ADR 0026 §2:122–123).
- **Domain-neutral** (ADR 0021 §6.2,
  [`docs/engineering.md:72`](../engineering.md) §The role table: _"A role is defined by
  **what it decides**, never by the artifacts it touches"_; software is one worked
  example). Every field below is named in the adopting project's own terms.
- **No authority moves.** ADR 0021 §2's authority map is unchanged (ADR 0026
  §Decision:76–81). The delivery lead still recommends; the product owner still decides;
  sequence is still not priority.

## Synopsis

```yaml
# ArggonManager/.convention.yml — the EXISTING arming, unchanged (no new key)
x-tracker:
  product-acceptance: true # opt in; OFF keeps every adopter silent
```

```text
### 2026-10-06 @Arggon
decide: second supplier for the same part (the price we pay each year)
- The question: do we add a second supplier for the same part?
- Why it matters: what a customer sees if we cannot deliver, and what we pay each year
- The options: A — keep one supplier, so we pay no more, and we have no way to deliver
  if they stop; B — add a second supplier, so we pay more each year, and we can still
  deliver if one stops
- The recommendation: B — a stoppage costs more in one month than the extra spend costs
  in a year
- The strongest argument against that recommendation: the extra spend is certain and the
  stoppage may never come
- The default: A, from 2026-10-20 — a supplier contract is not something we can undo this
  year, so the default is the option we can reverse
```

```text
### 2026-10-14 @gonzalo
decided: option B (add a second supplier)
- we are short of ways to keep delivering, not of money: one supplier leaves us with none
```

```bash
arggon show <id> --json       # additive `decision_brief` on that item
arggon spec analyze           # additive UNANSWERED-DECISION-BRIEF finding, armed only
arggon report --json          # UNCHANGED — see "The read-only surface" below
```

### The record (two bounded headers, `decide:` and `decided:`)

A **brief** is a comment whose first `decide:`-looking line is the header; an **answer**
is a comment whose first `decided:`-looking line is the header. Grammar for grammar,
the `verdict:`/`accept:` family as `lib/src/verdict.ts` and `lib/src/acceptance.ts`
parse it.

**Who writes which is part of the convention, not a detail of the example.** A brief is
**written by the delivery lead** on the item; the **product owner** answers it
(ADR 0026 §Decision:71–73, and §1:85–87 — "A brief is a comment on the item headed
`decide:`, written for **one** reader whose vocabulary is not assumed"). So the `decide:`
comment is attributed to the lead and the `decided:` comment to the product owner, and
the reverse never holds: a product owner does not author her own brief, and the lead
answering his own question is the case `self-decided` exists to surface (§States).

| Element        | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Heading        | `### <YYYY-MM-DD> @<author>` — exactly what `arggon comment` writes; a handoff heading never matches, so prose inside a handoff never counts                                                                                                                                                                                                                                                                                                 |
| Brief header   | `decide:` followed by free text naming the decision, optionally with a short scope in parentheses (ADR 0026 §1:86–87: the header "may carry a short scope in parentheses, exactly as `verdict:` and `accept:` do"). Unlike its siblings there is no fixed value token — the text after `decide:` is prose, so only the token is bounded: case-insensitive, and it must be followed by end-of-line, space or `(`, so `decides:` never matches |
| Answer header  | `decided:` followed by the chosen option — the text of the option, or `other` — optionally with a scope in parentheses (ADR 0026 §2:111–120)                                                                                                                                                                                                                                                                                                 |
| First only     | only the first header-looking line of a comment counts, so a quoted brief or answer inside an evidence list cannot impersonate one                                                                                                                                                                                                                                                                                                           |
| Order tiebreak | comments are append-only, so body order breaks ties between same-date comments                                                                                                                                                                                                                                                                                                                                                               |
| Superseding    | a later `decided:` supersedes an earlier one; a superseded brief is **never rewritten** — by ADR 0026 §2:122–123 and by the ADR lifecycle                                                                                                                                                                                                                                                                                                    |

**The six brief fields, in this order** (ADR 0026 §1:83–104, verbatim in intent; the
field _content_ is the ADR's, this spec fixes nothing new here):

1. **The question**, in one sentence. Any specialist term is translated, at first use,
   into what it changes for the product.
2. **Why it matters**, in outcome terms — what changes for the people who use it, what
   it costs, what it risks. Never in mechanism terms: how it will be built is the lead's
   decision, not the owner's.
3. **The options** — two or three, **never one**. Each with its consequence in plain
   words; for the recommended one, its honest cost stated rather than implied.
4. **The recommendation**, and why.
5. **The strongest argument against that recommendation**, written by the lead. A brief
   that omits this field is not a brief (ADR 0026 §1:98–99).
6. **The default**: what the lead will do if no answer arrives, and the **absolute**
   date after which it happens. Never a relative deadline — "by Friday" cannot be read
   in the week it was meant for (ADR 0026 §1:100–102).

The mechanical test for a well-written brief is ADR 0026 §1:106–107's, unchanged: could
the reader restate the choice and its consequence in their own words?

**The default's direction is constrained** (ADR 0026 §3:151–161, restated because it is
what makes the auto-execute safe): for a **hard-to-reverse** call the default is the
reversible or "hold" option, never the more aggressive one; if no such option exists the
default is "hold" and the brief says so; for every other decision that owes a brief the
default is the lead's own recommended option. Net effect, stated as ADR 0026 states it:
**a brief can never make an irreversible act happen because nobody replied.**

### States (report-only classification, one per item)

| State          | Meaning                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `none`         | no `decide:` header on the item                                                                                 |
| `open`         | a brief is on the item and no `decided:` comment follows it — **reported, never blocked**                       |
| `decided`      | a `decided:` comment follows the latest brief                                                                   |
| `self-decided` | that `decided:` was written by the item's own assignee — **reported, never blocked**, mirroring `self-accepted` |

`self-decided` exists for the reason `self-accepted` does (spec `promotion-policy-018`
§States; ADR 0021 §4's amendment: with no identity layer, forgery is expected rather
than exceptional, and attribution is the only honest signal). ADR 0026 §2:125 keeps
attribution and never authentication: _"Attribution only, never authentication: the
same line ADR 0021 §4 draws."_

### The read-only surface — `show`, and one named correction

ADR 0026 leaves this open, and the answer is not free: **`sync` cannot carry it.**

`sync` classifies only the items it reconciles with an **open PR**: its verdict map is
built over PR matches and skips `no_pr` rows (`lib/src/sync-command.ts:81–83`), so a
brief on an item with no open PR — including any **container-level** state, since
containers carry no branch and therefore never appear in that map — could never be
reported there. ADR
0021's own dated amendment records exactly this correction for the sibling artifact
([0021:323–347](../adr/0021-agents-primary-workers-human-product-owner.md): _"the
second bullet's `sync` is corrected to `report` + `show` … `sync` is left
**byte-identical**"_), and spec `promotion-policy-018` §Surfaces reached the same finding
from the same code. **`sync` stays byte-identical here too.**

So:

| Surface            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `show <id> --json` | additive `decision_brief` beside the existing `acceptance` field: `none｜open｜decided｜self-decided`, bounded like its neighbours (ADR 0006)                                                                                                                                                                                                                                                                                                     |
| `spec analyze`     | additive finding `UNANSWERED-DECISION-BRIEF` — an item carrying a `decide:` header with no later `decided:`                                                                                                                                                                                                                                                                                                                                       |
| `report --json`    | **unchanged.** `report` aggregates per **container** (`ReportContainer`, one entry per story under an epic — `lib/src/report.ts:13`, the row spec `promotion-policy-018` AC 3 read). A brief is an **item-level** record about a decision, not a container aggregate, and a decision may well be briefed on a leaf — where `report` has no row at all. Adding it would mean reporting a field that is `none` for most rows and duplicating `show` |
| `sync --json`      | **unchanged, byte-identical** — the correction above                                                                                                                                                                                                                                                                                                                                                                                              |

Choosing `show` over `report` is the decision this section exists to record: the brief
lives on the item it governs, so the surface that reads an item's own canonical body is
the one that can carry it. A dated amendment to ADR 0026 §6's consequences naming `show`
(the finding) plus `show`'s additive field is owed by the implementation PR — a doc
statement the change makes false is fixed in the same PR
([`docs/agents.md`](../agents.md) §Documentation maintenance).

### The finding

`UNANSWERED-DECISION-BRIEF`, one per item, **report-only in every respect** like the
rest of `spec analyze`: exit 0 with findings, nothing filed, no item mutated, no
transition consulted. It mirrors `MISSING-PRODUCT-ACCEPTANCE` (`cli/src/spec.ts:1010`,
`PRODUCT_ACCEPTANCE_FINDING_KIND`) and inherits its arming gate
(`cli/src/spec.ts:1060–1061`, `productAcceptanceFindings` returns `[]` unless
`productAcceptanceArmed(root)`), so:

- it fires **only** when `x-tracker.product-acceptance: true`; a project with no
  product owner stays silent, and an unparseable `.convention.yml` reads as UNARMED
  rather than failing a report-only scan (`cli/src/spec.ts:1019–1020`);
- the message is **deterministic** — fixed enum tokens, no clock, no counts — so a
  committed `--baseline` snapshot fingerprints it stably, the same discipline the
  acceptance message states (`cli/src/spec.ts:1031–1035`);
- `self-decided` is **not** a finding: the question was asked and answered. Only
  `open` fires;
- `self-decided` still reports as a state on `show`, because a reader deciding whether
  to trust an answer needs to see who wrote it.

**Scope, stated explicitly because the mirror suggests the opposite.**
`MISSING-PRODUCT-ACCEPTANCE` is deliberately narrow — `story` containers only
(`ACCEPTANCE_CONTAINER_TYPES`, `lib/src/acceptance.ts:184`) and terminal statuses only
(the `done`/`cancelled` filter at `lib/src/acceptance.ts:212`) — because an acceptance is _due at closure_, so
waiting for the container to close is what keeps the detector low-noise. A brief is
**not** due at closure: it is owed while the decision is open, and it stays `open` for
its whole default window. So this finding fires on an item of **any type and any
status** — leaf, container, `todo`, `in_progress` or terminal — for as long as the item's
state is `open`. The item's `file` is the item's own path, like its sibling's, so it has
no `line`. Narrowing this to containers or to terminal items by analogy with the
acceptance detector would silence the exact case exploration 025's observability row
names — a brief sent and never answered, and nobody notices.

### The routing rule — which decisions owe a brief

A brief is owed **only** for (ADR 0026 §5:195–217):

- **the rows of the ADR 0021 §2 authority map** ([`docs/engineering.md:89`](../engineering.md)
  §Authority map) — direction and priority; product acceptance of a container; accepting
  residual risk; taking over another writer's claim; publishing a release; and
- **hard-to-reverse calls** — the ones whose cost of being wrong later is paid in more
  than the time it takes to undo.

Everything else the delivery lead decides and records on the item **as a plain comment**.
A question with one real option is **not** a brief: the lead decides it and records why.
A brief never replaces the record a row already has — the `priority` field, an `accept:`
comment, the ADR 0015 waiver, the claim-takeover gate and the human-pushed release all
keep the records they have; the brief is the **request**, not the answer (ADR 0026
§5:206–210).

This rule is the load-bearing half of the convention: without it every decision becomes
a brief, which inverts ADR 0021 §3 — the model must reduce per-item human cost, never
add one. **One item is canonical for a given decision**; if two items brief the same
decision, one is the record and the other links to it (ADR 0026 §5:216–217).

**Nothing about the promotion-policy tiers changes.** The T0/T1/T2 table in
[`docs/engineering.md:137–143`](../engineering.md) §Review bar → Product acceptance, whose
content is fixed by spec `promotion-policy-018` §The promotion policy, is **unchanged**,
and this spec adds no tier and moves no row. Product-owner touchpoints per shipped
change do not rise: **a brief replaces a chat question rather than adding a step**
(ADR 0026 §Consequences:272–274). That sentence is the acceptance test for AC 10 below,
because the failure mode this convention could plausibly cause is an extra human step in
the loop.

### Domain neutrality

Every field is named in the **adopting project's own terms** (ADR 0026 §7:239–248;
ADR 0021 §6.2). Three sentences in ADR 0026 §7 do three separate jobs, and this section
keeps them apart:

- the **rule** (ADR 0026 §7:241) is that every field is named in the project's own terms;
- the **model of that rule** (ADR 0026 §7:242–244) is this project's own supplier/customer
  vocabulary — "a second supplier for the same part", "the price we pay each year", "what a
  customer sees if it is wrong" — which is what §Synopsis above uses;
- the **constraint on the software case** (ADR 0026 §7:245–247) is about _where_ software
  may appear: "it appears in carriers as an example only, never as the convention's own
  language".

**This spec contains no software worked example, by design.** The three software phrases
above are inside the sentence that quotes ADR 0026 §7 and are not an example of a brief;
nothing else here is software-flavoured. The convention's own language — the six field
names, the `decide:`/`decided:` tokens, the routing rule, the four state tokens — is
neutral throughout, so a reader who has never written anything technical can follow the
convention itself, which is the reader it exists for (ADR 0026 §7:247–248). The **software
worked example is owed in the carriers**, `task-wire-decision-brief-carriers`, and is
that item's acceptance criterion (AC 14 below names it as such).

## Boundary with the carriers item

`task-wire-decision-brief-carriers` is `todo`, `depends_on: [task-spec-owner-decision-brief]`,
and blocked by the ADR 0017 hard gate. This spec must be complete enough that its maker
implements from it **without re-deciding anything**. What the carriers item does, and
what it must not re-decide:

| The carriers item will…                                                                                                                                                                                                                        | Why it is not here                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write the convention prose into [`docs/agents.md`](../agents.md) §Orchestration and [`docs/engineering.md`](../engineering.md) §Roles and authority — six fields, answer grammar, routing rule, with the ADR 0021 §2 map restated as unchanged | This spec fixes the content (above); the carriers carry it. ADR 0026 §Consequences:294–296 names the carrier text as belonging to "the spec and the carriers that follow this record, in that order" |
| Give the generated `arggon-delivery-lead` contract the duty, phrased in role language and **citing** §Roles and authority instead of duplicating it                                                                                            | Carrier text belongs to the carriers item; a duplicated table would fork the record                                                                                                                  |
| Update both skill copies and keep them byte-equal (`npm run skills:sync`; `cli/src/skill-copy.test.ts` decides, never hand-sync)                                                                                                               | Behavioral change ⇒ the ADR 0016 channel (`docs/agents.md:506`)                                                                                                                                      |
| Ship the report-only finding with tests, asserting **no** transition, command or CI lane consults it                                                                                                                                           | The finding's _content_ is specified above (kind, arming, scope, determinism); its code belongs to the implementation                                                                                |
| Re-brief or record-as-decided the three live cases named in exploration 025                                                                                                                                                                    | Content work on real items, not specification                                                                                                                                                        |
| Amend ADR 0026's consequences with the chosen surface (`show`), dated                                                                                                                                                                          | The _choice_ is made above (and §Surfaces says why `sync`/`report` cannot); the dated amendment travels with the change that makes the record complete                                               |

**Not the carriers item's job, and not this spec's:** re-deciding any part of ADR 0026,
changing the promotion-policy tiers, adding a frontmatter field, adding a command, or
adding a gate. If an implementer finds one of those necessary, that is a finding against
ADR 0026 §6, not a decision to take at the keyboard.

## Acceptance

- [ ] **AC 1 — parser.** A kernel module (`lib/src/brief.ts`) mirroring
      `lib/src/acceptance.ts` and `lib/src/verdict.ts`: heading regex, bounded `decide:`
      and `decided:` header lines, first-match-only per comment, append-order tiebreak,
      later-`decided:` supersedes, and the `decided: other` reply parsed as an ordinary
      answer. Exported from the kernel index. Unit tests pin the vocabulary boundaries
      the siblings pin: `decide:` must not match `decides:`, `decided:` must not match
      `decidedly:`, a mention mid-sentence (`the decide: header …`) is not a header, and
      a header inside a dated handoff block does not count.
- [ ] **AC 2 — attribution.** The parsed answer carries the comment's **author** (today
      `VerdictComment` does not), which is what makes `self-decided` computable — the
      same new-data reasoning AC 2 of spec `promotion-policy-018` records for
      `self-accepted`. The classifier receives the item's current `assignee` as its second
      argument, exactly as `classifyAcceptance(body, assignee)` does, because
      `self-decided` is defined against the item's **own assignee**
      (`lib/src/acceptance.ts:150–152`: an unassigned item can never read as
      self-answered).
- [ ] **AC 3 — `show`.** Additive `decision_brief` (`none｜open｜decided｜self-decided`)
      on the item's own classification, additive within `schemaVersion` 1, bounded like
      its neighbours (ADR 0006), read from the item's canonical body so a brief filed as
      a comment — the default path, since `create` has no `--body` flag — is still
      classified. The human `arggon show` view gains **no** field line: the brief is
      already visible there as the item's own comment text, verbatim — exactly how
      `acceptance` renders today (`docs/json-output.md:607`).
- [ ] **AC 4 — `spec analyze` finding.** `UNANSWERED-DECISION-BRIEF` fires only when
      `x-tracker.product-acceptance` is armed **and** the item's state is `open`.
      **Scope: any item type and any status**, deliberately wider than the acceptance
      detector it mirrors — the acceptance is due at closure and so is scoped to
      terminal `story` containers (`lib/src/acceptance.ts:184`, `:212`), while a brief is
      owed while the decision is open, so narrowing it by analogy would silence the case
      the finding exists for (§The finding states this in full). Its `file` is the item's
      own path, so it has no `line`. Never fires on `none`, never on `decided`, never on
      `self-decided`, never when unarmed, never fails the run, and its message is
      deterministic (no clock, no counts) so a committed baseline fingerprints stably.
- [ ] **AC 5 — opt-in, and the existing arming is reused.** No new `x-tracker` key.
      Absent or `false` ⇒ no finding, and `show`'s field still reports **all four
      states** — `none`, `open`, `decided`, `self-decided` — unconditionally (a pure read
      of the body), exactly as `acceptance` is ungated while its finding is armed
      (`docs/convention.md:560`). An unparseable `.convention.yml` reads as UNARMED, never
      as an analyze failure.
- [ ] **AC 6 — never a gate, anywhere.** No transition consults the state; no command
      refuses because of it; CI never fails on it; no new status, no timer, no
      product-owner-blocked state. A test asserts the done gate and the cascade reach the
      same verdict with and without brief and answer comments present.
- [ ] **AC 7 — one logic path.** The classification is computed once in the kernel and
      read by every surface; no adapter reimplements it and the capability matrix needs
      no row change. `report --json` and `sync --json` are **byte-identical** — asserted
      by a test, not by prose.
- [ ] **AC 8 — idempotence and forward-only.** Re-running any surface never mutates
      state; a later `decided:` clears the finding on the next run; nothing backfills
      historical items; a superseded brief is never rewritten (a superseding answer is a
      new comment).
- [ ] **AC 9 — routing rule and the unanswered default, stated not enforced.** The
      carriers (next item) carry ADR 0026 §5's rule verbatim: briefs only for the
      ADR 0021 §2 rows and hard-to-reverse calls; **a one-option question is not a brief**
      (the lead decides it and records why); everything else is a plain comment; one
      canonical item per decision and a second brief links to it. They also carry
      ADR 0026 §3's unanswered rule (ADR 0026 §3:129–139): the stated default **executes**
      on its date and the brief records that it did — silence selects a default the owner
      was shown in advance, never an answer by abstention. This AC is satisfied by the
      carriers item, and it is recorded here so both rules have an owner: no automated
      check enforces either, because ADR 0026 §6 admits no gate on a record the tracker
      cannot authenticate.
- [ ] **AC 10 — touchpoints do not rise.** The carriers state, in the same words as ADR
      0026 §Consequences:272–274, that a brief **replaces a chat question rather than
      adding a step**, and the promotion-policy T0/T1/T2 table in
      [`docs/engineering.md:137–143`](../engineering.md) is unchanged by this work: same
      tiers, same rows, same blocking column. A reviewer diffing that table finds no
      change.
- [ ] **AC 11 — concurrency: one canonical item.** Two items briefing the same decision
      resolve by convention (one is the record, the other links). **No cross-item dedupe
      scanner** — an explicit non-goal (see §Non-goals), because the volume of
      product-owner decisions in a repository this size does not justify a new surface
      (the same reasoning that rejected the C3 `docs/decisions/` corpus, ADR 0026
      §Alternatives:304–309).
- [ ] **AC 12 — absolute dates only.** The default field carries an absolute ISO date
      (`YYYY-MM-DD`); a relative deadline ("by Friday") is not a brief that satisfies
      field 6. Enforced as a **convention in the carriers**, not as a parser: the brief's
      fields are prose (fields 1–5 have no grammar a parser could check), and inventing
      one would be a second rule for a record whose siblings are checked at the header
      line only.
- [ ] **AC 13 — data, never instruction.** A brief is parsed as prose. No command
      interpolates its text, no shell/subprocess ever receives it, and the generated
      agent contracts are **shipped files** an adopter's brief cannot reach (`init`
      never overwrites them). No new permission, no new command.
- [ ] **AC 14 — domain-neutral wording.** Every doc sentence names the surface by what
      the adopting project declares, and a non-software reader must be able to follow the
      convention without knowing what a test suite or a worktree is (ADR 0021 §6.2,
      ADR 0026 §7). This spec carries the **non-software** worked example only, in
      ADR 0026 §7's own supplier vocabulary; the **software** worked example is owed in
      the carriers (`task-wire-decision-brief-carriers`), where it appears as this
      project's example and never as the convention's own language — ADR 0026 §7:245–247.
- [ ] **AC 15 — upgrade path.** Behavioral ⇒ the ADR 0016 channel: `arggon init --propose`
      delivers the convention to adopters ([ADR 0016 §Decision 2](../adr/0016-adopter-upgrade-channel.md)),
      the release note names it, and both skill copies stay **byte-equal in the same PR**
      (`docs/agents.md:506`).
- [ ] **AC 16 — docs travel with code.** `docs/json-output.md` documents the new
      `decision_brief` field and the new finding kind; `docs/engineering.md` gains the
      convention beside §Product acceptance and the routing rule; `docs/agents.md`
      §Orchestration states it; ADR 0026 gains the dated amendment naming `show`.
- [ ] **AC 17 — the findings ADR 0026 left open are answered.** The change lands with
      both questions settled in writing: **which read-only surface reports an unanswered
      brief** (`show`'s additive field plus the `spec analyze` finding; `report` and
      `sync` unchanged, justified above) and **where the carrier text lives**
      (`task-wire-decision-brief-carriers`, named in §Boundary above).
- [ ] **AC 18 — gates.** `arggon validate`, `arggon spec validate`, `npm test` green;
      `npx prettier --check` clean on every file touched; `arggon spec analyze` reports
      **no NEW findings** for this spec.

## Non-goals

- **A gate of any kind on a brief or an answer** — refused by ADR 0026 §6 for the
  inherited reason: no identity layer, so a gate is forgeable or unusable, and both are
  worse than none (ADR 0026 §6:219–226).
- **Authentication of the product owner** — impossible without an identity layer; out of
  scope here and for any future gate.
- **A cross-item dedupe scanner** for two briefs of the same decision. One canonical item
  plus a link is a convention; a scanner would be a new surface over a volume that does
  not justify it (exploration 025 §Edge cases, concurrency row: _"No cross-item dedupe
  scanner in v0 — **explicit non-goal**, the volume does not justify a surface"_).
- **A `docs/decisions/` corpus, a template, or any second home for questions** — ADR
  0026 §Alternatives (C3, :304–309) rejected it on one home, one style: the failure mode
  is a decision recorded in the corpus and never in its own record.
- **A `priority`-style frontmatter field** recording that a brief is outstanding —
  rejected in ADR 0026 §Alternatives (:313–316) on the same grounds that rejected
  `role:`/`owner:` in ADR 0021.
- **A brief on every decision** — rejected outright (ADR 0026 §Alternatives:310–312): it
  inverts ADR 0021 §3. The routing rule is normative, not advisory.
- **A machine-checked field list.** Fields 1–6 are prose; only the two header lines are
  parsed. A parser that tried to enforce "≥2 options" or "an absolute date" would be a
  second grammar over free text, and the siblings do not have one either. These are
  convention, carried by the carriers, reviewed by a human.
- **Anything for the no-product-owner case.** A repository with nobody to answer is
  compliant by default and silent (ADR 0026 §3:137–139; ADR 0021 §3's compliant-by-
  default tier). The stated default executes and the brief records that it did — that is
  the compliance posture, not a defect to detect.
- **A migration.** Nothing to migrate: briefs live in item bodies, which already exist.
  A superseded brief is answered by a later `decided:` comment.
- **Changing the promotion-policy tiers or the ADR 0021 §2 authority map** — see AC 10.

## Open questions this spec does not answer

- **The metric that would ever justify revisiting report-only — what is computable, and
  what is not.** ADR 0026 §8:250–260 names its own two measurable limbs. **Limb (a) is
  computable from what this spec already specifies.** It reads as answer-latency
  collapsing to "immediate, no scope note", or an answered-brief ratio near 1.0 with zero
  `decided: other` replies: AC 1 mandates a parser carrying `date` and `order` on every
  recognized comment — the same fields both siblings already capture
  (`lib/src/verdict.ts:23–31`, `lib/src/acceptance.ts:54–58`) — so answer latency is a
  comment-date difference between a brief and the answer that follows it, and the
  answered-brief ratio follows from the per-item state above. **Limb (b) is not
  computable**: "more real decisions are made in chat than in briefs" needs a count of
  decisions made outside briefs, and no surface records a chat decision. **No detector is
  built for either limb here** — the ADRs ask for measurable triggers, not for shipping
  a metric surface with the convention — but the distinction is recorded so a future
  reader does not conclude limb (a) was unknowable, which it is not.
- **Whether the carriers item should re-brief the three live cases named in exploration
  025** (`task-decide-codebase-memory-default-discovery`,
  `task-decide-adr-0021-index-title-editorial-vs-verbatim`,
  `task-arm-strict-worktree-writes`). ADR 0026 §Context:57–63 states two of the three
  would not owe a brief at all under §5, so the carriers item's own acceptance ("re-brief
  or record as decided") is content work, not a convention question. This spec takes no
  position on which of the three owe one.
