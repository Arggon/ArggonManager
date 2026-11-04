# Convention reference

Read only the linked section needed for the current operation; the [operational core](../convention.md) owns the entry points and retained contracts. Extracted detail remains normative unless it says otherwise.

### Reparent vs rename

| Operation                                   | What to update                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Reparent** (move dir/file, **same** `id`) | Only the moved item’s `parent` (+ filesystem path). **Children untouched.**         |
| **Rename** (change `id` / directory name)   | Filename/dir, the item’s `id`, and **every** `parent` that referenced the old `id`. |

`parent` is an **id**, not a path. Moving `story-login/` from under `auth/` to under `onboarding/` updates only that story’s `parent` (`auth` → `onboarding`). Nested tasks keep `parent: story-login`.

`arggon update <id> --parent <new-parent>` performs this reparent mechanically: it validates the edge (task/bug under a story, story under an epic, epic under an initiative; no cycles — a parent that is the item's own descendant is refused), rewrites `parent`, and moves the file (leaves) or the whole directory (containers) per the layout rules. Same parent = no-op. `arggon update <task-id> --type story` promotes a task to a story in place: the file moves to the story index layout under the task's grandparent epic and the id is renamed `task-x` → `story-x` (container ids must not start with `task-`/`bug-`), with `depends_on` references rewritten; demotion is not supported in v1.

### Acceptance rows (the one grammar)

**One body, one question.** A consumer of these rows must read the item's **canonical** body — the whole body, comment sections included, exactly as `acceptanceBody(item)` hands it over — and must not trim, EOL-normalize, clip or filter it before calling: a reader that pre-processes the body has changed the question, and on reachable shapes it changes the answer. `arggon show`'s `prose`, the board drawer's clipped prose and a bounded comment tail are for _rendering_; handing one to an acceptance predicate asks a different question, and on a checklist filed as a comment — a supported shape, and the only one before issue #870 added `create --body` — the answer flips from "criteria remain" to "nothing left to do" while the gate still refuses the flip. That inversion is what had the goal contract telling an agent an item was finished at the exact moment the done gate was blocking it (bug-three-acceptance-parsers-diverging).

| Line                                                   | Row?    | Gates the `done` flip? | Why                                                                                                                                                                               |
| ------------------------------------------------------ | ------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `- [ ] criterion` / `- [x] criterion`                  | yes     | yes when unticked      | The canonical form.                                                                                                                                                               |
| `* [ ] criterion`                                      | yes     | yes when unticked      | `*` is an equally standard bullet.                                                                                                                                                |
| `  - [ ] criterion` (space or tab indent)              | yes     | yes when unticked      | Indentation is tolerated; nesting is not meaningful here.                                                                                                                         |
| **`- [ ] x`** (marker, then trailing content)          | **yes** | **yes when unticked**  | **Decided: it IS a row.** The text after the box is the criterion — `x` is simply a one-character criterion.                                                                      |
| **`- [ ]x`** (box glued to its text)                   | **yes** | **yes when unticked**  | **Decided: it IS a row.** Whether the space is there changes nothing about the intent, and the gate has always counted it.                                                        |
| `- [ ]` (nothing after the box)                        | yes     | **no**                 | A scaffold placeholder, not a criterion (`bug-empty-template-checkbox`).                                                                                                          |
| **`-  [ ] x`** (two spaces after the bullet)           | **no**  | **no**                 | **Decided: not a row.** Exactly one space separates the bullet from the box; two spaces is a different (non-list) construct. Kept as-is so unifying the parsers added no refusal. |
| `+ [ ] x`, `1. [ ] x`, `> - [ ] x`, `text - [ ] x`     | no      | no                     | Not a list item whose line starts with the marker.                                                                                                                                |
| ``Use `- [ ] text` `` (the literal inside a code span) | no      | no                     | The marker is not at the start of the line. Prose may show the literal box freely.                                                                                                |
| ``- [ ] wrap it in `- [ ]` when you mean it``          | yes     | yes when unticked      | The row's own text may contain the literal; the marker at line start decides.                                                                                                     |

**Line breaks are part of the grammar.** A row scan walks the ECMAScript **LineTerminator** set, because the gate has always been a `/…/gm` regex and `^` under `m` anchors after **every** one of them — not after `\n` alone. So splitting a body on `"\n"` is not behavior-preserving: the rest of a CR-, U+2028- or U+2029-separated body glues onto the previous line, a criterion the gate refuses on becomes invisible, and a `done` flip the gate is blocking goes through (bug-three-acceptance-parsers-diverging, review F1).

| Byte                                                                                       | Ends a row line? | Why                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `\n` (LF, U+000A)                                                                          | yes              | LineTerminator                                                                                                                                                                                                                                                                                                                                                    |
| `\r` (CR, U+000D)                                                                          | yes              | LineTerminator — and the `\r` half of CRLF, which is why CRLF needs no special case: both LF and CRLF bodies parse identically, because the frontmatter parser tolerates `\r\n`, so the acceptance grammar does too                                                                                                                                               |
| U+2028 LINE SEPARATOR                                                                      | yes              | LineTerminator                                                                                                                                                                                                                                                                                                                                                    |
| U+2029 PARAGRAPH SEPARATOR                                                                 | yes              | LineTerminator                                                                                                                                                                                                                                                                                                                                                    |
| **`\v` VT (U+000B)**, **`\f` FF (U+000C)**                                                 | **no**           | Whitespace but **not** LineTerminators, so `^` under `m` never anchored after them — `- [x] a\v- [ ] b` is ONE row to the gate. Splitting on them invents a refusal the gate never made, and a false refusal wedges a legitimate `done` flip, so do not widen the set by analogy with `\s` — the LineTerminators inside JS's `\s` are exactly the four rows above |
| `\p{Zs}` spaces (U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000) and U+FEFF | no               | Inside JS's `\s`, but not breaks — they stay in the row text. Only space and tab are consumed after the box, so `- [ ]\u00a0x` is a row whose text trims to `x` and still does not gate the flip                                                                                                                                                                  |

### Minimal examples

**Initiative** (may be `in_progress` without assignee)

```yaml
---
type: initiative
status: in_progress
id: launch-mvp
title: Launch MVP
labels: [phase-1]
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Epic** (parent required; may be `in_progress` without assignee)

```yaml
---
type: epic
status: todo
id: auth
parent: launch-mvp
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Story**

```yaml
---
type: story
status: todo
id: story-login
parent: auth
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Task**

```yaml
---
type: task
status: todo
id: task-rate-limit
parent: story-login
labels: [security]
created: "2026-09-03"
updated: "2026-09-03"
---
```

**Bug**

```yaml
---
type: bug
status: todo
id: bug-empty-password-500
parent: story-login
labels: [bug]
created: "2026-09-03"
updated: "2026-09-03"
---
```

Body content after frontmatter is free-form Markdown (context, acceptance criteria, notes). Convention tools treat the body as opaque except for optional H1 title derivation.

### Status examples

```yaml
status: todo
```

```yaml
status: in_progress
assignee: arggon
```

```yaml
status: blocked
assignee: arggon
blocked_reason: Waiting on OAuth app credentials from ops
```

```yaml
status: done
assignee: arggon
```

```yaml
status: cancelled
```

### Tracker layout (v5)

Per [ADR 0012](../adr/0012-tracker-root-layout.md), v5 renames the tracker root
`tasks/` → `ArggonManager/` and moves every product doc under
`ArggonManager/docs/` (adr, specs, plans, explorations, playbooks,
convention/engineering/agents/json-output, plus the docs generated by `init`
such as `tracking.md`). The item schema is unchanged: ids, frontmatter,
statuses and the methodology are exactly as before.

- **Detection (no hard break).** The kernel walks up looking for
  `ArggonManager/.convention.yml` first and falls back to a legacy
  `tasks/.convention.yml`; a legacy tree keeps operating on `tasks/` with its
  docs at `<repo root>/docs/`. `arggon validate` reports the legacy location as
  a `LEGACY_LAYOUT` warning and `doctor` reports the detected layout; both are
  informational, never errors.
- **Migration.** `arggon migrate --layout [--dry-run]` moves `tasks/` →
  `ArggonManager/` and `<root>/docs/` → `ArggonManager/docs/`, rewrites the
  machine-written `x-generated` destination keys, and bumps the file to
  `version: 5`. It is convergent (re-running finishes a half-done migration)
  and idempotent (an already-migrated tree is a no-op), preserves file bytes,
  and **never auto-commits** — review and commit the migration as one change.
- **Reserved path.** `<tracker>/docs/` is the product-docs dir on v5 and is
  never an item container; the item walkers skip it.
- **Versioning disambiguation.** `v4` is the priority field
  ([Priority (v4)](../convention.md#priority-v4)); the layout change is `v5`. A v3/v4 tree on
  the legacy layout stays valid without any data migration.
- **Scope of the migration.** `arggon migrate --layout` moves the whole
  `<root>/docs/` directory into the tracker root (every product doc, assets
  included) and never asks per file; a repository with its own unrelated
  `docs/` tree should reconcile it before or after migrating. Root meta-docs
  stay at the repository root: `README.md`, `AGENTS.md`, `CLAUDE.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `ARCHITECTURE.md`,
  `CHANGELOG.md`. `.github/**`, `.opencode/**`, `.agents/**`, `templates/**`
  (packaged scaffolds), `fixtures/**` and `labs/**` are not product docs and
  do not move either.

### Dependency graph (v3)

Per [ADR 0004](../adr/0004-milestone-deps-v3.md), v3 = v2 + the official `milestone` field ([ADR 0003](../adr/0003-milestone-field.md), quoted `YYYY-MM-DD`) + the dependency fields.

`depends_on` is a list of work-item ids this item waits for:

- Permitted on **all** types; empty or omitted = no dependencies.
- Entries are **ids** (globally unique under the tracker root), not paths; edges between any types and across initiatives are allowed.
- `blocked_by` is a **computed inverse view, never stored** — one source of truth, no sync bugs (the key stays reserved).

`validate` enforces that the dependency graph is a consistent DAG:

| Code                 | Meaning                                       |
| -------------------- | --------------------------------------------- |
| `UNKNOWN_DEPENDENCY` | a `depends_on` id does not resolve to an item |
| `SELF_DEPENDENCY`    | an item depends on itself                     |
| `DEPENDENCY_CYCLE`   | the graph has a cycle (it must be a DAG)      |

Each reported cycle prints one canonical chain — the simple cycle rotated to its
lexicographically smallest member and closed on it — so a given cycle renders
byte-identically under any traversal order. A graph with **several** cycles is
checked by a single depth-first pass, which names the back edges its own forest
closes (deduplicated by member set). That **forest selection** is deliberately
traversal-order dependent and is part of the contract, not a defect: the
acyclic/cyclic verdict and every chain's text are order independent, while which
subset of the graph's cycles a report names is not. Consumers must rely on the
verdict and the per-cycle chains, never on the presence or absence of a
particular cycle in a report (ADR 0004; task-cycle-set-canonical).

Semantics are deliberately **advisory-only** (ADR 0004):

- Dependencies **never block an update**: `arggon update <id> --status done` still works with open dependencies (humans may close out of order; the trail is in git).
- They gate **suggestions and queries** (`arggon next` readiness, board edges) — shipped separately from the schema wave.
- They do **not** interact with the container auto-completion cascade: containment and dependency are two different graphs with two different rules.

CLI surface: `arggon update <id> --depends-on "a,b"` **replaces** the full list (empty string clears; mirrors `--labels`) and `arggon update <id> --add-depends-on c` appends one edge (no-op when already present). Unknown ids fail `update` with an actionable error; the full graph is re-checked by `validate`.

### Priority (v4)

Every item type carries an optional judgment priority — set at filing time and
ranked on by `next` (who owns it: the **Owner** bullet below; see ADR 0009 and
[exploration priority-model-008](../../docs/explorations/exploration-priority-model-008.md)):

```yaml
priority: p1
```

- Values: `p0` (drop everything) | `p1` | `p2` | `p3` — lowercase, exact.
- Omit or `null` = unprioritized; never defaulted by the CLI. In `next`'s
  ranking unprioritized orders with the `p3` tier.
- Unknown values are validate errors (`PRIORITY_INVALID`).
- Set via `arggon create <type> <title> --priority p1` / `arggon update <id>
--priority p2` (clear: `--priority ""`).
- Legacy `pN` labels migrate into the field with `arggon priority migrate`
  (highest label wins, all pN labels removed, non-priority labels kept,
  idempotent, never auto-commits). New code must not use `pN` labels for
  priority — the field is the only official carrier.
- **Owner:** `priority` is the **product owner's** field ([ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md)
  §2, §6.1). A delivery lead _sequences_ delivery — what is built next, in what
  order — and recommends priority changes; the product owner sets the field.
  Nothing in the kernel gates who may write it (any caller may), so this is
  doctrine recorded here because `next` ranks by it and a wave plan must never be
  mistaken for a priority call.

### Saved views (`x-views`)

```yaml
version: 0
x-views:
  my-open-bugs: "type:bug status:todo !assignee:someone"
  this-epic: "parent:cli"
  this-initiative: "ancestor:launch-mvp"
```

- `arggon list --view <name>` resolves the expression and applies it ANDed with the explicit flags and `--filter`; `@me` inside a view resolves exactly like `list --assignee @me`.
- `ancestor:<id>` matches items with `<id>` anywhere in their parent chain (task → story → epic → initiative), composing with the other predicates and `!` negation. It checks the chain only: an item is never its own ancestor (`ancestor:<own-id>` is false), and an unknown id simply matches nothing (no error). `parent:<id>` remains the direct-parent-only predicate.
- Unknown view names fail with the list of known views; an empty `x-views` map fails for any name.
- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace); a scalar `x-views` value, an empty expression, or a duplicate view name is a parse error.

### Technology playbooks (`x-playbooks`)

```yaml
version: 3
x-playbooks:
  max-age-days: 60
```

- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### Tracker hygiene (`x-tracker`)

```yaml
version: 3
x-tracker:
  auto-commit: false
  strict-gate-bins: true
  strict-worktree-writes: true
  product-acceptance: true
  reap-acked-orphans: true
```

- Tracker mutations — `create`, `comment`, `adopt` (task + story files), `cleanup --prune` (cleared `worktree_path` records) — commit their own mutated files by default as `chore(tasks): <verb> <id>` (verbs: `created`/`commented`/`adopted`/`pruned`). Staging is surgical (`git add -- <path>` only): the user's pre-existing dirty files are never swept into the tool's commit. Mutated paths matched by `.gitignore` are skipped and reported in the additive `commit.ignored` array — never force-added; one ignored path would otherwise abort `git add` after staging the rest, leaving a dirty index (bug-init-ignored-artifacts-dirty-commit).

- Skipping is never a failure: non-git trees, a missing `git` binary, or a no-op commit (nothing staged) are reported (`--json` additive `commit: { skipped: <reason> }`) and the command succeeds — the CLI works without git.
- `x-tracker.strict-gate-bins: true` arms the strict start gate (task-start-gate-strict-mode): `start --worktree` then HARD-FAILS the claim commit when the dependency-preparation receipt (`gateBins`, bug-start-worktree-npm-ci-claim) reports any declared gate binary resolving from OUTSIDE the worktree — `external` (an install above the worktree), `path` (a sibling checkout's or global `.bin` on the invoking PATH, the silent-masking flavor), or `missing` (resolves nowhere; the no-link-farm flavor). The refusal happens before the claim update (the item file is not mutated), the worktree is kept, and the failure names each offending bin with its observed source plus the exact remediation (`npm ci` in the worktree, then re-run `start --worktree` to attach). An empty `gateBins` report (nothing declared exposes a bin) never violates the gate — strict mode never invents a violation the report-only probe did not observe.
- **Readiness clause bound (task-cli-start-remediation-tail-clipped-on-human-channel).** When a start failure reports the gate-bin readiness observation to a HUMAN, it names as many bins as fit and counts the rest (`; and N more bins not resolving inside it`). The bound is **derived, not a constant**: every mandatory clause — the failing step, the kept worktree path, the generic fix, the exact `npm ci` fix, the attach re-run, the discard hint and the raw error — is reserved first, and the names are filled into what is left of the human channel's 2000-char (`MAX_HUMAN_ERROR_CHARS`) line. So a deep-sibling-path checkout names fewer names than an ordinary one (measured on this repo's own shapes: 2 of 8 at ~317 chars an entry, 7 of 8 at ~117), while every actionable clause always survives whole — **for as long as the reserved block itself fits the line**. When it does not (a ~700+ char worktree path: the path is named in the kept note, the exact fix and the discard hint, so the mandatory clauses alone pass 2000), the report takes the OVER-BUDGET shape instead (bug-gatebin-budget-reserved-block-can-exceed-clip): a one-line truncation notice is composed FIRST (`[truncated: the worktree path leaves no room for the whole message inside the 2000-char human clip; the tail is clipped there — the full message and the bin evidence ride the --json error]`), so the cut is named rather than left as a silent `…`; the exact `npm ci` fix leads the clauses after it (the only thing composed ahead of it is the notice), the readiness fill is REFUSED (the minimum-one-name override yields rather than push a name into a window that cannot show it), and the complete message plus the complete observation ride `--json` (`error.message` raw, `readiness.gateBins` unbounded). This is NOT the same depth as the two refusals above, which name every offending bin because their remedy is inside the message and the evidence is the tail; here the evidence has a caller-appended clause after it, so it is the one thing that can be bounded. Nothing is lost for a machine: the `--json` failure envelope carries the complete observation as `readiness` (`{ hasInstall, gateBins }`), the same cap + count + array shape as `missingDependencies` / `missingDependenciesTotal`.
- **Fresh-worktree install gate (bug-start-install-ordering):** independent of the flag above, a `start --worktree` that **created** the worktree must leave a gate-usable install — or fail itself, before the claim update, with the named cause. Whenever the preparation receipt reports any gate binary resolving outside the worktree, such a start refuses the claim BEFORE the claim write (the item file is not mutated; `claimCommit.reason: "fresh-worktree install gate refused"` on the native surface), names each offending bin with its observed source, the bounded preparation log (`prepSteps`/`steps`: which prep path ran — link farm created / reused / skipped-and-why, per-workspace build decisions), and the remediation (`npm ci` in the worktree, or `npm install` in a stale/missing primary, then re-run `start --worktree` to attach); the worktree is kept. The same observation as the strict gate with a stronger default consequence: attach re-runs keep the report-only receipt unless `x-tracker.strict-gate-bins` is armed, so the fix-then-attach remedy stays possible. The empty-`gateBins` carve-out is unchanged — a project with no dependency-needing gate may still have no install and commit the claim.
- **Claim stamp and single-writer detection (task-single-writer-worktree-enforcement, exploration 017 F12; decided in [ADR 0019](../adr/0019-worktree-runtime-isolation.md) decision point 4):** every `start --worktree` writes a claim stamp — `arggon-claim.json` inside the worktree's **git dir** (never in the work tree: it cannot dirty `git status`, block `git worktree remove`, or need a cleanup step) — recording the owning identity (the calling session id on the native tools, the resolved assignee on the CLI), the item, the branch, the claim timestamp, and the surface. On an **attach**, the previous stamp is read before it is replaced: a DIFFERENT identity plus tracked files whose mtimes are NEWER than the stamped claim is reported as a named, bounded warning (`claim.foreignWrites` on both surfaces; `note: single-writer check — …` in the human CLI output). The observation means "written during the stamped owner's window, by the owner or by a concurrent writer — the attacher cannot tell which"; it is deliberately bounded (one `git status --porcelain` plus one `stat` per dirty path, at most 10 paths named with an exact total — the porcelain probe must return the line RAW: its leading status columns are positional, so a trimmed probe silently reads every path one character off and disarms the detection) and best-effort (a missing or corrupt stamp — pre-feature worktrees, a plain directory — degrades to no detection and never blocks the claim). Detection covers the UNCOMMITTED collision window; foreign work that was already committed is history, not a live second writer. A fired detection never re-stamps the worktree: the stamped owner stays, so every retry re-detects against the same evidence and the strict gate cannot unlock itself. When that owner is gone (crashed session), recovery is the deliberate take-over below, or the documented manual step — confirm no live writer, then `rm "$(git -C <worktree> rev-parse --absolute-git-dir)/arggon-claim.json"`. A stamp is also reaped when its CLAIM is released: `arggon cleanup --release <id>` (native `tools.arggon.cleanup({ release })`, bug-unclaim-leaves-worktree-record-without-reaper) removes the recorded worktree, deletes its branch, reaps a start-created `.arggon.env` and the stamp, and clears the `worktree_path` record — the inverse of `start --worktree` for a claim that was dropped. Unclaiming (`update --status todo`) never releases on its own: `update` is frontmatter-only (it is the call that CLEARS a `worktree_path` record), so it reports the surviving footprint as the additive `claimFootprint` receipt (`{ worktreePath, release: { cli, native } }` — no `branch`: the unclaim already cleared the item's field, and the release reads the branch from the worktree itself) and names the release path. A release is refused while the item is still claimed — **unconditionally**; `--take-over-worktree` / `take_over_worktree` does NOT bypass it (a re-claimed item has a live owner, and nothing durable here records an override). It is also refused when the stamp names another identity whose window shows a live writer, and when the worktree carries uncommitted or untracked content (`blockingPaths`/`blockingTotal`) — that last refusal happens during classification, BEFORE anything is reaped, so a failed release leaves the stamp and the env file standing and the next attempt keeps its evidence; the stamp itself is reaped only AFTER an observed removal. `--take-over-worktree` / `take_over_worktree` is the audited hatch for a presumed-dead stamped owner on an UNCLAIMED item and the only thing that forces the removal; without a release it is refused.
- **Deliberate take-over of a dead owner (task-strict-attach-dead-owner-hatch):** when the stamped session is gone, `start --worktree --take-over-worktree` is the designed recovery. It applies ONLY to an attach whose detection fired (same identity, no newer tracked writes, or no prior stamp: nothing to take over, the flag is a no-op and the run is byte-identical to the default), re-stamps the worktree with the calling identity, and records a dated take-over: on the receipt as `claim.takeOver` (`{ at, by, replacedIdentity, replacedClaimedAt, replaced, files, total }` — the replaced stamp in full, plus the same evidence the detection saw) and in the new stamp as a bounded `takeovers` chain (the newest 5 entries, carried forward by every later write, one entry per taker). The fired evidence deliberately moves out of `claim.foreignWrites` on a take-over, so the armed strict gate below is resolved by the authorized replacement and needs no special case; nothing is hidden — the same owner, claim time and newer files are in the receipt, the chain is in the stamp, and the CLI prints `note: single-writer take-over — …`. The flag is explicit and opt-in, never time-based: a stale-stamp window was rejected because it silently steals a long-but-live session's dirty work. An unwritable git dir degrades the take-over to an unrecorded one (`stamped: false` plus a warning) and never blocks the claim. It requires `--worktree`; without it the flag is rejected (`START_FAILED`), because a plain start writes no stamp to take over.
- `x-tracker.strict-worktree-writes: true` arms the single-writer gate: the SAME observation — the worktree stamped by a different session, with tracked files modified after that claim — HARD-FAILS the attach before the claim update (the item file is not mutated; `claimCommit.reason: "strict worktree-write gate refused"` on the native surface), naming the stamped owner, the claim time, and the newer files. The worktree is kept, and the remediation is coordination (the stamped session may simply be mid-task — that is the F12 incident seen from outside), not deletion: re-run `start --worktree` to attach once resolved. The refusal message names the two dead-owner recovery paths, both conditional on confirming the stamped session is gone: the audited `start --worktree --take-over-worktree`, then the manual `rm "$(git -C <worktree> rev-parse --absolute-git-dir)/arggon-claim.json"`. As with `strict-gate-bins`, the flag changes the CONSEQUENCE, never the observation; the owner's own re-attach (same identity, stamp refreshed) never fires either gate.
- `x-tracker.product-acceptance: true` arms the **product-acceptance record** ([ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md) §4): whether a container's work was accepted is written as an ordinary comment on the item — `accept: approve` or `accept: changes-requested` (optionally followed by a short scope), then the evidence list — so the record is human-written prose, never schema, and no flag writes it. Arming is the act of saying the project HAS a product owner and wants the record: a project without one is compliant by default and is never nagged about a role it does not have. **Report-only either way** — no transition consults it, no command refuses because of it, and CI never fails on it; an acceptance is attributed (`self-accepted` when its author is the container's own assignee), never authenticated, because the tracker has no identity layer.
- `x-tracker.reap-acked-orphans: true` arms reaping of **acknowledged orphans** (task-adapter-orphan-reaping). An _orphan_ is a destination recorded in `x-generated` whose `template:` is absent from the installed arggon version — init can neither refresh nor keep generating it, yet the file is on disk (and, under an auto-discovered seam directory, still dispatchable). `arggon doctor --agents` reports each one as `orphaned`; `arggon init` then **deletes** it only when it is inside the repo root, is a regular file (never a directory, never a symlink), was recorded by no newer arggon (a downgrade reports instead of deleting), and its bytes are unchanged since the recorded baseline. Bytes that DIFFER are refused always: that is a known edit, and your edits are never deleted. The middle case — **acknowledged** and unchanged — is refused by default and reaped only when this flag is armed: `arggon adopt --ack` acks every entry and re-records its checksum from disk, so for an acknowledged entry a matching checksum proves only _unchanged since the ack_, never _arggon wrote exactly these bytes_ — provenance cannot separate "unedited" from "curated, then acked". Arming is how an adopted adopter clears a dead agent file across a release that renamed its template (ADR 0021 §6.2a′ gates the agent rename on reaping); the default is the side that cannot lose content. An armed reap still names the ack in its reason, so the record says a sanctioned file was removed deliberately.

- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### Import type mapping (`x-import`)

```yaml
version: 3
x-import:
  label-types:
    bug: bug
    enhancement: task
```

- Label-based type mapping: an issue whose labels contain a configured label imports as that type; the **first of the issue's labels with a mapping wins** (issue label order). Labels without a mapping keep the `task` default.

- Mapped types must be **leaves**: only `task` or `bug` are accepted at import time. A mapping to a container (`story`, `epic`, `initiative`) fails the import with an actionable `IMPORT_FAILED` error — stories are containers, and imported leaves all live under the same target story. Values must still be valid work-item types; anything else is a `.convention.yml` parse error.
- Mapped bugs go under the **same parent story** as tasks (bugs live only under stories in v0/v3 — never under epics). The target id follows the mapped type — `task-issue-<n>` or `bug-issue-<n>` — so idempotency is per (issue, mapped type): changing the mapping can re-import an issue under the new id.
- The GitHub issue number is recorded on every imported item regardless of type (`issue: <n>`, so `start --open-pr` still emits `Closes #N`).

- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### Worktree bootstrap (`x-worktree`)

```yaml
version: 3
x-worktree:
  post-start: "npm ci"
  post-start-shell: "login"
  env: false
  services: myapp
```

- When enabled, `start --worktree` writes a gitignored, dotenv-style `.arggon.env` at the worktree root carrying the worktree identity (`ARGON_ITEM`, `ARGGON_WORKTREE_ID` = `<repo>-<item-id>`, `ARGGON_WORKTREE_PATH`, `ARGGON_WORKTREE_BRANCH`) and per-OS suffixed state/cache dirs (`ARGGON_STATE_DIR`/`ARGGON_CACHE_DIR` — XDG on Linux, `~/Library` on macOS, `%LOCALAPPDATA%` on Windows, each + `/<repo>-<item-id>`, created `mkdir -p`), seeds a primary `.env` into the worktree copy-if-absent (never overwritten, never interpreted), and reports the read-only `git check-ignore .arggon.env` probe in the additive `env` receipt field. Nothing is ever overwritten (an existing `.arggon.env` or `.env` is left byte-identical), env files are never staged or committed, and the preparation is best-effort: `written: false` with a `warning` never blocks the claim. `arggon init` generates a `.gitignore` that ignores `.arggon.env` on fresh scaffolds; `cleanup --prune` reaps a start-created env file before removing the worktree.

- **`services` (ADR 0019 layer 2, task-cleanup-declared-services):** the declaration that arms `cleanup --prune` to tear down a worktree's per-worktree Compose project (pattern: [worktree-services.md](../worktree-services.md)). Safety by construction: **the kernel never invokes Docker unless this key declares services** — absent, `false`, or an unparseable convention file keep cleanup entirely report-only. The value names the project:
  - `services: true` — the per-worktree Compose project is named exactly the worktree id `<repo>-<item-id>` (compose `name: "${ARGGON_WORKTREE_ID:-}"`); cleanup reaps `<repo>-<item-id>` (lowercased).
  - `services: <base>` — the declared base project name of the adopter pattern (`name: "<base>${WORKTREE_SUFFIX:-}"` with `WORKTREE_SUFFIX="-<repo>-<item-id>"`); cleanup reaps `<base>-<repo>-<item-id>` (lowercased). Validated at parse time against Compose's documented project alphabet (`[A-Za-z0-9][A-Za-z0-9_-]*` — anything else is a convention parse error).
  - Reaping runs `docker compose -p <project> down -v --remove-orphans` (volumes included, orphans swept) **before** `git worktree remove`, only for worktrees that otherwise qualify (done/cancelled + merged branch), with the project derived from the worktree directory's basename — never from a scan. A project that is already gone is a graceful no-op (the command exits 0 with a "No resource found to remove" warning); an absent `docker` CLI degrades the whole run to report-only (`compose.dockerUnavailable` in `--json`, a `note:` line in human output); a failed teardown is a per-item failure on both the `pruned[]` (`action: "failed"`) and `failures[]` surfaces and never blocks the worktree removal or aborts the run. An adopter-run project that the convention does not declare is never touched.

- The hook runs **only when `arggon start --worktree` creates a new worktree** — the sanctioned spot for per-checkout bootstrap like `npm ci` (linked worktrees do not share `node_modules`). Attach re-runs (idempotent re-starts of the same item) never re-run it.
- Execution: `sh -c <command>` with cwd = the worktree root, after the claim commit / push / PR steps have succeeded.
- **The start-created dependency link is removed before the hook runs.** Before the claim commit, `start` links the primary checkout's `node_modules` into the worktree when the worktree lacks one (so the pre-commit gate can run; see the `start --worktree` guidance in [agents.md](../agents.md)). When the worktree carries its own copy of a workspace package, the install is a per-worktree link farm and that copy is built (the package's own `build` script) and resolved worktree-locally; a copy that could not be built stays on the primary's install and is reported in `linkedWorkspaces`. A start that **created** the worktree also enforces the fresh-worktree install gate there: if the prepared install cannot provide a declared gate binary inside the worktree, the claim is refused before the claim write (see the `x-tracker.strict-gate-bins` section above — bug-start-install-ordering), so a hook configured here runs only for starts whose preparation left a gate-usable install. Immediately before a configured `post-start` hook runs, that install is removed, and it is re-created only when the hook leaves the worktree without `node_modules` (the re-link outcome is reported: `postStartRelink`, `relinked`/`failed`). This keeps the canonical `npm ci` example safe: npm's reify step removes a symlinked `node_modules` and can empty the **primary** checkout's install through it. The hook therefore never sees a symlink to the primary install; do not create one manually before running `npm ci` either — if a worktree's `node_modules` is a symlink to the primary install, remove the link (`rm <worktree>/node_modules`) before `npm ci`.
- **Environment footgun (task-post-start-env):** the hook inherits the environment of the process that ran `arggon` — not your interactive shell. Toolchains installed outside that PATH fail with "command not found" even though they work in a terminal (rustup installs to `~/.cargo/bin`; mise/asdf shims are similar). Workarounds, in order of preference:
  1. Use absolute paths in the hook: `~/.cargo/bin/cargo check`.
  2. Source the toolchain env inside the hook: `source ~/.cargo/env && cargo check`.
  3. Set `x-worktree.post-start-shell: "login"` to run the hook via your login shell (`$SHELL -lc`), which sources your profile files (`~/.profile`, `~/.cargo/env`, ...) so the toolchain lands on PATH.
- Failure is reported, never fatal — the worktree exists and the claim stands. Human output prints `(hint: hooks inherit the environment of the process that ran arggon — use absolute paths, or set x-worktree.post-start-shell: "login") post-start failed: <command> → <stderr tail>` (last 3 stderr lines, hint FIRST — the hint leads because the human channel clips an error line head-kept at 2000 chars and a hook's stderr tail is unbounded); the command still exits 0. `--json` reports the additive `postStart: { command, ok: false, error }` field (success: `postStart: { command, ok: true }`; no config: the field is absent).
- The per-invocation `--no-hook` flag skips the hook for that start, regardless of config.

- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### Issue round-trip (`x-github`)

```yaml
x-github:
  issue-roundtrip: true
```

- When enabled, flipping such an item to `done` closes the linked GitHub issue via `gh` (best effort, never blocking the flip); `arggon start <id> --open-pr` appends `Closes #N` to the PR body so GitHub also closes the issue on merge.
- `--json` reports the additive `issueRoundtrip` field on the update: `{ closed: true, issue: <number>, repo: "owner/name" }`, or `{ closed: false, issue: <number>, skipped: <reason> }` when the close degraded (gh missing/unauthenticated, non-GitHub origin, gh failure) — the flip itself always succeeds, and skips are warned on stderr.

- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### Friction opt-out (`x-friction`)

```yaml
version: 5
x-friction: false
```

```yaml
version: 5
x-friction:
  capture: false
```

- **Opting out gates capture, never discoverability** (ADR 0024 §3). `false` writes no record and renders an empty report with `optedOut: true`. It does **not** remove the marked `arggon:friction-trigger` block from the generated agent files and does not hide `arggon friction` from `--help`: an adopter who opted out and later wants the channel back must be able to find it, and an agent that cannot see the rule cannot tell the user it exists.

- The feedback itself never enters the tracker: `arggon friction` appends to a local, append-only log outside the work items, redacted at write, and the resulting `arggon create` stays a human decision.
- `arggon doctor --json` reports the trigger per managed agent file in the additive `friction` block (`triggerPresent` / `triggerVersion`), which is what separates _trigger absent_ from a template that moved for unrelated reasons.

- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### Generated-doc provenance (`x-generated`)

```yaml
version: 3
x-generated:
  AGENTS.md:
    template: "docs/AGENTS.md"
    checksum: "sha256:0f3a…"
    arggonVersion: "0.0.0"
    generatedAt: "2026-09-12T10:30:00.000Z"
  .agents/skills/arggon-cli/SKILL.md:
    template: "skills/arggon-cli/SKILL.md"
    checksum: "sha256:91bc…"
    arggonVersion: "0.0.0"
    generatedAt: "2026-09-12T10:30:00.000Z"
```

- Every generated doc carries a visible marker as its **first line** — `<!-- arggon:generated template="<template-relative-path>" -->` — so authorship is visible in any diff or editor; the `template` inside the marker is relative to the template root (`AGENTS.md`), while the state entry records the package-root-relative source (`docs/AGENTS.md`).
- `checksum` is the sha256 of the exact written bytes (marker included). It distinguishes "arggon-generated and untouched" from "edited by the adopter": a hand edit may keep the marker (harmless) but never the checksum.
- Re-running `arggon init`: destination absent → generate (`created[]`); entry flagged `acknowledged: true` → skip, never touch (`skipped[]`, regardless of hash — acknowledged baselines are adopter-owned content, see `arggon adopt --ack` below); file checksum matches the recorded one → untouched → silently regenerate from the current template and refresh the entry (`updated[]`); checksum differs, or the file exists with no entry (pre-provenance files) → adopter-modified → skip by default (`modified[]` + `skipped[]`, never overwritten, even with `--force`); `arggon init --backup` first moves the modified file to `backup/<YYYY-MM-DD>/<dest>` and then regenerates (`backedUp[]`).
- Checksums are refreshed in exactly two sanctioned ways: `arggon adopt --ack` (the sanctioned adoption-sweep edits become the new baseline) and init re-runs (untouched docs); any other edit keeps the file adopter-modified. Exception (bug-stale-vendored-plugin-copy): the vendored OpenCode plugin artifacts (`.opencode/plugins/arggon/index.ts`, `tui.tsx`) are gitignored, per-checkout DERIVED copies of the committed bundle — never adopter-owned — so a checksum mismatch on those destinations re-vendors the committed bundle (decision `updated`, reason `re-vendored`) and refreshes the entry instead of reporting adopter-modified; skill copies (`.agents/skills/**`) are tracked in an adopter tree (the shipped `.gitignore` does not exclude them) and keep the normal decisions there, while the seam repo's own checkout gitignores its copies (single committed source) and its `cli/src/provenance-audit.test.ts` requires each skill row to equal the render of the committed source — a skill copy is a pure function of that source, so the row is checkable with no copy on disk, and `npm run skills:sync` re-records it (bug-skill-source-edit-leaves-ledger-stale). `adopt --ack` also sets `acknowledged: true` on each acked entry (bug-ack-baseline-regen-loss): the acked checksum equals the adopter's edited content, not the template render, so acknowledged entries are never regenerated by later init re-runs — they are yours.
- State is machine-written: unknown nested fields are ignored, and incomplete entries never fail a command — they simply never match, so the file reports as adopter-modified (the conservative default). `arggon doctor` reports `managed`/`untouched`/`modified`/`acknowledged`/`stale`/`missing` counts from this section.
- The section is spliced into the tracker `.convention.yml` without disturbing sibling content (comments, `branch_patterns`, `x-views`, `x-playbooks`); `arggon init --force` carries the section across a re-scaffold.
- The key is namespaced (`x-*`), so older tools ignore it per the [core extension policy](../convention.md#extension-namespace).

### `.convention.yml` syntax arggon reads (and what it refuses)

`.convention.yml` is YAML, and arggon reads it with a **line** parser — the kernel has no YAML dependency and must run anywhere `node` runs. The two agree on the block-style mapping form every example in this document uses, and the parser is deliberately tolerant of what an adopter writes naturally:

- **A trailing comment.** `allow-steal: true # armed` is the boolean `true`, exactly what YAML says it is. A `#` starts a comment at the start of a line or after whitespace; one inside a quoted scalar (`hot: "status:todo # tagged"`) or with no whitespace in front of it (`hot: status:todo#tag`) is content.
- **A block scalar.** `post-start: |` (literal) and `>` (folded), each with an optional chomping indicator and an optional explicit indentation, in either order:

  ```yaml
  x-worktree:
    post-start: |
      npm ci
      echo ready
  ```

  A literal block keeps its line breaks (`|` leaves exactly one trailing break, `|-` none, `|+` all of them); a folded block turns a single break between two ordinary lines into a space and keeps a blank line as a break. Inside the block a `#` is content and a `:` is content — neither is a comment nor a nested key. The decoded text is literal: it is never re-read as a quoted scalar.

- **A quoted key.** `"x-tracker":` is `x-tracker`; `'allow-steal':` is `allow-steal`. Keys are decoded wherever a key is read, nested ones included.

What the parser refuses, it refuses **by name**: flow style (`x-tracker: {allow-steal: true}`), anchors, aliases and tags are all valid YAML that this reader does not handle, and the parse error names the construct instead of leaving it to guess. That matters because `init --force` answers a file it cannot read by re-deriving it from the scaffold — so an error an adopter can diagnose is the difference between fixing a typo and losing their configuration (bug-convention-parser-rejects-valid-yaml-force-rescaffolds).

One strictness is a safety property, not a limitation. The boolean options (`allow-steal`, `auto-commit`, `strict-gate-bins`, `strict-worktree-writes`, `reap-acked-orphans`, `product-acceptance`, `issue-roundtrip`, `x-worktree.env`, `x-generated.acknowledged`) accept only the exact tokens `true` and `false`:

- `yes` / `on` / `no` / `off` are YAML-1.1 spellings; YAML 1.2 reads them as the **string** `"yes"`, so arming from one would be reading a flag out of a string. They are parse errors.
- A **quoted** boolean (`allow-steal: "true"`) is also the string `"true"`, so it is a parse error too — accepting it is precisely how an armed gate reads as unset.

Widening the parser for comments, block scalars and quoting therefore never widens what an arming flag accepts.

Unknown keys, at either level, keep the forward-compatibility behaviour above: ignored, never an error.

## Templates

Copy-paste stubs for each v0 work-item type live in [`templates/`](../../../templates/). Fill placeholders and place the file under the tracker root per [Folder layout](../convention.md#folder-layout). Future CLI `arggon create` should copy from these templates.

| Type       | Template                                                      |
| ---------- | ------------------------------------------------------------- |
| Initiative | [`templates/initiative.md`](../../../templates/initiative.md) |
| Epic       | [`templates/epic.md`](../../../templates/epic.md)             |
| Story      | [`templates/story.md`](../../../templates/story.md)           |
| Task       | [`templates/task.md`](../../../templates/task.md)             |
| Bug        | [`templates/bug.md`](../../../templates/bug.md)               |

Templates default to `status: todo`, omit `assignee` (never an empty string), and omit `blocked_reason`. Dates are quoted `"YYYY-MM-DD"` placeholders.

## Sample tree

See [`fixtures/tasks-valid/tasks/launch-mvp/`](../../../fixtures/tasks-valid/tasks/launch-mvp/) for a small valid v0 example (initiative → epics → stories → tasks/bugs), plus the tracker `.convention.yml` in the same fixture.
