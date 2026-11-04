# Agent runtime and integration reference

Layer: **reference**. Read only for installation, client wiring, worktree preparation or a runtime refusal; start with [the operational core](../agents.md).

## Installation and upgrades

Upgrading is non-destructive for agents too: an agent's edits to a generated doc are respected on every re-run — `arggon init` refreshes untouched docs quietly, skips modified ones (listed in the command's JSON output) rather than clobbering them, and archives the originals under `backup/<date>/` first when run with `--backup`. The one thing `init` deletes is an **orphan** — a generated destination whose template this arggon version no longer ships (so it can neither be refreshed nor kept generated), and only when its bytes are still exactly as arggon wrote them: an edited or acknowledged orphan is reported and kept, never removed (see [Reaping orphans](#orphaned-destinations-what-init-reaps-and-when)).

#### Agent seams: `arggon init --agents` / `--no-agents`

`arggon init` also materializes the per-client **adapter seams** (the OpenCode config + `.opencode/agents|commands` + vendored plugin, the `.zcode-marketplace/` bundle, the `.claude-marketplace/` bundle plus the `CLAUDE.md`/`.mcp.json` pair). Adapters are **enhancers**: docs + CLI alone remain a complete methodology, so an absent or failing adapter never bricks the workflow, and the kernel stays the enforcement of record ([ADR 0020](../adr/0020-methodology-first-productization.md), [spec §S2](../specs/spec-methodology-adapters-017.md)).

- `arggon init --agents <opencode,zcode,claude>` materializes exactly those seams; `--no-agents` materializes none (docs + CLI only). With no flag the selection is every **detected** agent, from the tree's own markers; a tree with **no** marker at all (a fresh scaffold) selects every known agent, so the pre-flag default seams are never silently dropped from a brand-new tree — narrow an existing tree with `--agents`.
- **Selection never deletes.** An unselected seam is simply not generated; nothing on disk is removed, and an adopter-edited generated file is still skipped rather than overwritten. Re-running with a wider `--agents` list materializes the missing seams; that is how you add an adapter later. (Reaping an _orphan_ is not selection — see below.)
- An **unknown agent name is refused by name** (`INIT_FAILED`, nothing written) — a typo must never silently install a different seam than you asked for.
- `--json` gains an additive `adapters` block: the resolved `selection` (`mode`, `known`, `detected`, `selected`, `reason`) plus one row per adapter destination — `written`, `replaced` (`--backup` archived the original and regenerated it) or `skipped` — with its reason and honest `counts` that sum to the total. `--dry-run` reports the identical block from the identical plan.
- `arggon doctor --agents` is the mirror image (report-only): per agent, every adapter file as `present` / `acknowledged` / `acknowledged-drifted` / `adopter-edited` / `stale` / `missing` / `unverified` / `orphaned`, plus that agent's capability-matrix gap rows. Each status names what `init` would do with the file; `adopter-edited` and the acked statuses are your bytes (skipped unless `--backup`), only `stale` is one `arggon init` would actually refresh, and `orphaned` is the one a single `arggon init` would **delete** — with the per-file verdict (`reap.action`) saying whether it would. Gap rows stay advisory everywhere. (The derived vendored plugin copies are never `adopter-edited`: init re-vendors them, so the `opencode` line's `vendored plugin current`/`STALE` verdict is the one to read there.)

#### Orphaned destinations: what `init` reaps, and when

`init` never deletes a file it did not generate — with **one** exception, because a release that drops or renames a template would otherwise strand its destination forever, and a stranded file under `.opencode/agents/` is still **dispatchable**. An **orphan** is a destination recorded in `x-generated` whose `template:` is absent from this arggon version: the recorded provenance is the whole detection mechanism, so no new state is needed.

**`init` DELETES** an orphan when all of these hold: it is inside the repo root · it is a regular file (never a directory, never a symlink) · it was recorded by no **newer** arggon than the one running (a downgrade reports instead of deleting) · and its bytes are **unchanged since the recorded baseline** — byte-identical to the recorded checksum.

**`init` REFUSES and names** it in every other case: an edit since that baseline (yours — never deleted), a downgrade, a destination outside the repo root, a directory or symlink, or a destination not on disk.

**The one middle case — an ACKNOWLEDGED orphan — is refused by default and needs one opt-in flag.** Read this before "fixing" it, because the reasoning is not obvious:

- `arggon adopt --ack` acks **every** `x-generated` entry **and re-records its checksum from the on-disk bytes**. So for an acknowledged entry, "matches the recorded checksum" proves only **unchanged since the ack** — _not_ "arggon wrote exactly these bytes". A file you **curated and then acked** matches too, and **no recorded state can tell the two apart** (the generated marker survives hand edits as well). That is the whole reason this case is not automatic: deleting it could destroy your curated content.
- The flag is `x-tracker.reap-acked-orphans: true` in `ArggonManager/.convention.yml` — the same default-refused shape as `x-tracker.allow-steal`. Absent or `false`, an acknowledged orphan is **never** deleted: `init` reports it in `reapRefused[]` with a reason naming both routes out (delete it by hand now, or arm the flag for future runs). Armed, the acknowledged+unchanged case reaps like any other, and the reason still names `(acknowledged baseline, adopt --ack)` so the record shows a sanctioned file was removed **deliberately**.
- Bytes that **differ** are refused whether or not the flag is armed: that is a known edit, not an unknowable one.
- Why opt-in rather than refuse-always: the agent rename ([ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md) §6.2a′) gates on reaping, and a stranded `.opencode/agents/arggon-*.md` stays **dispatchable**. Refusing outright would push that cleanup onto exactly the repos that adopted properly; the flag gives them the choice, with a default that cannot lose work.
- Run `arggon doctor --agents` **before** `arggon init` when upgrading across a rename: it shows every orphan, whether `init` would reap it, and why.

Reaping is never silent: `--json` carries `reaped[]` and `reapRefused[]` (their own action family, never folded into the create/replace/skip counts) and human output prints one line per file. `init --dry-run` previews both without writing. A reaped destination loses its `x-generated` entry in the same run and the removal rides the auto-commit, so a later `init` reaps nothing and a committed tree never keeps provenance for a file that is gone.

## Worktree mechanics

#### Worktree in the claim (`start --worktree`)

The manual worktree step (`git worktree add ../<repo>-<id> -b <branch>`) can be folded into the claim: `arggon start <id> --worktree --assignee <login>` claims the item, creates (or attaches to) the worktree at `../<repo-name>-<id>`, and runs the claim commit / push / optional `--open-pr` inside it, recording the path on the item's `worktree_path` field.

Before the claim commit it prepares the worktree for the project gate:

- **Linked installs.** When the primary checkout has a `node_modules` and the worktree does not (a fresh worktree never does), start links the primary install in — best-effort, reported as `linkedNodeModules` in `--json` and on stdout — so a dependency-needing pre-commit gate (`npm run arggon -- validate`) runs in the fresh worktree with no manual symlink dance.
- **Workspace packages become a link farm.** When the worktree carries its own copy of a workspace package (here `@arggondev/lib`), the install is a per-worktree **link farm** — a real `node_modules` directory whose entries link the primary's packages — or a bare symlink to the primary install when the worktree shadows no workspace package. That copy is built with the package's own `build` script before the claim commit and resolved worktree-locally (printed on stdout). The build's exit is honored: a failed build never flips, so it falls back to the primary's copy even when it still emitted the entry; builds are skipped when the install cannot consume them (a bare symlink has no farm to flip, so an attach re-run does not rebuild). A local copy that could not be built stays on the primary's install and is named in `linkedWorkspaces` (`--json` + stdout).

#### Readiness reporting (`manifestCoverage`)

**A linked install is only a mirror of the primary's, so it is only as current as that install**: a dependency declared in `package.json` after the primary's last `npm install` cannot be resolved from any worktree. Preparation reports that as `manifestCoverage: "stale"` with the names in `missingDependencies` (sorted, capped; `missingDependenciesTotal` is the full count) and `ready: false`, instead of reporting the mirrored install as ready.

- `satisfied` means every declared top-level `dependencies`/`devDependencies` name resolves through the install on the worktree's resolution path — presence only: no version, no transitive walk, and `optionalDependencies` are excluded because being absent is what they allow.
- `unknown` means nothing was compared (no install, an unreadable manifest) — it is never `satisfied`.
- The signal is informational: a stale mirror still produces a usable, linked, claimed worktree.

**Remedy: re-install the primary checkout (`npm install` _in it_ — never `npm ci` through a link to it) or give the worktree its own install (`npm ci` in the worktree, e.g. via `x-worktree.post-start: npm ci`).**

#### Install hygiene

- Start never commits the install (the claim commit stages only the item file) — but stage explicit paths, never `git add -A`.
- The install is removed before a configured `x-worktree.post-start` hook runs (so the canonical `npm ci` bootstraps a real install instead of reifying through it and emptying the primary checkout) and re-created only when the hook leaves no `node_modules` (the re-link outcome is reported: `postStartRelink: "relinked" | "failed"` — never swallowed).
- Hooks are never bypassed (`--no-verify` is never passed).

#### Fresh-worktree install gate (bug-start-install-ordering)

A start that **created** the worktree must leave a gate-usable install — or
fail itself, before any claim commit, with the named cause. Whenever the
preparation leaves a gate binary resolving outside the worktree (`external`,
`path`, or `missing`), the claim is refused before the claim update with the
offending bins, the bounded `prepSteps` log (which prep path ran: link farm
created / reused / skipped-and-why, per-workspace build decisions), and the
`npm ci` fix — no flag required. Attach re-runs keep the report-only receipt
(or the `x-tracker.strict-gate-bins` refusal when armed), so the fix-then-
attach remedy stays possible, and an empty `gateBins` report (nothing declared
exposes a bin) never violates the gate. The preparation log rides the CLI
`--json` envelope (`prepSteps`) and the native `preparation` payload (`steps`);
a fresh worktree whose item file is unexpectedly clean at claim-commit time is
a named error, never a silently skipped commit.

#### Worktree env contract (`.arggon.env`)

Every `--worktree` checkout carries a portable runtime environment (spec
[worktree-env-contract-016](../specs/spec-worktree-env-contract-016.md)): start
writes a gitignored, dotenv-style `.arggon.env` at the worktree root with the
per-worktree identity — `ARGON_ITEM` (the name the OpenCode plugin already
correlates sessions with, deliberately un-prefixed), `ARGGON_WORKTREE_ID`
(`<repo>-<item-id>`), `ARGGON_WORKTREE_PATH`, `ARGGON_WORKTREE_BRANCH`, and
`ARGGON_STATE_DIR`/`ARGGON_CACHE_DIR` (per-OS state/cache bases — XDG on
Linux, `~/Library` on macOS, `%LOCALAPPDATA%` on Windows — suffixed with the
worktree id, created `mkdir -p`). A primary `.env` is seeded copy-if-absent
(never overwritten, never interpreted); an existing `.arggon.env` (attach
re-run) is left byte-identical; the read-only `git check-ignore` probe is
reported as `env.gitignored`. The whole path is best-effort: `written: false`
with a `warning` (the `x-worktree.env: false` opt-out, a write failure, the
attach keep) never blocks the claim, and the env file is never staged — the
claim commit still contains only the item file. Projects pull the convention
in by reading the keys: servers bind an ephemeral port (`:0`) or one derived
from the worktree id, and services are isolated by identifier (per-worktree
database name/schema) against one local server — adopters who read none of it
are unaffected. `cleanup --prune` reaps a start-created env file (contract
shape only) before `git worktree remove`, so an unignored one never wedges
pruning. The receipt rides both surfaces: the CLI envelope's additive `env`
field and the native `preparation.env`.

#### Single-writer ownership (claim stamp, exploration 017 F12)

One claimed item → one worktree → one writer session: ownership is a
convention every agent must hold, and start now carries the detection layer
underneath it. **The worktree belongs to the session the stamp names** — the
delivery lead owns the item, the maker owns the worktree while the claim lives
(§Orchestration → Worktree ownership and collisions) — and no session writes in
a worktree another live session holds.
Every `start --worktree` writes a claim stamp (`arggon-claim.json`
inside the worktree's **git dir** — never in the work tree, so it cannot dirty
`git status`, block `git worktree remove`, or need cleanup) recording the owning
identity (calling session id on the native tools, assignee on the CLI), the
item, branch, claim timestamp, and surface. On an **attach** the previous stamp
is read before it is replaced: a DIFFERENT identity plus tracked files modified
after that claim is reported — a bounded, named warning (`claim.foreignWrites`
in `--json`; `note: single-writer check — …` on stdout; the native
`preparation.claim`) naming the stamped owner, the claim time, and up to 10 of
the newer files with an exact total. Read it as "a concurrent writer may be
active under the previous owner's claim" and check before writing — the F12
incident (a claimed worktree written into by a concurrent session) is exactly
this signature. With `x-tracker.strict-worktree-writes: true` the same
observation refuses the attach before any item mutation; the remedy is
coordination with the stamped session, then re-running `start --worktree` (the
owner's own re-attach never fires — the stamp is refreshed with its identity).
Detection is bounded and best-effort: one porcelain read plus one `stat` per
dirty path, covering the UNCOMMITTED collision window; committed work is
history, and a missing or unreadable stamp (pre-feature worktrees) degrades to
no detection, never to a false accusation. A fired detection never re-stamps the worktree, so the previous owner stays stamped and every retry re-detects — a strict refusal cannot be unlocked by retrying. If the stamped session is gone, there are two recovery paths, and both start with the same step — confirm no live writer (ask the coordinator if you cannot tell):

1. Take the worktree over explicitly — the designed, auditable path
   (task-strict-attach-dead-owner-hatch). It applies only when the
   detection actually fired: it re-stamps the worktree with your identity and
   records a dated take-over naming the stamp it replaced (`claim.takeOver` in
   `--json`, `note: single-writer take-over — …` on stdout, plus a bounded
   `takeovers` chain in the stamp itself). On a clean attach there is nothing to
   take over, so the flag changes nothing. Never use it to override a LIVE
   owner: coordination is the refusal's first remedy and always cheaper.
   - CLI: `arggon start <id> --worktree --take-over-worktree`
   - Native tool: `tools.arggon.start({ id, assignee, takeOverWorktree: true })`
     (default OFF, requires `worktree`; the take-over rides
     `preparation.claim.takeOver`).
2. Remove the stamp by hand:
   `rm "$(git -C <worktree> rev-parse --absolute-git-dir)/arggon-claim.json"` —
   the escape hatch for the case where the take-over is not available at all
   (an older CLI or plugin build without the flag). It discards the ownership
   record, so prefer (1).

The **native** refusal therefore no longer advertises a plain re-run: while the fired detection stands, every retry re-detects against the same evidence, so it names the take-over input instead (the shared kernel refusal still carries the coordinate-first advice — "coordinate with the stamped session, then re-run start --worktree" — which is correct when the owner can still re-attach and refresh the stamp; a crashed owner has no such session, which is what the take-over and the manual `rm` are for).

#### Failure semantics

A failure after the worktree exists **never** rolls it back: the worktree and branch are kept for inspection, and the error names the failing step, the worktree path, the remediation, and the fact that re-running `arggon start <id> --worktree` attaches to it. A failed push is the exception — attach does not retry it, and the error instructs `git push -u origin <branch>` manually.

#### Force-push spellings: what the seam permits and what it refuses

The generated seam's shell gates discriminate on the **lease**, never on how `--force` is spelled. Know this before you attempt one:

- **Permitted** — `git push --force-with-lease origin <branch>`, `git push --force-with-lease=<ref>:<expect> origin <branch>`, and `git push --force-if-includes …` (in either order with `--force-with-lease`). They are lease-checked: git refuses the update unless the remote ref still points where your remote-tracking ref says it did, so they replace history **you** published without clobbering work you have not seen. **This is the spelling to use after a rebase** — `git push --force-with-lease -u origin <branch>` is the shape the claim loop takes.
- **Refused** — bare `--force` (`git push --force origin main`), `-f`, and the `+refspec` spelling (`git push origin +main`, refused even next to a lease flag). `git commit --no-verify` is refused by the same block. The refusal arrives as `{"error":{"type":"permission.rejected","message":"Permission denied: shell"}}` from the session's own shell layer — not as a git error, and not as an auth or lease failure.
- **The refname is not part of the discriminator.** `git push --force-with-lease origin main:other` is permitted as well: the colon-free `git push --force-with-lease origin main` is permitted too, so refusing the colon form would refuse legitimate spellings (`HEAD:<branch>`) while refusing nothing it means to refuse — this seam's own defect class, recorded in `bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use`.
- **Text matching has a known limit.** The gate reads shell text, so a command that combines an allowed lease flag with a _second_, bare `--force`/`-f` is not caught, and neither is a force push hidden behind a separator or an interpreter (`cd x && git push --force`, `bash -c "git push --force"`). The kernel invariants, the pre-commit `arggon validate` gate and CI stay the enforcement of record: this gate stops the accidental spelling, not a determined one. On the ZCode and Claude Code seams the hook gate (`hooks/gate.mjs`) still denies `--force-with-lease` with the same over-broad `--force\b` matcher, so use the flag spelling and expect the refusal there until that seam is fixed separately.

#### Which layer enforces the seam's shell gates

Probed 2026-10-15 (`bug-task-permissions-enforcement-not-observed`, harness `npm run smoke:permissions-probe`; OpenCode v2.0.29) — one denied and one allowed command per client runtime, recorded as command / expected / observed / exit / does-NOT-prove:

- **OpenCode V2 session — honors it.** The runtime's own permission layer reads the project `permissions` block for every agent (the project rules are appended after each agent's own rules, last match wins). A session started _without_ the block allows `git commit --no-verify -m probe`; after the block is written to the same fixture, the _same_ session refuses it (`Permission denied: shell`). That holds for a fresh headless `opencode run`, for a session continued across runs, and for a session attached to a long-lived background service (the desktop app's runtime shape) — a running session is not stuck with a frozen permission surface.
- **ZCode and Claude Code seams — their own gate, not this file.** Neither seam reads `opencode.jsonc`; the plugin bundle's `hooks/gate.mjs` PreToolUse gate denies `git push --force` / `-f` / `+refspec` and `git commit --no-verify` for every session (fail-open by design) and still refuses the lease-checked spelling.
- **The native plugin — no permission surface of its own.** The vendored bundle registers tools and session hooks; it declares no `config` hook and no permission rules, so its tools are filtered by the runtime's permission layer and its kernel calls are refused by the kernel.
- **The CLI / kernel — the enforcement of record.** Reopening a `done`/`cancelled` item and stealing a claim are refused whatever any client's permission surface says; ordinary tracker writes are not impaired.

An earlier observation on this topic (a live session allowing both denied dry-runs after the file was repaired, 2026-10-02) **could not be reproduced** on the current runtime and config state; the probes above are the recorded answer, and the harness is what keeps it honest — a leg that cannot run records a skip, and a probe whose permission layer was never exercised is inconclusive, not a pass.

Impact class: **Behavioral** ([ADR 0016](../adr/0016-adopter-upgrade-channel.md)) — the permitted set changed for every session (the deny used to catch `--force-with-lease`, which stopped a live wave at the merge step on 2026-10-11), so an adopting repo absorbs this through the propose channel and an agent must re-learn which spelling to reach for.

Native `tools.arggon.start` uses that same kernel dependency-preparation path before its explicit claim commit. Its bounded `preparation` and `claimCommit` receipts make a required install, pre-commit gate, or claim-commit failure a typed failure (with the worktree kept and an attach/retry instruction), never an unqualified success; see §Orchestration → Native `start` dependency contract.

### Native `start` dependency contract

`tools.arggon.start({ id, assignee, worktree: true })` and
`arggon start <id> --worktree` use the same kernel-level
`prepareWorktreeDependencies` implementation before either surface writes the
claim. It links the primary checkout's existing `node_modules` when the fresh
worktree has none, builds workspace packages that the worktree owns, and
re-reads which packages still resolve into the primary. The native result
carries a bounded `preparation` receipt (`ready`, `install`,
`linkedNodeModules`, `builtWorkspaces`, `linkedWorkspaces`, `gateBins`) and an
explicit
`claimCommitted`/`claimCommit` outcome. `ready` is the conjunction of four
clauses: an install is present, no worktree-owned workspace package resolves
into the primary, the install provides what the worktree's own
`package.json` declares, and every reported gate binary resolves inside the
worktree (`gateBins`; an empty report — nothing declared exposes a bin —
leaves that clause vacuous) — a linked install mirrors the primary's, so a
devDependency merged since that install ran is missing from every worktree and
`ready: false` is reported instead of a readiness the gate cannot use. The
receipt names the reason on BOTH surfaces: `manifestCoverage`,
`missingDependencies` (kernel-capped at 10 names), `missingDependenciesTotal`
and `gateBins` (which node_modules each gate binary resolves from —
`worktree`/`external`/`path`/`missing`; a `path` source is a sibling
checkout's bin silently running the gate on a foreign install)
are part of the native `preparation` payload as well as the CLI `--json`
envelope, so neither caller has to shell out to the other to learn which
declared dependency is missing (see §4). The remedy is the same on both
surfaces: re-install the primary checkout, or give the worktree its own install. A required dependency or
pre-commit failure is a typed `START_FAILED`, never an unqualified `ok:true`: the native
worktree and branch are kept, the skip reason is bounded, and the message gives
the `tools.arggon.start` attach/retry command. The preparation receipt also
carries the bounded `steps` log (bug-start-install-ordering): which prep path
ran — link farm created / reused / skipped-and-why, per-workspace build
decisions, the gate-bin verdict — so a broken worktree can always be
correlated with the exact decision that produced it; the CLI envelope carries
the same log as `prepSteps`.

**Fresh-worktree install gate (bug-start-install-ordering).** A start that
CREATED the worktree must leave a gate-usable install — or fail itself, before
any claim commit, with the named cause. The eight-incident record behind
`bug-start-install-ordering` was exactly this ordering: the preparation steps
degraded silently (the primary install missing or mid-install at prep time, a
farm that could not be created, a sibling checkout's `.bin` on PATH masking
the absent install) and the claim commit then died at the gate with a bare
`tsx: command not found`. Both surfaces therefore refuse the claim BEFORE the
claim update whenever the worktree was created this run and the receipt
reports any gate bin resolving outside the worktree — no flag required
(`claimCommit.reason: "fresh-worktree install gate refused"` on the native
surface; the CLI wraps the same refusal with its step/keep/attach report).
The refusal names the offending bins, the `steps` log, and the fix (`npm ci`
in the worktree, or `npm install` in a stale/missing primary), and the
worktree is kept: fix the install, re-run start, and the attach retries the
claim. Attach re-runs keep the historical semantics — report-only without the
flag, refused by `x-tracker.strict-gate-bins` when armed — so the documented
`npm ci` then attach remedy stays possible. The carve-out is unchanged: a
project with no dependency-needing gate may still have no install and commit
the claim (an empty `gateBins` report violates neither gate). Related
never-silent rules from the same fix: a fresh worktree whose item file is
unexpectedly clean at claim-commit time is a named error, not a skipped
commit (a lost mutation must not look like success), and a post-start hook
that leaves the worktree without an install has its re-link outcome
(`relinked`/`failed`) reported instead of swallowed.

The commit outcome is the
authority; `claimCommit.status: "not-needed"` means no second commit was needed,
not that a commit was silently skipped. Re-running after fixing the gate
retries a dirty claim instead of treating the no-op update as success.

Ordering is part of that contract. Native start settles branch ownership
(create/attach/switch) BEFORE the claim mutation: a switch that fails leaves the
item byte-identical and unclaimed, and a claim refused after this run created a
branch rolls back only that owned branch — the checkout returns to its previous
branch first, the deletion is observed, and the result reports `rollback`
(`branchDeleted: null` means no branch was owned). An unexpected failure after
the phases above began is reported with the state observed so far, so a claim
commit that already landed stays `claimCommitted: true` with its committed
status/hash instead of being downgraded to "not attempted".

Native start does not run the CLI-only `x-worktree.post-start` hook; a project that
needs a full local install must first remove the start-created link/farm (the
CLI hook does this automatically) and then run its package-native bootstrap in
the returned worktree. Never run `npm ci` through a link to the primary
install. Both surfaces keep the install out of the claim commit and never use
`--no-verify`.

## MCP server

`arggon mcp` starts a stdio MCP (JSON-RPC 2.0, newline-delimited) server that exposes the shared kernel and the bounded read surface as **sixteen** tools: the core nine `arggon_list`, `arggon_create`, `arggon_update`, `arggon_comment`, `arggon_handoff`, `arggon_show`, `arggon_next`, `arggon_report` and `arggon_validate` (task-mcp-parity-full: the pure-read `next`/`report`/`validate` commands complete the ADR 0006 next-first surface for MCP-only agents), the kernel tools `arggon_priority`, `arggon_sync` and `arggon_import_issues` (ADR 0014, `task-mcp-full-surface`), and the worktree lifecycle `arggon_start`, `arggon_branch` and `arggon_cleanup`, each of which re-enters the CLI as an argv array with no shell (§Worktrees), plus `arggon_friction` — the local friction channel ([spec friction-capture-020](../specs/spec-friction-capture-020.md)), also a CLI re-entry, because the CLI owns the whole `friction --json` contract (the mode conflicts, the `--tier` validation, the opt-out resolution and the `arggonVersion` every record carries). That list is generated from one registry — the `TOOLS` array in `cli/src/mcp-server.ts` — and `cli/src/mcp-doc-contract.test.ts` pins every enumeration of it in this file, in `ArggonManager/docs/json-output.md`, in `README.md` and in the CLI skill's `references/json-contract.md` to that registry, so a tool added there without a matching doc edit fails the suite. Tool results are the documented `--json` envelope objects (see [`ArggonManager/docs/json-output.md`](../json-output.md)) serialized as text content; kernel failures surface as tool errors with the CLI's message text. `arggon init` generates a `.mcp.json` that registers the server project-scoped for MCP clients — **as part of the `claude` adapter seam** (it is the surface that hands a Claude Code tree its tools, alongside the `CLAUDE.md` pointer), so it is generated with the default selection but **not** under `--no-agents`, nor under `--agents` without `claude`; if your repo already has a `.mcp.json`, the arggon entry is never overwritten — add `{"command": "arggon", "args": ["mcp"]}` under `mcpServers` manually. **OpenCode V2 does not need it**: since W3 the generated `opencode.jsonc` carries no `mcp.servers` stanza and the vendored plugin serves the native `arggon` tools in-process (`.opencode/agents/`, `.opencode/commands/arggon-*.md`, `.opencode/plugins/arggon/`); MCP is a conditional adapter for other clients, and `doctor` reports a present stanza as optional. See [exploration-opencode-v2-native-009 ](../explorations/exploration-opencode-v2-native-009.md) and `ArggonManager/docs/playbooks/opencode.md`.

The MCP layer always calls the kernel with the agent playbook rules applied: an MCP caller cannot reopen `done`/`cancelled` items and cannot steal a claim — no `force` parameter touches a claim (`update --force` stays human-only, with no native/MCP parameter). The one `force` on the surface is `arggon_cleanup`'s audited prune opt-in (bug-cleanup-prune-untracked-artifacts-no-force): terminal+merged items whose only removal blockers are untracked, refused without `prune` (`force requires prune`), and it never discards tracked modifications. These rules live in one module (`lib/src/rules.ts`) shared by the CLI and the MCP server, so both entry points enforce identical semantics.

**Session attribution (task-opencode-v2-mcp-meta).** OpenCode V2 sends the invoking session ID in `CallToolRequest.params._meta.sessionID` for calls made on behalf of a session — direct tools and Code Mode, over stdio and Streamable HTTP — and documents it as an opaque correlation value ([MCP servers](https://opencode.ai/v2/docs/mcp-servers/), accessed 2026-09-17). `arggon mcp` reads it absent-safely and uses it as the **default** `session` for `arggon_handoff` and the **default** `author` for `arggon_comment`/`arggon_handoff`; explicit **non-empty** tool arguments always win, and a caller that omits the metadata keeps the previous behavior (`@me` author resolution, no session). The value is normalized once at the boundary (`sessionIDFromMeta`) before any consumer sees it (task-opencode-v2-mcp-meta-hardening, finding F1): surrounding whitespace is trimmed, the token is cut at the first whitespace, control, format or lone-surrogate character so it is always single-line, and it is capped at 64 characters with `…` — the same bound the handoff `session` field enforces. A value that normalizes to nothing (whitespace-only, control-only, empty) counts as absent; the meta-derived `author` therefore cannot inject an extra heading line or unbounded prose, and explicit arguments keep their existing kernel semantics (comment trims its author; handoff caps its `session` at 64). The ID is correlation metadata only: never authentication or authorization, never logged, and it triggers no state transitions — `lib/src/rules.ts` stays the only path for updates and the CLI is unchanged.

**Item-addressed cwd (bug-mcp-server-binds-session-cwd-tracker-root).** The server binds one session to the cwd it was launched from (`runMcpServer({ cwd: process.cwd() })`), but the item-addressed tools — `arggon_update`, `arggon_comment`, `arggon_handoff`, `arggon_show` — resolve their tracker root per call through the item's own `worktree_path` (the claim address `start --worktree` records on the item; when the launch copy is stale, the claiming worktree is found through its `.arggon.env` or its copy of the item). A comment/handoff/update for an item claimed in a worktree therefore lands in THAT tree — on the item's branch, with the handoff's auto-detected `branch` correct — never in the launching tree just because the server started there: the incident this closes (PR #713) landed a maker's comment + handoff on the primary checkout's stale base branch, duplicating content already on the fix branch, and left `arggon_update --status done` able to flip an item in a tree the branch is not on. When the recorded claim tree cannot be written into (gone, or no tracker there) a WRITE refuses with `error.code: "TRACKER_ROOT_MISMATCH"` naming both trees and the remedies, instead of landing in the launching tree — reads never refuse, they answer from the launching tree. Pool calls (`list`/`create`/`next`/`report`/`validate`/`priority`/`sync`/`import_issues`) and the worktree lifecycle tools (`start`/`branch`/`cleanup`) are untouched, and the CLI itself is deliberately unrouted (one cwd, one tree — the single-checkout flow). Behavioral change for MCP callers (their writes now land on the item's branch); the same class was fixed on the native surface by bug-native-arggon-tools-resolve-tracker-root-to-session-cwd.

The MCP tool input schemas are **parity-tested against the CLI** (`cli/src/mcp-parity.test.ts` derives the commander option surface for `list`/`create`/`update`/`comment` and asserts it matches the tool schemas both ways, minus a documented exception list). Keep MCP schema changes **additive only**; a breaking change to a tool input schema must bump the `schemaVersion` of the JSON output contract.

Wire it up with any MCP client config:

```json
{
  "command": "arggon",
  "args": ["mcp"]
}
```

## Reference integrations

Copy-paste wiring so agents follow ArggonManager rules **by default** — same CLI, same rules, no private dialect (Phase 3, [#20](https://github.com/Arggon/ArggonManager/issues/20)).

Or print it on demand: `arggon instructions` extracts these snippets from this file at runtime (`--json` emits them as structured fields), so doc and command cannot drift.

The generated AGENTS.md also mandates the bundled **arggon-cli skill** (`.agents/skills/arggon-cli/SKILL.md`, copied by `arggon init` from this repo's `skills/arggon-cli/SKILL.md` — single source, no duplicate): agents load it before any arggon invocation for the JSON contract, claim rules and pitfalls. It is an umbrella — `SKILL.md` plus `references/{json-contract,methodology,exploration,orchestration,pitfalls}.md`, bundled beside it; V2 advertises the supporting paths and the model reads the relevant reference on demand instead of carrying all detail per step. A parity test (`cli/src/skill-copy.test.ts`) keeps every bundled file byte-equal to its source, modulo the generated marker.

### OpenCode V2

`arggon init` generates the OpenCode **V2** seam (tier-1; never overwrites an existing file): a root `opencode.jsonc` — **only when the repo has no OpenCode config of its own** (`opencode.json(c)` or `.opencode/opencode.json(c)`) — carrying a git-root-anchored prettier formatter override + compaction retention and **no MCP stanza** (ADR 0011 §5/§6: MCP left the default path in W3), plus `.opencode/agents/arggon-{delivery-lead,maker,standards-reviewer,verifier}.md` and the eleven native `.opencode/commands/arggon-{next,start,done,handoff,review,status,spec,adr,explore,playbook,adopt}.md` (prompt templates that drive the native tools and write the methodology artifacts directly — no CLI-driving prose, no shell blocks). The generated `.mcp.json` still serves other clients (e.g. Claude Code) — it belongs to the `claude` seam, so a tree initialized with `--no-agents` (or `--agents` without `claude`) has none of this V2 seam **and no `.mcp.json`**; the skills bundled under `.agents/skills/` are always generated (no config needed):

```jsonc
{
  // formatter override + compaction retention; the native `arggon` tools come
  // from the vendored plugin, so no MCP stanza is needed. The prettier
  // override anchors the session formatter at the edited file's own git root,
  // so sibling-worktree files (the `start` layout) keep their own
  // .prettierignore — the full command is in the generated opencode.jsonc.
  "$schema": "https://opencode.ai/config.json",
  "formatter": {
    "prettier": {
      "command": [
        "sh",
        "-c",
        "<git-root-anchored prettier --write>",
        "prettier-cwd-guard",
        "$FILE",
      ],
    },
  },
  "compaction": { "keep": { "tokens": 15000 } },
}
```

V2 recognizes `AGENTS.md` only — **no `CLAUDE.md` fallback** (that shim serves other tools) — and accepts but does not load the `instructions` config array. Never map V1 fields into V2 config (`mcp.<name>`, `enabled`, `autoupdate`); the published `https://opencode.ai/config.json` schema is **V1** and is _not_ a field-level source of truth for V2 — the vendor's V2 guidance (runtime v2.0.26) says verbatim: _"The schema served from <https://opencode.ai/config.json> may describe V1 even though V2 configuration files include that URL for editor integration. Never use it to infer V2 field names or shapes."_ Take V2 names from the V2 surface instead — `plugins`, `agents` (with `system`/`permissions`), `commands` — never from that schema. `arggon init` also vendors the OpenCode V2 plugin (`.opencode/plugins/arggon/index.ts`, same never-overwrite + provenance semantics as the skills): since W3 it is the **single-file, dependency-free bundle** built from `opencode/plugins/arggon/index.ts` with `@arggondev/lib` inlined (`npm run build:plugin`; drift-gated by `cli/src/plugin-copy.test.ts` — assert-before-write — and `npm run check:plugin` in CI), so it loads in a dependency-less adopter tree with zero config. Since W5 (`task-native-tui`) it also vendors the **TUI entry** `.opencode/plugins/arggon/tui.tsx` beside the bundle: OpenCode discovers it from the same plugin directory, the runtime resolves `solid-js`, and the board/status surface (`session.panel` + `sidebar.content`, opened with `/arggon-board`) reads the tracker through the inlined kernel — still no `node_modules`. It registers the **native `arggon` tool namespace** (W2/W3, `task-native-tools`; W4 adds the worktree domain, T5 adds `friction`): sixteen Code Mode tools with `ctx.tool.transform` (`options.namespace: "arggon"`, `codemode: true`; nine of them also `options.pinned` — `list`, `create`, `update`, `show`, `next`, `validate`, `comment`, `handoff` and W4's `start`, the claim → worktree entry `/arggon-start` drives) that call the kernel in-process and return the documented `--json` envelopes, with kernel failures surfacing as typed tool errors and the session continuing. The W4 worktree tools (`start`, `branch`, `cleanup`) own the item worktree through `ctx.worktree` while the kernel keeps the claim/branch/`worktree_path` records: `start` creates `../<repo>-<id>` (name `<repo>-<id>`), records the branch + path inside the worktree copy so the claim commit lands on the feature branch, and `cleanup` classifies with the shared kernel rule, removes merged worktrees through the domain and clears the records; push and the `gh` PR step stay explicit agent steps, and the CLI (`arggon start --worktree` / `arggon cleanup --prune`) is the fallback when the domain is unavailable. The generated seam and the shipped agents also carry the W4 permission defaults (minimal shell gates; reviewer read-only shell gates; native + MCP tool-level least privilege) that complement — never replace — the kernel invariants. Ambient behavior: it correlates the session to the active work item — `ARGON_ITEM` env → observed `arggon` calls (shell invocations **and** Code Mode `tools.arggon.<name>(…)` calls, W3) → `feat/<id>`/`fix/<id>` branch — injects a **bounded** item block through the context hook, rebuilt per call so it survives compaction, **stamps every admitted prompt with the worktree env-contract identity** (`.arggon.env` item/branch/worktree, written into the prompt's own `metadata` and never into its text), **retains that item block in the compaction request itself** so the checkpoint summary is produced with the item in scope, renames the session on claim, and logs a non-blocking hygiene warning when `arggon validate` fails after a commit. MCP auto-registration was **removed** in W3 (ADR 0011 §5/§6): the plugin never touches `ctx.mcp`; an adopter who wants the stdio server configures `mcp.servers.arggon` explicitly. Headless evidence: `npm run smoke:opencode` — fresh-init seam + dependency-less bundle + one bounded session per native command + the context/hygiene scenarios on opencode v2.0.12. Config precedence, skills discovery, bundling, testing and the upgrade policy live in the [OpenCode playbook](../playbooks/opencode.md) (pinned 2.0.12).

### ZCode

`arggon init` generates the **ZCode seam** (tier-1, ADR 0014; same never-overwrite + provenance semantics): `.zcode-marketplace/` — a marketplace **catalog** (`marketplace.json`) plus the vendored declarative plugin at `arggon/` (`.zcode-plugin/plugin.json`, the thirteen `commands/arggon-*.md` rewritten against the arggon **MCP** surface, the two `agents/arggon-{maker,standards-reviewer}.md` in ZCode frontmatter, a seam `README.md`, `templates/goal-mode.md`, the opt-in `templates/automations/` pair, and `hooks/`). **In ZCode the main session IS the delivery lead** (`task-zcode-lead-role-belongs-to-the-main-session`): ZCode can only surface plugin agents as dispatchable subagents — it has no primary/session-agent concept — while the delivery lead is the primary worker who interacts with the product owner (ADR 0021 §6.1/§6.2a′), so the seam ships only the subagent roles (`arggon-maker`, `arggon-standards-reviewer`; the OpenCode seam keeps the lead as its selectable `mode: primary` session agent) and the lead's contract rides the carriers (`AGENTS.md` → this document §Orchestration, `engineering.md` §Roles and authority, and the seam `README.md`), which state that no ZCode surface dispatches a lead. A client whose plugin agents are all subagents materializes only the roles it can express — the rule the shipped Claude Code seam follows too (§Claude Code: plugin agents are subagents there as well; the lead role belongs in the generated `CLAUDE.md`/instruction material). ZCode has no code-mode tool API, so the plugin's `mcpServers` field registers `arggon mcp` — the **sixteen-tool** MCP surface is the client's whole native tool surface (ADR 0014, `task-mcp-full-surface`), and it requires the `arggon` CLI on `PATH`. **One manual step** the platform requires: in ZCode, Plugin Marketplace → Add → Add Plugin Marketplace, paste the repo's `.zcode-marketplace/` directory, then install the `arggon` plugin from it; the plugin ships the MCP registration, so no `.zcode/config.json` stanza is generated (an adopter who skips the plugin adds `mcp.servers.arggon` themselves — ADR 0011 §5/§6 carries over).
**Goal Mode** (spec methodology-adapters-017 §S5, ADR 0020, `task-zcode-goal-mode`): ZCode's Goal Mode loops plan → execute → verify, so the seam ships a **goal-mode contract template** — `.zcode-marketplace/arggon/templates/goal-mode.md`, generated with the same provenance + never-overwrite rules as every other seam file. The template is only the _shape_: `arggon goal <item-id>` (ZCode: `/arggon-goal`) instantiates it from the item in git, and the derived contract is **one goal per claimed item** — objective, verification contract, loop, and the worktree it may run in. **Whether work remains is the KERNEL's answer, not this command's — and the kernel is the only grammar left to ask.** `bug-three-acceptance-parsers-diverging` (PR #611) unified the six acceptance-box grammars that used to exist (the gate plus the board, the TUI, the native detail block, `spec` and this goal contract) into one in `lib/src/items.ts`: `acceptanceRows` / `acceptanceCriteria` / `acceptanceUnchecked` / `acceptanceComplete`, with `acceptanceBody` as THE canonical input. `arggon goal` reads both the verdict (`acceptanceGate(acceptanceBody(item)).gated`, the `done` flip’s own verdict) and the criterion text (`liveAcceptanceRows` on the same body, i.e. the item’s live `## Acceptance` section — a dated comment block is history, so its boxes are neither the contract nor the work left) from it, so the contract cannot disagree with the done gate, nor with itself. Which lines are rows and which rows gate is decided in [`convention.md` §Acceptance rows](../convention.md) (`- [ ] x` and `- [ ]x` are rows; `-  [ ] x` is not); line breaks are the whole ECMAScript **LineTerminator** set, so CRLF and U+2028/U+2029 bodies need no special case. The one live hazard is the INPUT, not the grammar: hand `acceptanceRows` a reader’s bounded `prose` (body minus comment sections) instead of `acceptanceBody(item)` and a checklist filed as an `arggon comment` — first-class here, and the only path before issue #870 added `create --body` — vanishes from the goal while the gate still refuses to close the item. Kernel parity corpus: `cli/src/acceptance-parity.test.ts`; this adapter’s own corpus (including the comment-filed case) is in `cli/src/goal-mode.test.ts`. Normally the objective is the first unchecked criterion and the verification contract is every unchecked one (they must all hold before `done`); when the gate says the contract is satisfied, the goal is an explicit “define the goal first” contract — never an empty one. Bounded by construction: byte-clipped rows, at most eight inlined criteria, counted overflow, and a clipped template copy, so a tampered or oversized item cannot produce an unbounded contract (the template is clipped BEFORE its slots are filled, so an adopter copy over 8 KiB can lose its `{{...}}` placeholders while the structured `goal.*` fields still carry the values). One worktree per item means the item's recorded worktree — an item that records none (`start` without `--worktree`) is scoped to the repo root you are in, never a sibling's. **One goal per claimed item, one worktree per item** — `arggon goal` REFUSES, with no override flag: an unresolvable caller identity (`GOAL_IDENTITY_UNKNOWN` — the claim holder cannot be proven to be you, so nothing renders; set `GITHUB_USER`/`GITHUB_ACTOR` or authenticate `gh`), a `done`/`cancelled` item (`GOAL_ITEM_CLOSED`), an unclaimed item (`GOAL_UNCLAIMED`, claim it with `arggon start` — the claim is what creates the worktree), an item claimed by **another identity** (`GOAL_FOREIGN_CLAIM`), a run from any checkout that is not the item’s recorded `worktree_path` (`GOAL_WORKTREE_MISMATCH`), one whose worktree no longer exists (`GOAL_WORKTREE_MISSING`), a missing template (`GOAL_TEMPLATE_UNAVAILABLE`), and an unknown id / missing tracker (`GOAL_FAILED`). Pointing a goal at another session’s worktree is a refusal, not a mode, and there is no flag to route around it. The hard boundaries and the refusal list are appended by the CLI from constants, **not** read from the template file, so an adopter who edits their copy of the template still gets them in the rendered contract — the goal cannot become a path around the dispatch-scoped reviewer backstop below (the reviewer window stays read-only; the goal says so). Adopter copy wins over the packaged one when the file exists (never-overwrite means it is yours); the packaged template is the fallback. The kernel is the enforcement of record: `arggon validate`, the claim lease and the done gate decide what is allowed — the contract is a prompt. Headless evidence: `cli/src/goal-mode.test.ts` (parity corpus, boundaries, **every** refusal code, row clipping/overflow, envelope) and `cli/src/init-zcode.test.ts` (template generated with provenance, never-overwrite, instantiated from a real item).

**Automations (opt-in)** (spec methodology-adapters-017 §S5, plan T5, `task-zcode-automations`): beside the goal-mode contract the seam ships two automation contract templates — `.zcode-marketplace/arggon/templates/automations/spec-drift-scan.md` (daily) and `.zcode-marketplace/arggon/templates/automations/stale-claim-sweep.md` (weekly), generated with the same provenance + never-overwrite rules as every other seam file. **Opt-in means init schedules and runs nothing**: a template is a contract an adopter wires into their own scheduler (cron, CI timer, agent loop) at a cadence they chose, and deleting the file is the off switch. Each carries the claim/branch preconditions — it holds no claim, runs inside no item's `worktree_path`, never claims/branches/checks out, and refuses to run anywhere but the primary checkout on the default branch with a clean tree (filing appends the tracker auto-commit, which must never land on an item's feature branch). The scan is read-only — `arggon validate`, `arggon spec validate`, `arggon spec analyze`, `arggon doctor --agents`, and for the sweep `arggon list --stale --older-than 7d` + `arggon show` — and the ONLY write either may ever make is `arggon create`: one item per NEW drift finding or per deduplicated stale claim (capped, and never filed twice for the same finding), under the drifted spec's story (resp. the stale item's parent story), with the evidence in an `arggon comment` on the NEW item. Neither automation ever touches the items it scans — no `arggon update`, no comment on a scanned or stale item, no claim release (that decision belongs to the claim's assignee or the lead), no hand `git commit`/`push` — the kernel invariants (claim/steal/reopen, `arggon validate`) outrank the contract, which is a prompt. Headless evidence: `cli/src/init-zcode.test.ts` — provenance markers, never-overwrite, the precondition contract, a read-only allowlist over every quoted scan command, create-only filing, and the opt-in declaration.

Hooks replace the per-agent permission DSL ZCode lacks (hook input carries `session_id` + `tool_input`, never an agent identity). The plugin ships one dependency-free Node script (`hooks/gate.mjs`, invoked through `node` via a `process` hook — no exec bit, no shell) with two gates: **global** — every session is denied `git push --force`/`-f` and `git commit --no-verify` (the W4 seam gates, ported); **dispatch-scoped reviewer backstop** — while an Agent dispatch naming `arggon-standards-reviewer` is in flight (`PreToolUse(Agent)` marks the session, `PostToolUse(Agent)` closes the window, `Stop` clears it, parallel dispatches count), the gate denies `Write`/`Edit`, mutating `arggon` shell invocations, git history commands and the mutating `mcp__arggon__*` tools for that session — the reviewer reads with `arggon_show` and posts its verdict with `arggon_comment`. That matcher is a string, so the shipped reviewer id and the matcher are bound by a test that reads the id out of the shipped template (`cli/src/init-zcode.test.ts`): renaming the agent without the gate would otherwise disarm the backstop with no failure anywhere. Like the OpenCode seam's shell-text patterns, the gates are best-effort defense-in-depth that complement — never replace — the kernel invariants (no reopen, no steal hold whatever the hooks say). Known platform gaps: the TUI board panel has no ZCode equivalent (the `/arggon-board` command serves `arggon board --serve` and hands back the loopback URL), and agent `tools:` allowlists cannot express the OpenCode per-tool deny lists — the reviewer agent's allowlist plus the dispatch-scoped hook gate are the replacement. Headless evidence: `cli/src/init-zcode.test.ts` — fresh-init seam shape, manifest/marketplace consistency, provenance markers, never-overwrite, and the gate script contract (global gates, marker lifecycle, parallel dispatches, Stop clearing).

### Claude Code

`arggon init` generates the **Claude Code seam** (tier-1, ADR 0014, spec-claude-code-adapter-024; same never-overwrite + provenance semantics): `.claude-marketplace/` — a marketplace **catalog** (`.claude-plugin/marketplace.json`, `arggon-local`) plus the vendored declarative plugin at `arggon/` (`.claude-plugin/plugin.json`, the thirteen `commands/<command>.md` rewritten against the arggon **MCP** surface, the two `agents/arggon-{maker,standards-reviewer}.md`, the bundled `arggon-cli` skill, a seam `README.md`, and `hooks/hooks.json` + `hooks/gate.mjs`). Claude Code namespaces every component under the plugin name, so the commands run as **`/arggon:<command>`** (the file stems drop the ZCode seam's `arggon-` prefix, which the namespace would repeat) and the subagents dispatch as **`arggon:arggon-maker`** / **`arggon:arggon-standards-reviewer`**; agent file names keep the `arggon-` prefix because the file stem IS the wire id, which ADR 0021 §6.2a′ forbids forking per client. **The main session IS the delivery lead**, exactly as on ZCode: Claude Code surfaces plugin agents as dispatchable subagents and has no primary/session-agent concept, so the seam ships only those **two** subagent roles and the lead's contract rides the generated repo-root `CLAUDE.md` → `@AGENTS.md` carriers plus the seam `README.md`, which state that no surface of this plugin dispatches a lead. No `arggon-verifier` agent ships (the verifier needs shell without writes; the ZCode seam's subagent-only precedent applies), and `agents` is deliberately absent from the manifest — the key validates but replaces the client's convention `agents/` scan and surfaces zero agents (probed on claude 2.1.289), so omitting it is what loads the shipped pair.

**One server, one name**: the manifest registers exactly one server, keyed `arggon`, with the same `command`/`args` (`arggon mcp`) as the generated repo-root `.mcp.json`. Claude Code loads a plugin's `mcpServers` together with the project `.mcp.json` and a later declaration of a name replaces an earlier one, so two differently named servers over one tracker must never exist; `claude mcp list` shows both surfaces — `plugin:arggon:arggon` and the project-scoped `arggon` — and the plugin-bundled tools are spelled `mcp__plugin_arggon_arggon__<tool>` (the project registration keeps `mcp__arggon__<tool>`). **One manual step** the platform requires: `claude plugin marketplace add <repo>/.claude-marketplace`, then `claude plugin install arggon@arggon-local` (both probed on 2.1.289). The plugin ships the MCP registration, so no `.claude/settings.json` stanza is generated — an adopter who skips the install keeps the `.mcp.json` floor — and the `arggon` CLI must be on `PATH` (`npm i -g arggon-manager`): `arggon mcp` is this client's whole typed tool surface, the same fifteen tools and envelopes as every other seam.

**Hook gates** (`hooks/gate.mjs`, invoked in exec form — `node` + `${CLAUDE_PLUGIN_ROOT}` as `args`, no shell, no exec bit): **global** — every session is denied `git push --force`/`-f` and `git commit --no-verify` (`PreToolUse` on `Bash` and the mutating tool names; a denied form merely quoted as documentation passes, while quoted text a shell would still execute stays in the scan); **dispatch-scoped reviewer backstop** — Claude Code's `SubagentStart`/`SubagentStop` events carry the agent type natively, so the window opens on `^arggon:arggon-standards-reviewer$` and denies `Write`/`Edit`, mutating `arggon` shell invocations, git history commands and the mutating `mcp__arggon__*`/`mcp__plugin_arggon_arggon__*` tools for that session (parallel dispatches counted, `Stop` clearing any residue, `arggon_comment` left open as the verdict channel). The reviewer matcher is bound to the id read out of the shipped agent file by `cli/src/init-claude.test.ts`: renaming the agent without the gate fails the suite instead of silently disarming the backstop. The gates **fail open** by design — like the ZCode gate they are defense-in-depth, and the kernel, the pre-commit `arggon validate` gate and CI remain the enforcement of record, which the capability matrix records per row (`claude:plugin.hooks.PreToolUse`). Known gap: this client has no session-context hook, so nothing injects the active work item — the agent fetches it with `arggon show`, and the matrix keeps `docs-travel-with-code` a claude gap. Headless evidence: `cli/src/init-claude.test.ts` — fresh-init seam shape, marketplace/manifest consistency, provenance markers, never-overwrite, the selection matrix, the two-agent/no-lead rule, the gate script contract (global denies, window lifecycle, parallel dispatches, `Stop`, both MCP spellings), one-server byte-equality, skill parity, a live `arggon_show` stdio round-trip, and the optional `claude`-binary probes (recorded `skipped: claude not installed` when absent). Impact class: **Behavioral** (ADR 0016) — agents must re-learn a new client surface.
