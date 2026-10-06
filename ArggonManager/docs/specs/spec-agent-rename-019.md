---
spec_id: agent-rename-019
title: The agent rename migration — role ids, role contracts, domain-neutral gates and adapter orphan reaping
status: proposed
created: 2026-10-04
---

# Spec: The agent rename migration (agent-rename-019)

Implements [ADR 0021 §6.1, §6.2 and §6.2a′](../adr/0021-agents-primary-workers-human-product-owner.md)
— the role model, its domain-neutrality clause, and the superseding amendment that
authorises the rename. ADR 0017 gate item: no implementation task below this one may be
claimed before it exists and `arggon spec analyze` reports no NEW findings.

This spec **absorbs** `task-spec-agent-role-contracts` (cancelled): the contract rewrite
and the rename touch the same seven files, so they are one migration, not two.

## Purpose

Two contradictions are live today, and both are the same bug at different depths.

**Surface.** ADR 0020 declares the methodology's scope _"any project — not only
software"_, yet the four shipped agent contracts are hard-wired to code artifacts —
`arggon-worker.md` says _"Tests travel with behavior; run the project gates (tests,
lint, build)"_, `arggon-reviewer.md` binds its blocking bar to _"probe evidence for CLI
changes, real-browser drive for UI changes"_, and `arggon-prover.md` says _"suites
import the kernel's built output"_. An adopter running research, editorial, ops or
compliance work reads those and gets a methodology that does not apply to it.

**Naming.** ADR 0021 §6.1 named the roles (Delivery lead / Practice & standards / Maker
/ Verifier), but the shipped ids still read `coordinator`, `worker`, `reviewer`,
`prover` — process verbs, not roles. §6.2a′ then authorised the rename, gated on orphan
reaping, because `arggon init` never deletes and a naive rename would leave every
adopter with a **dispatchable orphan** per old file.

**Invariants**

- **Reaping precedes renaming.** The rename never lands without the `orphaned` status and
  the checksum-guarded reap. Reaping alone is useful (any destination can disappear from
  a future template set); the rename alone strands adopters.
- **Never-overwrite binds reaping.** An orphan is deleted only when it is byte-identical
  to what was generated. An adopter-edited orphan is reported and left alone — the same
  rule that governs acked docs (`docs/agents.md` §Prerequisites).
- **One logic path.** The reaping decision is computed in the kernel and read by `init`
  and `doctor`; no adapter reimplements it, and the capability matrix needs no row change
  (its rows are per _client_, not per agent — verified: zero agent-id references in
  `adapters/capability-matrix.json`).
- **The role id names the role, never the software title** (§6.2 applied to filenames).
- **Permissions keep their semantics.** Only the resource _names_ in the allow-list
  change; no deny is added, removed or weakened.
- **No kernel rule, envelope, schema field, CLI flag or command changes.**

## Synopsis

### The rename map

| old id               | new id                      | role (§6.1)          | software analogue _(non-normative)_ |
| -------------------- | --------------------------- | -------------------- | ----------------------------------- |
| `arggon-coordinator` | `arggon-delivery-lead`      | Delivery lead        | product manager                     |
| `arggon-reviewer`    | `arggon-standards-reviewer` | Practice & standards | tech lead / architect               |
| `arggon-worker`      | `arggon-maker`              | Maker                | programmer                          |
| `arggon-prover`      | `arggon-verifier`           | Verifier             | manual QA                           |

`arggon-product-manager` and `arggon-tech-lead` were considered as ids and **rejected**:
they name the _analogue_. The software title stays in the §6.1 role table.

### Surface inventory (measured, not estimated)

| #   | Surface                  | Files                                                                                                    | Coupling                                                                                                                         |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A   | OpenCode agent templates | `templates/docs/opencode/agents/` × 4                                                                    | **filename** — a rename is a new path                                                                                            |
| B   | ZCode agent templates    | `templates/docs/zcode/arggon/agents/` × 3 (no prover)                                                    | **filename**                                                                                                                     |
| C   | ZCode hook gate          | `templates/docs/zcode/arggon/hooks/gate.mjs:16,150` — `/(^\|:)arggon-reviewer$/` in `isReviewerDispatch` | **string, security-relevant**: rename the agent, miss the regex, and the dispatch-scoped read-only window silently stops opening |
| D   | Init/doctor tests        | `cli/src/{init,init-opencode,init-zcode,adapter-selection,doctor}.test.ts` × 5                           | string (generated paths + permission resources)                                                                                  |
| E   | Evidence harnesses       | `smoke/opencode-smoke.ts`, `smoke/opencode-wave.ts` × 2                                                  | string — they dispatch agents by name, so they are the rename's **proof**                                                        |
| F   | Prose                    | 57 tracked markdown files                                                                                | string                                                                                                                           |
| G   | Generated seam copies    | `.opencode/agents/*.md` × 4, `.zcode-marketplace/arggon/agents/*.md` × 3                                 | refreshed by `init` / `npm test`; never committed                                                                                |

Plus, inside A: the delivery lead's subagent allow-list
(`resource: arggon-worker|arggon-reviewer|arggon-prover` → the three new ids), each
prompt's `description:` frontmatter (what a dispatcher displays), and the ZCode agents'
`name:` frontmatter.

**Unaffected:** the capability matrix, the kernel, the envelopes, the schema, the CLI
flags, the commands, and the permission semantics.

### The precondition — orphan detection and reaping

The provenance this needs is **data the product already ships**. Every generated
adapter destination is recorded in the tracker's `x-generated` block with its
`template:` path and `checksum` (`ArggonManager/.convention.yml:84–96` for the four
OpenCode agents, `:170–183` for the three ZCode ones). So an orphan is detectable with
no new provenance: **a destination whose recorded template is absent from the installed
package**.

```text
doctor --agents   →  status `orphaned`   (report-only, one row per destination)
init              →  removes it ONLY when the checksum still matches the recorded one
init --dry-run    →  previews the reaping, writes nothing
```

| Case                                  | `doctor`         | `init`                                     |
| ------------------------------------- | ---------------- | ------------------------------------------ |
| template gone, file byte-identical    | `orphaned`       | removes it, reported as its own action     |
| template gone, file adopter-edited    | `orphaned`       | **refuses**, names the path and the reason |
| template present, file byte-identical | `stale`          | refreshes (today's behavior)               |
| template present, file adopter-edited | `adopter-edited` | skips (today's behavior)                   |
| destination absent from disk          | `missing`        | materializes (today's behavior)            |

`orphaned` slots into the existing status vocabulary
(`present`/`acknowledged`/`acknowledged-drifted`/`adopter-edited`/`stale`/`missing`/`unverified`)
and keeps its contract: every status names what `init` would do, and the matrix/gap rows
stay advisory. The reaped set rides the `--json` envelope in its own action family —
never mixed into the create/replace/skip counts — and human output prints one line per
reaped file. **A reaping action is never silent.**

Safety rules, all testable:

- never reaps a path outside the tracker-root repo
- never reaps a path not recorded in `x-generated` (an unknown file is not an orphan, it
  is somebody's own file)
- never reaps a directory, a symlink, or anything but a regular file
- idempotent: a second `init` reaps nothing and reports nothing outstanding
- never reaps a file whose recorded template is absent **only because the arggon version
  is older than the destination** — the check is "absent from this version's template
  set", so a downgrade reports rather than deletes

### The role contracts (domain-neutral)

Each prompt opens with its role and one line pointing at the authoritative role table
(`docs/engineering.md`, landed by `task-wire-role-model-carriers`), so the table is the
single source and the prompts cannot drift from it.

| Role                     | Decides                                                                                                        | Gate language                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Delivery lead**        | what is built next and in what order; who is dispatched; tracker state; merge verification and the `done` flip | "the gates this project declares"                                      |
| **Practice & standards** | whether a change is right by the project's own bar — structure, patterns, principles, scope; asks for refactor | "the blocking bar the project's engineering docs declare"              |
| **Maker**                | producing the change, keeping it on the item                                                                   | "evidence travels with the change; run the gates the project declares" |
| **Verifier**             | whether the delivered thing does what was specified, by executing those gates                                  | the same, plus: a gate may need the project's build step first         |

Two boundaries the roles would otherwise blur, carried from §6.1:

1. **Delivery lead ≠ priority owner.** A product manager _sequences_ delivery; the
   product owner _sets_ the `priority` field. The delivery lead recommends priority
   changes and owns wave planning, dispatch and tracker state.
2. **Verifier reports, it does not rule.** "Manual QA" means checking the delivered thing
   against the specification and reporting observed-versus-expected. The existing rule
   that the verifier does not _decide the verdict_ survives — the reviewer's judgment and
   the delivery lead's merge call are unchanged.

Software terms survive only as **one worked example each**, never as the rule. The
domain-invariant is the **acceptance contract on the item**, not the tool that checks it.

### The worked example that closes the deferred spike

[Exploration-018](../explorations/exploration-methodology-productization-018.md)
deferred domain neutrality as a _spike item_ — "branch/PR model evaluated for non-code
repos". This spec closes the agent half of it: **one full pass**
(claim → work → review → verify → done) must be traced through the four contracts using a
non-software project, showing that every rule resolves without a code noun. The example
lives in the carriers' role table as a short illustration; the branch/PR model for
non-code repos remains explicitly out of scope (the convention is already generic —
markdown items).

### Rollout (ADR 0016 channel)

Behavioral: agents must re-learn their operating contract, and an adopter's tree changes
shape. So:

- release note names the four new ids and the old→new mapping
- `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**` byte-equal in the same PR
- an adopter runs `arggon doctor --agents` **first** and sees `orphaned` before anything
  is removed — the migration is observable before `init` acts
- an adopter with edited agents keeps their files; the new ones are added beside them
  and the report says so

## Acceptance

- [ ] **AC 1 — one atomic PR.** Renaming, contract rewrite and reaping land together;
      the rename is forbidden from merging without `orphaned` + the guarded reap.
- [ ] **AC 2 — the gate regex cannot drift.** `isReviewerDispatch`'s matcher and the
      shipped reviewer id are bound by a test — the test reads the agent name from the
      shipped template and asserts the regex matches it, so renaming the agent without
      the gate fails CI rather than silently disarming the backstop.
- [ ] **AC 3 — the allow-list cannot drift.** A test pins the delivery lead's allow-list
      to exactly the three shipped subagent ids plus `explore`, reading the ids from the
      shipped templates rather than restating them.
- [ ] **AC 4 — `orphaned` status.** Additive to the `doctor --agents` status vocabulary;
      each status still names what `init` would do; matrix and gap rows stay advisory.
- [ ] **AC 5 — guarded reap.** `init` removes only a checksum-matching orphan; an
      adopter-edited orphan is refused with the path and the reason; the reaped set is a
      distinct `--json` action family and one human line per file.
- [ ] **AC 6 — safety.** No reap outside the repo root, of a path absent from
      `x-generated`, of a directory or symlink; a downgrade (destination newer than the
      installed templates) reports instead of deleting.
- [ ] **AC 7 — idempotence.** A second `init` reaps nothing; `init --dry-run` previews
      without writing.
- [ ] **AC 8 — end-to-end migration test.** On a fixture: generate a seam, delete one
      agent template from the installed package, then assert `doctor --agents` reports
      `orphaned` for the four old destinations and `missing` for none, `init` creates the
      new ids and reaps the unmodified old ones, and a second `init` is a no-op.
- [ ] **AC 9 — harness proof.** `smoke/opencode-wave.ts` and `smoke/opencode-smoke.ts`
      dispatch the new ids and pass their permission probes (reviewer cannot edit, maker
      cannot launch subagents, delivery lead's allow-list holds).
- [ ] **AC 10 — contracts are domain-neutral.** Each of the four prompts carries its role + table pointer, and no rule is stated in a code noun that a non-software project
      cannot resolve; software terms appear only as worked examples.
- [ ] **AC 11 — the two boundaries.** Priority ownership and the verifier's
      report-don't-rule rule are stated in the contracts explicitly.
- [ ] **AC 12 — permissions unchanged in kind.** The same deny set as today, only the
      resource names change; a test asserts no permission was added or removed.
- [ ] **AC 13 — no collateral.** No kernel rule, envelope, schema field, CLI flag,
      command, or capability-matrix row changes.
- [ ] **AC 14 — docs travel with code.** `docs/agents.md`, `docs/engineering.md`
      (role table), `README.md`, both skill copies and the playbooks carry the new ids and
      roles; the ADR 0016 impact class and the release note are stated.
- [ ] **AC 15 — gates.** `arggon validate`, `arggon spec validate`, `npm test`,
      `smoke:native-start-cold` green; `arggon spec analyze` reports no NEW findings;
      prettier clean on every touched file.

## Non-goals

- **Renaming the tracker fields, the commands, or the CLI flags** — the ids are agent
  names, nothing else.
- **A compatibility alias** (generating both old and new names). It would double the
  dispatchable surface and keep the orphan problem alive under a new name.
- **Reaping anything the product did not generate.** An unknown file is somebody's file.
- **The branch/PR model for non-code repos** — explicitly out of scope, per the spike
  note in exploration-018; the convention is already domain-generic.
- **A fifth agent.** Four roles, four ids — the prover stays OpenCode-only, and the
  ZCode gap is recorded as a capability-matrix gap rather than papered over with a new
  file.
