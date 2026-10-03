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
([ADR 0013](./adr/0013-lib-package-split.md)) and both are published
(`arggon-manager@0.4.0`, `@arggondev/lib@0.4.0`). The released install is one line:

```bash
npm install -g arggon-manager      # pulls @arggondev/lib from the registry
```

**From a pinned checkout (development) — pack both packages.** Pack and install
**both** tarballs from the same directory so the checkout's versions stay pinned
(the kernel resolves locally; `commander` still comes from the registry — see the non-hermeticity note below); the root tarball also resolves `@arggondev/lib`
from the registry since 0.4.0. `npm pack
--pack-destination` does **not** create the destination directory (npm 10 and 12
both exit 254 with `ENOENT`), so create it first:

```bash
git clone --depth 1 https://github.com/Arggon/ArggonManager /tmp/arggon-src
cd /tmp/arggon-src
npm ci                                                        # prepare builds lib/dist + dist
mkdir -p /tmp/arggon-packs                                    # npm pack does not create it
npm pack --workspace lib --pack-destination /tmp/arggon-packs
npm pack --pack-destination /tmp/arggon-packs
npm install -g /tmp/arggon-packs/*-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
arggon --version
```

The tarball ships production `dist/`, `templates/`, `skills/` and `opencode/`;
installing it needs no scripts. npm may warn that the tarball's blocked
`prepare` was skipped — benign, the build is already inside.

**Released — one line:**

```bash
npm install -g arggon-manager      # both packages from the registry
```

**From a GitHub Release asset (no registry access)** — every release attaches
both packed tarballs to its GitHub Release (ADR 0018 §4's non-npm fallback):

```bash
mkdir -p /tmp/arggon-release
gh release download vX.Y.Z --repo Arggon/ArggonManager --dir /tmp/arggon-release \
  --pattern 'arggon-manager-*.tgz' --pattern 'arggondev-lib-*.tgz'
npm install -g /tmp/arggon-release/arggon-manager-*.tgz /tmp/arggon-release/arggondev-lib-*.tgz
arggon --version
```

Install **both** tarballs together so the kernel resolves at the released
lockstep version, exactly like the pinned-checkout flow below.

**Repo-local, no global install** (Node projects; keeps `PATH` untouched) —
reuses the tarballs packed above, or pack them into any directory you created
first:

```bash
mkdir -p /tmp/arggon-packs      # `npm pack --pack-destination` does not create it
npm install --no-save /tmp/arggon-packs/*-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
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
branches (`branches: [main]` in the shipped recipe — adjust to your
default branch(es)). The job is cheap for an adopter (~30–60 s) but it installs a
release from the registry, so running it on every topic-branch push or tracker
auto-commit only repeats a comparison the next PR run repeats anyway.

## Which generator the gate compares against

The drift gate answers one question: **does the committed seam match what the
generator that owns it produces?** The answer depends on who owns it, so the
recipe picks the generator explicitly, with the same predicate in the bootstrap
and drift steps (a step cannot hand an env var to the next one without
`GITHUB_ENV`, which this recipe must not use):

| Checkout                                                                           | Generator                                                           | Why                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is the seam's source (`package.json` name is `arggon-manager` + `cli/src/cli.ts`)? | its own build: `npm ci` → `npm run build` → `node dist/cli.js init` | A feature PR that legitimately **adds or edits generated content** can satisfy the gate on its own branch. Judging it against the last release instead made every such PR red until a release and a re-pin — and the prescribed remedy ("run `arggon init`") could not work, because the pinned init was the thing deleting the new content (PR #605). |
| Anything else (every adopter and fork)                                             | the pinned release: `arggon init`                                   | An adopter has no arggon source to build; the pinned install above is its only generator, and its committed seam is expected to be reproducible from exactly that release.                                                                                                                                                                             |

Each direction prints its own verdict, so the failure names what disagrees and
the remedy that works for it:

```text
# the pin sits behind the committed seam (the #527 class)
ARGGON_VERSION (0.5.0) lags the committed arggon seam (0.9.9):
the pinned init would REWRITE committed content — bump ARGGON_VERSION to 0.9.9
once that version is released (release.md, 'The re-pin'). Re-running the pinned
init is not the fix: it is what deletes the newer content.

# the committed bytes disagree with the generator this repo is checked against
the committed arggon seam does not match what this checkout's own build (node dist/cli.js) generates — regenerate it with 'npm ci && npm run build && node dist/cli.js init' and commit, or drop the template change that moved it:
 M .mcp.json
# ... or, in an adopter repo, the same diff against the pinned release:
the committed arggon seam does not match what arggon-manager@0.5.0 generates — re-run 'arggon init' with arggon-manager@0.5.0 and commit the result:
 M .mcp.json

# no committed seam yet (a fresh clone): green, no-op
no committed arggon seam yet — run 'arggon init' locally and commit the generated docs
```

The self-hosted branch **builds the checkout** (`npm ci --ignore-scripts` — no
double build through the `prepare` lifecycle — then `npm run build`), so its
bootstrap needs a registry round trip for dependencies and a build; the drift
step re-runs the branch's own `init` (a no-op when the seam is current) and
fails loudly if `dist/cli.js` is missing, rather than silently falling back to
the pinned release — that silent fall-back _is_ the bug.

**What the branch-local comparison gives up, and what compensates.** In the
seam's own repo, `tasks-validate` no longer proves that the _pinned release_
reproduces the committed seam. Two assertions keep the release protection:

- the **pinned-lag assertion** inside the drift step: no committed `x-generated`
  entry may carry an `arggonVersion` stamp NEWER than `ARGGON_VERSION`. A newer
  stamp means the pinned install would rewrite committed content — the #527
  outage class — so the gate reports the lag and its two values, then
  prescribes the only remedy that works: **bump the pin** once that version is
  released. Re-running the pinned `init` is not the fix; it is what deletes the
  newer content. This repo pins the same rule as a test
  (`cli/src/ci-seam-pin.test.ts`), so neither copy can rot silently; for adopters
  the workflow assertion is the only gate, which is why it lives there;
- `arggon validate` / `doctor` / `list` still run through the **pinned** bin, so
  the release can always read the tracker (the adopter-shaped check).

The pin is a literal on purpose and stays one: deriving it from `package.json`
would install the bumped version between the release runbook's step-1 bump and
its step-3 publish — before the registry has it — turning `tasks-validate` red on
main and on the release PR on every release ([ADR
0018](./adr/0018-update-delivery-and-distribution-channel.md) §1's amendment,
`task-ci-seam-pin-tracks-release`).

## Reproduce the drift gate both ways

The gate is only worth its cost if both directions are demonstrable. The
hermetic fixture (`npm test -- headless-ci`) drives the step bodies on synthetic
repos; this is the real thing — real templates, real build, the branch's own
`dist/cli.js` — in a throwaway clone:

```bash
# 0. a scratch clone of the branch (never run this in your working tree)
git clone --quiet /path/to/your/checkout /tmp/arggon-seam && cd /tmp/arggon-seam
git checkout --quiet fix/<item-id>
export ARGGON_VERSION=0.5.0            # the value the workflow's env: block pins

# 1. GREEN, both ways: this branch's seam is current for its own generator
npm ci --ignore-scripts --no-audit --no-fund && npm run build
node dist/cli.js init --no-commit
git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml' \
  ':(exclude)tasks/.convention.yml' ':(exclude).github/workflows/arggon.yml'   # empty => green

# 2. RED, stale seam: move a template, leave the committed seam behind
printf '\n// moved\n' >> templates/docs/mcp-json
node dist/cli.js init --no-commit
git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml'   # ` M .mcp.json` => red
git checkout -- . && git clean -fd templates

# 3. RED under the OLD gate (the #605 shape): the seam POSTDATES the pin. Commit
#    the regeneration from step 2, then run the pinned release's init — it
#    rewrites the committed content the release does not know about:
#      npx --yes arggon-manager@$ARGGON_VERSION init --no-commit
#      git status --porcelain    # ` M .mcp.json` => the seam predates nothing;
#                                # it POSTDATES the pin. With the fix, tasks-validate
#                                # compares step 1's generator and stays green.
```

Both red cases are also asserted in `cli/src/headless-ci.test.ts` (the drift step
body run verbatim, including the pinned-lag assertion, the branch generator's
selection, and the missing-build error).

Steps, and what each one is for:

| Step                      | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| install                   | Headless bin from the registry, pinned by `ARGGON_VERSION` (`npm install -g "arggon-manager@$ARGGON_VERSION"`); no model, no MCP, no clone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `arggon init --no-commit` | Idempotent bootstrap/upgrade with the **generator that owns this seam** (see [Which generator](#which-generator-the-gate-compares-against)): the checkout's own build when the checkout is the seam's source, else the pinned bin. Creates the tracker on a fresh clone, restores missing templates, refreshes untouched generated docs (`updated[]`), never touches adopter-modified ones. `--no-commit` keeps CI from writing history (the default auto-commit is for local runs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| drift gate                | Runs after the bootstrap step, against the **same generator**, in three parts: **(a)** the pinned-lag assertion — no committed `x-generated` `arggonVersion` stamp may be newer than `ARGGON_VERSION` (the #527 class: the pinned init would rewrite committed content; the remedy is to bump the pin, never to re-run init); **(b)** regenerate, then require `git status --porcelain` to be empty — a dirty tree means the committed seam does not match what the generator above produces, and the message names _that_ generator plus the remedy for that direction. It activates on the presence of a **committed provenance marker** in any generated file (not just the state file), so a repo that commits the generated docs without committing `*.convention.yml` still gets checked; a fresh clone has no committed marker and no-ops. Two files are excused from the diff: the state file (`ArggonManager/.convention.yml`, or `tasks/.convention.yml` on legacy trees), because init refreshes its per-doc `generatedAt` bookkeeping on every run by design, and **the workflow file itself** (`.github/workflows/arggon.yml`), because a self-bootstrapping runner cannot be gated against the pinned release — its own template change only reaches a release after merge, so gating it would fail every such PR; its step bodies are pinned by the fixture below. |
| `arggon validate --json`  | The hard gate: frontmatter, tree integrity, claim/blocked invariants. Non-zero exit on a broken tracker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `arggon doctor --json`    | Report-only installation shape (convention version, provenance buckets, OpenCode seam state, tracker counts); always exit 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `arggon list --json`      | Report-only tracker scan for the log.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

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
- The recipe is **not offline-hermetic**: the install step pulls
  `arggon-manager` (and its `@arggondev/lib` dependency) from the registry at
  the pinned `ARGGON_VERSION`. CI runners have the registry; the fixture test
  documents and depends on that too.

## Fixture and evidence

`cli/src/headless-ci.test.ts` exercises exactly this recipe end to end:

1. asserts the shipped **install step text** (the registry pin
   `npm install -g "arggon-manager@$ARGGON_VERSION"`, no clone) and then packs
   BOTH **working-tree packages** into tarballs and installs them together —
   the documented checkout-pinned variant — so the bin under test carries the
   working tree's templates AND kernel; `npm_config_prefix` is redirected to a
   temp prefix and the install inherits no ambient npm config;
2. runs the remaining step bodies on the **adopter-shaped fixture** (git repo
   with a `package.json`, sources and README, no tracker) with `PATH` pointing
   at the bin installed by step 2: bootstrap → drift gate → validate →
   diagnostics;
3. drives the drift gate both ways (clean tree passes; a mutated generated file
   fails) including the state-file-untracked case — activation keys off the
   committed provenance marker, not `*.convention.yml` — and re-runs the recipe
   after deleting `.mcp.json` and the whole `.opencode/` + `.agents/` seam:
   green, proving no MCP, OpenCode or model is required;
4. drives the **branch-aware** gate on a self-hosted-shaped fixture (the arggon
   package name + `cli/src/cli.ts` + a built `dist/cli.js` standing in for the
   branch's own generator, with `init`'s checksum rule): a seam that POSTDATES
   the pin is green on the branch-local path and red with the pinned one (the
   #605 shape, both verdicts asserted); a moved template and a hand-edited
   generated file are red with the branch generator named; the pinned-lag
   assertion fires on a committed `arggonVersion` newer than `ARGGON_VERSION`,
   with the bump-the-pin remedy; a missing `dist/cli.js` is an error, never a
   silent fall-back;
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
