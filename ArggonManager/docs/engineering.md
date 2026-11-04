# Engineering conventions (Phase 1)

> **Methodology carrier (per [ADR 0020](./adr/0020-methodology-first-productization.md)).** This document is a carrier of the ArggonManager methodology — declared together with `ArggonManager/docs/agents.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/convention.md`, and the bundled `arggon-cli` skill.
>
> - **Scope:** any project — not only software.
> - **Invariants:** work-loop parity: any human and any agent may claim, work, review, comment and merge under the same kernel rules and the same JSON contracts; state lives in git; discipline is enforceable; docs travel with code; never-steal / never-reopen, with authority asymmetric and named — the irreversible overrides stay product-owner powers, structurally human-only.
> - **Version:** tracks the ArggonManager package version.
> - **Upgrade channel:** methodology changes reach adopters through the adopter upgrade channel ([ADR 0016](./adr/0016-adopter-upgrade-channel.md)).

Technical direction for ArggonManager: how we structure the repo, what “done” means for eng, and the bars that block merge.

Two axes, not one ([ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §1): the **work loop is identical** for every human and every agent — same kernel rules, same envelopes, same claim discipline — while **authority is asymmetric and named**: a bounded set of decisions belongs to the **product owner** (a human), and the irreversible ones are structurally human-only. Agents are the primary workers; the human in the loop holds those decisions. This is a recorded authority split, not an agent-only dialect: one rules module (`lib/src/rules.ts`), one envelope contract, no per-adapter divergence (ADR 0020 §Decision.1).

This document is owned by the **practice & standards** role. It complements [`ArggonManager/docs/convention.md`](./convention.md) (task tree / frontmatter schema). Product acceptance belongs to the **product owner**, bounded by the promotion-policy tiers next to the review bar below. Implementation stays with the **maker**; executing and reporting the verification gates stays with the **verifier**. The role table, the authority map and the human-only powers: §Roles and authority.

**Status:** active. Phase 1 (convention + CLI) is implemented — stack per [ADR 0001](./adr/0001-cli-stack.md), board per [ADR 0002](./adr/0002-board-viewer-v0.md). This doc evolves in the same PRs as the behavior it governs.

---

## Goals

1. Keep the **repo** scalable as CLI, viewer, and agent hooks arrive.
2. Make discipline **enforceable** (review, CI, fixtures) — not aspirational.
3. Prefer one clear default over “team policy” ambiguity when agents and humans share workflows.

---

## Repo structure (Phase 1)

When changing repository structure or package boundaries: [read details](./references/engineering.md#repo-structure-phase-1).

### Locked / in-flight product layout

When changing the product layout: [read details](./references/engineering.md#locked--in-flight-product-layout).

## Roles and authority

The methodology states two axes, not one ([ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §1): the **work loop is identical** for every human and every agent — same kernel rules, same JSON contracts, same claim discipline — while **authority is asymmetric and named**: a bounded set of decisions belongs to the **product owner**, and the irreversible ones are structurally human-only. Agents are primary workers ([ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §6.1); the human in the loop is the product owner.

Nothing below is a second rule set: every role calls the same kernel through the same envelopes (ADR 0010/0011, one logic path), and a role difference an adapter cannot express is a **gap row** in the capability matrix, never a second rule (ADR 0020).

### The role table

A role is defined by **what it decides**, never by the artifacts it touches (ADR 0021 §6.2) — that is what makes the table readable in a project that is not software. The middle column is a mapping for readers who know the software vocabulary; it is **non-normative** and never a requirement.

| Shipped id                  | Role                     | Software analogue _(non-normative)_ | Non-software analogue                     | Decides                                                                                                        |
| --------------------------- | ------------------------ | ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| _(human)_                   | **Product Owner**        | Product owner / sponsor             | Same                                      | Direction, priority, acceptance, risk, release (§Authority map)                                                |
| `arggon-delivery-lead`      | **Delivery lead**        | Product manager                     | Project manager                           | What is built next and in what order; who is dispatched; tracker state; merge verification and the `done` flip |
| `arggon-standards-reviewer` | **Practice & standards** | Tech lead / software architect      | Standards, methods, editorial, compliance | Whether a change is right by the project's own bar — structure, patterns, principles, scope; asks for refactor |
| `arggon-maker`              | **Maker**                | Programmer                          | Author, analyst, executor                 | Producing the change, keeping it on the item                                                                   |
| `arggon-verifier`           | **Verifier**             | Manual QA                           | Independent checker / inspector           | Whether the delivered thing does what was specified — by executing the project's verification gates            |

The **id names the role**, never the software title and never the process verb (ADR 0021 §6.2a′): the rename landed with `orphaned` detection and the checksum-guarded reap as its precondition, so a role's id, its contract and its file name are one thing. These ids are also what permissions, the plugin manifests and the gate's dispatch matcher point at — and what an adopter's tree materializes, where an edited file is kept and never overwritten (`agents.md` §Prerequisites).

Two boundaries this makes explicit, because the roles otherwise blur (ADR 0021 §6.1):

<!-- arggon:excerpt start: priority -->

1. **Delivery lead ≠ priority owner.** A delivery lead _sequences_ delivery; the product owner _sets_ the `priority` field. The delivery lead recommends priority changes and owns wave planning, dispatch and tracker state — the product owner's authority map below is unchanged.

<!-- arggon:excerpt end: priority -->

2. **The verifier reports, it does not rule.** Checking the delivered thing against the specification and reporting observed-versus-expected is the whole job. The verifier does **not** decide the verdict: the reviewer's judgment and the delivery lead's merge call are unchanged — the role gets its teeth without becoming an approver. The boundary is **config-enforced, not prompt-enforced**: the role's generated contract carries explicit `effect: allow` entries for the read-only tracker tools (`show`, `list`, `next`, `report`, `validate`, in both the native and the MCP spellings) and `deny` entries for every tracker write — `comment` included, since a body append is a write — plus `edit`, `subagent` and the four git history verbs, so the runtime drops the denied tools from the verifier's session catalog while the reads stay callable (`bug-verifier-cannot-read-the-tracker-no-allow-side`; `agents.md` §Orchestration).

### Authority map

Bounded and named (ADR 0021 §2). No new authority is granted to any agent by this table.

| Decision                           | Owner             | Enforced today                                                                                                                                                                       |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Direction and priority             | **product owner** | recorded as `priority`; decided by a person                                                                                                                                          |
| Product acceptance of a container  | **product owner** | recorded as an `accept:` comment (§Review bar → Product acceptance); never a gate                                                                                                    |
| Accepting residual risk            | **product owner** | ADR 0015 waiver — human-only, no agent parameter                                                                                                                                     |
| Taking over another writer's claim | **product owner** | `--steal` — armed config (`x-tracker.allow-steal`) + TTY confirmation                                                                                                                |
| Publishing a release               | **product owner** | human-pushed version bump (spec-release-pipeline-015 AC 7)                                                                                                                           |
| Exploring, specifying, planning    | agent             | the loop, unchanged                                                                                                                                                                  |
| Implementing, testing, docs        | agent             | the loop, unchanged                                                                                                                                                                  |
| Reviewing and proving              | agent             | `arggon-standards-reviewer` (read-only) / `arggon-verifier` (executes gates; tracker reads granted, every tracker write denied — config-enforced) split (`agents.md` §Orchestration) |
| Verifying merges, flipping `done`  | agent             | delivery lead; the done gate still holds (ADR 0015)                                                                                                                                  |
| Filing follow-up work              | agent             | the delivery lead consolidates and files (`agents.md` §Orchestration)                                                                                                                |

**The four irreversible powers are human-only, structurally — not undocumented exceptions** (ADR 0021 §1/§2; every row keeps the gate it already had, and this table grants nothing):

| Power                            | The structural gate                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Take over another writer's claim | `--steal`: `x-tracker.allow-steal: true` **and** a y/N confirmation on an interactive terminal; non-TTY callers refused (`convention.md` §Claim lease) |
| Waive the done gate              | `--waive` on `update --status done` (ADR 0015); no MCP/native parameter exists and the kernel refuses agent callers (`agents.md` §5)                   |
| Force a claim reassignment       | `--force` on `update`: refused for agent callers by the shared rules module; no native parameter (`lib/src/rules.ts`)                                  |
| Reopen a terminal item           | `update --status todo` on `done`/`cancelled` needs a y/N confirmation over a TTY stdin; piped stdin is refused, no `--yes`, no config opt-in           |

Publishing a release is the fifth human step and is human by construction (a human-pushed commit), not by a CLI gate.

### The decision brief (the request side of the authority map)

When requesting a product-owner decision: [read details](./references/engineering.md#the-decision-brief-the-request-side-of-the-authority-map).

## Review bar (blocks merge)

A bar is named by **what the project declares**, never by a tool: this document declares ArggonManager's own bar, and every adopting project rewrites its own (`arggon init` never overwrites it — `agents.md` §Prerequisites). The domain-invariant that survives every project is the **acceptance contract on the item** — the checklist in the item body — not the tool that checks it. Everything below is this project's declaration, and the parenthetical gates are the software worked example (ADR 0021 §6.2).

A PR merges only when **all** applicable bars pass:

### Architecture / boundaries (practice & standards)

**Operating principle 1: code is cheap; good practices and sound software architecture are always important.** Architecture quality is always in scope, on every PR: clear module boundaries, small surfaces, evidence that travels with the change, and docs that travel with code are part of "done" — never deferred as "refactor later". The speed of writing code never justifies structural debt.

- Changes match documented boundaries (convention vs eng vs CLI).
- No silent schema forks: if CLI behavior disagrees with `ArggonManager/docs/convention.md`, update the doc **in the same PR** or open a follow-up that blocks release.
- No shortcuts that break Phase 2/3 extensibility without an ADR (e.g. hard-coding non-unique ids, inventing frontmatter keys outside reserved extension rules).
- This role may **block merge** on quality even if the product owner accepted the change.

### Product acceptance (product owner)

- Behavior matches product intent and is shippable.
- The product owner may bounce a change that is technically clean.

**Promotion policy — how deep product-owner review goes per class of work** (ADR 0021 §3; content fixed by [spec promotion-policy-018](./specs/spec-promotion-policy-018.md)). A written, agreed-in-advance tiered review path keeps human attention the scarce input it is: routine leaves are agent-owned end to end, so no product-owner review per routine leaf PR.

| Tier | Applies to                                          | Who accepts                                                                                             | Blocking?                                                                                |
| ---- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| T0   | `task` / `bug` leaf with **no risk trigger**        | the agent self-certifies on the review-bar evidence plus the project's verification gates               | no — and the **default**                                                                 |
| T1   | `story` containers, and risk-triggered leaves       | the product owner or a named human reviewer, recorded as an `accept:` comment                           | the record never gates; a risk-triggered leaf also needs the authenticated GitHub review |
| T2   | the four irreversible powers, and irreversible risk | a human, gated structurally or as the operator of the irreversible step; the acceptance records the why | yes — ADR 0015 / TTY gates, or the human-run irreversible step                           |

**Risk triage — the T0 exception.** T0 is the default only while a leaf hits no risk trigger. A triggered leaf is escalated even when the diff is one line: **a small diff never lowers the tier.** Record every matching `risk-…` label on the item when it is created or claimed (`create --labels risk-security`, or `update --labels …`; no trigger needs no label) so the triage is visible in `show`, in `list --json` and `list --filter "label:risk-security"`, and in the PR.

| Trigger label          | Hits when the change touches                                                                  | Escalation                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `risk-security`        | authentication/authorization, crypto, secrets, PII, untrusted-input parsing, a trust boundary | T1 recorded acceptance **plus** an authenticated GitHub review before merge                         |
| `risk-destructive`     | data deletion, a destructive migration, an irreversible backfill, force operations            | **T2**: a person runs or approves the irreversible step; the acceptance records why                 |
| `risk-compatibility`   | a public API, schema, wire-format or protocol change; any breaking change                     | T1 recorded acceptance **plus** an authenticated GitHub review before merge                         |
| `risk-supply-chain`    | dependency sources, CI permissions, release/publish, signing                                  | T1 recorded acceptance **plus** an authenticated GitHub review before merge                         |
| `risk-safety-critical` | billing, payments, regulated or safety-relevant behavior                                      | T1 recorded acceptance **plus** an authenticated GitHub review before merge; **T2** if irreversible |

**Which gate is authenticated, which is recorded.** The tracker has no identity, so an `accept:` comment is a **recorded** artifact — attributed (an approval by the item's own assignee is `self-accepted`), never authenticated, and never a merge gate on its own. The **authenticated** gate is the project's GitHub review: the PR template asks "Does this hit a risk trigger? Which one?", and for `risk-security`, `risk-compatibility` and `risk-supply-chain` a named human reviewer — CODEOWNERS (`.github/CODEOWNERS`) requests one — must approve the PR before merge; the agent that wrote the change does not approve it. The tracker acceptance stays the durable record of _why_. T2's irreversible steps keep the structural gates of §Roles and authority.

**The audit (report-only, first iteration).** `arggon report --json` carries `risk: { checked, leaves, leavesTotal }` — every open `risk-…`-labeled leaf whose latest `accept:` state is not `accepted`, with its story/epic chain. The human table and the markdown standup print the same bounded block; nothing gates on it and `report` still exits 0. This is how the policy is measured before any gate exists.

A repository with **no product owner is compliant by default**: routine leaves stay T0, the tracker acceptance never blocks, and every opt-in surface stays silent unless the project arms the convention itself. A risk-triggered leaf still owes the record above; where the project declares no authenticated reviewer the missing record is reported, not enforced. There is no SLA and no product-owner-blocked status, so an absent product owner can never wedge a container's children — only its bookkeeping.

**The record (bounded, mirrors the verdict convention).** A product acceptance is a comment on the item — a container, or a risk-triggered leaf — whose first acceptance-looking line is the header:

```
### 2026-10-04 @gonzalo
accept: approve
- login rate limit behaves as specified; p95 unchanged at 40 rps
```

`accept: approve` or `accept: changes-requested`, optionally followed by a short scope in parentheses, then the evidence list; a later `approve` supersedes an earlier `changes-requested`. Prose, documentation, not schema.

**Never a gate.** The tracker has no identity — the session id is correlation metadata only (`agents.md` §MCP server) — so an acceptance cannot be authenticated; a gate built on it would be forgeable or unusable, and both are worse than none. An acceptance written by the item's own assignee is reported as self-accepted rather than blocked. [spec promotion-policy-018](./specs/spec-promotion-policy-018.md) specifies the read-only surfaces that classify it (`report` per container and for the risk audit, `show` per item, plus one opt-in `spec analyze` finding); none of them gates a transition, ever.

The **request** that precedes an acceptance — how a decision is asked, the six-field brief and its `decide:`/`decided:` grammar, the routing rule and the answer's report-only surface — is §Roles and authority → The decision brief (ADR 0026). A brief never replaces the `accept:` record above: the one is the request, the other the answer.

### Implementation quality (maker, checked in review)

- The change is readable and its public surface documented where users meet it (in software: public CLI flags/commands documented in README or `cli` help).
- Errors are actionable (especially validate failures).

### Non-functional bar (quality · scalability · security)

Quality is the operating principle above; **scalability and security are named review dimensions**, not aspirations. Every behavior change is reviewed against:

- **Scalability** — payloads stay bounded (ADR 0006 spirit); algorithms declare their complexity wherever inputs grow with the corpus (items, specs, docs): an O(n²) pairwise scan must say so and justify its input ceiling; no unbounded reads/renders over the task tree; JSON envelopes grow sub-linearly or are capped.
- **Security** — untrusted content (adopted repos' markdown/frontmatter/JSON) is parsed defensively; subprocess arguments are arrays, never shell-interpolated; no writes outside the repo root; secrets never committed or logged; the dependency surface stays minimal (a new runtime dependency needs justification in the PR).

### Smoke test (blocks merge)

Before a change is approved it is **smoked — executed end-to-end, not just unit-tested**. The gate is **the project's own verification gates**, and the evidence is observed-versus-expected against the specification (ADR 0021 §6.2); in software that is the test suite, lint, typecheck, build and the review-time smoke below ([ADR 0008](./adr/0008-review-smoke-gate.md)). The bar is blocking for applicable changes; docs-only PRs are exempt. The **verifier** role executes these gates and reports them; it does not decide the verdict (§Roles and authority).

- **CLI behavior changes:** the reviewer probes every changed/new command on a fixture repo and records the evidence in the review verdict (commands run, expected vs observed). Prefer deterministic `--json` output for evidence.

- **UI changes (board HTML / `board --serve`):** the reviewer drives a real browser against `arggon board --serve` on a fixture tree — the board renders, cards match `arggon list`, and one status change round-trips through the UI and persists (verified with `arggon show`). Tool: **Playwright CLI** (`@playwright/cli`, agent-first; fallback Playwright MCP) — see [ADR 0008](./adr/0008-review-smoke-gate.md).

The gate is repo-agnostic: adopting repos run the same bar against their own surface — UI-rich adopters (e.g. ArggonStores) are its primary beneficiaries.

When selecting or running the applicable end-to-end smoke gate: [read details](./references/engineering.md#smoke-test-blocks-merge).

### Review verdicts (comment convention)

Verdicts land **on the item** with `arggon comment <id>` — never as GitHub PR comments. A verdict comment starts with a bounded header line, `verdict: approve` or `verdict: request-changes` (optionally followed by a short scope), and then the evidence list: commands run, expected vs observed. This is documentation, not schema — human-written prose. `arggon sync --json` reads it report-only and classifies every item it reconciles with an open PR as `approved` (latest verdict is an approve), `changes-requested` (the latest verdict is a request-changes) or `none`; a later `verdict: approve` supersedes an earlier `verdict: request-changes`.

**Bind the verdict to the revision it reviewed.** Add an optional bounded second header line naming the commit the verdict applies to:

```
### 2026-09-29 @Reviewer
verdict: approve
reviewed: abc1234
- commands run, expected vs observed
```

`reviewed:` takes a 7–40 character hexadecimal commit id (short or full, case-insensitive) in the same dated comment as the verdict; only its first occurrence counts. A verdict with no `reviewed:` line remains readable but is **unbound**: it records no revision, so sync cannot show that it still covers the PR head.

`arggon sync --json` reports the binding separately from the verdict in `reviewFreshness` (per item carrying a verdict): `reviewed_revision`, the PR's current `head_revision`, and `freshness`:

- `fresh` — the reviewed revision is the head, or every path changed between them lives under the tracker root. The verdict's own tracker commit (the `arggon comment` that recorded it) therefore does not invalidate the verdict it records.
- `stale` — at least one non-tracker path changed after the reviewed revision. An approval no longer covers the code: **reassessment is required** before it reads as current, and the item id is also listed in `reassessmentRequired`.
- `unbound` — no `reviewed:` revision was recorded, or the reviewed..head comparison could not be resolved. Unbound is never reported as fresh.

The comparison is read from GitHub's compare API, so freshness does not depend on the PR head being fetched into the local checkout; a comparison that cannot be resolved is `unbound`, never fresh. Like the verdict classification, freshness is **report-only**: it never gates matching or the sync exit code. A new `verdict: approve` recording the new head returns the item to `fresh`.

Example:

```
### 2026-09-29 @Reviewer
verdict: request-changes (smoke evidence missing)
- probed `arggon sync --json` on a fixture: expected `verdicts` per matched item, observed field absent
- unit tests travel with the parser
```

### UI (verifier)

- When a change touches a user-facing surface, the **smoke-test bar above applies** (drive the real thing); ownership of that bar sits with the **verifier** role (software analogue: manual QA) and stays scoped as in Phase 2.

### Docs

- User-facing behavior changes update README and/or convention/engineering as appropriate.
- ADRs for stack, identity, and cross-cutting schema decisions (see below).
- PRs touching the methodology carriers state their **methodology impact class** (advisory / behavioral, with an ADR 0016 reference when behavioral) — reviewers check it like any bar above; see `ArggonManager/docs/agents.md` §Changing the methodology itself.

### Session context (advice, never a gate)

When diagnosing session-context degradation: [read details](./references/engineering.md#session-context-advice-never-a-gate).

## Testing expectations

When selecting project testing layers: [read details](./references/engineering.md#testing-expectations).

## ADR process

**When to write an ADR**

- CLI stack / package layout (#8)
- Identity model (`id` uniqueness, path vs id canonicality)
- Claim/concurrency model (beyond #16 notes)
- Introducing reserved frontmatter namespaces or breaking schema changes
- Adding a new top-level package (viewer, SDK, services)

**When not to**

- Typos, pure refactors, or local implementation choices that don’t change external contracts

**Location & naming**

```text
ArggonManager/docs/adr/
  NNNN-short-title.md    # e.g. 0001-cli-stack.md
```

Use a 4-digit monotonic number. Title is kebab-case.

**Template (minimum)**

```markdown
# NNNN Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: …

## Context

## Decision

## Consequences

## Alternatives considered
```

**Lifecycle:** Proposed in a PR → Accepted when merged (or explicitly recorded) → Superseded by a later ADR, never silently rewritten.

**The status flip rides the merge.** The PR that ships an ADR ships it reading `- Status: Proposed`; the commit that lands it — the merge commit, or the commit that reaches `main` directly — flips that line to `Accepted`, appends a dated status note naming that commit, and updates the ADR's row in `ArggonManager/docs/adr/README.md`. All three edits belong to the landing commit because `cli/src/adr-index-parity.test.ts` pins row and file to the same status class, so half the flip turns `main` red. Precedent on record: ADR 0021 (PR #624, `171f43b3`), ADR 0024 (accept commit `3d612032`), ADR 0026 (PR #659, `cbf9656c`). What was missing was not a check but this sentence: three merged ADRs (0022, 0023, 0025) were left reading `Proposed` and needed the retroactive fix tracked as `bug-adr-status-drift-merged-adr-proposed`. A check cannot decide it from the file — a test cannot tell an ADR that merged as `Proposed` on purpose (ADR 0019, whose own amendment says "the status is unchanged (still Proposed) … it does not accept the record") from one whose status line merely lagged, and twelve ADRs (0001–0012) share a single introducing commit, so git archaeology has no per-record answer either. The report-only backstop is `spec analyze`'s `STALE-PROPOSED-ADR` finding, which fires once a `Proposed` line is 14 days old; it is a warning by design, not a gate. The lifecycle's "(or explicitly recorded)" is the only sanctioned way to merge still `Proposed`, and that record has to be written down in the ADR, as ADR 0019's is.

**A status change lands in the ADR file, and the check that says so is a test, not a sweep.** A carrier (`agents.md`, this file, `convention.md`, `skills/arggon-cli/**`) links to the ADR that decided something; it never restates that ADR's status. Restating is what makes status drift — a carrier claiming `Proposed` for an ADR merged as Accepted is wrong in a way its reader cannot recover from the link, and it has to be re-edited by hand on every acceptance, so it is eventually not. `cli/src/adr-index-parity.test.ts` fails a PR whose [ADR index](./adr/README.md) row misreports a file's status; `cli/src/adr-status-doc-contract.test.ts` fails a PR that restates an ADR's status, or links an ADR that does not resolve. Both read `docs/adr/*.md` as the authority, so adding, accepting, superseding or renaming an ADR needs no documentation edit elsewhere — only the ADR file and its index row. Both rules cover the three methodology cores and their extracted references/runbook; the bundled skill set (`skills/arggon-cli/**`) is outside both because none of its markdown files carries a relative ADR link to resolve. Core `./adr/` and bare `adr/` links and extracted `../adr/` links resolve from the document's own directory. **Coverage: status restatement in `engineering.md`, `agents.md`, `convention.md`, `references/agent-runtime.md`, `references/orchestration.md`, `references/documentation.md`, `runbooks/agent-recovery.md`, `references/convention.md`, `references/engineering.md`; link resolution in `engineering.md`, `agents.md`, `convention.md`, `references/agent-runtime.md`, `references/orchestration.md`, `references/documentation.md`, `runbooks/agent-recovery.md`, `references/convention.md`, `references/engineering.md`.**

---

## Naming, commits, PRs

- **Branches:** `type/short-kebab` — `docs/…`, `feat/…`, `fix/…`, `chore/…`
- **Commits:** imperative, scoped when helpful (`docs:`, `cli:`, `test:`)
- **PRs:** problem + approach + test plan; reference the tracker work item id — move it to `done` only when fully done (issues live in the tracker, not GitHub; see `ArggonManager/docs/agents.md` §0)
- **Convention vs engineering:** schema/layout/status → `ArggonManager/docs/convention.md`; process/structure/review/ADR → `ArggonManager/docs/engineering.md` or `ArggonManager/docs/adr/`
- **Humans and agents share one work loop** — the same PR and claim rules, the same kernel, the same envelopes; what is asymmetric is **authority**, not the loop, and it is named in §Roles and authority. Agent-only shortcuts are out of scope unless an ADR says otherwise

### Merging: a PR refused as out of date

When recovering an out-of-date pull request: [read details](./references/engineering.md#merging-a-pr-refused-as-out-of-date).

## Definition of done (engineering, Phase 1)

The **acceptance contract on the item** — its checklist — is the done contract, and it is the domain-invariant: the project declares what done means, and the gates below are how _this_ project checks it (ADR 0021 §6.2). Operational completion, including actual merge, is defined in [agents §5](./agents.md#5-done-criteria). The engineering checks are:

1. Behavior matches `ArggonManager/docs/convention.md` where applicable
2. Review bars above are satisfied (practice & standards, plus the product-acceptance tier that applies to the item)
3. Tests/fixtures cover the change (once CLI exists)
4. Docs/ADR updated in the same PR when contracts change
5. No known validate false-pass for the new behavior
6. Follow-ups filed as tracker items (not GitHub issues, not TODOs left only in code) when deferred

---

## Phase 2 / 3 (boundary notes only)

When extending viewer or agent-hook boundaries: [read details](./references/engineering.md#phase-2--3-boundary-notes-only).

## Related

- Task convention: [`ArggonManager/docs/convention.md`](./convention.md)
- CLI stack: [ADR 0001](./adr/0001-cli-stack.md) · board: [ADR 0002](./adr/0002-board-viewer-v0.md) · milestone field: [ADR 0003](./adr/0003-milestone-field.md) · review smoke gate: [ADR 0008](./adr/0008-review-smoke-gate.md) · **each ADR's status lives in its own `- Status:` line** — the [ADR index](./adr/README.md) is the register (see [ADR process](#adr-process): carriers link to ADRs, they never restate a status)
- Claim concurrency: [`ArggonManager/docs/claim.md`](./claim.md)
- Agent playbook: [`ArggonManager/docs/agents.md`](./agents.md) · JSON contract: [`ArggonManager/docs/json-output.md`](./json-output.md)
