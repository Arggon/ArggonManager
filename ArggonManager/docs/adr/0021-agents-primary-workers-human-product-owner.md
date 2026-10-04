# 0021 Agents as primary workers, humans as product owner

- Status: Proposed
- Date: 2026-10-04
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Input: [exploration-agent-primary-workers-019](../explorations/exploration-agent-primary-workers-019.md) (2026-10-04)
- Methodology impact class: **Behavioral** (agents must re-learn something) — reaches adopters through the ADR 0016 channel

## Context

The methodology states, in five places, that **humans and agents follow the same
rules**: `README.md:59` (Principle 3), the invariant block of all three carriers
(`ArggonManager/docs/agents.md:6`, `docs/engineering.md:6`,
`docs/convention.md:6`), the ADR 0020 decision that declares those carriers to be
the product (`adr/0020-methodology-first-productization.md:62–64`), and
`docs/engineering.md:201` ("agent-only shortcuts are out of scope unless an ADR says
otherwise").

Two things have since drifted out from under that sentence.

**First, the invariant is already structurally false in four places.** `--steal` is
human-only and requires an interactive confirmation (`convention.md:303`,
`docs/claim.md:83–99`); `--waive` on the done gate is human-only and exposes **no**
MCP/native parameter (`docs/agents.md:227`, `docs/json-output.md:415`); `--force` on
`update` is human-only (`docs/agents.md:303`); reopening a terminal item needs a TTY
confirmation and refuses piped stdin (`docs/agents.md:282`). The asymmetry is real,
structural, and load-bearing — it is the only thing standing between an agent and a
silent override of a recorded decision. It is simply not written down as a _role_.

**Second, the work loop has already become agent-primary, without saying so.** The
shipped agent roles plan waves, claim, dispatch, implement, review as lead
architect, verify merges, flip items done and file follow-ups
(`docs/agents.md:290,306,308`). The human's remaining powers are direction/priority,
product acceptance, risk waiver, claim takeover and release — and four of the five
are structural. The fifth, **product acceptance**, has no record anywhere: the review
bar assigns it to a "Project Manager" in prose (`docs/engineering.md:12,75–78`) and a
story closes through the acceptance-aware cascade (`convention.md:52`). Meanwhile
`docs/engineering.md:12` still assigns architect / developer / QA work to human job
titles that the shipped agents already perform.

So the state today is the worst of both worlds: the stated rule is false, and the
real division of authority — including the single most important human decision in
the loop — leaves no trace.

The product owner asked for this to be settled as a recorded decision (2026-10-04):
agents as the primary workers, humans in the product-owner role.

## Decision

Adopt **C2** from the exploration: declare the role model honestly, and back exactly
one human decision with a record.

### 1. The invariant is superseded by a two-axis rule

Replace "humans and agents follow the same rules" with:

> **Work-loop parity:** any human and any agent may claim an item, work it, review
> it, comment on it and merge it, under the same kernel rules and the same JSON
> contracts.
> **Asymmetric authority:** a small, named set of decisions belongs to the product
> owner, and the irreversible ones are structurally human-only.

The carriers, README and ADR 0020's invariant block are updated to this wording in
the same change (Behavioral class). Parity is not weakened: the _loop_ stays
identical for both sides; what is being recorded is the authority split that already
exists in code.

**This is not an "agent-only dialect of the rules".** `docs/engineering.md:56` keeps
a dialect out "without an ADR" — this _is_ that ADR. Both sides call the same kernel
through the same envelopes (ADR 0010/0011 one-logic-path); no adapter forks a rule;
no new command, schema field or private surface is introduced.

### 2. The authority map (bounded, named)

| Decision                           | Owner             | Enforcement today                                                   |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------- |
| Direction and priority             | **product owner** | recorded as `priority`; decided by a person                         |
| Product acceptance of a container  | **product owner** | recorded as an `accept:` comment (below)                            |
| Accepting residual risk            | **product owner** | ADR 0015 waiver — human-only, no agent parameter                    |
| Taking over another writer's claim | **product owner** | `--steal` — armed config + TTY confirmation                         |
| Publishing a release               | **product owner** | human-pushed version bump (`spec-release-pipeline-015.md` AC 7)     |
| Exploring, specifying, planning    | agent             | the loop, unchanged                                                 |
| Implementing, testing, docs        | agent             | the loop, unchanged                                                 |
| Reviewing and proving              | agent             | reviewer (read-only) / prover (no mutation) split (`agents.md:293`) |
| Verifying merges, flipping `done`  | agent             | coordinator; the done gate still holds (ADR 0015)                   |
| Filing follow-up work              | agent             | coordinator consolidates and files (`agents.md:308`)                |

The four irreversible powers keep their existing structural gates. No new authority
is granted to any agent.

### 3. The promotion policy (the missing artifact)

`docs/engineering.md` gains a bounded **tier table** next to the review bar: which
item classes require a recorded product acceptance and which the agent may
self-certify on the review-bar evidence (tests + blocking smoke, ADR 0008). The
default tier is **agent-self-certified**, so a repository with no product owner is
compliant by default and never blocked.

This mirrors the external practice the exploration found: a written, agreed-in-
advance, tiered review path ("promotion policy") that sets the depth of human review
per class, tiered by blast radius (Anthropic, 2026-09-23). We already have the
certificate — the review bar and its blocking smoke — and never wrote down how deep
human review goes for each class of work.

**The cap matters as much as the table:** product-owner touchpoints are bounded to
containers, waivers and irreversible steps. Leaves are agent-owned end to end. No
product-owner review per leaf PR. METR's field evidence (2025-07-10: 19% slower
with early-2025 tools, time lost to reviewing, prompting and waiting; follow-up
2026-02-24: the sign flipped for late-2025 tools but selection effects make the size
weak evidence) is the reason: human attention is the scarce input, so the model must
reduce per-item human cost, never add one.

### 4. One recorded artifact: the product acceptance

A bounded, author-attributed comment header on a container item, exactly mirroring
the review-verdict convention (`docs/engineering.md:109`):

```
### 2026-10-04 @gonzalo
accept: approve
- login rate limit behaves as specified; p95 unchanged at 40 rps
```

- `accept: approve` or `accept: changes-requested`, optionally followed by a short
  scope, then the evidence list. Prose, documentation, not schema.
- `arggon sync --json` reads it **report-only** and classifies a reconciled item as
  `accepted` / `changes-noted` / `none`, alongside the verdicts it already
  classifies; an acceptance whose author equals the item's own assignee is reported
  as `self-accepted`.
- `spec analyze` gains one additive finding: a container closed with no recorded
  acceptance.
- **Never a gate.** The tracker has no identity — the session id is correlation
  metadata only (`docs/agents.md:414`) — so an acceptance cannot be authenticated.
  A gate built on it would be forgeable or unusable; both are worse than not having
  one. The enforced human steps remain the four irreversible ones in §2.

### 5. Agent identity

Agents claim as their shipped role id — `arggon-coordinator`, `arggon-worker`,
`arggon-reviewer`, `arggon-prover` — never as the product owner's login. The schema
already permits it: `assignee` is documented as "GitHub login **or agent id**"
(`convention.md:168`). This is doctrine, not migration, and it ends the conflation
that makes agent work look like human ownership in `list --assignee @me`,
stale-claim reports and CODEOWNERS review routing.

### 6. The review-bar role table is remapped

`docs/engineering.md:12` and the review-bar section headers stop naming human job
titles for work the agents perform. Architect / reviewer / prover / QA become agent
roles; product acceptance becomes the product owner's, with §3's tiers deciding
which items ever reach them.

## Consequences

- **The stated rule finally matches the code.** Four human-only gates stop being
  undocumented exceptions and become the named authority surface they have always
  been — which also means a future agent that "helpfully" adds a waive path is
  proposing to break a published invariant, not to extend a helper.
- **Adopters carry a Behavioral change** (ADR 0016): `init --propose` delivers the
  new invariant wording, the tier table and the acceptance convention; the release
  note names them; `skills/arggon-cli/` and `.agents/skills/arggon-cli/` stay
  byte-equal in the same PR (`docs/agents.md:476`).
- **Product-owner attention becomes the explicit bottleneck.** Concentrating
  acceptance at containers is right for quality and wrong for latency: a week without
  a product owner now stalls _closures_ — never the work itself.
- **The shift is measurable, which is what makes the next decision possible.** The
  acceptance share plus the count of human-only hatches used (waivers, steals) per
  closed container is the PO-attention signal, surfaced through the existing
  report-only surfaces (`sync`, `spec analyze`, `report`) — no new dashboard.
- **A kernel-enforced acceptance gate stays deferred** (C3 in the exploration). The
  revisit condition is explicit: a demonstrated failure the report-only detector did
  not prevent, **and** a report that has proven low-noise. The repo's precedent is
  the same one applied to review verdicts (`docs/engineering.md:109`).
- **Reviewers will ask whether this is a dialect.** The answer is in §1 and is
  checkable: one kernel, one rules module (`lib/src/rules.ts`), one envelope contract,
  no per-adapter divergence. Per the ADR 0020 capability matrix, a role difference
  that an adapter cannot express is a **gap row**, never a second rule.
- **Not decided here:** anything about how a product owner is _appointed_ in a
  multi-human repo. The model needs exactly one accountable product owner per
  container; more than one is a team decision this record deliberately leaves open.

## Alternatives considered

- **C1 — declare only** (supersede the invariant, rewrite the role table, no new
  artifact). Rejected: leaves product acceptance invisible, which is the one power
  with no record today; the machinery to make it visible already ships twice over
  (`sync` verdict parsing, `spec analyze` findings), so the simplicity was worth less
  than it appeared.
- **C3 — C2 plus a kernel-enforced PO gate** (no `done` without a recorded
  acceptance). Rejected on a hard constraint: the tracker cannot authenticate the
  product owner, so the gate is forgeable or unusable; it also spends scarce
  human attention on every close, against the field evidence. Deferred with an
  explicit revisit condition rather than discarded.
- **A `role:` / `owner:` frontmatter field.** Rejected: a schema change carrying a
  fact `assignee` already carries, and a kernel-trusted field a worker could write
  to nominate itself product owner.
- **Per-adapter permission enforcement of the role.** Rejected: violates the
  one-logic-path invariant and leaves the Claude Code seam — which ships no hooks and
  no permission DSL (ADR 0020 amendment, 2026-10-02) — permanently unenforced.
- **A product-owner-only `next` lens or a separate agent pool.** Rejected as YAGNI: a
  second work loop with no evidence it would behave differently.
- **Keeping the parity invariant and treating the four human-only gates as bugs.**
  Rejected: the gates are the safety property, not the defect; the defect was calling
  them exceptions.
