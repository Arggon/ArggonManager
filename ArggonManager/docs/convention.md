# Task convention (v0)

> **Methodology carrier (per [ADR 0020](./adr/0020-methodology-first-productization.md)).** This document is a carrier of the ArggonManager methodology — declared together with `ArggonManager/docs/agents.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/convention.md`, and the bundled `arggon-cli` skill.
>
> - **Scope:** any project — not only software.
> - **Invariants:** work-loop parity: any human and any agent may claim, work, review, comment and merge under the same kernel rules and the same JSON contracts; state lives in git; discipline is enforceable; docs travel with code; never-steal / never-reopen, with authority asymmetric and named — the irreversible overrides stay product-owner powers, structurally human-only.
> - **Version:** tracks the ArggonManager package version.
> - **Upgrade channel:** methodology changes reach adopters through the adopter upgrade channel ([ADR 0016](./adr/0016-adopter-upgrade-channel.md)).

ArggonManager stores work as Markdown files under the tracker root — `ArggonManager/`
(legacy `tasks/` trees are auto-detected and keep working; see [Tracker layout
(v5)](#tracker-layout-v5)). Humans and agents create, claim, and update items the
same way: edit the file and commit. That is **work-loop parity**
([ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §1) — the
loop is identical for both sides. What is _asymmetric_ is authority, and it is
named, not implied: the product owner sets `priority`, and four irreversible
overrides are structurally human-only (the full map, with the structural gate
behind each: [`ArggonManager/docs/engineering.md`](./engineering.md)
§Roles and authority).

**v0 fields and layout are locked.** See [Versioning](#versioning--forward-compatibility) for how unknown keys and future versions work.

This document is the source of truth for future CLI behavior (`validate`, `create`, `update`, claim rules). CLI implementation is out of scope for this convention PR.

---

## Folder layout

```text
ArggonManager/                    # tracker root (legacy: tasks/)
  .convention.yml                 # tree version (optional; omit = 0)
  docs/                           # product docs (convention, engineering, ADRs, specs, plans, ...)
  <initiative-id>/
    <initiative-id>.md            # REQUIRED index
    <epic-id>/
      <epic-id>.md                # REQUIRED index
      <story-id>/
        <story-id>.md             # REQUIRED index
        task-<inner-slug>.md
        bug-<inner-slug>.md
```

`docs/` directly under the tracker root is reserved for the product docs
(ADR 0012): it is never an item container and the item walkers skip it.

### Hierarchy

<!-- prettier-ignore -->
| Level | Directory | Index file | Children |
| --- | --- | --- | --- |
| Initiative | `ArggonManager/<initiative-id>/` | `<initiative-id>.md` | epic directories |
| Epic | `.../<epic-id>/` | `<epic-id>.md` | story directories |
| Story | `.../<story-id>/` | `<story-id>.md` | `task-*.md`, `bug-*.md` |
| Task / Bug | _(files only)_ | n/a | none |

In **v0**, tasks and bugs live **only** under a story. They must not sit directly under an epic or initiative.

Parent `status` is **independent** of children — **no rollup** in v0. Container status is authored, not derived.

**Exception — automatic container completion** (`task-container-auto-done`): when an update drives an item to a terminal state (`done`/`cancelled`) and an ancestor container's entire subtree is terminal, that ancestor completes as `done` automatically, cascading up to the initiative. Containers in `todo`/`blocked` complete directly to `done` (a documented exception to the transition table, since the intermediate `in_progress` is meaningless for unattended automation and would violate the claim rule on claimable types); already-terminal containers keep their status (an explicit `cancelled` is never overwritten). Callers that must not touch ancestors opt out with `--no-cascade` (`cascade: false` in the kernel). The rollup is write-on-close only — no derived status is ever computed for display. The cascade is **acceptance-aware** (`task-cascade-acceptance-aware`): a container whose OWN body still has unchecked acceptance checkboxes is never auto-completed — `done = acceptance checklist complete` wins over status mirroring. A container without any checklist has no acceptance contract and completes as before. The skipped container stays open, and nothing above it completes either (its subtree is not closed); the `--json` envelope reports the skip as `cascadeSkipped` and human output prints one `cascade skipped:` line per skipped container.

**Cascade predictability** (`task-cascade-predictability`): when the cascade auto-completes containers at **epic level or above**, human `arggon update` output prints a visible warning naming them (e.g. `⚠ cascade: auto-completed epic 'cli' (and 1 more ancestor) — use --no-cascade to keep containers open`), and the `--json` envelope carries `cascadeLevels` (container types affected, parallel to `autoCompleted`). Modeling guidance: administrative leaves (e.g. adoption or migration tasks) must not live as the **sole children** of product containers that must stay open — closing the last child completes the whole chain. When closing such a leaf is unavoidable, pass `--no-cascade` so its containers stay open.

### Vocabulary: `id`, inner slug, filename

<!-- prettier-ignore -->
| Term | Meaning |
| --- | --- |
| `id` | Canonical identifier = **filename stem** (no `.md`). **Globally unique** under the tracker root. |
| inner slug | Leaves only: `id` with the `task-` / `bug-` prefix stripped. |
| filename | Function of `type` + `id`, never an independent namespace. |

Rules:

- Max length **64** characters applies to **`id`** (the stem), not the inner slug alone.
- `id` pattern (stem): `^[a-z0-9]+(?:-[a-z0-9]+)*$` (kebab-case ASCII).
- Container ids (**initiative / epic / story**) **MUST NOT** start with `task-` or `bug-`.
- Type prefixes on stories (e.g. `story-login`) are **not** type discriminators — type lives in `type` + path. A prefix may appear inside the id as style only.
- `id` is **not** a stable UUID: **rename = new identity**.

CLI create examples:

<!-- prettier-ignore -->
| Command | Resulting `id` / filename |
| --- | --- |
| `arggon create task rate-limit …` | `id: task-rate-limit`, file `task-rate-limit.md` (CLI adds `task-` / `bug-` for leaves) |
| `arggon create epic auth …` | `id: auth`, file `auth.md` (no type prefix) |
| `arggon create story story-login …` | `id: story-login` (caller chose the stem; `story-` is not required) |

### Filename vs `id`

<!-- prettier-ignore -->
| Item | Filename | `id` value |
| --- | --- | --- |
| Initiative / epic / story index | `<id>.md` | `<id>` |
| Task | `task-<inner-slug>.md` | `task-<inner-slug>` |
| Bug | `bug-<inner-slug>.md` | `bug-<inner-slug>` |

### Reparent vs rename

When reparenting or renaming an item: [read details](./references/convention.md#reparent-vs-rename).

### Invalid layouts (reject / fail validate)

<!-- prettier-ignore -->
| Problem | Why invalid |
| --- | --- |
| Missing index `.md` in an initiative/epic/story directory | Every container needs a required index |
| `task-*.md` or `bug-*.md` directly under epic or initiative | Tasks/bugs only under story in v0 |
| Filename does not match `type` + `id` rules | Naming must match type and identity |
| Filename stem ≠ `id` | Identity must be consistent |
| `id` not kebab-case / > 64 chars / non-ASCII | Breaks path and id rules |
| Container `id` starts with `task-` or `bug-` | Reserved leaf prefixes |
| Epic/story/task/bug without `parent` | Parent required except for initiatives |
| Initiative with a non-null `parent` | Initiatives are roots |
| **`id` not unique** under the entire tracker tree | `parent` and lookup-by-id must be unambiguous |
| **`parent` does not resolve** to an existing item | No dangling references |
| **`parent` type vs child type** mismatch | Allowed edges only: epic→initiative, story→epic, task/bug→story. No skip, no cycles |
| **`parent` ≠ filesystem parent container’s `id`** | Path and frontmatter are the **same** hierarchy |
| **`type` ≠ path role** | e.g. index in an epic directory must be `type: epic` |
| Unknown directories under a story | Only index + `task-*.md` / `bug-*.md` allowed in v0 |

**Work-item detection:** any `*.md` under the tracker root whose frontmatter has `type:` is a work item and must satisfy naming + placement. Other files (`README`, images, `.convention.yml`) are ignored by `validate`.

**Frontmatter presence is enforced, not assumed** (bug-validate-does-not-check-frontmatter-present). Detection above is a
positive rule; it is deliberately not the whole rule. A file in a position the layout RESERVES for a work item — a container
index (`<dir>/<dir>.md`) or a `task-*.md` / `bug-*.md` leaf — MUST open with a `---` frontmatter block: without one it
reports `MISSING_FRONTMATTER`, and a block that opens but never closes reports `UNTERMINATED_FRONTMATTER`. Both name the
file. Before this rule the worst possible corruption was the only shape `validate` accepted: required-field checks are
skipped when there is no block to check them against, so a file whose whole block was deleted — by a conflict-resolution
script, a truncated write — was read as body prose and the tree reported `ok`, while the item could not be listed, claimed,
gated on `done` or resolved by `depends_on`. Checking the _content_ of a structure is not checking that the structure
exists. The requirement is scoped to item positions on purpose: a plain `.md` that the layout reserves nothing for stays an
ignored non-item document, so the rule cannot invent a requirement for a `README` or a notes file.

Note: a container's acceptance-aware cascade guard is any unticked checkbox that carries text — a checkbox line with no text after the box is a scaffold placeholder, not a criterion (bug-empty-template-checkbox): the kernel ignores it. The shipped task/bug templates scaffold one unchecked title-derived criterion, never a bare box (issue #870, [authoring decision](#authoring-a-contract-versus-creating-a-skeleton)).

### Acceptance rows (the one grammar)

**A checkbox line is an acceptance ROW when — and only when — it starts with the marker `^[ \t]*[-*] \[( |x|X)\][ \t]*`; it GATES the `done` flip when — and only when — the first character after the box, after any spaces or tabs, is non-whitespace.** Two facts, deliberately not one: the kernel reports every marker match and keeps the second as a separate flag (`AcceptanceRow.criterion`, `lib/src/items.ts`), so the bare box `- [ ]` is still a row that renderers show, while only a text-bearing row is a criterion. Deriving one from the other drops the placeholder box on the floor. That gate is the DONE GATE's rule ([ADR 0015](./adr/0015-done-gate-acceptance-waiver.md)) and it is the rule the board drawer, the detail pane, the native panel and the ZCode goal contract all read, because the kernel is the only place it exists (`acceptanceRows`, `lib/src/items.ts` — one parser, and the only place the reference tables are implemented). Decided and documented by `bug-three-acceptance-parsers-diverging`, because three renderers and the gate used to carry three grammars between them and disagreed on the reference shapes.

**Call the kernel; do not reimplement the grammar.** The one row parser is `acceptanceRows`, layered under `acceptanceCriteria` → `acceptanceUnchecked` → `acceptanceComplete`, with `acceptanceBody` fixing its input (`lib/src/items.ts`); each one's doc comment carries the marker rule, the terminator set and both exclusion directions. Whether a given line is a row at all is decided by the reference tables — including the settled `- [ ] x` and `- [ ]x` (both ARE rows; `x` is just a one-character criterion, and whether the space is there changes nothing) and `-  [ ] x` (is NOT a row) answers. The ast-grep rule `acceptance-rows-use-kernel` (`tools/ast-grep/rules/`, run by `npm run test:structure`) fails a hand-rolled box regex next to a consumer; it says nothing about _which bytes_ you hand the kernel, so a consumer that already calls the right parser still needs `cli/src/acceptance-parity.test.ts`, which asserts each consumer reads `acceptanceBody(item)`.

**Which bytes is the question.** The canonical body is the INPUT; narrowing it is the consumer's business only when the rule says so, and the rule now says it in exactly one place. The `→ done` gate asks the **live `## Acceptance` section** of that body — dated comment blocks and fenced code blocks excluded — through `acceptanceGate` / `liveAcceptanceRows` (bug-done-gate-counts-checkboxes-inside-comment-blocks, bug-done-gate-whole-body-scan-counts-fenced-repro-boxes), while `acceptanceRows` / `acceptanceCriteria` / `acceptanceComplete` keep answering the whole-body question that the container cascade and the renderers ask. Both are the same row parser over the same canonical input; they differ in which region is the contract, and neither one narrows the INPUT at a call site. So a consumer still must never pre-filter: the region is decided INSIDE the predicate, on the canonical body.

When implementing or debugging acceptance consumers: [read details](./references/convention.md#acceptance-rows-the-one-grammar).

---

## Frontmatter schema (v0)

Every work item file begins with YAML frontmatter between `---` fences.

**List values may wrap.** A list field (`labels`, `depends_on`, or an `x-*` extra) is _written_ on one line as a flow
sequence — `depends_on: [task-a, task-b]` — and the _reader_ accepts that same list continued over the following
lines in either shape a YAML writer produces: a wrapped flow sequence (`depends_on:` then an indented `[...]`, with
one element per line and a trailing comma allowed), or an indented block sequence (`- task-a`). All of them read back
as the identical list, which is what makes an item file safe to run the repo formatter over: `arggon update` writes
the single-line form, the formatter may reflow it past `printWidth`, and `validate` still passes
(bug-update-depends-on-multiline-rejected). The tolerance is scoped to a list value: an indented line that is neither
a flow sequence nor a block entry, and a flow sequence that never closes, are still refused as `BROKEN_YAML`.

### Fields

<!-- prettier-ignore -->
| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `type` | **yes** | enum | `initiative` \| `epic` \| `story` \| `task` \| `bug` |
| `status` | **yes** | enum | see [Statuses](#statuses-v0) |
| `id` | **yes** | string | Filename stem; globally unique under the tracker root; rename = new identity |
| `title` | no | string | Canonical when present; else first Markdown H1; else display `id`. `list` does **not** rewrite the file |
| `assignee` | no | string \| null | Omit or `null` = unassigned; **empty string is invalid**. Pattern: `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$` (GitHub login or agent id) |
| `branch` | no | string \| null | Working branch name (v1 field, e.g. `feat/task-rate-limit`). Omit or `null` = none. Set on claim/`start`, cleared on unclaim |
| `parent` | conditional | string \| null | **Required** for epic/story/task/bug; omit or `null` for initiative. Must equal filesystem parent container’s `id` |
| `labels` | no | list of strings | Default `[]`. Kebab-case ASCII, unique, case-sensitive (no folding) |
| `priority` | no | string \| null | Judgment priority (v4 field, spec-priority-field-008): `p0` \| `p1` \| `p2` \| `p3`. Omit or `null` = unprioritized. Valid on all item types; unknown values are validate errors (`PRIORITY_INVALID`). Set via `create --priority` / `update --priority`; legacy `pN` labels move in via `arggon priority migrate`. See [Priority (v4)](#priority-v4) |
| `created` | no | string | Quoted `YYYY-MM-DD` only in v0 (e.g. `created: "2026-09-03"`) |
| `updated` | no | string | Quoted `YYYY-MM-DD` only in v0 |
| `blocked_reason` | conditional | string | **Required non-empty** when `status: blocked`; must be **absent or empty** otherwise |
| `depends_on` | no | list of strings | Dependency graph (v3 field, ADR 0004): ids this item waits for; empty/omitted = none. See [Dependency graph (v3)](#dependency-graph-v3) |
| `claimed_at` | no | string | Soft claim lease (ISO date-time), written/cleared by the CLI on claim state changes; reporting only. See [Claim lease](#claim-lease-claimed_at) |

### Defaults when creating

<!-- prettier-ignore -->
| Field | Default |
| --- | --- |
| `status` | `todo` |
| `created` | today (`"YYYY-MM-DD"`) |
| `updated` | today (`"YYYY-MM-DD"`) |
| `labels` | `[]` |
| `assignee` | omit / null |
| `title` | unset (derive from H1) |

### Minimal examples

When authoring frontmatter examples: [read details](./references/convention.md#minimal-examples).

---

## Statuses (v0)

### Enum

`todo` | `in_progress` | `blocked` | `done` | `cancelled`

### Transition matrix

<!-- prettier-ignore -->
| From | Allowed next |
| --- | --- |
| `todo` | `in_progress`, `cancelled` |
| `in_progress` | `blocked`, `done`, `cancelled`, `todo` (unclaim) |
| `blocked` | `in_progress`, `cancelled` |
| `done` | `todo` (reopen — schema allows; see playbook) |
| `cancelled` | `todo` (reopen — schema allows; see playbook) |

Intentional gaps: **`todo` ↛ `done`** and **`todo` ↛ `blocked`** — completing or blocking requires a claim first.

**Done gate (task-done-gate-acceptance-waiver, ADR 0015; scoped by bug-done-gate-counts-checkboxes-inside-comment-blocks):** for the claimable leaves `task`/`bug`, the `→ done` transition additionally requires the item's **live `## Acceptance` section** to be a complete acceptance contract. The gate reads that section — not the whole body — because a dated comment block is append-only history: an unticked box inside one records what the criteria _were_, so counting it made an item's verdict depend on its comment record rather than on the work. Two refusals, both named in the message:

1. **`unchecked-live-criteria`** — the section carries at least one criterion and one is unticked. A checkbox line with no text after the box is a scaffold placeholder, not a criterion (bug-empty-template-checkbox), so it is never an unmet criterion and never appears here.
2. **`no-live-contract`** — the section publishes **no criterion at all**: absent, empty, whitespace-only, still the `<!-- … -->` template placeholder, nothing but bare `- [ ]` scaffold rows, or nothing but rows that sit inside a fenced code block. "No criterion" is one predicate (zero criteria in the live section), so none of those spellings is a way past it, and an item that has published no live contract does not reach `done` on the strength of ticked boxes in a comment record — that is vacuous success, the defect class `bug-verification-regex-matching-nothing` and `bug-wave-probe-file-check-model-dependent` already name.

The section is the one headed exactly `## Acceptance` (case-insensitively; `## Acceptance mapping` or `## Acceptance criteria` is prose that merely starts with the word and cannot answer for the contract), and it ends at the next `#`/`##` heading. Dated comment blocks inside it — `### <date> @<author>` and `### Waiver <date>`, through the next dated heading or the end of the body — are excluded, including any `### Acceptance` a reporter pasted into one. **Fenced code blocks are excluded on the same footing, and the fence wins over the heading rules**: a fence is content, so a `- [ ]` row inside one is never a criterion, a `## Acceptance` heading inside one opens no section, and a `### <date> @author` line inside one opens no comment block — an unclosed fence runs to the end of the body (CommonMark). So a bug item whose own repro demonstrates what a formatter does to a `- [ ]` list item still flips, and a repro that quotes `arggon comment` output cannot delete the live section below it. **The current body is the contract; the comment record is history; a fence is content; and none of them is edited to satisfy a gate** — transcribe the criteria into the live section instead. The kernel refuses the flip unless the caller passes an explicit waiver — `update --status done --waive "<reason>"` with a non-empty reason, recorded as a dated `### Waiver <date>` section in the item body before the status changes. Agents are refused waivers (the MCP/native surfaces expose no waive parameter); containers are exempt here — their contract is the acceptance-aware cascade. The gate is a kernel rule on the transition, never a `validate` error: the two refusals above never appear in `validate` output — hand-edited files still validate either way on their account.

**Validate refusal for placeholder bodies (task-validate-refuses-placeholder-bodies; `decided: A` on bug-template-only-bodies-ship-green):** alongside the done gate, a template-only body on an OPEN item fails `arggon validate` (non-zero, named error `PLACEHOLDER_BODY`) — it does not warn. Report-only and split were explicitly rejected: the delivery lead owns the backlog, so parking rot there is not an option. Scope: every item type, statuses `todo`/`in_progress`/`blocked`, whose live `## Context` or live `## Acceptance` section (same live-section extraction as the done gate — dated comment blocks and fenced code blocks excluded, section ends at the next `#`/`##` heading) still carries the scaffold placeholder marker — the `<!-- … -->` placeholder comment. The match is on the marker grammar, never on quoted prose: a marker quoted inside an inline code span or a fenced code block is real content about the marker, not the marker itself, so an item that discusses the placeholders (as `bug-template-only-bodies-ship-green` itself does) stays green, and the file-top placement comment — outside every live section — never counts. Done/cancelled items are excluded (history, not the contract) and the message says so. There is no `--waive` on `validate` and no waiver parameter on the native/MCP surface: the refusal clears only when the live sections carry real prose. The one path past it without prose is the human-only done-gate waiver (`update --status done --waive "<reason>"`), which closes the item — and closed items are excluded. Agents cannot take it (the MCP/native surfaces expose no waive parameter and the kernel refuses agent callers), so for an agent the only way past is the honest one: write the sections.

### Authoring a contract versus creating a skeleton

**Decision (issue #870, `task-create-needs-a-body-flag-to-author-a-live-contract`):** body remains optional, and the shipped **task/bug** defaults become a meaningful textual skeleton — title-derived `## Context` prose and one unchecked live `## Acceptance` criterion (task: the title; bug: `Resolved: <title>`). The `title-inline` token is HTML/Markdown escaped, so title text cannot inject markup, headings, extra rows or a placeholder comment. Container templates are unchanged. The two rejected alternatives: a mandatory body flag would break compatible `create` callers, and auto-checking the default criterion would fabricate completion.

Callers should still author precise Context and live Acceptance themselves. CLI `create --body <file>` reads UTF-8 Markdown as a **complete body replacement**, bypassing templates (the frontmatter serializer normalizes the final newline); repeatable `--acceptance '<criterion>'` authors the live `## Acceptance` section as unchecked rows and replaces the skeleton, and the two flags are mutually exclusive. Each `--acceptance` value must be non-empty and single-line, so one flag cannot smuggle a second row or a heading. MCP `arggon_create` and native `tools.arggon.create` take the same input as inline `body: string` and `acceptance: string[]` (never a filename). A supplied body may carry checked criteria for already-performed work; it does not bypass the claim-first transitions or the done gate above. Claim, then complete only when every live criterion is honestly ticked — no waiver or manual item edit is needed to author the contract.

**Local-template limitation:** custom/local templates keep their existing precedence. An existing adopter's old task/bug templates may still scaffold placeholders; the shipped-default change does not rewrite them or migrate existing items. Use an explicit body or `--acceptance` to bypass them, or deliberately update the local templates. Open items whose live sections retain placeholder markers still fail `PLACEHOLDER_BODY` as above.

**Impact class: Behavioral ([ADR 0016](./adr/0016-adopter-upgrade-channel.md)).** Agents must learn body authoring, the unchecked skeleton defaults, and create's honest partial-failure receipt: a failed add/commit, an exhausted index-lock retry, or a lost staged entry now returns `ok: false` with `error.code: CREATE_COMMIT_FAILED`, preserving `path`, `item` and `commit` (additive `commit.failure`, plus the existing `commit.skipped` reason). The written file is kept; repair the commit on that file, never rerun create. Benign opt-out / non-git / git-missing / genuinely-nothing-to-commit skips stay successful and quiet; the other mutators keep their best-effort semantics. Adopters absorb methodology changes through the propose channel, not an overwrite of their local choices.

Changing status means editing frontmatter and committing (or opening a PR). Agents follow the same transitions except where playbook forbids reopen.

### Claim rule

Claim applies **only** to claimable types: **`story` | `task` | `bug`**.

- For those types, `status: in_progress` **requires** non-null `assignee`.
- **Initiative** and **epic** MAY be `in_progress` **without** assignee (authored container status, not rollup).

**Claim** = (`type` ∈ {story, task, bug}) ∧ `assignee` set ∧ `status: in_progress`.

**Conflict:** reassigning a claimed item to a different assignee is refused unless `--force`; that override is [human-only](./engineering.md#authority-map), not an agent recovery path. Force still obeys status transitions, the claim rule and `blocked_reason` constraints. Prefer coordination or the current owner's unclaim followed by a new claim; never silently replace a claim.

### Claim lease (`claimed_at`)

Claims carry a **soft lease**: an ISO date-time `claimed_at` maintained by the CLI (additive field; treated like the `milestone`/`depends_on` prototype keys — parsed unconditionally, never rejected, ignored by older tools).

- **Set** automatically whenever a claimable item is claimed — transitions to `in_progress` with an assignee via `arggon update` or `arggon start` — and refreshed when the claimant changes.
- **Cleared** automatically when the item leaves the claimed state: unclaim (`in_progress` → `todo`), terminal states, or `blocked` (a new lease starts on re-claim).
- **Reporting only**: `claimed_at` never gates a transition and `validate` imposes no constraint on it. Items claimed before the field existed simply have no `claimed_at`; missing `claimed_at` counts as stale in stale-claim reporting.
- **Staleness is advisory**: `arggon list --stale --older-than <duration>` (`<number><d|h|m>`, e.g. `7d`) surfaces claimed items whose lease started before the threshold. It filters reporting only — it never blocks work.
- **Only humans may steal**: `arggon update <id> --steal --reason "<why>" --assignee <you>` is a supervised takeover of a claimed item. It requires a non-empty reason, refreshes `claimed_at`, and appends a dated note (`> stolen <date> by <you>: <reason>`) to the item body. It is double-gated at the CLI (bug-cli-steal-not-gated): the repo must arm `x-tracker.allow-steal: true` in the tracker `.convention.yml` (default: refused), and the invocation must run on an interactive terminal with a y/N confirmation — non-TTY callers are refused even when armed. Agent callers are refused by the playbook rules (`docs/agents.md`), exactly like `--force`. Taking over another writer's claim is a **product-owner power** and one of the four irreversible ones ([ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §2) — a recorded authority split, not an undocumented exception to parity.

Concurrency / conflict handling (refuse steal unless `--force`, unclaim recovery, stale reporting): see [`claim.md`](claim.md).

### Unclaim (v0 CLI `update` default)

`in_progress` → `todo` **clears** `assignee` to null (omit or `null`). Documented as the CLI `update` default. See also [`claim.md`](claim.md).

### Working branch (v1)

`branch` records the working branch for an item (like a linked branch on a GitHub issue; plural later). Rules:

- Optional on every type; omit or `null` = no branch.
- Single non-blank token (no whitespace); naming patterns land in #49.
- Set via `arggon update <id> --branch <name>` (cleared with `--branch ""`); `start` fills it automatically (#50).
- Unclaim (`in_progress` → `todo`) **clears** `branch` alongside `assignee`, unless `--branch` is passed explicitly.
- Shown in the `list` table, the board card badge, and the JSON `WorkItem.branch` (additive; `null` when unset).

### Reopen / status policy

- **`validate` ALLOWS** `done|cancelled` → `todo` (schema permits).
- **Enforced (bug-reopen-ungated-cli):** agents are refused — the MCP layer via rules.ts, and the CLI via an interactive-terminal gate (`--status todo` on a `done`/`cancelled` item needs a y/N confirmation over TTY stdin; non-TTY callers are refused, no `--yes`, no config opt-in). Humans reopen by confirming at their terminal. Reopening a terminal item is a **product-owner power** ([ADR 0021](./adr/0021-agents-primary-workers-human-product-owner.md) §2).
- No status rollup — parent status is independent of children.

### `blocked_reason`

When `status` is `blocked`, `blocked_reason` MUST be a non-empty short human-readable string (elaborate in the body if needed). When status is not `blocked`, `blocked_reason` MUST be absent or empty. Clearing the block should return to `in_progress` (with assignee still set on claimable types) or `cancelled`.

### Status examples

When checking status examples: [read details](./references/convention.md#status-examples).

---

## Versioning & forward compatibility

### Tree version

Add the tracker `.convention.yml` (`ArggonManager/.convention.yml`, or legacy `tasks/.convention.yml`):

```yaml
version: 5
branch_patterns:
  initiative: "feat/{id}"
  epic: "feat/{id}"
  story: "feat/{id}"
  task: "feat/{id}"
  bug: "fix/{id}"
```

Omit = `0`. Layout is a tree concern. Per-file schema is optional and defaults to the tree version.

### Tracker layout (v5)

When detecting or migrating a tracker layout: [read details](./references/convention.md#tracker-layout-v5).

### Branch patterns (v2)

`branch_patterns` maps each work-item type to a branch-name template with `{id}` (required) and `{type}` (optional) placeholders. Missing keys fall back to the defaults above (`feat/{id}` everywhere, `fix/{id}` for bugs); unknown top-level keys are ignored. `arggon branch <id>` resolves the item's pattern (or its recorded `branch` field) and runs `git checkout -b`. Malformed patterns (missing `{id}`, unknown type, non-mapping section) fail `validate` with `INVALID_BRANCH_PATTERN`.

### Dependency graph (v3)

When changing or querying dependency graphs: [read details](./references/convention.md#dependency-graph-v3).

### Priority (v4)

When setting or migrating judgment priority: [read details](./references/convention.md#priority-v4).

### Saved views (`x-views`)

`x-views` is the official namespaced extension for named list filters (Linear-style saved views). It is a mapping of view name → filter expression using the same compact syntax as `arggon list --filter`:

When using saved list views: [read details](./references/convention.md#saved-views-x-views).

### Technology playbooks (`x-playbooks`)

`x-playbooks` is the official namespaced extension for playbook staleness options (`arggon playbook status`, story-tech-playbooks). It is a mapping of option names to values; the only official option today is `max-age-days`:

- `arggon playbook status` flags `docs/playbooks/<tech>.md` whose `researched` date is older than `max-age-days` days. Precedence: `--max-age-days <n>` wins over `x-playbooks.max-age-days`, which wins over the built-in default of **90**.

- Unknown nested keys inside `x-playbooks` are ignored (ignore-unknown, forward compat); a scalar `x-playbooks` value or a `max-age-days` that is not a positive integer is a parse error.

When configuring playbook staleness: [read details](./references/convention.md#technology-playbooks-x-playbooks).

### Tracker hygiene (`x-tracker`)

`x-tracker` is the official namespaced extension for tracker-hygiene options (story-tracker-hygiene). It is a mapping of option names to values; the official options today are `auto-commit`, `allow-steal` (claim-steal arming, see Stealing), `strict-gate-bins` (strict start gate), `strict-worktree-writes` (single-writer enforcement), `product-acceptance` (product-acceptance recording), and `reap-acked-orphans` (orphan-reaping arming, see below):

- `x-tracker.auto-commit: false` opts out tree-wide. Precedence: the per-invocation `--no-commit` flag wins over `x-tracker.auto-commit`, which wins over the built-in default of **true**.

- **`strict-gate-bins` default:** Unset or `false` keeps the documented honest-receipt default byte-identical ON ATTACH RUNS: the resolution stays report-only (readiness withholds `ready`; the claim commit remains authoritative).

- **`strict-worktree-writes` default:** Unset or `false` keeps the report-only default byte-identical (the warning never blocks).

- **`product-acceptance` default:** Unset or `false` keeps every adopter **silent**: `arggon report --json` (per container) and `arggon show <id> --json` (per item) still carry the acceptance state as an additive `acceptance` field — `accepted` / `changes-noted` / `none` / `self-accepted`, `none` when nothing was recorded — and only `arggon spec analyze` goes quiet on a terminal container closed with no recorded acceptance (the report-only `MISSING-PRODUCT-ACCEPTANCE` finding).

- **`reap-acked-orphans` default:** Unset or `false` keeps every acknowledged orphan on disk, reported in `init --json`'s `reapRefused[]` with the reason and the flag named.

- Unknown nested keys inside `x-tracker` are ignored (ignore-unknown, forward compat); a scalar `x-tracker` value or an `auto-commit`/`allow-steal`/`strict-gate-bins`/`strict-worktree-writes`/`product-acceptance`/`reap-acked-orphans` value that is not `true`/`false` is a parse error.

- **Undocumented by design (the escape hatch):** an option the kernel reads but that ships deliberately undocumented carries `undocumented-by-design` on the same source line as its `if (key === "…")` (or `key !== "…"`) comparison in `lib/src/convention.ts` — the marker is read off that one line, so a marker on the branch's `throw` or assignment line below it does not exempt the option. `cli/src/convention-option-doc-contract.test.ts` derives the official option lists from the kernel type and parser and exempts exactly those marked lines. Documenting is the default — the marker exists for a genuine internal alias and stays visible on the line where the branch lands.

When configuring tracker hygiene and start safety: [read details](./references/convention.md#tracker-hygiene-x-tracker).

### Import type mapping (`x-import`)

`x-import` is the official namespaced extension for GitHub issue-import options (`arggon import-issues`, task-import-type-mapping). It is a mapping of option names to values; the only official option today is `label-types`, which maps GitHub labels (exact keys, matched against the slugified issue labels) to work-item types:

- Without `x-import.label-types`, the built-in default applies: the `bug` label imports as a **bug**, everything else (including `enhancement`/`feature`) as a **task**. An explicit `label-types` mapping **replaces** the built-in default entirely (set `bug: task` there to opt out; an explicitly empty mapping disables all mapping).

- Unknown option keys inside `x-import` are ignored (ignore-unknown, forward compat); a scalar `x-import` or `label-types` value, a value that is not a work-item type, or a duplicate label is a parse error.

When configuring GitHub import type mapping: [read details](./references/convention.md#import-type-mapping-x-import).

### Worktree bootstrap (`x-worktree`)

`x-worktree` is the official namespaced extension for worktree-bootstrap options (`arggon start --worktree`, task-start-post-hook). It is a mapping of option names to values; the official options are `post-start`, a shell command run after a new worktree is created, `post-start-shell`, the shell that command runs through, `env`, the worktree env-contract opt-out, and `services`, the Compose reaping declaration:

**`env` (spec worktree-env-contract-016):** absent or `true` (the default) keeps the per-worktree env contract enabled; only an explicit `false` disables it.

The per-invocation flag `arggon start --worktree --post-start-shell login` overrides the config value; anything other than `inherit` (the default, current behavior) or `login` is a parse error.

- Unknown nested keys inside `x-worktree` are ignored (ignore-unknown, forward compat); a scalar `x-worktree` value or an `env` value that is not `true`/`false`, or an empty `post-start` value is a parse error.

When bootstrapping worktrees and declaring services: [read details](./references/convention.md#worktree-bootstrap-x-worktree).

### Issue round-trip (`x-github`)

`x-github` is the official namespaced extension for GitHub round-trip options (task-issue-roundtrip, PR #228). It is a mapping of option names to values; the only official option today is `issue-roundtrip`, which opts in to closing the linked GitHub issue when a work item is flipped to `done`:

- Opt-in and **default OFF**: without `x-github.issue-roundtrip: true`, flipping an item to `done` never touches GitHub, even for items carrying an `issue:` field (imported via `arggon import-issues`, or set on hand-built items via `arggon create --issue <n>` / `arggon update <id> --issue <n>`; `--issue 0` clears it).

- Unknown option keys inside `x-github` are ignored (ignore-unknown, forward compat); a scalar `x-github` value or an `issue-roundtrip` value that is not `true`/`false` is a parse error.

When enabling linked-issue close-out: [read details](./references/convention.md#issue-round-trip-x-github).

### Friction opt-out (`x-friction`)

`x-friction` is the official namespaced extension for the adopter friction channel ([ADR 0024](./adr/0024-adopter-friction-channel.md), [spec-friction-capture-020](./specs/spec-friction-capture-020.md)). It is a mapping of option names to values; the only official option today is `capture`, the friction-capture opt-out. The documented spelling is the scalar one, because the spec, the ADR and the plan all write it that way:

- `ARGGON_NO_FRICTION=1` (any non-empty value) is the per-invocation off-switch and **wins** over this key, mirroring `--no-commit` over `x-tracker.auto-commit`. There is deliberately no per-invocation opt-in: a tree that opted out at the config level re-enables by editing the config, never by an ambient variable a wrapper shell may or may not have set.

- Unknown nested keys inside `x-friction` are ignored (ignore-unknown, forward compat); a scalar `x-friction` value or an `capture` value that is not `true`/`false` is a parse error.

When configuring friction capture: [read details](./references/convention.md#friction-opt-out-x-friction).

### Generated-doc provenance (`x-generated`)

`x-generated` is the official namespaced extension for generated-file provenance (`arggon init` / `generateDocs`, story-adoption-state; Copier/Helm precedent). It maps each generated destination (posix, relative to the repo root) to its provenance record:

When maintaining generated-file provenance: [read details](./references/convention.md#generated-doc-provenance-x-generated).

### Extension namespace

- Official keys = the field table above.
- Reserved extension namespace: `x-*` keys (or an `extensions:` map).
- Unknown **namespaced** keys: ignore-unknown (do not fail).
- Unknown **unnamespaced** keys: validators may **warn**.
- Official tools **must round-trip** unknown namespaced keys on `update` (do not strip).

### `.convention.yml` syntax arggon reads (and what it refuses)

When editing convention parser syntax: [read details](./references/convention.md#conventionyml-syntax-arggon-reads-and-what-it-refuses).

### Reserved for later (invalid as ad-hoc in v0)

These names are reserved for a future version — do not invent them as unknown keys with meaning:

`order` / `rank`, `blocked_by`, `priority`, `estimate`

(`depends_on` was reserved through v2 and became official in v3; `blocked_by` stays reserved permanently — it is a computed inverse view, never stored.)

### v0 → v1

- Additive fields default safely (`branch` is optional; v0 trees without it stay valid).
- Breaking changes bump `version`.
- `validate` **rejects** trees with a higher convention version than it supports.
- **v1** = v0 + official `branch` field. New trees are scaffolded at v1; v0 trees (explicit `version: 0` or omitted) remain fully supported.
- **v2** = v1 + `branch_patterns` config in the tracker `.convention.yml`. New trees are scaffolded at v2 with explicit per-type patterns; older trees keep working (missing patterns fall back to defaults).
- **v3** = v2 + official `milestone` ([ADR 0003](adr/0003-milestone-field.md)) + `depends_on` ([ADR 0004](adr/0004-milestone-deps-v3.md)). New trees are scaffolded at v3. Purely additive migration: **v0–v2 trees stay valid unchanged, nothing to migrate** — the CLI parses `depends_on` (and `milestone`) unconditionally, so older trees that adopt the field early keep validating, and trees without it are unaffected (see [Dependency graph (v3)](#dependency-graph-v3)).
- **v4** = v3 + the official `priority` field ([Priority (v4)](#priority-v4), ADR 0009). Additive; `v4` is NOT the layout version.
- **v5** = v4 + the tracker root rename ([Tracker layout (v5)](#tracker-layout-v5), ADR 0012): items under `ArggonManager/`, product docs under `ArggonManager/docs/`. New trees are scaffolded at v5; legacy `tasks/` trees stay valid and keep working, and `arggon migrate --layout` is the supported move (it bumps the file to v5).

### Listing order (v0)

Lexicographic by `id`.

### Parent status

Independent of children — **no rollup** in v0.

---

## Templates

When copying item templates: [read details](./references/convention.md#templates).

## Sample tree

When looking up the valid sample tree: [read details](./references/convention.md#sample-tree).
