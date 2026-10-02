# 0019 Worktree runtime isolation: environment contract by default, ephemeral service containers as an opt-in pattern

- Status: Proposed
- Date: 2026-10-01
- Deciders: Product owner (accepted the recommendation, 2026-10-01); coordinator recorded
- Evidence: [exploration-worktree-env-isolation-017](../explorations/exploration-worktree-env-isolation-017.md)
- Numbering note: drafted as 0018; a concurrent update-delivery ADR merged
  first on `main` and took 0018, so this record renumbers to the next free id
  (2026-10-01).
- Amendment (2026-10-02, PR #568): decision point 4 below adds the
  single-writer **claim/concurrency** layer (claim stamp + attach-time
  detection + the `strict-worktree-writes` escalation). It amends this record
  in the same direction it was accepted in — additive detection, no new
  dependencies, no platform-specific primitives, kernel stays convention-first
  — behind a default that is byte-identical to before. `engineering.md`'s
  "Claim/concurrency model" line is why it lands here and not in
  `agents.md` alone.

## Context

The methodology's loop is one worktree per item (`start --worktree` →
`../<repo>-<item-id>`), on every machine that installs ArggonManager (npm,
OpenCode V2 seam, ZCode plugin) and for every adopter project shape. Worktrees
isolate *files* but not *runtime state*: parallel runs of the same project
collide on fixed ports, shared local services and singleton state dirs. The
product owner asked for the best approach "that consumes the fewest possible
resources" and accepted the layered recommendation from exploration 017
(measured evidence: 2026-10-01).

Constraints from prior decisions: ADR 0001 keeps the product dependency-light
and adopter trees install nothing; ADR 0005 records operating principle 2 —
"infrastructure is expensive" — for exactly this adopter population; the
bundled skill advertises `platforms: [linux, macos, windows]`, and on macOS and
Windows Docker Desktop runs containers inside a Linux VM, so Docker can never
be a default assumption of the loop.

## Decision

**A layered policy, applied to every adopter repo:**

1. **Environment contract by default (layer 1).** `start --worktree` writes a
   gitignored, dotenv-style `.arggon.env` carrying the worktree identity
   (`ARGON_ITEM` — the plugin's existing correlation name — plus
   `ARGGON_WORKTREE_ID/PATH/BRANCH`), per-OS suffixed state/cache dirs
   (`ARGGON_STATE_DIR`/`ARGGON_CACHE_DIR`, following the env-paths platform
   conventions), and seeds `.env` copy-if-absent. Projects pair it with the
   documented conventions: servers bind ephemeral ports (`:0`) or a port
   derived from the worktree id; services are isolated by identifier
   (per-worktree database name/schema) against one local server. Spec:
   [spec-worktree-env-contract-016](../specs/spec-worktree-env-contract-016.md).
2. **Ephemeral per-worktree service containers as a documented opt-in pattern
   (layer 2), never a kernel feature.** For adopters who already ship Docker
   (CI or prod), stateful dependencies run as a Compose project named
   `<repo>-<item-id>` with random host ports or supported sockets, living only
   for the run. arggon's role stays conventional (naming, docs);
   `cleanup --prune` may reap such projects **only when the repo's convention declares
   them** and otherwise skips with a report — the kernel never probes for or
   invokes Docker the convention didn't declare.
3. **Rejected as defaults:** full dev-environment containers per worktree
   (re-pays per-worktree installs and forces agent seams into containers —
   worst where Docker is VM-backed), distrobox/toolbox (mounts host `$HOME` by
   design, preserving the collisions), VMs per worktree (GB-scale cost for a
   problem mostly made of conventions). Nix/devbox stays an optional,
   per-project complement outside arggon's scope.

4. **Single-writer ownership: a claim stamp plus attach-time detection, by
   default advisory (layer 0).** `start --worktree` stamps the worktree with
   its owning session — `arggon-claim.json` in the worktree's **git dir**
   (`git rev-parse --absolute-git-dir`), never in the work tree, so the stamp
   cannot dirty `git status`, block `git worktree remove`, or acquire a
   cleanup step. On an **attach** the previous stamp is read before it is
   replaced: a different identity plus tracked files modified after that
   claim is the concurrent-writer signature, reported bounded and named
   (`claim.foreignWrites`). Detection is report-only by default;
   `x-tracker.strict-worktree-writes: true` escalates it to an attach refusal
   before any item mutation.

   > Amendment (2026-10-02, PR #568): exploration-017 finding F12 — a CLAIMED
   > worktree was written into by a concurrent session mid-task (disclosed on
   > PR #544) — showed the ownership model was pure convention, and that this
   > record decided runtime *isolation* without deciding *concurrency*. Two
   > invariants are part of the decision, not implementation detail: (a) a
   > fired detection **never re-stamps** the worktree (the anti-unlock rule —
   > otherwise a refused attach makes its own retry match and claims silently
   > over the owner's uncommitted work), and (b) recovery from a dead stamped
   > session is explicit: the refusal names the manual
   > `rm <git-dir>/arggon-claim.json` step, and a designed take-over hatch is
   > tracked in `task-strict-attach-dead-owner-hatch`. Detection covers the
   > uncommitted window only; committed foreign work is history.

Explicit YAGNI: no `arggon compose` wrapper, no global port-allocation
registry, no Docker detection/installation in the kernel, no unix-socket
requirement (an optimization where available, never the contract).

## Consequences

- The kernel gains no dependencies and no platform-specific primitives; the
  whole layer-1 path is filesystem-only and degrades to a no-op for adopters
  who read none of the keys (e.g. static-site shapes).
- JSON contract grows additively (`preparation.env`); `schemaVersion`
  unchanged.
- Methodology carriers touched by the convention are **Behavioral** under
  ADR 0011/0016 (agents re-learn a receipt field and a convention key); the
  skill and its copies stay byte-equal in the same PR.
- Layer 2 is documentation, not enforcement: adopters without Docker lose
  nothing; adopters with it keep their own lifecycle, now reaped by cleanup
  when declared. Unreaped per-worktree infrastructure is a known residue
  class (exploration 017, F2/F8) — the declaration gate is what keeps cleanup
  safe by construction.
- Follow-up implementation is filed as tasks under
  `parallel-worktree-runtime-isolation-ports-state-services` and follows the
  spec → plan → PR pipeline.
- The claim/concurrency layer (decision point 4) keeps the kernel
  dependency-free: the stamp is a JSON file in a directory git already owns,
  detection is one porcelain read plus one `stat` per dirty path with a 10-name
  cap, and there is no cleanup surface (git removes the directory with the
  worktree).
- Its JSON contract also grows additively (`claim`, `preparation.claim`),
  `schemaVersion` unchanged, and the default path (no fired detection, flag
  unset) is byte-identical to pre-PR receipts.
- Identity is the resolved assignee on the CLI and the calling session id on
  the native tools, so a mixed CLI-start → native-attach fires exactly one
  benign warning — which is the F12 signature, i.e. the feature rather than a
  false accusation. Unifying the two identities is left open deliberately.

## Alternatives considered

| Alternative | Verdict | Because |
| --- | --- | --- |
| Full dev-environment container per worktree (devcontainer/Compose with toolchain) | Rejected as default | per-worktree install + toolchain RAM; agent seams (pre-commit gate, Playwright, session hooks) must run in-container; worst on macOS/Windows where Docker is VM-backed. Kept as the escape hatch for toolchains that genuinely cannot run on the host. |
| Distrobox/toolbox per worktree | Rejected | mounts host `$HOME` by design — preserves the state collisions it is meant to solve; `--home` overrides reduce it to a hand-rolled container without the image workflow. |
| VM per worktree | Rejected | GB-scale RAM/disk per parallel instance; containers already share the host kernel on Linux. |
| Nix/devbox per project | Out of scope | cheap reproducible toolchains (store dedupe), but no runtime isolation; a per-project complement, never an arggon requirement. |
| Kernel-enforced port allocation registry | YAGNI | ports are an app convention; ephemeral binding (`:0`) already exists everywhere and is what `board --serve` does. |
| `arggon compose` wrapper command | YAGNI | the pattern is a name and a manifest; a wrapper would duplicate Compose badly. |
| A lockfile the CLI and native tools both honor (decision point 4's concurrency model) | Rejected | it needs a shared lock protocol plus its own dead-holder problem (a crashed holder blocks forever) for strictly less information than the stamp; the stamp is advisory and the refusal explicit. |
| Commit-log-based concurrent-writer detection | Rejected | committed foreign work is history, not a live second writer — the F12 collision window is the uncommitted one, and scanning history would buy a log read per attach to re-report what the mtime comparison already bounds. |
| Strict worktree-writes by default | Rejected | a crashed session would deadlock every recovery path on a non-interactive surface; advisory-first keeps the loop recoverable and arming the flag is a one-line convention change. |
| Auto-takeover after a stale-stamp window | Deferred | a long-but-live session can be stolen silently; an explicit hatch (`task-strict-attach-dead-owner-hatch`) keeps the take-over a deliberate act. |
