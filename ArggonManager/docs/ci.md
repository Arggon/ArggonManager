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
plugin) and `@arggon/lib` (kernel) are **two packages**
([ADR 0013](./adr/0013-lib-package-split.md)) and both stay `private: true`
until the release wave, so there is no npm one-liner yet.

**Pre-release — pack both packages from a pinned checkout.** The root tarball
alone is **not installable**: it declares `@arggon/lib: ^0.3.0` and that package
is not on the registry (a lone `npm install -g arggon-manager-<v>.tgz` fails
with `404 @arggon/lib@^0.3.0`). Pack and install **both** tarballs in one
command so npm resolves the kernel dependency locally:

```bash
git clone --depth 1 --branch opencode2 https://github.com/Arggon/ArggonManager /tmp/arggon-src
cd /tmp/arggon-src
npm ci                                                        # prepare builds lib/dist + dist
npm pack --workspace @arggon/lib --pack-destination /tmp/arggon-packs
npm pack --pack-destination /tmp/arggon-packs
npm install -g /tmp/arggon-packs/arggon-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
arggon --version
```

The tarball ships production `dist/`, `templates/`, `skills/` and `opencode/`;
installing it needs no scripts. npm may warn that the tarball's blocked
`prepare` was skipped — benign, the build is already inside.

**Released (post-W7) — one line:**

```bash
npm install -g arggon-manager      # both packages from the registry
```

**Repo-local, no global install** (Node projects; keeps `PATH` untouched):

```bash
npm install --no-save /tmp/arggon-packs/arggon-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
npx arggon validate --json         # or: node_modules/.bin/arggon
```

**Dev checkout** (this repo): `npm run arggon -- <command>` runs the TypeScript
sources directly; `npm run build` produces the packaged `dist/cli.js`.

## The CI recipe

`arggon init` writes `.github/workflows/arggon.yml` (never overwriting an
existing file; it is adopter-owned the moment it exists). That file is the
runnable recipe; the job-level snippet to embed into an existing workflow —
the same one `arggon instructions` prints — lives in
[`docs/agents.md` §CI gate](./agents.md#ci-gate).

Steps, and what each one is for:

| Step                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| install                   | Headless bin from the packed (or published) tarballs; no model, no MCP.                                                                                                                                                                                                                                                                                                                                                                             |
| `arggon init --no-commit` | Idempotent bootstrap/upgrade: creates the tracker on a fresh clone, restores missing templates, refreshes untouched generated docs (`updated[]`), never touches adopter-modified ones. `--no-commit` keeps CI from writing history (the default auto-commit is for local runs).                                                                                                                                                                     |
| drift gate                | Runs after the bootstrap step: once the tracker is committed, `git status --porcelain` must be empty — a dirty tree means the committed seam predates the pinned arggon ref (re-run `arggon init` locally and commit). No-ops on a fresh clone, and excludes the tracker state file (`ArggonManager/.convention.yml`; `tasks/.convention.yml` on legacy trees) because init refreshes its per-doc `generatedAt` bookkeeping on every run by design. |
| `arggon validate --json`  | The hard gate: frontmatter, tree integrity, claim/blocked invariants. Non-zero exit on a broken tracker.                                                                                                                                                                                                                                                                                                                                            |
| `arggon doctor --json`    | Report-only installation shape (convention version, provenance buckets, OpenCode seam state, tracker counts); always exit 0.                                                                                                                                                                                                                                                                                                                        |
| `arggon list --json`      | Report-only tracker scan for the log.                                                                                                                                                                                                                                                                                                                                                                                                               |

Notes:

- The gate is the **exit code**; `--json` is for logs and downstream tooling.
- CI does **not** need `.mcp.json`, `opencode.jsonc`, the `.opencode/` seam or
  any other OpenCode artifact — only the bin and the tracker. Deleting
  `.mcp.json` is safe: the native tools do not read it; `arggon mcp` and the
  file remain for non-OpenCode MCP clients that configure them explicitly.
- The pre-commit gate for local work stays
  [`docs/agents.md` §Pre-commit gate](./agents.md#pre-commit-gate):
  `arggon validate` (or `npm run arggon -- validate` in a checkout).

## Fixture and evidence

`cli/src/headless-ci.test.ts` exercises exactly this recipe end to end:

1. builds and `npm pack`s **both** tarballs from a fresh-clone copy (no
   pre-built `dist/`, so `prepare` is part of the gate);
2. installs them into a temp prefix and runs the **adopter-shaped fixture**
   (git repo with a `package.json`, sources and README, no tracker);
3. executes the step bodies extracted from the shipped workflow, with `PATH`
   pointing at the packed bin: bootstrap → drift gate → validate → diagnostics
   (the drift gate is also driven both ways: clean tree passes, a mutated
   generated file fails). The install step is replaced by the same pack+install
   it documents (the test does not clone over the network);
4. re-runs the recipe after committing the generated tree (drift gate active)
   and once more after deleting `.mcp.json` and the whole `.opencode/` +
   `.agents/` seam — green both times, proving no MCP, OpenCode or model is
   required;
5. compares the `--json` envelopes of the packed bin against the checkout CLI
   on the same/twin fixtures (`init --no-commit`, `init`, `validate`, `doctor`,
   `list`, `show`, `next`, `report`) and the generated bytes of `init` — they
   must be identical.

Reproduce locally:

```bash
npm test -- headless-ci        # the fixture above
npm test -- pack-contents      # tarball allowlist + prepare + executable bin
```

`cli/src/pack-contents.test.ts` pins what the tarball ships (production
`dist/**` without tests, `templates/`, `skills/`, `opencode/`, README/LICENSE),
and `npm run check:plugin` in CI gates the committed vendored plugin bundle.
