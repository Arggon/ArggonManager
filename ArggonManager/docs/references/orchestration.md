# Orchestration runtime reference

Layer: **reference**. Read for client permissions, binding diagnostics, multi-agent harnesses or a worktree collision. Ordinary dispatch is in [the core](../agents.md#orchestration-multi-agent-work); the role and authority table is in [engineering](../engineering.md#roles-and-authority).

**OpenCode V2 is the reference implementation** ([ADR 0010](../adr/0010-opencode2-native-architecture.md)): the rules below are unchanged, but on V2 they are enforced with native primitives. `arggon init` generates the surface (`.opencode/agents/`, `.opencode/commands/`) — one of the selectable adapter seams (§Prerequisites → Agent seams), so pass `--agents opencode` when that is the seam you want and the others are not:

- **Agents, by role** ([role table](../engineering.md#roles-and-authority); ADR 0021 §6.1/§6.2a′): `arggon-delivery-lead` (**delivery lead**) plans waves, delegates, reviews and owns the tracker; `arggon-maker` (**maker**, subagent) owns exactly one item; `arggon-standards-reviewer` (**practice & standards**, subagent) reviews read-only; `arggon-verifier` (**verifier**, subagent) executes the project's verification gates a verdict needs and returns expected-vs-observed evidence. Each id names its **role** — never the software title, never the process verb — and each prompt opens with the role and points at that table, so the contract and the table cannot drift.
- **An agent claims as its role id, never as the product owner's login** (ADR 0021 §5): stamp `assignee: "arggon-delivery-lead"` on the claim you take — a claim identifies **its writer**, and the writer is not the owner. The schema already allows an agent id (`assignee` is "GitHub login **or agent id**"), so this is doctrine, not migration. `@me` resolves the **human** login, so an agent claim correctly does **not** appear under `--assignee @me`: that is the signal working, not a bug. Filing agent work under the owner's login is what makes it look like human ownership in `list --assignee @me`, stale-claim reports and CODEOWNERS review routing.
- **Permissions keep the model honest**: the delivery lead's `subagent` allow-list is `arggon-maker` / `arggon-standards-reviewer` / `arggon-verifier` / `explore` (any other agent is denied, and the list is pinned to the shipped ids by a test — a rename can never silently strand the lead); makers cannot launch subagents (nesting stops at one level); the standards reviewer cannot edit — `edit`/`write`/`patch` are removed from its catalog while reads and shell stay available for the review.
- **The generated seam bytes are what your session runs** (bug-generated-seam-bytes-predate-050): `.opencode/plugins/arggon/index.ts` is a generated, gitignored copy of the committed bundle, so a release can merge while your machine's copy stays a version behind — and the native `tools.arggon.*` surface you call is whatever those bytes said when the session started (a missing tool input is a symptom, not a bug in the tool). After pulling a release, refresh the generated seam (`arggon init`, or `npm test`, which rewrites the copy) and **start a new session**; `arggon doctor` reports it either way (`vendored plugin current` / `STALE` / `unverified` — "unverified" means the tree has no local bundle, which is a plain adopter tree vendored from the installed package), plus the CLI skill's frontmatter version against the release.
- **Who proves, who reviews** (`task-prover-agent-reviewer-split`, Behavioral per ADR 0016 — an agent's operating contract changes): `arggon-standards-reviewer` (**practice & standards**) is **read-and-reason**. It does not run the project's gates; when its verdict genuinely needs execution evidence it ends its report with a `## Probes needed` block (exact command + cwd + what it demonstrates + what the result would change), and the delivery lead routes those to `arggon-verifier` (or runs them itself) and hands the evidence back. `arggon-verifier` (**verifier**) is the mirror image: **shell allowed** for the gates, `edit`/`subagent`/every tracker write and `git commit|push|merge|rebase` denied, and its output contract is `command / expected / observed / exit / does NOT prove` — expected-vs-observed, verbatim output, failures never summarized as passes, skips reported as skips, and every result bounded by what it does not prove. Its tracker **reads are granted explicitly** (`show`, `list`, `next`, `report`, `validate`, in both the native and the MCP spellings; `bug-verifier-cannot-read-the-tracker-no-allow-side`), so the read-only boundary is **config-enforced, not prompt-enforced**: the permission block removes the denied write tools — `comment` included, since a body append is a tracker write — from the verifier's session catalog while the granted reads stay callable, and the prompt's "never post to the tracker" restates what the config already refuses. It **reports, it does not rule**: the verifier decides nothing — no verdict, no approval, no `done` — so its evidence never becomes an approver's (ADR 0021 §6.1). Rationale: a reviewer that runs gates burns its context on execution, races the maker's own runs, and can hit environment walls (a stale `lib/dist`, a missing fixture) that it then reports as findings. On the ZCode seam the split is structural: the standards reviewer's `tools:` allowlist carries no shell at all, and no verifier is shipped for v1 — the delivery lead or the maker runs the probes there.
- For dispatch and ownership, follow [the core orchestration loop](../agents.md#orchestration-multi-agent-work). OpenCode makers run foreground: a background child would outlive a headless `opencode run`. Native tools carry tracker operations; git stays on the shell.
- **A moved session is not a guarantee — verify the binding, do not assume it** (bug-native-arggon-tools-resolve-tracker-root-to-session-cwd): `session_move` **does** rebind the tracker root (verified against the real runtime 2026-10-05), but it only helps a session that actually moved. A worker whose _shell_ is in a worktree while its _session_ is still in the primary used to resolve the primary, commit there and report `ok: true` with a hash — silently, which is how 7 open PRs became invisible to the tracker. Two rules close it, and a worker follows both:
  1. **Move the session, then confirm it.** After `opencode.session_move`, one read settles it: `tools.arggon.show({ id, meta: true })` must answer with the item's claimed state (`status: in_progress` + `assignee` + `branch`). If it answers `todo` with no assignee, the session is still bound to the primary — move it, do not start writing.
  2. **Never rely on the write to report where it landed.** When a worktree is involved the envelope carries `trackerRoot` (the checkout that answered), `trackerWorktree` (the `.arggon.env` identity read from it — spec [worktree-env-contract-016](../specs/spec-worktree-env-contract-016.md)) and, when the caller declares a worktree the call did not resolve into, `trackerRootMismatch`. A **write** in that state is **refused** with `error.code: "TRACKER_ROOT_MISMATCH"` naming the resolved-vs-expected mismatch; a **read** reports it instead of failing, so the state is detectable without a mutation. The remedy is named in the refusal: move the session into the declared worktree, or clear the stale declaration.

  Sourcing a worktree's `.arggon.env` (the pairing the README documents) is ONE
  way to give the seam an expectation — it is no longer the only one, and it is
  no longer load-bearing. Since bug-native-guard-silent-without-worktree-declaration
  the **claim itself declares**: `start --worktree` writes the worktree's
  `.arggon.env` at claim time, and an item-scoped call that declares nothing
  reads that footprint from the sibling worktrees of the resolved checkout
  (`git worktree list`, keyed by the call's item id). A write from an unsourced,
  unmoved session to an item whose claim lives in a worktree therefore
  **reports** `trackerRoot` + `trackerRootMismatch` — the claiming worktree named,
  with the file its declaration was read from — instead of proceeding silently:
  the state the incident hid now rides every item-scoped envelope, read or write.
  It reports rather than refuses because the claim's own lifecycle legitimately
  writes from the canonical checkout (the post-merge terminal flip, the unclaim
  of a dropped claim); the decision, its bounds and the exemptions are in
  [opencode2.md](../opencode2.md) §The binding guard → Design decision. **Rule 1 is
  still load-bearing** — a report tells you a write landed in the wrong place, it
  does not reroute it — but it is no longer the only thing protecting the
  unsourced case.

- **Evidence harness**: `npm run smoke:opencode:wave` runs headless `opencode run` sessions on a fixture with a **local bare remote** — permission probes (standards reviewer edit denied, maker subagent denied, delivery-lead allow-list), then a scripted four-phase wave (plan → two foreground makers in disjoint worktrees → reviewer verdicts → merge verification and done flips) and the run's context accounting. Separate from `npm test` and from `npm run smoke:opencode`; both are **model-driven and timing sensitive — run each one alone**, never beside a test suite or another headless harness (a stalled provider call can leave a scenario half-done past the per-command timeout); exits 0 with `skipped: opencode not installed` when the binary is absent.
- **Deterministic native-start gate**: `npm run smoke:native-start-cold` is the model-free, offline counterpart for the worktree path itself (needs `npm run build` first): on a disposable fixture it proves a dependency-requiring `pre-commit` gate fails in a cold worktree, then drives the real `tools.arggon.start` seam and requires a bounded readiness/claim-commit receipt, a claim commit containing only the item file, a deterministic re-run attach, and untouched primary installs. Run it whenever `start`/worktree behavior changes — it needs no provider, so it is safe beside anything and it complements (never replaces) the wave transcripts above.

### Worktree ownership and collisions

One claimed item → one worktree → one writer: the worktree belongs to the
session its claim stamp names (`arggon-claim.json` in the worktree's git dir —
§Single-writer ownership). The delivery lead owns the **item**; the maker owns
the **worktree** while the claim lives, and no session writes in a worktree
another **live** session holds.

A collision is noticed through the attach-time single-writer observation the
start receipt carries (`claim.foreignWrites` — the stamped owner, the claim
time, and the newer files) and through the stamp itself; `arggon doctor` reports
the surrounding repo/tracker state, not per-worktree stamps.

Resolution belongs to the stamped owner first: the owner re-attaches (the stamp
is refreshed with its identity), and coordinating with that owner is always the
cheaper remedy. When the owner is gone, the lead resolves it through
`start --worktree --take-over-worktree` (audited — it re-stamps the worktree
and records the take-over) or the manual
`rm "$(git -C <worktree> rev-parse --absolute-git-dir)/arggon-claim.json"`
escape hatch — never by hand-writing into another live session's worktree.
Recovery and merge-prep writes after that session has ended are the lead's
call.

The strict refusal (`x-tracker.strict-worktree-writes`) remains **unarmed by
deliberate choice** in this repo (decision recorded 2026-10-15,
`task-arm-strict-worktree-writes`): the default stays report-only, and this
rule is the compensating coordination discipline in its place.

### Decision briefs and the answer grammar

For an owner decision, use the canonical [decision brief](../engineering.md#the-decision-brief-the-request-side-of-the-authority-map); the grammar and routing rule are defined there, not repeated here.
