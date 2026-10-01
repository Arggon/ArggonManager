---
exploration_id: worktree-env-isolation-016
title: "Parallel worktree runtime isolation: run N instances of a project with minimal resources"
status: open
created: 2026-10-01
---

# Exploration: Parallel worktree runtime isolation: run N instances of a project with minimal resources (worktree-env-isolation-016)

Trigger: coordinator directive (2026-10-01) — "we create a new worktree for each
task so we can work without altering other files … however, this sometimes
leads to environment-related issues. For instance, we cannot run the same
project multiple times to test different changes simultaneously … Docker might
be the solution, but let's find the best approach that consumes the fewest
possible resources."

Every number below was **measured on this machine on 2026-10-01** (12 CPUs,
31 GiB RAM, ≈16 GiB available, Docker 29.7.2 with the daemon active, Node
26.7.0, psql client 18.6 with no local server binaries — `initdb`/`pg_ctl`
absent, so Postgres here already runs only in Docker). The scope is every repo
that follows the per-item-worktree loop (`start --worktree` →
`../<repo>-<item-id>`): ArggonManager itself plus the adopter projects that
share this workflow. The decision lands in an ADR — numbering note:
exploration 015 and ADR 0017 are reserved by the open PR
[#519](https://github.com/Arggon/ArggonManager/pull/519), so the follow-up ADR
must take the next free id at merge time.

## Candidates

1. **C1 — Host-native per-worktree environment contract (no containers).**
   `start --worktree` derives the worktree identity it already has (item id,
   worktree path) into a runtime environment contract: exported/`sourced` env
   (`ARGGON_WORKTREE_ID`, `ARGGON_WORKTREE_PATH`), a generated **gitignored**
   `.env` seed (copied from the primary checkout only if absent, never
   overwritten), suffixed per-worktree state/cache dirs for projects that opt
   in (`XDG_*` variants), and the documented convention that servers bind an
   **ephemeral port** (`:0`) or a port derived from the worktree id. Services
   are isolated by *identifier*, not by machine: database name/schema per
   worktree against one local server, Redis logical DB or socket path per
   worktree. Resource cost: kilobytes.
2. **C2 — Ephemeral per-worktree service containers (Docker for services
   only).** The app keeps running on the host; only stateful dependencies get
   a per-worktree throwaway container: a Compose project named
   `<repo>-<item-id>` (unique network + volumes per worktree), publishing to a
   **random host port** (or no published port at all — access through a
   per-worktree unix socket directory), or `docker run --rm --tmpfs` for
   stateless test databases. Images are shared across worktrees; a test DB
   lives only for the run. Resource cost: the container's processes' RAM
   (tens of MB for an alpine Postgres), zero disk when the image is already
   pulled, writable layer only.
3. **C3 — Full dev-environment container per worktree** (devcontainer / Compose
   with toolchain + app + services in-container). Image layers shared across
   worktrees of the same project; marginal disk per worktree is the writable
   layer plus an in-container `node_modules` (182 MB for this repo unless
   volume-cached); RAM is the whole toolchain per instance; every agent seam
   (pre-commit gate, Playwright, ZCode/OpenCode hooks) must run in-container
   or exec into it.
4. **C4 — Distrobox/toolbox container per worktree.** A container with deep
   host integration: it **mounts the host `$HOME` as the container home by
   design**, so state, caches and DB connections are shared with the host and
   with every other box unless `--home` is overridden per box — which reduces
   it to a hand-rolled C3 without the image/workflow tooling.
5. **C5 — Nix / devbox per project (reproducible toolchains, store dedupe).**
   `/nix/store` deduplication makes per-project toolchains cheap on disk and
   kills version skew across worktrees; it provides **no runtime isolation**
   (same ports, same services, same `$HOME` state). Orthogonal to C1/C2.
6. **C6 — VM per worktree.** Hardware-level isolation; GB-scale RAM and disk
   per parallel instance. The maximal-cost answer to a problem mostly made of
   conventions.

## Criteria

1. **Marginal resource cost per parallel instance (high)** — the stated
   constraint: the approach that lets N instances coexist while adding the
   least RAM/disk/CPU per instance.
2. **Collision-class coverage (high)** — does it actually kill the four
   collision classes observed in the wild: ports; shared service state (the
   fixed-port DB container below); writable singleton dirs (caches, XDG
   state, gitignored `.env`); and single-instance tooling (watch modes, test
   watchers)?
3. **Agent-loop integration (high)** — the loop that ships today (worktree
   link farms, the `arggon validate` pre-commit gate, Playwright with
   `preserveSymlinks`, ZCode/OpenCode seams, `cleanup --prune`) must keep
   working unchanged; the worktree path stays the unit of work.
4. **Adopter blast radius and dependency policy (medium)** — ADR 0001 keeps
   the product dependency-light and adopter trees dependency-less; ADR 0005
   records "infrastructure is expensive" as operating principle 2. The
   methodology cannot *require* Docker; a project opts in.
5. **Effort/risk and operability (medium)** — how the app discovers its
   assigned port/socket, what happens to leftovers (orphans), and how much
   new convention the docs must carry.
6. **Reversibility (low)** — a project can adopt the layers it needs, one at
   a time, without methodology churn.

## Findings

### F1 — The real collisions are services and state, not code; and the repo itself is nearly collision-free by construction

- ArggonManager's own run surface is already parallel-safe: `board --serve`
  binds `server.listen(opts.port ?? 0, "127.0.0.1")` — an **ephemeral port**
  by default (`cli/src/board-serve.ts:473`, read 2026-10-01; a served session
  in the tracker history recorded port 45887), the Playwright suite drives the
  built CLI on a **temp fixture** with one worker (`playwright.config.ts`,
  read 2026-10-01), vitest runs hermetically, and `dist/` is per-worktree by
  definition. Two worktrees of *this* repo already run tests concurrently.
- The adopter projects are where parallel runs break, and the failure mode is
  **fixed-host-port shared service state**: `docker ps` on this machine shows
  `evajoyas-db` (postgres:17.11-alpine) published at `0.0.0.0:5433->5432` and
  `mssql` at `127.0.0.1:1433->1433`, both up for 13 h (measured 2026-10-01).
  A second worktree of evajoyas pointed at `localhost:5433` does not "run the
  project a second time" — it shares one database with the first, so
  migrations and test data collide.

### F2 — Where the resources actually go today

- A full `node_modules` here is **182 MB** (`du`, 2026-10-01); ~9 sibling
  `ArggonManager-<item-id>` worktrees existed in `~/Projects` — full installs
  per worktree would be ≈1.6 GB, which is exactly what `start --worktree`'s
  link farm avoids and what an in-container toolchain (C3) would re-introduce
  per worktree unless volume-cached.
- Docker on this machine already holds **5.3 GB images, 1.377 GB containers,
  3.9 GB volumes — of which 3.3 GB volumes are reclaimable** across 33
  containers (2 active) and 78 volumes (`docker system df`, 2026-10-01).
  Orphaned per-worktree infrastructure that nothing reaps is the *observed*
  cost pattern, not a hypothetical one.

### F3 — Containers share the host kernel: a container costs its processes, not a machine

Docker on Linux isolates with namespaces and caps with cgroups **on the host
kernel**; there is no guest kernel or hypervisor, so container startup
overhead is roughly that of starting a process, and the standing footprint is
the container's own processes plus its writable layer (sources:
[Red Hat — Introduction to Linux containers](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux_atomic_host/7/html/overview_of_containers_in_red_hat_systems/introduction_to_linux_containers),
[CMU — Namespaces and cgroups, the basis of Linux containers](https://www.andrew.cmu.edu/course/14-712-s20/applications/ln/Namespaces_Cgroups_Conatiners.pdf),
[Docker forums — containers share the same kernel, no VM overhead](https://forums.docker.com/t/basic-question-on-container-stack/21284),
accessed 2026-10-01). VMs virtualize hardware and pay the guest-OS cost —
that is C6. This makes **C2 the cheapest real isolation unit available** for
stateful services: an alpine Postgres container idles at tens of MB of RAM and
zero marginal disk when the image is shared (this machine already pulls
postgres:17.11-alpine).

### F4 — Distrobox/toolbox is built to *share* state, which is the problem, not the solution

Distrobox mounts the host's `$HOME` as the container home — that is the
feature (host tools, dotfiles, USB devices integrate seamlessly), and it means
every box sees the same caches, config and DB connections (sources:
[distrobox.it](https://distrobox.it),
[GitHub issue #2036](https://github.com/89luca89/distrobox/issues/2036),
[ArchWiki — Distrobox](https://wiki.archlinux.org/title/Distrobox), accessed
2026-10-01). A `--home` override per box exists
([distrobox.it — useful tips](https://distrobox.it/useful_tips), 2026-10-01)
but then the box shares nothing and you have re-implemented C3 by hand with
weaker image tooling. **C4 fails criterion 2 by design.**

### F5 — Ports are a convention, and this repo already encodes the alternative

Any server can bind `:0` and discover its assigned port; the repo's own
`board --serve` does exactly that (F1), and `docker run -P` / Compose
publishing without a host port assign **random host ports** the same way
(Docker docs, accessed 2026-10-01). Postgres and Redis likewise accept a
per-instance unix socket directory, removing ports entirely. Fixed ports are
a *choice* baked into adopter configs — the cheapest fix is a convention that
makes the choice explicit per worktree, not infrastructure.

### F6 — The natural implementation seam already exists in `start`

`start --worktree` already computes the worktree identity (item id, path,
branch), prepares dependencies and reports a bounded receipt
(`linkedNodeModules`, `builtWorkspaces`, `manifestCoverage`); the OpenCode
plugin already correlates sessions to work items via `ARGON_ITEM` and the
branch (`docs/agents.md` §OpenCode V2, read 2026-10-01). Exporting a
per-worktree environment contract from the same seam (and recording it in the
receipt) is an extension of existing behavior, not a new subsystem.

### F7 — Prior decisions constrain the shape

ADR 0001 (dependency-light Node CLI; adopter trees install nothing) and ADR
0005 (operating principle 2: "infrastructure is expensive" — read
2026-10-01) rule out making Docker a *requirement* of the loop and favor the
candidate stack that adds nothing by default. ADR 0011 makes any adopted
convention a methodology carrier (behavioral impact class).

### F8 — Whatever creates per-worktree infra must be reaped by the same lifecycle

`arggon cleanup --prune` already reaps merged worktrees and clears
`worktree_path`; F2 shows unmanaged docker residue on this very machine
(3.3 GB reclaimable). Any C2 adoption must extend cleanup (Compose project
per worktree → `docker compose -p <repo>-<item-id> down -v --remove-orphans`)
or it converts a workflow win into a permanent disk leak. This is the same
lesson as the tracker's own auto-commit hygiene: the lifecycle that creates
must also delete.

## Recommendation

**Adopt a layered policy: C1 always, C2 where a stateful-service collision
actually exists; reject C3, C4 and C6 as defaults; treat C5 as an optional,
per-project complement (out of scope for arggon).**

- **C1 wins criterion 1 outright (kilobytes) and kills most of the observed
  collisions by convention** (F1, F5): ephemeral/derived ports, suffixed
  state dirs, per-worktree DB *names* against one server, gitignored `.env`
  seeds — implemented as an extension of the existing `start` seam (F6), so
  criterion 3 holds. If a project's parallel instances only ever collide on
  ports and state dirs, C2 never needs to exist for it.
- **C2 is the cheapest unit of *real* isolation when one server cannot be
  shared** (F3): two worktrees running migration-backed suites against
  Postgres need separate server instances (or at least separate
  initdb/roles), and a named Compose project per worktree gives that for the
  RAM of the service itself — no toolchain in any container, all agent seams
  untouched, image layers shared across worktrees.
- **C3 loses on criteria 1 and 3**: it re-pays 182 MB × N of install (or
  volume machinery), adds per-instance RAM for the toolchain, and forces the
  pre-commit/Playwright/agent seams into containers — significant new
  convention to buy isolation C1/C2 already deliver. Keep it as the explicit
  escape hatch for a project whose toolchain genuinely cannot run on the
  host.
- **C4 loses on criterion 2** (F4): sharing `$HOME` is its purpose, and
  `--home` overrides turn it into a worse C3.
- **C6 loses on criterion 1 by an order of magnitude** and is not seriously
  in contention on a shared-kernel Linux host.

If the decision is accepted, the follow-up shape is: ADR (next free 4-digit
id — 0017 is reserved by open PR #519, so likely 0018) → spec for the
`start` environment contract (env vars, `.env` seed rules, receipt fields)
with tasks under the `parallel-worktree-runtime-isolation-ports-state-services`
story → docs convention section + the per-worktree Compose pattern documented
for adopters → `cleanup` integration (F8). Explicit YAGNI deferrals: no
`arggon compose` wrapper command, no global port-allocation registry, no
Docker installation assistance — the convention is a file format and a name,
not a subsystem.

## Decision

<!-- ADR reference placeholder: ArggonManager/docs/adr/0000-<slug>.md once the ADR lands. -->
