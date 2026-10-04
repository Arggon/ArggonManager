# Orchestration — multi-agent work

Part of the `arggon-cli` skill (`SKILL.md`). Non-trivial items are **orchestrated
by default**: a coordinator delegates them to subagents instead of working them
inline. Trivial items (one-line fixes, doc tweaks) stay inline. Full rules:
`ArggonManager/docs/agents.md` §Orchestration.

## The roles (named by what they decide)

Authoritative table, with the software analogue marked non-normative:
`ArggonManager/docs/engineering.md` §Roles and authority (ADR 0021 §6.1).

| Shipped id           | Role                 | Decides                                                                                                        |
| -------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `arggon-coordinator` | Delivery lead        | what is built next and in what order; who is dispatched; tracker state; merge verification and the `done` flip |
| `arggon-reviewer`    | Practice & standards | whether a change is right by the project's own bar; asks for refactor                                          |
| `arggon-worker`      | Maker                | producing the change, keeping it on the item                                                                   |
| `arggon-prover`      | Verifier             | whether the delivered thing does what was specified, by executing the project's gates                          |

Two boundaries the roles must not blur: the delivery lead **sequences** and
recommends priority — the product owner (human) sets the `priority` field; and
the verifier **reports** observed-versus-expected without deciding the verdict.
The shipped ids are wire names permissions and manifests point at (ADR 0021
§6.2a′), so cite the role, never the file name.

Everywhere else the loop is **parity**: any human and any agent may claim, work,
review, comment and merge under the same kernel rules and the same JSON
contracts. Only the irreversible overrides are structurally human-only — steal,
waive, force, reopen — and they are the product owner's (ADR 0021 §1/§2).

## Coordinator duties

- **Wave planning by file-disjointness:** group claimable items into waves whose
  members touch disjoint files/modules; items that would collide go in different
  waves.
- **Claim before dispatch:** claim every item you are about to delegate —
  `tools.arggon.start({ id, assignee, worktree: true })` (CLI: `arggon start <id>
--worktree`) — **before** launching its worker, then launch into the path the
  claim returned. That call is the worktree step: it takes the single-writer
  stamp, creates `../<repo>-<id>`, pre-builds the packages that copy owns and
  records `branch` + `worktree_path`. Never hand-roll `git worktree add` for a
  claim, never dispatch a worker as the first claimant, never claim an item you
  are not dispatching (unclaim it **and release it** —
  `tools.arggon.cleanup({ release: id })` / `arggon cleanup --release <id>`: the
  unclaim clears the assignee but leaves the claim's worktree, `.arggon.env` and
  claim stamp behind, and `--prune` cannot reap a `todo` item; the unclaim's own
  `claimFootprint` receipt names the release command), and read a start **refusal**
  as evidence,
  not a retry — `start` has no `--force`, and no refusal is a licence to route
  around it by hand.
- **Per-item worktrees:** one subagent per item, each in its own worktree — the
  recorded `worktree_path` on the item, never a `../<repo>-<id>` convention
  guess; no two subagents share a working tree.
- **Code review (practice & standards):** review **every** subagent PR before merge
  against the bar the **project's engineering docs declare** (this project's
  `ArggonManager/docs/engineering.md` §Review bar: architecture-first,
  conventions first, quality/security bar, evidence travels with the change, docs
  travel with code, scope stays on the item, **blocking smoke test** — in software
  the probe evidence and the browser drive the review bar describes) plus the
  coordination specifics: surgical staging, no cross-item files, no unrelated
  reformatting, acceptance ticks honest. Change requests and verdicts go back via
  `arggon comment <item-id>` on the item — never as GitHub PR comments.
- **Merge verification:** after each subagent PR, verify the merge; resolve
  cross-item conflicts when waves overlap.
- **Tracker ownership:** claim conflicts, blocked items, follow-up filing, and
  final wave verification (`arggon validate` ok, `arggon doctor` clean).
- **Sequencing ≠ priority:** decide what is built next and in what order, and
  recommend `priority` changes — the product owner sets the field (ADR 0021 §6.1).

## Subagent rules

- Work an item inside the worktree you were handed, and only when the item is
  **already claimed** — a coordinator that dispatches work claims it first, so
  confirm with `tools.arggon.show({ id, meta: true })` and never re-claim, never
  take over the stamp and never hand-roll a worktree. Claim it through `start`
  (never a bare `update --status in_progress`) only when you picked the item up
  yourself and no claim exists.
- Never flip your item `done` — completion is the coordinator's call after merge
  verification — and never reopen `done`/`cancelled` or steal a claim. Those
  irreversible overrides are the product owner's, structurally.
- Expect the coordinator's code review on your PR and address change requests
  before it merges.
- Come with smoke evidence for behavior changes: the project's gates executed
  end-to-end against the specification, reported as expected-vs-observed (in
  software: changed commands probed on a fixture, UI changes browser-driven per
  ADR 0008) — the smoke gate blocks merge.
- Keep the item's acceptance checklist honest: it is the **done contract** and
  the domain-invariant — a non-software project checks it with its own gates, a
  software project with tests, lint and a smoke.
- Report findings back to the coordinator instead of filing tracker items — the
  coordinator consolidates and files.

## Worktrees in practice

`arggon start <id> --worktree` claims, creates (or attaches to) the worktree at
`../<repo-name>-<id>`, runs the claim commit/push inside it, and records
`worktree_path` on the item. Start prepares the worktree first — it mirrors the
primary checkout's `node_modules` as a per-worktree link farm when the worktree
lacks an install, so the repo's pre-commit gate can run (start never commits the
install; it is removed before a configured `x-worktree.post-start` hook runs, so
`npm ci` cannot reify through it and empty the primary install) — and a failure
after creation keeps the worktree and branch instead of deleting them (the error
names the failing step, path and remediation; re-running attaches). The workspace
packages the worktree also carries (`node_modules/@arggondev/lib -> ../../lib`) are
pointed at the worktree copy and pre-built with the package's own `build` script
before the claim commit when their declared entry is missing, so the spawned
CLI/tests run the branch's build; a copy that could not be built keeps the
primary's copy and is named by `linkedWorkspaces` in `--json` (re-read after the
hook). A worktree that must use a full local install can run `npm ci` (e.g. via
`x-worktree.post-start: npm ci`). Move the session into that path
(`session_move` in OpenCode V2) so every later command runs there. When the work
is merged, `arggon cleanup` lists stale worktrees and `--prune` removes them.

The claim, branch, PR and validate rules apply to subagents **unchanged**: same
commands, same gates, same never-list. The kernel enforces the rules; neither
role forks them.
