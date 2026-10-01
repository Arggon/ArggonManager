# Per-worktree services (Compose): ephemeral containers per worktree

**Status:** adopter pattern — documentation, not a kernel feature. This is layer 2 of
[ADR 0019](./adr/0019-worktree-runtime-isolation.md) (decision evidence:
[exploration-worktree-env-isolation-017](./explorations/exploration-worktree-env-isolation-017.md)).
It is written for adopters who **already ship Docker** (CI or prod) and have a real
stateful-service collision. Docker is never a requirement of the arggon loop: without
it, this page degrades to background reading and the
[environment contract](./specs/spec-worktree-env-contract-016.md) still covers ports
and state by convention.

Some runtime pieces this pattern plugs into are still landing — the split between
what works **today**, what the spec **promises**, and what is **planned** is stated
inline and consolidated in [Shipped vs promised vs planned](#shipped-vs-promised-vs-planned).

## The problem: two worktrees, one dev stack

`arggon start --worktree` isolates _files_: each item works in `../<repo>-<item-id>`
on its own branch with its own dependency install. It does not isolate the _runtime
stack_ the code talks to. Two worktrees of the same repo driving the same Compose
file collide in four ways:

1. **Fixed host ports.** `ports: ["5433:5432"]` in every worktree means the second
   `docker compose up` fails with "port is already allocated" — or worse, both
   worktrees silently share one service. Measured in exploration 017 (F1): a fixed
   host port `5433` published by one long-lived container was shared by every
   worktree of its project, so a second worktree's "second run" was really a second
   client of the first worktree's database.
2. **A fixed Compose project name.** When the project name is pinned anywhere — a
   top-level `name: myapp`, a `-p myapp` in a script, or `COMPOSE_PROJECT_NAME` in a
   shared `.envrc` — both worktrees drive the **same** Compose project. The second
   `up` does not run "another copy": it reconciles the same service keys and
   **recreates the first worktree's containers** under the second one.
3. **Shared state.** One shared project also means shared named volumes, and any
   `external: true` volume or fixed host-path bind mount is shared even across
   _different_ projects — two writers running migrations against one dataset.
4. **Hardcoded `container_name`.** A literal `container_name: myapp-db` is global to
   the Docker daemon: the second worktree's `up` fails with a name conflict even
   when everything else is namespaced.

One honest observation up front: the _default_ Compose project name is the base name
of the Compose file's directory ([Docker docs — project name](https://docs.docker.com/compose/how-tos/project-name/),
accessed 2026-10-01), and an arggon worktree directory is already named
`<repo>-<item-id>` — so worktrees that rely purely on the default get unique project
names by accident. The pattern below makes that **deliberate and collision-proof**,
so it survives the overrides adopters realistically carry (`name:`, `-p`,
`container_name`, fixed ports, external volumes).

## The pattern

Four rules. Rules 1–4 need nothing from arggon beyond the worktree itself; rule 4's
automation gets better now that the env contract ships (PR #566).

### 1. One Compose project per worktree, named `<repo>-<item-id>`

Compose uses the project name to isolate environments — networks, volumes and
container names are all prefixed with it
([Docker docs — project name](https://docs.docker.com/compose/how-tos/project-name/),
accessed 2026-10-01; project names are lowercased and restricted to `[a-z0-9_-]`,
so `ArggonManager-task-123` becomes `arggonmanager-task-123` — verified live on
Docker 29.7.2, 2026-10-01). Make the per-worktree name declarative with the
top-level `name:` and interpolation, committed to the repo:

```yaml
name: "myapp${WORKTREE_SUFFIX:-}"
```

`WORKTREE_SUFFIX` carries the worktree identity. In the primary checkout it stays
unset and the project is plain `myapp`; in a worktree it is `-<repo>-<item-id>`:

```bash
# Works today: the worktree directory IS <repo>-<item-id>.
export WORKTREE_SUFFIX="-$(basename "$PWD")"    # e.g. -myrepo-task-123
docker compose up -d
```

```bash
# The env contract ships in PR #566 (spec-worktree-env-contract-016): read
# the documented key instead of guessing from the directory name.
set -a; . ./.arggon.env; set +a                  # ARGGON_WORKTREE_ID=<repo>-<item-id>
export WORKTREE_SUFFIX="-${ARGGON_WORKTREE_ID}"
docker compose up -d
```

Two interpolation footguns, both verified live (Docker 29.7.2, 2026-10-01):

- `${WORKTREE_SUFFIX:-}` defaults to the **empty** string: a worktree that forgot to
  set it silently reverts to the shared `myapp` project — collision class 2 again.
  Teams that prefer loud failure can use `${WORKTREE_SUFFIX:?export WORKTREE_SUFFIX=-<repo>-<item-id>}`
  instead; Compose then refuses to run until the variable is set.
- Compose reads interpolation variables from the environment and from a `.env` file
  in the project directory, never from `.arggon.env` (it only auto-reads a file
  literally named `.env`). Sourcing `.arggon.env` in the shell (above) merges it
  with everything else; `docker compose --env-file .arggon.env` also works but
  **replaces** the default `.env` as the interpolation source.

### 2. Random host ports, loopback-published

Never publish a fixed host port from a per-worktree stack. The short syntax with an
empty host port publishes the container port to a **random** host port
([Compose services reference — `ports`](https://docs.docker.com/reference/compose-file/services/),
accessed 2026-10-01); pin the loopback interface so the service is not reachable
from the network:

```yaml
ports:
  - "127.0.0.1::5432" # <host-ip>::<container-port> — random host port
```

Discover the assigned port per run (or point the app's config at it):

```bash
docker compose port db 5432          # → 127.0.0.1:32784 (example, verified live)
```

The app's **own** dev server should not publish through Docker at all — it binds an
ephemeral port (`:0`) or a port derived from the worktree id on the host. That is
layer 1's port convention ([ADR 0019](./adr/0019-worktree-runtime-isolation.md),
[spec-worktree-env-contract-016](./specs/spec-worktree-env-contract-016.md)).

Unix sockets are an optimization where supported (Postgres and Redis can serve a
per-instance socket directory volume-mounted between app and service), never the
mechanism: sockets are the first thing Docker Desktop's VM boundary complicates, and
the loop must stay portable across linux/macos/windows (exploration 017, F9).

### 3. Ephemeral data by default; named volumes (auto-prefixed) when persistence is needed

A per-worktree test database should usually leave **nothing** behind:

- **tmpfs** — keep the data directory in memory so it dies with the container and no
  volume is ever created (zero residue, verified live 2026-10-01):

  ```yaml
  db:
    image: postgres:17-alpine
    tmpfs:
      - /var/lib/postgresql/data
  ```

- **`docker run --rm --tmpfs …`** — the one-shot equivalent for a stateless test
  database started outside Compose (the shape recorded in exploration 017, C2).
- **Named volumes** when a run genuinely needs persistence across restarts — declare
  them in the Compose file and let the project name do the namespacing: `db-data`
  becomes `<project>_db-data` per worktree (verified live:
  `shop-vol-check_db-data` for project `shop-vol-check`, 2026-10-01).

Never bind-mount a fixed host path for service data, and never mark a per-worktree
volume `external: true` — both reintroduce the shared-state collision the project
name just removed.

### 4. Cleanup: the lifecycle that creates must also delete

Orphaned per-worktree infrastructure is a real cost, not a hypothetical one —
exploration 017 (F2) measured 3.3 GB of reclaimable Docker volumes on the machine
that wrote the pattern. Per worktree, tear the stack down with the project name the
same way Compose created it:

```bash
docker compose -p "$COMPOSE_PROJECT" down -v --remove-orphans
```

`-v` removes the project's named volumes, `--remove-orphans` sweeps containers
Compose no longer tracks (command verified live: networks and containers removed,
zero residue, Docker 29.7.2, 2026-10-01).

**Planned, not shipped:** `arggon cleanup --prune` will eventually do this reaping
for you — running `docker compose -p <repo>-<item-id> down -v --remove-orphans` for
merged worktrees, but **only when the repo's convention declares its services
manifest**, and skipping with a report otherwise; the kernel never probes for or
invokes a Docker daemon the convention did not declare. That behavior is tracked as
`task-cleanup-declared-services` under the
`parallel-worktree-runtime-isolation-ports-state-services` story and does not exist
in any build today. Until it ships, the reaping step is yours (a script, a Make
target, or your session's end-of-run checklist).

### Optional today: wire `up` into worktree creation

The `x-worktree.post-start` hook (shipped; see
[convention.md](./convention.md) §Worktree bootstrap) runs a shell command with the
worktree as cwd when `start --worktree` **creates** the worktree — the sanctioned
spot to bring the stack up automatically:

```yaml
x-worktree:
  post-start: 'WORKTREE_SUFFIX=-$(basename "$PWD") docker compose -f docker/compose.worktree.yml up -d --wait || true'
```

Hook failure is reported, never fatal (the claim stands), which is why the `|| true`
guard is optional: the worktree is valid even on a machine where the Docker daemon
is not running.

## Copy-paste example (validated)

A complete per-worktree stack. Committed as `docker/compose.worktree.yml`, it is
inert in the primary checkout (`name: myapp`) and fully isolated in every worktree.
Validated end-to-end on Docker 29.7.2, 2026-10-01: `docker compose config` parses
with and without `WORKTREE_SUFFIX`; two "worktrees" (`-shop-pr-123`,
`-shop-pr-456`) ran concurrently on distinct random host ports (32784/32785 vs
32786/32787); a table created through one worktree's port was invisible through the
other's; `down -v --remove-orphans` left zero containers, networks or volumes.

```yaml
name: "myapp${WORKTREE_SUFFIX:-}"

services:
  db:
    image: postgres:17-alpine
    ports:
      - "127.0.0.1::5432" # random host port, loopback only
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: postgres
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d myapp"]
      interval: 2s
      timeout: 2s
      retries: 15

  cache:
    image: redis:8-alpine
    ports:
      - "127.0.0.1::6379"
```

```bash
# In a worktree — wire the suffix, then use Compose as usual.
set -a; . ./.arggon.env 2>/dev/null; set +a   # shipped in PR #566 (spec 016)
export WORKTREE_SUFFIX="-${ARGGON_WORKTREE_ID:-$(basename "$PWD")}"
docker compose -f docker/compose.worktree.yml up -d --wait
docker compose -f docker/compose.worktree.yml port db 5432
# … point the app at the printed host port; run the tests …
docker compose -f docker/compose.worktree.yml down -v --remove-orphans
```

The fallback `$(basename "$PWD")` keeps the same snippet working on released
builds without the contract and switches to the documented key once your checkout
carries it.

## Env contract receipt and lifecycle notes

What `start --worktree` reports in the additive `env` receipt field (spec
[worktree-env-contract-016](./specs/spec-worktree-env-contract-016.md)), with the
coordinator rulings of 2026-10-01 encoded:

- **`written` means "this run created the file"** (accepted ruling). A fresh
  start reports `written: true` with `path` and the six `keys`; an **attach**
  re-run finds the file already there, leaves it byte-identical, and reports
  `written: false` with `warning: "already exists — left byte-identical (never
overwritten)"` (plus `path`/`gitignored` when known). This attach case is the
  spec's listed three (`x-worktree.env: false` opt-out, write failure,
  unreadable state) plus one — recorded as spec errata, incomplete not
  contradicted.
- **Windows co-location (accepted ruling):** by the spec's own env-paths bases,
  `ARGGON_STATE_DIR` and `ARGGON_CACHE_DIR` are both `%LOCALAPPDATA%` on
  Windows, so the two resolve to the same `%LOCALAPPDATA%/<repo>-<item-id>`
  directory there. Isolation is per-worktree uniqueness — which the shared
  directory does not affect; Linux (XDG) and macOS (`~/Library`) keep distinct
  state and cache bases.
- **Seed failures never vanish:** a failed `.env` seed is a receipt `warning`
  on every path — including a fresh start whose `.arggon.env` write otherwise
  succeeded.
- **`cleanup --prune` reaps a start-created `.arggon.env`** (it is untracked and
  would otherwise block `git worktree remove`). Ownership is strict: the file is
  removed only when **every line is one of the six documented `KEY=value` pairs**
  — adopter-customized files (comments, extra keys) and symlinks are left for
  git to report. Caveat, stated plainly: a file that keeps the exact contract
  shape is reaped even if you edited only the **values** — do not park data you
  care about in `.arggon.env`; it is generated identity state, yours to edit for
  the session, arggon's to reap with the worktree.

## Platform note: Docker Desktop is a VM on macOS and Windows

On Linux the daemon runs natively on the shared host kernel, so a per-worktree
service costs roughly its own processes' RAM (tens of MB for an alpine Postgres) and
zero marginal disk when the image is already pulled. On **macOS and Windows, Docker
Desktop runs containers inside a Linux VM** (source:
[Docker Desktop docs](https://docs.docker.com/desktop/), accessed 2026-10-01; also
exploration 017, F9), so adopters there pay the VM's standing RAM/disk footprint on
top of every container. The per-worktree increment stays small, but the first
container of the day is not free there — prefer fewer, shared-infra patterns (layer
1's identifier isolation against one local server) when a single server genuinely
can be shared, and reach for this pattern when it cannot.

## Shipped vs promised vs planned

| Piece                                                                                       | Status  | Where                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| Per-item worktrees, identity dir name `<repo>-<item-id>`                                    | Shipped | today's build                                                                                                   |
| Unique Compose project via directory-derived default                                        | Shipped | Compose default (no arggon code involved)                                                                       |
| `${WORKTREE_SUFFIX:-}` interpolation pattern, random ports, tmpfs volumes, manual `down -v` | Shipped | this page — pure Compose, no arggon changes needed                                                              |
| `x-worktree.post-start` hook (auto-`up` on creation)                                        | Shipped | [convention.md](./convention.md) §Worktree bootstrap                                                            |
| `cleanup --prune` for merged worktrees (no Docker involvement)                              | Shipped | today's build                                                                                                   |
| `.arggon.env` with the six keys (`ARGGON_WORKTREE_ID`, `ARGGON_STATE_DIR`, …)               | Shipped | **this PR** ([spec-worktree-env-contract-016](./specs/spec-worktree-env-contract-016.md) implemented, PR #566)  |
| `.env` seed (copy-if-absent) + `ARGGON_STATE_DIR`/`ARGGON_CACHE_DIR`                        | Shipped | **this PR** (same spec — per-OS bases, `mkdir -p`'d)                                                            |
| `preparation.env` receipt field, `x-worktree.env` opt-out                                   | Shipped | **this PR** (same spec — CLI `env`, native `preparation.env`; `written:false` + warning never blocks the claim) |
| `cleanup --prune` reaping of a start-created `.arggon.env` (contract-shape ownership)       | Shipped | **this PR** — see the lifecycle notes above                                                                     |
| `cleanup --prune` reaping of **declared** Compose projects                                  | Planned | `task-cleanup-declared-services` (declaration manifest shape decided there)                                     |

"Shipped (this PR)" means: merged with the env-contract implementation PR — script
against `.arggon.env` freely in worktrees, but a **released** build carries it only
from the next release. The Compose pattern itself needs none of it: the directory
name already carries `<repo>-<item-id>`.

## Sources

Docker behavior claims on this page carry their evidence inline: the two Compose
reference pages below were read 2026-10-01, and every runtime claim (random host
ports, project-name lowercasing, volume prefixing, tmpfs zero-residue,
`down -v --remove-orphans` teardown, two-project concurrency with data isolation)
was exercised live on Docker 29.7.2 on 2026-10-01 as described in the sections
above.

- [Docker Compose — Specify a project name](https://docs.docker.com/compose/how-tos/project-name/) (accessed 2026-10-01)
- [Compose file reference — services (`ports`)](https://docs.docker.com/reference/compose-file/services/) (accessed 2026-10-01)
- [Docker Desktop — VM-based architecture](https://docs.docker.com/desktop/) (accessed 2026-10-01)
- Collision measurements and resource numbers: [exploration-worktree-env-isolation-017](./explorations/exploration-worktree-env-isolation-017.md) (F1, F2, F3, F8, F9)
