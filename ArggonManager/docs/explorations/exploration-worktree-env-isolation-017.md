---
exploration_id: worktree-env-isolation-017
title: "Parallel worktree runtime isolation: run N instances of a project with minimal resources"
status: resolved
created: 2026-10-01
---

# Exploration: Parallel worktree runtime isolation: run N instances of a project with minimal resources (worktree-env-isolation-017)

Trigger: coordinator directive (2026-10-01) — "we create a new worktree for each
task so we can work without altering other files … however, this sometimes
leads to environment-related issues. For instance, we cannot run the same
project multiple times to test different changes simultaneously … Docker might
be the solution, but let's find the best approach that consumes the fewest
possible resources."

**Scope: adopters, not this repo.** The loop being improved is the per-item
worktree (`start --worktree` → `../<repo>-<item-id>`) wherever ArggonManager is
installed — via npm (`arggon-manager` + `arggon init`/`adopt`), the OpenCode V2
seam, the ZCode marketplace plugin, or any other client of the CLI/MCP surface
— on **any machine**. The bundled skill advertises
`platforms: [linux, macos, windows]` (source:
`.agents/skills/arggon-cli/SKILL.md` frontmatter, read 2026-10-01), so a
recommendation is only valid if it holds when Docker is absent, on macOS and
Windows, and for every adopter project shape. Machine-specific numbers below
(measured on the author's Linux workstation, 2026-10-01: 12 CPUs, 31 GiB RAM,
Docker 29.7.2 active, Node 26.7.0, psql client 18.6 with no local server
binaries) are **evidence of collision classes**, not an adopter baseline — the
ArggonManager repo itself is just the first adopter of its own convention.

The decision lands in an ADR — numbering note (revised 2026-10-01 after a
merge race): this record was drafted as exploration 016 when exploration 015
and ADR 0017 were still reserved by the open PR
[#519](https://github.com/Arggon/ArggonManager/pull/519). A **concurrent
record for a different topic — update delivery — merged first** and took
exploration 016, ADR 0018 and spec/plan 015 on `main`. Numbers are assigned by
merge order, so this record renumbers to **exploration 017, ADR 0019 and
spec/plan worktree-env-contract-016**; the draft-era ids (016/0018/015) appear
only in historical tracker comments, never in linked documents.

## Candidates

1. **C1 — Host-native per-worktree environment contract (no containers, no
   new dependencies).**
   `start --worktree` derives the worktree identity it already has (item id,
   worktree path) into a runtime environment contract: a generated
   **gitignored, dotenv-style env file** in the worktree (the
   lowest-common-denominator mechanism — every runtime on every platform can
   load one, whereas shell `export` snippets are shell-specific; the dotenv
   convention: [github.com/motdotla/dotenv](https://github.com/motdotla/dotenv),
   accessed 2026-10-01) carrying documented variable names
   (`ARGGON_WORKTREE_ID`, `ARGGON_WORKTREE_PATH`, …), seeded from the primary
   checkout's `.env` only if absent, never overwritten; a **per-OS state-dir
   mapping** for projects that opt in (per-worktree suffixed cache/state
   dirs — see F11 for the per-platform conventions); and the documented
   convention that servers bind an **ephemeral port** (`:0`, portable to all
   three platforms) or a port derived from the worktree id. Services are
   isolated by *identifier*, not by machine: database name/schema per
   worktree against one local server, Redis logical DB per worktree. Works
   with zero tooling installed beyond Node itself.
2. **C2 — Ephemeral per-worktree service containers (Docker for services
   only, opt-in per adopter).** The app keeps running on the host; only
   stateful dependencies get a per-worktree throwaway container: a Compose
   project named `<repo>-<item-id>` (unique network + volumes per worktree),
   publishing to a **random host port** (or no published port at all where
   sockets are supported), or `docker run --rm --tmpfs` for stateless test
   databases. Images are shared across worktrees; a test DB lives only for
   the run. Resource cost: the container's processes' RAM (tens of MB for an
   alpine Postgres), zero disk when the image is already pulled, writable
   layer only — **on Linux**; on macOS/Windows Docker Desktop runs containers
   inside a Linux VM, so adopters there pay the VM's standing footprint
   (F9). This is a **documented pattern for adopters who already ship
   Docker**, never an arggon requirement — where Docker is absent the
   pattern degrades to a docs page, and the loop (C1) still works.
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
7. **Platform portability across adopters (high)** — the contract may not
   depend on Linux-only primitives (`$HOME` assumptions, unix sockets,
   systemd) nor on tooling an adopter may not have (Docker): portable pieces
   are the default, platform/tool-specific pieces are opt-in patterns that
   degrade to documentation when absent.

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
must also delete. For adopters this must be **opt-in and safe by
construction**: cleanup may only touch Docker when the project's convention
declares it (a committed services manifest / Compose file in the repo), and
it must skip with a report — never probe for a Docker daemon it wasn't told
about.

### F9 — Adopters run on three platforms, and Docker is a VM there

The product advertises `platforms: [linux, macos, windows]` (source:
`.agents/skills/arggon-cli/SKILL.md` frontmatter, read 2026-10-01); nothing in
any adopter contract installs or requires Docker. On Linux the Docker daemon
runs natively on the shared host kernel (F3); on macOS and Windows **Docker
Desktop runs containers inside a Linux VM** (WSL2/HyperKit/Virtualization
framework backends), so adopters there pay the VM's standing RAM/disk on top
of every container (source:
[Docker Desktop docs — VM-based architecture / WSL 2 backend](https://docs.docker.com/desktop/),
accessed 2026-10-01). Consequences: (a) Docker-dependent candidates (C2/C3)
can only ever be **documented opt-in patterns** for projects that already ship
Docker — most cheaply for teams whose CI/prod already containerize the same
services; (b) C1 is the only candidate whose marginal cost is zero on *all
three* platforms; (c) the contract itself must be built from portable
primitives — TCP ports (`:0` ephemeral binding is POSIX and Windows alike),
dotenv files, per-OS directory conventions — with sockets an optimization
where available, never the mechanism.

### F10 — Adopter project shapes differ, so the contract must degrade to a no-op

ADR 0005 already classifies adopter projects by shape and keys defaults on
that shape — static/docs, SPA + small API, long-running server/DB, jobs
(read 2026-10-01). The same spectrum applies here: a static-site adopter has
no services and no ports (the contract must be invisible to it), a server
adopter needs the port convention, a DB adopter needs the identifier
convention and — optionally, if it already uses Docker — the C2 pattern. A
contract that required any given tool or service would be wrong for most of
the shapes the methodology itself advertises; **the default path must be
"adds nothing, changes nothing" and every isolation feature must be pulled
in by the project's own manifests and config.**

### F11 — Per-OS state-directory mapping is a solved naming problem

The per-platform conventions for cache/data/state/log directories are
documented and battle-tested — XDG under `~/.config`/`~/.cache` on Linux,
`~/Library/Application Support` + `~/Library/Caches` on macOS,
`%LOCALAPPDATA%`/`%TEMP%` on Windows (source:
[github.com/sindresorhus/env-paths](https://github.com/sindresorhus/env-paths),
accessed 2026-10-01). A per-worktree suffix rule layered on those conventions
(each dir suffixed with the worktree id) gives adopters isolated state
without inventing a new scheme, and Node's `os.tmpdir()` covers scratch
paths portably. The kernel should name the *variables* and the *suffix rule*
in the spec; the per-OS paths come from the platform conventions, not from
arggon.

### F12 — Worktrees isolate files per item; nothing enforces one *writer* per claimed worktree

The process model of the loop is: one claimed item → one worktree
(`../<repo>-<item-id>`) → one session that owns it. Ownership is convention,
not enforcement. Observed 2026-10-01: the seam-pin worker session
(`ses_f0821d67`, disclosed on PR
[#544](https://github.com/Arggon/ArggonManager/pull/544)) found a concurrent
writer session active **in its claimed worktree** (writes at 10:18,
11:41–44, 12:04–07 local); the worker waited for it to finish, re-assessed and
adopted the writer's converged state — no work was lost, but only the two
sessions' discipline and disclosure kept it that way. This is a *process*
collision class the runtime options above deliberately do not address: two
sessions in one worktree share one identity (same branch, same `.arggon.env`,
same ports), so C1 cannot separate them. The mitigation layer is session
ownership (F14), and the residual open question — should the kernel or plugin
*detect and refuse* a second live session on a claimed worktree — is recorded
as an open question for the coordinator, not resolved here.

### F13 — The gate environment is the most-repaired runtime leak: eight install-incidents, one root cause

Across 2026-10-01 sessions, eight consolidated incidents
(bug-start-install-ordering) hit one shape: a fresh worktree whose pre-commit
gate bins resolved **outside** it — a sibling worktree, the primary checkout,
or nowhere (`tsx: command not found`), once silently (the claim commit skipped
without surfacing an error). The leaked runtime resource is the install itself
(`node_modules`/link farm) — the "writable singleton dirs" collision class of
criterion 2, applied to tooling. The fix arc also fixed the *semantics*:
[#517](https://github.com/Arggon/ArggonManager/pull/517) added named-source
`gateBins` receipts, [#533](https://github.com/Arggon/ArggonManager/pull/533)
added the opt-in strict gate for attach runs, and
[#551](https://github.com/Arggon/ArggonManager/pull/551) made a created
worktree's start **refuse before the claim write** unless the gate bins
resolve inside it (naming bins, prep log, `npm ci` remediation) — i.e.
**report honestly where the run is a guest (attach), hard-fail where the tool
vouches for what it just built (create)**. Live confirmation on this very item
(2026-10-01): an attach start resolved all eight gate bins from the worktree
(`source: "worktree"` ×8, strict armed, no refusal, no hand-`npm ci`) — the
fixed ordering holds on a real attach.

### F14 — Per-session resolution is proven end-to-end, which is what makes single-writer worktrees implementable

PR [#559](https://github.com/Arggon/ArggonManager/pull/559)'s smoke leg drives
the real OpenCode host: a session created at a fixture primary, moved with
`POST /api/session/{id}/move` to the item worktree, then a model-free agent
loop calls `tools.arggon.comment` through the real plugin — and
`resolveToolCwd` resolves **per call**: the commit lands on the item branch in
the worktree; primary HEAD and porcelain stay untouched (42/42 checks, two
consecutive green runs). Together with F13's gate semantics, the process side
of the isolation model now has the property the env contract gives files:
*identity resolves per session, per call, per worktree*. What the smoke leg
pins is resolution, not exclusion — F12's two-writers incident is compatible
with every mechanism here and remains the open process gap.

### Incident register (all observed 2026-10-01 on this repo's own loop)

| Incident | Collision class | Finding | Status |
| --- | --- | --- | --- |
| Claimed worktree written into by a concurrent session (PR #544 disclosure) | process — single-writer ownership | F12 | open — coordination-layer convention; enforcement question filed for the coordinator |
| Eight install-incidents: gate bins resolving outside the fresh worktree (bug-start-install-ordering) | runtime — install/gate environment leaks across worktrees | F13 | resolved — #517/#533/#551; all eight signatures mapped to tests or fixed-by-the-gate |
| Session↔worktree resolution assumed, not proven, on the real host (from the PR #426 review) | process — per-session resolution | F14 | resolved — PR #559 smoke leg green |
| Attach-vs-created gate semantics (#517/#533/#551) | runtime — enforcement semantics | F13 | resolved — documented contract (convention.md, attach-vs-created) |

## Recommendation

**Adopt a layered policy for every adopter repo, on every platform: C1
always; C2 only for adopters who already ship Docker and have a real
stateful-service collision; reject C3, C4 and C6 as defaults; treat C5 as an
optional, per-project complement (out of scope for arggon).**

- **C1 wins criterion 1 outright (kilobytes on every OS) and kills most of
  the observed collisions by convention** (F1, F5): ephemeral/derived ports,
  per-OS suffixed state dirs (F11), per-worktree DB *names* against one
  server, a gitignored dotenv seed — delivered as a file by the existing
  `start` seam (F6), loaded by whatever runtime the adopter already uses, so
  criteria 3 and 7 hold. For project shapes with no services at all it
  degrades to a no-op (F10): the file exists, nothing reads it, nothing
  changes. If a project's parallel instances only ever collide on ports and
  state dirs, C2 never needs to exist for it.
- **C2 is the cheapest unit of *real* isolation when one server cannot be
  shared** (F3) — and it is a **pattern, not a feature**: documented for
  adopters whose repos already containerize those services (CI or prod),
  which is precisely where the images and the muscle memory already exist.
  On Linux the marginal cost is the service's own RAM; on macOS/Windows the
  Docker Desktop VM is a standing cost the adopter is already paying for
  those services (F9) — the per-worktree increment stays small, but it is
  recorded honestly. arggon's role stays conventional: the project name
  (`<repo>-<item-id>`), the manifest that declares it, and — only then —
  `cleanup` reaping it (F8). The kernel never probes for or invokes Docker
  the convention didn't declare.
- **C3 loses on criteria 1, 3 and 7**: it re-pays the per-worktree install
  (182 MB × N for a Node project, unless volume machinery), adds
  per-instance RAM for the toolchain, forces the pre-commit/Playwright/agent
  seams into containers, and is *worst* exactly where Docker is VM-backed
  (F9). Keep it as the explicit escape hatch for a project whose toolchain
  genuinely cannot run on the host.
- **C4 loses on criterion 2** (F4): sharing `$HOME` is its purpose, and
  `--home` overrides turn it into a worse C3.
- **C6 loses on criterion 1 by an order of magnitude** on every platform and
  is not seriously in contention.

If the decision is accepted, the follow-up shape is: ADR (next free 4-digit
id at merge time — the numbering race above is why this record now cites 0019)
→ spec for the
`start` environment contract (documented variable names, dotenv file
mechanism, seed rules, per-OS state-dir mapping per F11, receipt fields,
degradation semantics when the adopter reads none of it) with tasks under the
`parallel-worktree-runtime-isolation-ports-state-services` story → docs
convention section (ports/state/identifiers) → an adopter-facing pattern doc
for the per-worktree Compose services (C2) via the playbook pipeline →
opt-in `cleanup` integration per F8. Carriers touched by the convention are
methodology carriers under ADR 0011/0016: impact class **Behavioral**, skill
and copies kept byte-equal in the same PR. Explicit YAGNI deferrals: no
`arggon compose` wrapper command, no global port-allocation registry, no
Docker detection/installation assistance in the kernel, no unix-socket
requirement (an optimization where available, never the contract) — the
convention is a file format and a name, not a subsystem.

## Decision

[ADR 0019 — Worktree runtime isolation: environment contract by default, ephemeral service containers as an opt-in pattern](../adr/0019-worktree-runtime-isolation.md)
records the decision (status: Proposed; **accepted by the product owner on
2026-10-01**, ADR flips to Accepted at merge). Implementation follows
[spec-worktree-env-contract-016](../specs/spec-worktree-env-contract-016.md)
with [plan](../plans/plan-worktree-env-contract-016.md); follow-up tasks are
filed under the
`parallel-worktree-runtime-isolation-ports-state-services` story.
