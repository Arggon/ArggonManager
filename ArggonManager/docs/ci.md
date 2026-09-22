# Headless bootstrap and CI (no model, no MCP)

The packaged `arggon` bin is the **bootstrap and CI artifact** of the native-first
architecture: a plugin cannot create the repo it lives in, and CI has no model
([ADR 0011](./adr/0011-native-first-architecture.md), "Bootstrap tension").
`init`, `validate`, `doctor` and the `--json` diagnostics (`list`, `show`) run
in-process against the git-native tracker — **no OpenCode session, no LLM and no
MCP client** are involved at any point (MCP left the default path in W3; the
native tools come from the vendored plugin, which CI never loads).

This document is the full recipe. The runnable workflow ships with
`arggon init`:
[`templates/docs/github/workflows/arggon.yml`](../../templates/docs/github/workflows/arggon.yml)
→ `.github/workflows/arggon.yml`.

## Install the headless bin

Requires **Node.js 22.12+**. `arggon-manager` (bin + templates + vendored
plugin) and `@arggondev/lib` (kernel) are **two packages**
([ADR 0013](./adr/0013-lib-package-split.md)) and both stay `private: true`
until the release wave, so there is no npm one-liner yet.

**Pre-release — pack both packages from a pinned checkout.** The root tarball
alone is **not installable**: it declares `@arggondev/lib: ^0.3.0` and that package
is not on the registry (a lone `npm install -g arggon-manager-<v>.tgz` fails
with `404 @arggondev/lib@^0.3.0`). Pack and install **both** tarballs in one
command so npm resolves the kernel dependency locally. `npm pack
--pack-destination` does **not** create the destination directory (npm 10 and 12
both exit 254 with `ENOENT`), so create it first:

```bash
git clone --depth 1 --branch opencode2 https://github.com/Arggon/ArggonManager /tmp/arggon-src
cd /tmp/arggon-src
npm ci                                                        # prepare builds lib/dist + dist
mkdir -p /tmp/arggon-packs                                    # npm pack does not create it
npm pack --workspace @arggondev/lib --pack-destination /tmp/arggon-packs
npm pack --pack-destination /tmp/arggon-packs
npm install -g /tmp/arggon-packs/arggondev-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
arggon --version
```

The tarball ships production `dist/`, `templates/`, `skills/` and `opencode/`;
installing it needs no scripts. npm may warn that the tarball's blocked
`prepare` was skipped — benign, the build is already inside.

**Released (post-W7) — one line:**

```bash
npm install -g arggon-manager      # both packages from the registry
```

**Repo-local, no global install** (Node projects; keeps `PATH` untouched) —
reuses the tarballs packed above, or pack them into any directory you created
first:

```bash
mkdir -p /tmp/arggon-packs      # `npm pack --pack-destination` does not create it
npm install --no-save /tmp/arggon-packs/arggondev-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
npx arggon validate --json         # or: node_modules/.bin/arggon
```

**Dev checkout** (this repo): `npm run arggon -- <command>` runs the TypeScript
sources directly; `npm run build` produces the packaged `dist/cli.js`.

## The CI recipe

`arggon init` writes `.github/workflows/arggon.yml` under the provenance
contract of every generated file: a **pre-existing adopter file is never
overwritten** (`skipped[]`), a hand-edited generated file is protected
(`modified[]` + `skipped[]`, its bytes survive), and an untouched generated
file from an older arggon ref is **refreshed** (`updated[]`) — that refresh is
exactly what the drift gate below checks. That file is the runnable recipe; the
job-level snippet to embed into an existing workflow — the same one `arggon
instructions` prints — lives in
[`docs/agents.md` §CI gate](./agents.md#ci-gate).

**When it runs (scoped on purpose).** `pull_request` always runs the job so a
stale seam is caught before merge, while `push` is limited to the long-lived
branches (`branches: [main, opencode2]` in the shipped recipe — adjust to your
default branch(es)). The job is cheap (~30–60 s) but the drift gate compares the
committed seam against the pinned `ARGGON_REF`, so running it on every
topic-branch push or tracker auto-commit would only re-check a comparison that
cannot pass before the ref moves.

Steps, and what each one is for:

| Step                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| install                   | Headless bin from the packed (or published) tarballs; no model, no MCP.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `arggon init --no-commit` | Idempotent bootstrap/upgrade: creates the tracker on a fresh clone, restores missing templates, refreshes untouched generated docs (`updated[]`), never touches adopter-modified ones. `--no-commit` keeps CI from writing history (the default auto-commit is for local runs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| drift gate                | Runs after the bootstrap step: once an arggon-managed tree is committed, `git status --porcelain` must be empty — a dirty tree means the committed seam predates the pinned arggon ref (re-run `arggon init` locally and commit). It activates on the presence of a **committed provenance marker** in any generated file (not just the state file), so a repo that commits the generated docs without committing `*.convention.yml` still gets checked; a fresh clone has no committed marker and no-ops. Two files are excused from the check: the state file (`ArggonManager/.convention.yml`, or `tasks/.convention.yml` on legacy trees), because init refreshes its per-doc `generatedAt` bookkeeping on every run by design, and **the workflow file itself** (`.github/workflows/arggon.yml`), because a self-bootstrapping runner cannot be gated against the pinned ref — its own template/trigger change only reaches that ref after merge, so gating it would fail every such PR; its step bodies are pinned by the fixture below. |
| `arggon validate --json`  | The hard gate: frontmatter, tree integrity, claim/blocked invariants. Non-zero exit on a broken tracker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `arggon doctor --json`    | Report-only installation shape (convention version, provenance buckets, OpenCode seam state, tracker counts); always exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `arggon list --json`      | Report-only tracker scan for the log.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Notes:

- The gate is the **exit code**; `--json` is for logs and downstream tooling.
- `npm pack --pack-destination` does **not** create the destination directory
  (npm 10 and 12 exit 254 with `ENOENT`): the install step creates it with
  `mkdir -p` — the fixture exercises that exact step on an empty
  `$RUNNER_TEMP`, so dropping the `mkdir` fails the test suite.
- CI does **not** need `.mcp.json`, `opencode.jsonc`, the `.opencode/` seam or
  any other OpenCode artifact — only the bin and the tracker. Deleting
  `.mcp.json` is safe: the native tools do not read it; `arggon mcp` and the
  file remain for non-OpenCode MCP clients that configure them explicitly.
- The pre-commit gate for local work stays
  [`docs/agents.md` §Pre-commit gate](./agents.md#pre-commit-gate):
  `arggon validate` (or `npm run arggon -- validate` in a checkout).
- The recipe is **not offline-hermetic**: the install step clones the pinned
  ref, runs `npm ci` there (devDependencies) and installs the two tarballs,
  whose only runtime dependency is `commander`. CI runners have the registry;
  the fixture test documents and depends on that too.

## Fixture and evidence

`cli/src/headless-ci.test.ts` exercises exactly this recipe end to end:

1. commits the working tree's tracked files into a throwaway local **product
   repo** (no `dist/`, no `lib/dist/`) so the recipe's `git clone` runs against
   a local `file://` remote instead of the network;
2. runs the shipped **install step verbatim** (`bash -e`; `ARGGON_REPO`,
   `ARGGON_REF`, `RUNNER_TEMP` set; `npm_config_prefix` redirected to a temp
   prefix) from an **empty** temp root: the step itself must create
   `$RUNNER_TEMP/arggon-packs` — removing its `mkdir -p` fails with `ENOENT`,
   exit 254 — and must build `dist/` + `lib/dist/` through `npm ci`/`prepare`;
3. runs the remaining step bodies on the **adopter-shaped fixture** (git repo
   with a `package.json`, sources and README, no tracker) with `PATH` pointing
   at the bin installed by step 2: bootstrap → drift gate → validate →
   diagnostics;
4. drives the drift gate both ways (clean tree passes; a mutated generated file
   fails) including the state-file-untracked case — activation keys off the
   committed provenance marker, not `*.convention.yml` — and re-runs the recipe
   after deleting `.mcp.json` and the whole `.opencode/` + `.agents/` seam:
   green, proving no MCP, OpenCode or model is required;
5. compares the `--json` envelopes of the recipe-installed bin against the
   checkout CLI on the same/twin fixtures (`init --no-commit`, `init`,
   `validate`, `doctor`, `list`, `show`, `next`, `report`) and the generated
   bytes of `init` — they must be identical.

The fixture's `npm ci` (devDependencies) and the tarballs' `commander`
dependency resolve from the npm registry: the test is network-dependent by
design — exactly like the CI job it mirrors — but never dependent on the
product repo's git state or on a pre-created pack directory.

Reproduce locally:

```bash
npm test -- headless-ci        # the fixture above
npm test -- pack-contents      # tarball allowlist + prepare + executable bin
```

`cli/src/pack-contents.test.ts` pins what the tarball ships (production
`dist/**` without tests, `templates/`, `skills/`, `opencode/`, README/LICENSE),
and `npm run check:plugin` in CI gates the committed vendored plugin bundle.
