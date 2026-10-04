# 0021 Agents as primary workers, humans as product owner

- Status: Accepted
- Date: 2026-10-04
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Input: [exploration-agent-primary-workers-019](../explorations/exploration-agent-primary-workers-019.md) (2026-10-04)
- Methodology impact class: **Behavioral** (agents must re-learn something) — reaches adopters through the ADR 0016 channel

> Status note (2026-10-04): flipped from Proposed to Accepted on the merge of PR #624
> (`171f43b3`) — the ADR lifecycle in `docs/engineering.md` §ADR process is
> "Proposed in a PR → Accepted when merged". The decision itself was taken when the
> record was written; only the status line lagged the merge, so nothing below this
> note is rewritten (`task-adr-0021-status-accepted`).
>
> **Amendment (2026-10-04, product owner directive): §6 is expanded — the roles are
> named, and the shipped seam is brought in sync.** The decision below is unchanged;
> this amendment adds §6.1 (the role model) and §6.2 (role ids are stable wire
> names, not the role) to §6, and nothing above or below is rewritten. The four
> shipped agent contracts were still written for a software-only loop while the
> carriers declare the scope _"any project — not only software"_ (ADR 0020 §Decision
> .1; `spec-methodology-adapters-017.md:16–18`), so the seam contradicted the
> methodology it ships. Implementation is tracked under
> `task-agent-role-contracts` (spec) → `task-agent-role-contracts-seam`, with the
> authoritative role table landing in `task-wire-role-model-carriers`.
>
> ### §6.1 The role model
>
> | Shipped id           | Role                     | Software analogue              | Non-software analogue                     | Decides                                                                                                        |
> | -------------------- | ------------------------ | ------------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
> | _(human)_            | **Product Owner**        | Product owner / sponsor        | Same                                      | Direction, priority, acceptance, risk, release (§2)                                                            |
> | `arggon-coordinator` | **Delivery lead (PM)**   | Product manager                | Project manager                           | What is built next and in what order; who is dispatched; tracker state; merge verification and the `done` flip |
> | `arggon-reviewer`    | **Practice & standards** | Tech lead / software architect | Standards, methods, editorial, compliance | Whether a change is right by the project's own bar — structure, patterns, principles, scope; asks for refactor |
> | `arggon-worker`      | **Maker**                | Programmer                     | Author, analyst, executor                 | Producing the change, keeping it on the item                                                                   |
> | `arggon-prover`      | **Verifier**             | Manual QA                      | Independent checker / inspector           | Whether the delivered thing actually does what was specified, by executing the project's gates                 |
>
> Two boundaries this makes explicit, because the roles otherwise blur:
>
> 1. **Coordinator ≠ priority owner.** A product manager _sequences_ delivery; the
>    product owner _sets_ the priority field. The coordinator recommends priority
>    changes and owns wave planning, dispatch and tracker state — the PO's
>    authority map in §2 is unchanged.
> 2. **Prover reports, it does not rule.** "Manual QA" means checking the delivered
>    thing against the specification and reporting observed-versus-expected. The
>    existing rule that the prover does not _decide the verdict_ survives — the
>    reviewer's judgment and the coordinator's merge call are unchanged — so the
>    role gets its teeth without becoming an approver.
>
> ### §6.2 Domain neutrality is part of the role, not a courtesy
>
> A role is defined by **what it decides**, never by software artifacts. Every
> contract states its gate in the project's own terms and gives the software case
> only as a worked example: the verifier runs "the project's verification gates"
> (in software: the test suite, lint, typecheck, build, and the blocking smoke of
> ADR 0008); the reviewer's blocking bar is "the bar the project's engineering docs
> declare" (in software: architecture, conventions, tests-travel-with-behavior,
> docs-travel-with-code, the smoke gate). Today those prompts hard-code code nouns
> — `tests travel with behavior`, `run the project gates (tests, lint, build)`,
> "real-browser drive for UI changes" — which is the contradiction this amendment
> closes. The invariant that survives every domain is the **acceptance contract**
> on the item, not the tool that checks it.
>
> ### §6.2a The ids stay
>
> **Superseded 2026-10-04 — see §6.2a′ below.** The clause below is left exactly as
> taken, because it is the reasoning that produced the reaping precondition.
>
> Renaming the shipped files (`arggon-coordinator` → `arggon-product-manager`, and so
> on) was considered and **rejected**. The ids are wire names, not role names:
> they are referenced ~320 times across ~130 files in this repo (generated
> permission allow-lists, the ZCode plugin manifest and its agents, the capability
> matrix, the wave smoke harness, the docs) and, decisively, they are **materialized
> in every adopting repo**, where `arggon init` never overwrites and — per
> `docs/agents.md` §Prerequisites, _"Selection never deletes… nothing on disk is
> removed"_ — never removes a generated file whose template is gone. A rename would
> therefore leave each adopter with a **fifth, orphaned agent file** that OpenCode
> still auto-discovers and can still dispatch, alongside the new one, with no
> supported way to reap it except a manual `init` plus hand deletion. A stable id
> plus a changed role statement gets the same clarity for every reader and none of
> that. The role is carried by the contract text and the role table in
> `docs/engineering.md`; the id stays the thing permissions, manifests and existing
> adopter files can keep pointing at. Supersede this amendment if the adopter cost
> is judged worth paying.
>
> ### §6.2a′ Superseding amendment — the rename proceeds, gated on reaping
>
> The product owner directs the rename (2026-10-04), so §6.2a is superseded. What it
> got right survives as a **precondition** rather than a veto: the objection was
> never that renaming is wrong, it was that renaming strands dispatchable orphans.
>
> **The new ids, and the rule that produced them.** The id names the **role**, never
> the software title — §6.2 applied to filenames, so the rename cannot re-import the
> software framing the same amendment removed.
>
> | old id               | new id                      | role (§6.1)          | software analogue (non-normative) |
> | -------------------- | --------------------------- | -------------------- | --------------------------------- |
> | `arggon-coordinator` | `arggon-delivery-lead`      | Delivery lead        | product manager                   |
> | `arggon-reviewer`    | `arggon-standards-reviewer` | Practice & standards | tech lead / architect             |
> | `arggon-worker`      | `arggon-maker`              | Maker                | programmer                        |
> | `arggon-prover`      | `arggon-verifier`           | Verifier             | manual QA                         |
>
> `arggon-product-manager` and `arggon-tech-lead` were considered as ids and rejected:
> they would name the analogue rather than the role. The software title stays in the
> §6.1 table, where it belongs.
>
> **The precondition, and why it is now cheap.** The rename does not ship before
> orphan reaping exists (`task-adapter-orphan-reaping`), and the inventory showed the
> data it needs is data we already ship: every generated agent destination is recorded
> in the tracker's `x-generated` block with its `template:` path and `checksum`
> (`ArggonManager/.convention.yml:84–96`, `:170–183`), so an orphan is already
> detectable with no new provenance — a destination whose recorded template is absent
> from the installed package. Reaping is **checksum-guarded**: `doctor` reports
> `orphaned`, `init` removes the file only when it is byte-identical to what was
> generated, and an adopter-edited orphan is reported and never deleted. The
> never-overwrite promise binds reaping exactly as it binds refresh.
>
> **The inventory, and its sharpest edge.** The blast radius is smaller than §6.2a
> assumed: 7 path-coupled template files (4 OpenCode, 3 ZCode — the ZCode seam ships
> no prover), 9 code files carrying string references, 57 markdown files, and
> generated seam copies refreshed by `init`. The capability matrix needs **no**
> change — its rows are per client, not per agent. The sharpest coupling is
> `templates/docs/zcode/arggon/hooks/gate.mjs`: its `/(^|:)arggon-reviewer$/` matcher
> opens the dispatch-scoped read-only window, so a rename that misses the regex
> silently **disarms the reviewer backstop**. That is a security-relevant coupling
> and it gets a test binding the gate's matcher to the shipped reviewer name.
>
> Scope, waves and gates: `task-spec-agent-rename-migration` (the spec, ADR 0017
> gate) → reaping and rename in a single wave, because they are causally coupled
> (reaping alone is dead code, the rename alone strands adopters) → then harnesses
> and prose in disjoint waves. Nothing else in §6.1, §6.2 or §6.2b changes: the roles,
> the two boundaries, the domain-neutrality clause and the "no
> permission/tool/kernel/schema change" clause all stand as merged.
>
> ### §6.2b What this amendment does not change
>
> No permission, tool, capability, kernel rule, envelope or schema change. The
> coordinator's subagent allow-list, the reviewer's read-only contract and the
> prover's no-mutation contract are already correct for these roles — they are
> restated in role language, not re-decided. Behavioral impact class: agents must
> re-learn their operating contract, so it ships through the ADR 0016 channel with
> both skill copies byte-equal.

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

> **Amendment (2026-10-04, `task-role-model-report-only-detector`): the second bullet's
> `sync` is corrected to `report` + `show`.** The decision above is unchanged — one
> bounded, author-attributed, report-only record — and nothing above or below this note
> is rewritten. The implementation spec
> ([`docs/specs/spec-promotion-policy-018.md`](specs/spec-promotion-policy-018.md)) found
> that the surface this section names **cannot carry the artifact**: `sync` classifies
> only the items it reconciles with an **open PR** (`lib/src/sync-command.ts:83`, the
> verdict map is built over PR matches), while a product acceptance is a **container**
> decision — containers carry no branch, so they never appear in that map and a
> container's acceptance could never be reported there. The surfaces that can carry it
> are the ones that already aggregate per container and per item: `arggon report --json`
> (one `acceptance` per container row) and `arggon show <id> --json` (one `acceptance`
> per item, read from the item's canonical body). `sync` is left **byte-identical**: its
> review-verdict classification is untouched, and the container-level reading is simply
> not its question.
>
> Two further facts the spec settled, both consistent with §4 above: `self-accepted` is a
> first-class state (attribution is the only honest signal without an identity layer, so
> a reader must see it before trusting an acceptance), and the `spec analyze` finding is
> **opt-in** — it fires only where the project has declared
> `x-tracker.product-acceptance: true`, so a project with no product owner stays silent
> instead of being nagged about a role it does not have. Both are report-only, like
> everything in §4: no transition consults the state, no command refuses because of it,
> and CI never fails on it.

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
