# Documentation and adoption reference

Layer: **reference**. Read when changing documentation, planning a non-trivial feature, adopting an existing repository or running a self-improvement protocol; start with [the operational core](../agents.md).

## Documentation maintenance (docs, ADRs, specs, plans)

Agents and humans keep the docs alive **in the same PR as the change** — never as a TODO, a review comment, or a follow-up that blocks release.

### What to update, by change type

| Change                                                                        | Update (same PR)                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New or changed CLI command / flag                                             | `README.md` (user-facing section) **and** `ArggonManager/docs/json-output.md` (payload section + the `command` enum in the envelope table)                                               |
| JSON contract field or shape                                                  | `ArggonManager/docs/json-output.md` (`WorkItem` table or the command section). Additive fields note their additivity; breaking changes bump `schemaVersion`                              |
| Task-tree / frontmatter / validate behavior                                   | `ArggonManager/docs/convention.md` — non-negotiable, see the review bar in `docs/engineering.md`                                                                                         |
| Cross-cutting decision (stack, identity, schema model, new top-level package) | ADR under `ArggonManager/docs/adr/` — see the ADR process in `ArggonManager/docs/engineering.md` (4-digit id, `Proposed` in the PR, `Accepted` on merge, supersede instead of rewriting) |
| Non-trivial feature worth design review                                       | Spec in `ArggonManager/docs/specs/` + implementation plan in `ArggonManager/docs/plans/` (see below)                                                                                     |
| Agent playbook rules themselves                                               | This file (`ArggonManager/docs/agents.md`)                                                                                                                                               |
| A lesson — a trap that bit you, or an approach this item refuted              | The carrier that owns the topic, as one line ≤ 160 characters with a citation — see §Promoting lessons                                                                                   |

### Specs and plans (for non-trivial features)

- **Greenfield/new project?** Exploration comes first (arggon-cli skill, `references/exploration.md`; ADR 0017): the six-phase protocol hunts edge cases into spec acceptance criteria, explicit non-goals or spike items, and no implementation task is claimed before a spec with clean `spec analyze`.
- **Spec** (`ArggonManager/docs/specs/spec-<slug>-NNN.md`): the reviewable contract — purpose, synopsis, flags, JSON shapes, invariants ("never overwrites", "pure read"), and acceptance criteria. Write it **before** implementing; frontmatter carries `spec_id`, `title`, `status` (`proposed` → `implemented`), `created`.
- **Plan** (`ArggonManager/docs/plans/plan-<slug>-NNN.md`): the implementation breakdown derived from the spec — ordered tasks, each with verifiable acceptance criteria and a link back to the spec. Frontmatter: `plan_id`, `spec`, `status`.
- **One number per document, per directory.** An ADR (`NNNN-<slug>.md`), an exploration (`exploration-<slug>-NNN.md`), a spec (`spec-<slug>-NNN.md`) and a plan (`plan-<slug>-NNN.md`) each own their number for good, and the number is unique **inside its own directory** — a spec and a plan may both be `-017`. A slug may contain digits; the number is the **last** `-NNN` before `.md` (`spec-phase-2-009.md` is number 009, `plan-sync-2-003.md` is 003). Pick the next **FREE** number — the highest in use in that directory plus one (`arggon spec new` does exactly this for specs/plans) — never "whatever the last one was, plus one": two parallel branches each create `-018`, git merges both, and because the ids _inside_ the files differ, `spec_id`/`plan_id` uniqueness stays silent. `arggon spec analyze` reports the collision (`duplicate-doc-number`, naming every file that shares the number) and `arggon spec validate` warns (`DOC_NUMBER_COLLISION`); both are report-only. Repair by renumbering the newer document to a free number (updating its citations) or superseding it — never by deleting the other one.
- When the feature lands, flip both statuses in the same PR as the implementation (never leave a shipped feature `proposed`).
- Tooling: `arggon spec validate [--file <path>]` checks spec/plan structure read-only (CI-safe, non-zero on errors; corpus mode also warns on a number shared by two documents) and `arggon spec new <slug> [--title <t>] [--plan]` scaffolds the next numbered spec/plan from `templates/spec.md` / `templates/plan.md` — never overwrites. See [`ArggonManager/docs/specs/spec-spec-pipeline-002.md`](../specs/spec-spec-pipeline-002.md).
- Before implementing, run `arggon spec analyze` (report-only): it flags ambiguity (vague quantifiers, TODO/TBD markers, missing error paths, untestable acceptance) and spec ↔ tasks/plans inconsistency (implemented specs nothing cites, plans pointing at missing specs, two documents sharing one number) — findings never fail the run, resolve them by editing the spec. It also flags decision-pipeline gaps (`DECISION-PENDING-EXPLORATION`, `STALE-PROPOSED-ADR`, `SPEC-STATUS-DRIFT`): close them by writing the ADR, moving the ADR out of `Proposed`, flipping the spec status, or — when a spike genuinely needs no ADR — recording `No ADR required — <reason>` in the exploration's Decision section; never by editing the finding. For multi-wave refactors, gate each wave with `spec analyze --baseline <file>` (non-zero exit = NEW findings vs the committed snapshot). See [`ArggonManager/docs/specs/spec-spec-analyze-004.md`](../specs/spec-spec-analyze-004.md) and [`ArggonManager/docs/specs/spec-analyze-decision-gaps-013.md`](../specs/spec-analyze-decision-gaps-013.md).
- Migrating a legacy corpus? `arggon spec import openspec <path>` converts an OpenSpec corpus (`specs/<capability>/spec.md`) mechanically: Purpose mapping, Acceptance criteria verbatim with per-requirement verification checklists, a provenance line, and a per-file zero-loss assertion — all-or-nothing per run, never overwrites, `--dry-run` inventories first. The format adapter (`cli/src/spec-import.ts`) is the extension point for other corpus formats. See [`ArggonManager/docs/specs/spec-spec-import-openspec-005.md`](../specs/spec-spec-import-openspec-005.md).
- After a migration (or periodically), run `arggon spec audit` (report-only): it classifies every `ArggonManager/docs/specs/*.md` pair as DUPLICATE / MERGE / KEEP-SEPARATE from shingle-Jaccard similarity plus shared verbatim requirement/scenario titles, with thresholds you can tune — see [`ArggonManager/docs/specs/spec-spec-audit-006.md`](../specs/spec-spec-audit-006.md).

### Technology playbooks (stack decisions and doc freshness)

Stack/technology decisions follow the pipeline: **explore → ADR → playbook → status/--file-task**.

1. `arggon stack explore <topic>` records the spike (`ArggonManager/docs/explorations/exploration-<slug>-NNN.md`): candidates, criteria, findings with dated sources, recommendation.
2. The decision lands as an ADR under `ArggonManager/docs/adr/` (link it in the exploration's Decision section).
3. `arggon playbook new <tech> --version <v>` generates `ArggonManager/docs/playbooks/<tech>.md` — the chosen version plus Setup / Conventions / Testing / Security / Upgrade policy. The research is the caller's job (with dated sources); the CLI records it.
4. `arggon playbook status` flags playbooks older than the threshold (default 90 days, `x-playbooks.max-age-days` in the tracker `.convention.yml`); `--file-task <story-id>` files one re-research task per stale playbook into the tracker. After re-researching, `arggon playbook refresh <tech> --version <v>` updates the frontmatter.

Agents follow `ArggonManager/docs/playbooks/` by default (the init-generated `AGENTS.md` points there) and refresh playbooks when `playbook status` flags them stale.

### Promoting lessons (promote, never store)

A lesson — a trap that bit you, or an approach this item refuted — is **promoted, never stored**: when the work **repeats** a class another item already met, write it into the carrier that already owns the topic. No lesson store, no lessons section, no new file type.

| Lesson kind                           | Carrier (the one that owns the topic)      |
| ------------------------------------- | ------------------------------------------ |
| Loop/tool mechanics, repo conventions | `skills/arggon-cli/references/pitfalls.md` |
| Technology behaviour                  | `ArggonManager/docs/playbooks/<tech>.md`   |
| A refuted approach (a dead end)       | the `## Context` of a tracker item         |
| A cross-cutting decision              | an ADR under `ArggonManager/docs/adr/`     |

- **One line, ≤ 160 characters excluding the citation, with a mandatory citation** (`— <item-id>` or `— ADR NNNN`); the rationale stays in the item that produced the lesson. The bound stops a carrier from becoming the unbounded per-item record it indexes; the citation is what makes the line findable and supersedable by the change that moves the mechanism. `references/pitfalls.md` also holds a total ceiling of **12,288 B** (read with `wc -c` when the file is edited): a section that does not fit shortens or supersedes a line, it never raises the ceiling in the same PR.
- **The promotion moment is the second occurrence.** A maker promotes when the work repeats a class another item already met; the standards reviewer checks the promoted line like any other doc that must travel with the change; the delivery lead may consolidate a class the tracker shows repeating. No new ceremony, no new role, no new merge step.
- **Contradiction supersedes, never juxtaposes.** Rewrite the line in place with a dated note naming what changed and which item produced it (`superseded <date> by <item-id>: <reason>`); appending a second, contradicting bullet is forbidden — two answers in one carrier with no way to choose is worse than either.
- **Staleness is per carrier.** Technology lessons inherit `arggon playbook status` (`x-playbooks.max-age-days`, default 90). Mechanism lessons carry **no clock**: a lesson becomes false when the mechanism changes, not when the date advances, and the citation is the pointer that change follows.
- **A carrier edit is a methodology edit.** A lesson landing in `skills/arggon-cli/**` or `templates/**` reaches adopting repos through the [ADR 0016](../adr/0016-adopter-upgrade-channel.md) propose channel, never by overwrite, and states its impact class, keeping the skill and its copies byte-equal (§Changing the methodology itself).

### Verification before opening the PR

- Search each new command/flag/field across README, JSON contract, convention and
  agents; every statement must match implemented behavior.
- `arggon validate` passes.
- If the change made any doc statement false, that doc edit belongs in this PR.

## Adoption sweep (existing repos)

`arggon adopt` turns "start using ArggonManager here" into a tracked, agent-executable migration. It requires an initialized tree (`arggon init` first — the command pre-flights through the same logic as `arggon doctor`), inventories the repo's governing docs (present/absent, arggon-managed via `x-generated` provenance vs adopter-owned, plus cheap stack-manifest hints), and files one task — `task-adopt-arggon`, "Adopt ArggonManager in this repo" — whose body is the checklist below. `--dry-run` prints the inventory and planned actions and writes nothing; the same JSON is how the executing agent re-derives the inventory mid-flight. The task is created under `--story <story-id>` when given, else under `story-arggon-adoption` (auto-created under the first epic; when the tree has no epic at all — e.g. a fresh `init --full` — adopt auto-creates the initiative/epic chain `arggon-adoption` → `epic-arggon-adoption` itself, so pass `--story` when adopting an existing repo with its own structure). Idempotent: an already-open `task-adopt-arggon` is reported, not duplicated.

Any agent executing the adoption task follows this procedure (the task body carries the same steps as an acceptance checklist):

1. **Read the arggon-generated docs first**: `AGENTS.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/playbooks/` (if present) — they govern the rest of the migration.
2. **Sweep the existing repo docs** (list them from the inventory): extract the project description, conventions, workflows, and stack info. **Extract, don't wholesale-copy** — rewrite into the target doc's structure and drop duplicated or outdated material.
3. **Complete the arggon-generated docs** with the extracted content — fill the TODO placeholders: project description in `AGENTS.md`; `CONTRIBUTING.md` specifics (environment setup, build/test commands); `ARCHITECTURE.md` problem statement. The `SECURITY.md` contact is human input — leave it flagged for a human, never invent it.
4. **Archive replaced originals** to `backup/<YYYY-MM-DD>/` preserving their relative paths (today's date). Only docs you **replaced** get archived; **never archive README.md — merge into it instead**.
5. **Detect the stack from the manifests** (package.json / requirements.txt / go.mod / Cargo.toml / pom.xml — filenames only); for each technology create a playbook (`arggon playbook new <tech>`), research current versions and best practices with dated sources, then record them with `arggon playbook refresh <tech> --version <v>`.
6. **Baseline the sanctioned edits**: run `arggon adopt --ack` so the generated docs you completed in step 3 become the new `x-generated` baseline (their checksums are refreshed and they stop reporting as modified). Hand edits made AFTER this ack still report modified — the protection stays intact.
7. **Verify**: `arggon validate` + `arggon spec validate` (if specs exist) + `arggon playbook status`.
8. **Report**: comment on the adoption task (`arggon comment task-adopt-arggon`) listing the extracted content, archived files, and created playbooks; flip the task done when the human reviews.

If the adopting repo carries a pre-existing spec corpus (OpenSpec — `openspec/config.yaml` + `specs/*/spec.md` — or another format such as ADR/RFC markdown), follow the phased migration checklist the adoption task generates: detection fingerprints, then Fase 0 mapping (format -> spec template, e.g. OpenSpec `## Requirements` -> Acceptance criteria verbatim), Fase 1 one spec per capability with a zero-loss assertion, Fase 2 duplication audit, Fase 3 consolidation, Fase 4 contract refactor in file-disjoint waves — with the gates per phase (`spec validate` 0/0, `spec analyze` without NEW findings vs baseline; consolidar antes de reescribir).

## Self-improvement loop

Findings flow back into the tool through two documented, repeatable protocols (`ArggonManager/docs/labs/`), plus the adopter friction channel below — which captures friction met in **any** session, an adopter's as much as a maintainer's, and deliberately does **not** file through the tracker:

- **Adversarial audit** ([`ArggonManager/docs/labs/adversarial-audit.md`](../labs/adversarial-audit.md)): attack the behavioral invariants (claim exclusivity, never-reopen/steal, never-overwrite, cascade honesty, lost pushes) and sweep the normative doc statements ("never/always/only/requires") against built behavior, in a throwaway temp tree. Run after a notable feature wave or before a release (~1h). Findings file via the tracker; never patch the tool from an audit.
- **Telemetry mining** ([`ArggonManager/docs/labs/telemetry-mining.md`](../labs/telemetry-mining.md)): mine ZCode session logs, the experiment repos' tracker commit histories, and `.evidence/` dirs for friction signatures (retries, fallbacks, manual tracker git work, chore-commit clusters). Run after each real-usage session or experiment — not on a timer.

Both file through the normal loop (`arggon create task|bug --parent <story-id>`) with literal repro + evidence.

- **Adopter friction channel** ([ADR 0024](../adr/0024-adopter-friction-channel.md), [spec-friction-capture-020](../specs/spec-friction-capture-020.md)): `arggon friction "<one line>" --command "<argv shape>"` appends one bounded, redacted record to a **local, append-only JSONL log that is never the tracker** — it cannot become a task by accident, never stages, never commits and never appears in `arggon validate`. `--report` dedupes by a stable-fields fingerprint (`commandShape` + `errorCode` + `harness` + major version — never the narrative, per Sentry's grouping rule) and renders a report a human acts on; tier `b` adds a prefilled issue URL the human opens. No tier auto-submits, and the tool never reads an inbound issue body.
  - **The trigger lives in the generated agent files** (a marked `arggon:friction-trigger` block), not only in a skill reference: `deftai/directive#3633` shipped a sanctioned escalation skill and an agent that was actively escalating still missed it because the skill was absent from the host's discovery inventory — silent loss that looks like success. A capability in the wrong place is absent.
  - **Visibility is per file, and that is measurable**: `arggon doctor --json`'s additive `friction` block reports, per managed agent file, whether it carries the block and at which `triggerVersion`. It is not the channel's discoverability (a template edit already surfaces as an outdated managed doc); it is what separates _trigger absent_ from generic template drift, which is the observable `task-spike-friction-trigger-compliance` needs to tell "never seen" from "seen and ignored" before stage 2 is worth building.
  - **Opt-out gates capture, never discoverability** (ADR 0024 §3): `x-friction: false` (documented in [`convention.md`](../convention.md)) and `ARGGON_NO_FRICTION=1` write nothing and render an empty report with `optedOut: true`; neither removes the trigger from the agent files nor hides the command. Adopters take on the duty to re-run `arggon init` when the trigger goes stale.
