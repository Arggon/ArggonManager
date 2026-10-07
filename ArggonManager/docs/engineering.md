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

### Locked / in-flight product layout

```text
ArggonManager/          # git-native work tree + product docs (see `ArggonManager/docs/convention.md`)
  docs/                 # product docs: convention, engineering, agents, adr/, specs/, plans/
lib/                    # @arggondev/lib kernel package (ADR 0013): TypeScript sources (lib/src)
  src/index.ts          # kernel entry: items, rules, paths, envelopes + operations
  src/operations.ts     # in-process operations: --json envelope + exit codes per command
cli/                    # root package (arggon-manager): CLI, seam generation, MCP adapter
  src/                  # commands + tests co-located
  src/package-assets.ts # root package root + bundled templates dir (injected into the kernel)
dist/                   # compiled bin (gitignored; npm run build)
lib/dist/               # compiled kernel package (gitignored)
templates/              # scaffolded by arggon init
skills/arggon-cli/      # agent skill for the CLI (keep in sync with `ArggonManager/docs/json-output.md`)
fixtures/               # golden trees for validate + integration tests
.github/workflows/      # ci.yml (build+test+lint), auto-done.yml
```

**Boundaries**

| Concern                               | Lives in                                                          | Does not                                       |
| ------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Task schema / statuses / folder rules | `ArggonManager/docs/convention.md` + sample `ArggonManager/` tree | CLI source comments as sole source of truth    |
| Eng process, review bar, ADR, DoD     | `ArggonManager/docs/engineering.md`                               | Product roadmap and acceptance (product owner) |
| CLI behavior                          | `cli/` (or stack equivalent)                                      | Phase 2 board UI, Phase 3 SDK                  |
| Durable decisions                     | `ArggonManager/docs/adr/`                                         | Long debate only in PR threads                 |

**Shipped beyond the original Phase 1 scope** (each behind its own ADR/PR): static board + drag-and-drop + local serve (ADR 0002), GitHub reconciliation (`sync`), stdio MCP server. **Still out without an ADR:** hosted/SaaS anything, a parallel task schema, or an agent-only dialect of the rules — [ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) is one such ADR: it grants the four irreversible powers to a named human role and no agent a second rule set.

**Sample tree:** the fixture `fixtures/tasks-valid/tasks/launch-mvp/` is both the product demo and a test fixture. Changing convention requires updating samples and CLI tests in the same change set when the CLI exists.

---

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

1. **Delivery lead ≠ priority owner.** A delivery lead _sequences_ delivery; the product owner _sets_ the `priority` field. The delivery lead recommends priority changes and owns wave planning, dispatch and tracker state — the product owner's authority map below is unchanged.
2. **The verifier reports, it does not rule.** Checking the delivered thing against the specification and reporting observed-versus-expected is the whole job. The verifier does **not** decide the verdict: the reviewer's judgment and the delivery lead's merge call are unchanged — the role gets its teeth without becoming an approver.

### Authority map

Bounded and named (ADR 0021 §2). No new authority is granted to any agent by this table.

| Decision                           | Owner             | Enforced today                                                                                               |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Direction and priority             | **product owner** | recorded as `priority`; decided by a person                                                                  |
| Product acceptance of a container  | **product owner** | recorded as an `accept:` comment (§Review bar → Product acceptance); never a gate                            |
| Accepting residual risk            | **product owner** | ADR 0015 waiver — human-only, no agent parameter                                                             |
| Taking over another writer's claim | **product owner** | `--steal` — armed config (`x-tracker.allow-steal`) + TTY confirmation                                        |
| Publishing a release               | **product owner** | human-pushed version bump (spec-release-pipeline-015 AC 7)                                                   |
| Exploring, specifying, planning    | agent             | the loop, unchanged                                                                                          |
| Implementing, testing, docs        | agent             | the loop, unchanged                                                                                          |
| Reviewing and proving              | agent             | `arggon-standards-reviewer` (read-only) / `arggon-verifier` (no mutation) split (`agents.md` §Orchestration) |
| Verifying merges, flipping `done`  | agent             | delivery lead; the done gate still holds (ADR 0015)                                                          |
| Filing follow-up work              | agent             | the delivery lead consolidates and files (`agents.md` §Orchestration)                                        |

**The four irreversible powers are human-only, structurally — not undocumented exceptions** (ADR 0021 §1/§2; every row keeps the gate it already had, and this table grants nothing):

| Power                            | The structural gate                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Take over another writer's claim | `--steal`: `x-tracker.allow-steal: true` **and** a y/N confirmation on an interactive terminal; non-TTY callers refused (`convention.md` §Claim lease) |
| Waive the done gate              | `--waive` on `update --status done` (ADR 0015); no MCP/native parameter exists and the kernel refuses agent callers (`agents.md` §5)                   |
| Force a claim reassignment       | `--force` on `update`: refused for agent callers by the shared rules module; no native parameter (`lib/src/rules.ts`)                                  |
| Reopen a terminal item           | `update --status todo` on `done`/`cancelled` needs a y/N confirmation over a TTY stdin; piped stdin is refused, no `--yes`, no config opt-in           |

Publishing a release is the fifth human step and is human by construction (a human-pushed commit), not by a CLI gate.

### The decision brief (the request side of the authority map)

**The authority map above is unchanged by this convention** ([ADR 0026](./adr/0026-owner-decision-brief.md) §Decision; ADR 0021 §2 stands): the delivery lead still **recommends**, the product owner still **decides**, sequence is still not priority. What this adds is the missing **request side** — how the delivery lead brings a decision to the product owner, so a question does not land in a chat and the answer has somewhere durable to live.

A **brief** is an ordinary comment on the item, headed `decide:` and written by the delivery lead; the **answer** is an ordinary comment headed `decided:`, written by the product owner. Both use the dated heading `arggon comment` writes — `### <YYYY-MM-DD> @<author>` — and both are prose, never schema: there is no flag that writes a brief and no frontmatter field (ADR 0026 §6). A brief is **written for one reader whose vocabulary is not assumed**; the mechanical test is whether that reader could restate the choice and its consequence in their own words.

**The six fields, in this order** (ADR 0026 §1):

1. **The question**, in one sentence — any specialist term translated, at first use, into what it changes for the product.
2. **Why it matters**, in outcome terms — what changes for the people who use it, what it costs, what it risks; never in mechanism terms.
3. **The options** — two or three, **never one** — each with its consequence in plain words, and for the recommended one its honest cost stated rather than implied.
4. **The recommendation**, and why.
5. **The strongest argument against that recommendation**, written by the lead. A brief that omits this field is not a brief.
6. **The default**: what the lead will do if no answer arrives, and the **absolute** date after which it happens — never a relative deadline ("by Friday").

The **answer** carries the chosen option — the text of the option, or `other` for "none of these", which is a first-class, unremarkable reply — optionally with a scope note in parentheses, then the reasoning. A later `decided:` supersedes an earlier one, and a superseded brief is **never rewritten**.

**The routing rule — which decisions owe a brief** (ADR 0026 §5). A brief is owed **only** for the rows of the authority map above — direction and priority, product acceptance of a container, accepting residual risk, taking over another writer's claim, publishing a release — and for **hard-to-reverse calls** (those whose cost of being wrong later exceeds the time it takes to undo). Everything else the delivery lead **decides and records on the item as a plain comment**; a question with one real option is not a brief. A brief never replaces the record a row already has — the `priority` field, an `accept:` comment, the ADR 0015 waiver, the claim-takeover gate and the human-pushed release all keep their records: the brief is the **request**, not the answer. One item is canonical for a given decision; a second brief links to it. **This rule is normative, not advisory**: without it every decision becomes a brief, which inverts the tier table below — human attention must not rise per shipped change (a brief **replaces a chat question rather than adding a step**).

**The stated default is what makes a brief safe to send** (ADR 0026 §3). On the stated date the default executes and the record says so, so **silence selects a default the owner was shown in advance, never an answer by abstention**. The direction of that default is constrained: for a hard-to-reverse call it is the reversible or "hold" option, never the more aggressive one; if no reversible option exists the default is "hold" and the brief says so; for every other decision that owes a brief the default is the lead's own recommended option. The net effect is the property that lets a brief be sent without a blocker: **a brief can never make an irreversible act happen because nobody replied.**

**Report-only, never a gate** (ADR 0026 §6). This is inherited from the acceptance convention below, with its reasoning, not only its conclusion: the tracker has no identity layer, so an answer is attributed but never authenticated, and a gate built on it would be forgeable or unusable. No transition consults a brief, no command refuses because one is missing, and CI never fails on one. **The surface is `show`:** `arggon show <id> --json` carries an additive `decision_brief` field (`none` | `open` | `decided` | `self-decided`), and `arggon spec analyze` gains one additive, opt-in finding (`UNANSWERED-DECISION-BRIEF`, armed by the same `x-tracker.product-acceptance` as the acceptance detector); `arggon report --json` and `arggon sync --json` are **byte-identical** (a brief is an item-level record, so the container-level `report` and the PR-reconciled `sync` cannot carry it — the correction ADR 0021's own amendment records for the sibling artifact).

**This project's worked example — software, an example only.** The convention's own language is the six field names and the two header tokens above; they are domain-neutral, and a reader who has never written anything technical can follow the convention itself. Software is **this project's** example and never the convention's vocabulary (ADR 0026 §7). A brief written in this repository's own terms, therefore, would read like this — "a shared library", "a feature flag", "a database index" are the ADR's own named software cases:

```
### 2026-10-06 @Arggon
decide: a shared library for the date handling (the logic three screens each use today)
- The question: should the date logic live in one shared library, or stay copied in each screen that uses it?
- Why it matters: today a fix must be made in three copies and a missed copy shows customers different behaviour in different screens; one library costs a release shared by three teams.
- The options: A — keep three copies, so each team moves independently and every fix is made by hand; B — one library, so a fix lands once for every screen, at the cost of a shared release.
- The recommendation: B — a wrong date in one screen is a customer-visible defect, three times over.
- The strongest argument against that recommendation: a shared library couples three teams' release timing, and one library change can hold up a team that would otherwise ship today.
- The default: B, from 2026-10-27 — one library is the recommendation, and this call is one we can reverse in a release.
```

A non-software adopter writes the same six fields in its own words; a library, a flag and an index are not required vocabulary. The non-software worked example lives in [`spec-owner-decision-brief-021`](./specs/spec-owner-decision-brief-021.md) §Synopsis.

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

**Promotion policy — how deep product-owner review goes per class of work** (ADR 0021 §3; content fixed by [spec promotion-policy-018](./specs/spec-promotion-policy-018.md)). A written, agreed-in-advance tiered review path keeps human attention the scarce input it is: leaves are agent-owned end to end, so no product-owner review per leaf PR.

| Tier | Applies to                                          | Who accepts                                                                               | Blocking?                     |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| T0   | `task` / `bug` leaves                               | the agent self-certifies on the review-bar evidence plus the project's verification gates | no — and the **default**      |
| T1   | `story` containers                                  | the product owner, recorded as an `accept:` comment                                       | no — recorded, never gated    |
| T2   | the four irreversible powers (§Roles and authority) | a human, already structurally gated; the acceptance records the why                       | yes — by ADR 0015 / TTY gates |

A repository with **no product owner is compliant by default**: T0 applies, nothing is blocked, and every surface stays silent unless the project arms the convention itself. There is no SLA and no product-owner-blocked status, so an absent product owner can never wedge a container's children — only its bookkeeping.

**The record (bounded, mirrors the verdict convention).** A product acceptance is a comment on the item whose first acceptance-looking line is the header:

```
### 2026-10-04 @gonzalo
accept: approve
- login rate limit behaves as specified; p95 unchanged at 40 rps
```

`accept: approve` or `accept: changes-requested`, optionally followed by a short scope in parentheses, then the evidence list; a later `approve` supersedes an earlier `changes-requested`. Prose, documentation, not schema.

**Never a gate.** The tracker has no identity — the session id is correlation metadata only (`agents.md` §MCP server) — so an acceptance cannot be authenticated; a gate built on it would be forgeable or unusable, and both are worse than none. An acceptance written by the item's own assignee is reported as self-accepted rather than blocked. [spec promotion-policy-018](./specs/spec-promotion-policy-018.md) specifies the read-only surfaces that classify it (`report` / `show` per container, plus one opt-in `spec analyze` finding); none of them gates a transition, ever.

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
- **TUI:** no browser automation applies; smoke is a scripted pty render check or a documented manual check in the verdict. The scripted check is `npm run smoke:tui-board` (`smoke/tui-board-smoke.ts`): it runs `arggon board --tui` in a pty via util-linux `script` and drives a 14-step scripted session — board frame (five status headers, seeded item, freshness stamp), live refresh (an item created behind the board appears without a keypress), the ready lens on and off, priority and next-rank sorts, the `/` search prompt filtering to the seeded task, card selection opening the detail pane, a chunk-split PgDn paging the pane while the pane stays open, and the board restored with selection and filter intact — then quits with `q`; it skips cleanly where `script` is unavailable.
- **Native worktree/start changes:** the deterministic check is `npm run smoke:native-start-cold` (`smoke/native-start-cold-smoke.ts`, model-free and offline): on a disposable git fixture it proves the dependency-requiring `pre-commit` gate fails in a cold worktree, then drives the real `tools.arggon.start` seam and requires an explicit bounded readiness/claim-commit receipt, a claim commit containing only the item file, a deterministic re-run attach with no duplicate commit, and an untouched canonical install. It is a durable gate, not a substitute for the model-driven `smoke:opencode` transcript, which stays the runtime-level evidence.
- **CI tier (`cli` job) for the native start path:** the last step of the `cli` job runs `npm run smoke:native-start-cold` (`task-wire-native-start-cold-smoke-into-ci`), after the `npm run build` whose kernel it drives, beside `test:structure` / `lint:structure`. The step is blocking by construction (no `continue-on-error`, no `|| true`, no advisory `if:`), so it fails the lane like any other node gate, and it is dev-only: offline, model-free, Chromium-free, no second install — which is why it is in `cli` and not the `ui-smoke` job. Observed runtime ~0.5s, so it is on every PR rather than label-gated. What it does not claim: it does not replace the model-driven transcript smoke, and its fixture install is synthesized, so it proves resolution rather than npm's reifier.
- **CI tier (`ui-smoke` job):** the durable `@smoke`-tagged `@playwright/test` spec (`e2e/board.smoke.spec.ts`, Chromium only, `npx playwright test --grep @smoke`) drives `board --serve` on a temp fixture — board loads, cards match `arggon list`, one status move round-trips and persists. The same job runs the TUI frame check above. The review-time gate above stays the blocking bar. Playwright is dev-only, Chromium-only in CI — never a runtime dependency.
- **Accessibility (automated, in the same `ui-smoke` lane):** the first `@smoke` test runs `@axe-core/playwright` (version-pinned devDependency, never shipped) against the served board, on the readiness signal the spec already waits for (`h1` present) and before the card-parity and round-trip tests move the page on. It asserts the **automatable WCAG A/AA set across all three WCAG versions** — `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` — so a 2.1/2.2 AA rule cannot pass unreported. AAA and `best-practice` are deliberately out of scope. The policy is **no blanket exclusions**: zero `disableRules`/`exclude`/`include`/narrowed rule lists, zero accepted exceptions; an accepted exception must record the exact rule id, the reason and an owner in a comment at the call site and in `CONTRIBUTING.md` § UI smoke tests. A violation is fixed in the board or filed as a linked item — never excluded to get a green lane. What it does not claim: axe automates only part of WCAG (keyboard interaction, focus order, reflow and non-text contrast stay manual — `task-board-non-text-contrast-and-drag-affordance`), and the scan covers the ready board, not the detail drawer, the static export or the lens/filtered states (`task-axe-board-drawer-and-lens-coverage`).
- **Flake reproduction harness (opt-in, env-gated — never wired into CI):** an intermittent e2e failure is reproduced under instrumented load, not chased by reruns. `e2e/helpers/flake-harness.ts` arms CDP `Emulation.setCPUThrottlingRate` (`E2E_THROTTLE=<n>`; 20 is the proven setting) plus host busy-spinner processes (`E2E_SPINNERS=<n>`; 16 saturates a 12-core box) for any Playwright spec that imports the harness `test` — `e2e/board.smoke.spec.ts` does — and both fixtures are strict no-ops without the env, so the default lane is unaffected. Recipe (proven on the live-reload race, bug-live-reload-sse-race / PR #521): `E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test --grep "<flaky spec>"`. A malformed value fails loud naming the variable; grep to the suspect spec (throttling every page makes the whole lane crawl). What it does not claim: it supplies the load, not the diagnosis — a reproduced failure still needs the evidence trail (#521's buffered server event log + HAR) to separate wait-mechanism defects from real signal loss.

The gate is repo-agnostic: adopting repos run the same bar against their own surface — UI-rich adopters (e.g. ArggonStores) are its primary beneficiaries.

### Review verdicts (comment convention)

Verdicts land **on the item** with `arggon comment <id>` — never as GitHub PR comments. A verdict comment starts with a bounded header line, `verdict: approve` or `verdict: request-changes` (optionally followed by a short scope), and then the evidence list: commands run, expected vs observed. This is documentation, not schema — human-written prose. `arggon sync --json` reads it report-only and classifies every item it reconciles with an open PR as `approved` (latest verdict is an approve), `changes-requested` (the latest verdict is a request-changes) or `none`; a later `verdict: approve` supersedes an earlier `verdict: request-changes`. A blocking merge gate is deliberately out of scope until the report proves low-noise.

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

---

## Testing expectations

A project declares its own layers and its own commands; this is ArggonManager's declaration, and the software rows below are the worked example every other project replaces with its own (ADR 0021 §6.2).

| Layer                        | Required                         | Notes                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                         | Yes                              | Parsing, status transitions, claim rules, path/`id` checks                                                                                                                                                                                                                                                                    |
| Fixture / golden             | Yes                              | Valid tree must pass `validate`; each invalid layout rule has a failing fixture                                                                                                                                                                                                                                               |
| Integration                  | Yes for file-mutating commands   | `create` / `update` / claim against a temp copy of fixtures; assert git-friendly file output                                                                                                                                                                                                                                  |
| E2E against the real tracker | Optional                         | Nice-to-have; fixtures are the merge gate                                                                                                                                                                                                                                                                                     |
| Smoke (review gate)          | Blocking for behavior/UI changes | Probe evidence in the review verdict; UI changes get a real-browser drive via Playwright CLI ([ADR 0008](./adr/0008-review-smoke-gate.md)); docs-only exempt                                                                                                                                                                  |
| Smoke (CI `ui-smoke` job)    | Runs for board/TUI changes       | `npx playwright test --grep @smoke` (Chromium, dev-only) drives `board --serve` on a temp fixture and asserts the ready page against the automated WCAG A/AA rules (`@axe-core/playwright`, no blanket exclusions); `npm run smoke:tui-board` asserts the TUI frame in a pty; see [ADR 0008](./adr/0008-review-smoke-gate.md) |

**Rules**

- Convention changes that alter validate semantics ship with fixture updates in the **same** PR.
- Do not skip tests with “docs only” if the PR changes CLI behavior.

---

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

**A status change lands in the ADR file, and the check that says so is a test, not a sweep.** A carrier (`agents.md`, this file, `convention.md`, `skills/arggon-cli/**`) links to the ADR that decided something; it never restates that ADR's status. Restating is what makes status drift — a carrier claiming `Proposed` for an ADR merged as Accepted is wrong in a way its reader cannot recover from the link, and it has to be re-edited by hand on every acceptance, so it is eventually not. `cli/src/adr-index-parity.test.ts` fails a PR whose [ADR index](./adr/README.md) row misreports a file's status; `cli/src/adr-status-doc-contract.test.ts` fails a PR that restates an ADR's status, or links an ADR that does not resolve. Both read `docs/adr/*.md` as the authority, so adding, accepting, superseding or renaming an ADR needs no documentation edit elsewhere — only the ADR file and its index row. The restatement rule covers every carrier; the link rule is narrower only because `convention.md` still links a dead ADR 0015 (`bug-convention-md-links-nonexistent-adr-0015`). **Coverage: status restatement in `engineering.md`, `agents.md`, `convention.md`; link resolution in `engineering.md`.**

---

## Naming, commits, PRs

- **Branches:** `type/short-kebab` — `docs/…`, `feat/…`, `fix/…`, `chore/…`
- **Commits:** imperative, scoped when helpful (`docs:`, `cli:`, `test:`)
- **PRs:** problem + approach + test plan; reference the tracker work item id — move it to `done` only when fully done (issues live in the tracker, not GitHub; see `ArggonManager/docs/agents.md` §0)
- **Convention vs engineering:** schema/layout/status → `ArggonManager/docs/convention.md`; process/structure/review/ADR → `ArggonManager/docs/engineering.md` or `ArggonManager/docs/adr/`
- **Humans and agents share one work loop** — the same PR and claim rules, the same kernel, the same envelopes; what is asymmetric is **authority**, not the loop, and it is named in §Roles and authority. Agent-only shortcuts are out of scope unless an ADR says otherwise

---

## Definition of done (engineering, Phase 1)

The **acceptance contract on the item** — its checklist — is the done contract, and it is the domain-invariant: the project declares what done means, and the gates below are how _this_ project checks it (ADR 0021 §6.2). A Phase 1 eng change is done when:

1. Behavior matches `ArggonManager/docs/convention.md` where applicable
2. Review bars above are satisfied (practice & standards, plus the product-acceptance tier that applies to the item)
3. Tests/fixtures cover the change (once CLI exists)
4. Docs/ADR updated in the same PR when contracts change
5. No known validate false-pass for the new behavior
6. Follow-ups filed as tracker items (not GitHub issues, not TODOs left only in code) when deferred

---

## Phase 2 / 3 (boundary notes only)

- **Viewer/board (shipped):** the static board and the local `--serve` route go through the same kernel read/update paths; drag-and-drop parity with the CLI rules is test-enforced. Spike constraints: [`ArggonManager/docs/viewer-spike.md`](./viewer-spike.md).
- **Agent hooks (partially shipped):** the stdio MCP server and the `agent` caller flag enforce the same validate/claim rules as the CLI; no private agent dialect. A fuller SDK still requires an ADR.

Details belong in later ADRs — do not pre-build those packages in Phase 1.

---

## Related

- Task convention: [`ArggonManager/docs/convention.md`](./convention.md)
- CLI stack: [ADR 0001](./adr/0001-cli-stack.md) · board: [ADR 0002](./adr/0002-board-viewer-v0.md) · milestone field: [ADR 0003](./adr/0003-milestone-field.md) · review smoke gate: [ADR 0008](./adr/0008-review-smoke-gate.md) · **each ADR's status lives in its own `- Status:` line** — the [ADR index](./adr/README.md) is the register (see [ADR process](#adr-process): carriers link to ADRs, they never restate a status)
- Claim concurrency: [`ArggonManager/docs/claim.md`](./claim.md)
- Agent playbook: [`ArggonManager/docs/agents.md`](./agents.md) · JSON contract: [`ArggonManager/docs/json-output.md`](./json-output.md)
