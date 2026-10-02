<!-- arggon:generated template="CHANGELOG.md" -->

# Changelog

All notable changes to ArggonManager are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0](https://github.com/Arggon/ArggonManager/compare/arggon-manager-v0.4.1...arggon-manager-v0.5.0) (2026-10-02)

### Added

- **Worktree env contract**: `start --worktree` writes a gitignored `.arggon.env`
  carrying the worktree identity (`ARGON_ITEM`, `ARGGON_WORKTREE_ID`,
  `ARGGON_WORKTREE_PATH`, `ARGGON_WORKTREE_BRANCH`) plus per-OS
  `ARGGON_STATE_DIR` / `ARGGON_CACHE_DIR`, seeds `.env` copy-if-absent, and
  reports the outcome in the additive `env` receipt — `written: false` with a
  warning never blocks the claim (#566, spec worktree-env-contract-016).
  **Adopter migration:** read the contract keys instead of hardcoding paths;
  `x-worktree.env: false` opts out, and `cleanup --prune` reaps a
  start-created env file.
- **Single-writer worktree enforcement**: every `start --worktree` stamps its
  ownership in `arggon-claim.json` inside the worktree's **git dir** (never the
  work tree, so it cannot dirty `git status` or block `git worktree remove`).
  An attach under a different identity with tracked files modified after that
  stamp reports `claim.foreignWrites` — bounded (one `git status --porcelain`
  plus one `stat` per dirty path, 10 names with an exact total), best-effort,
  and never a claim blocker by default. `x-tracker.strict-worktree-writes: true`
  turns the same observation into an attach refusal before any item mutation,
  and a fired detection never re-stamps the worktree, so a retry cannot unlock
  the gate itself (#568).
- **Dead-owner take-over**: `arggon start <id> --worktree --take-over-worktree`
  authorizes replacing a stamp whose owner is gone (a crashed session), naming
  who was replaced and when in a bounded chain persisted in the stamp. Default
  off; the manual `rm <git-dir>/arggon-claim.json` recovery stays documented for
  clients without the flag (#573).
- **Compose reaping on prune**: `x-worktree.services` in `.convention.yml`
  declares per-worktree Compose projects (`true` → `<repo>-<item-id>`, a base
  name → `<base>-<repo>-<item-id>`, lowercased). `cleanup --prune` runs
  `docker compose -p <project> down -v --remove-orphans` **before** the worktree
  removal for every removable entry — report-only (never a failure) without
  Docker, non-fatal with bounded detail on failure, tolerant of an
  already-gone project by exit code — and the plugin's native prune loop now
  matches the CLI byte for byte (#569, #574).
- **Gate-bin readiness**: `x-tracker.strict-gate-bins: true` refuses the claim
  when a declared project gate binary resolves outside the worktree, naming the
  offending bins with their observed source plus the `npm ci` remedy (#533) — the
  `gateBins` receipt that reports each resolution shipped in 0.4.1.
- **Board**: dark mode and a density toggle.
- **TUI**: vim motions, a help overlay and color control; kernel filter
  predicates with saved views; claim/move actions routed through the kernel
  update path instead of their own writes.
- **Release pipeline**: release-please proposes the version bump; `release.yml`
  runs an ordered guard, tags, publishes `@arggondev/lib` **before**
  `arggon-manager` (OIDC trusted publishing), and attaches both tarballs.
  `release.md` is now only the operator's exception manual — the manual
  bump/pack/publish runbook is retired (ADR 0018, spec release-pipeline-015).
- **Methodology**: the greenfield exploration protocol (exploration-015 +
  ADR 0017) is wired into the carriers, so a new area opens with an
  exploration gate instead of an implementation.

### Changed

- **Kernel-facing**: `cleanup --json` pins its exit-code contract — exit 0 with
  a `failures[]` payload, never a non-zero exit for a partial prune — and
  branch-delete failures land there with both catch surfaces bounded (#515,
  task-cleanup-json-exit-code).
- **Supply chain**: every `uses:` in the shipped workflows is pinned to a full
  commit SHA with a human-readable version comment, kept that way by a grep
  gate (#567); the release seam pin stays a literal and is now enforced against
  the regenerated seam by `cli/src/ci-seam-pin.test.ts`, so a stale pin is a
  red test rather than a silent outage (ADR 0018 amendment).
- **Kernel-facing**: comment authors resolve without `gh`, and a missing
  dependency is named instead of surfacing as an opaque failure (#558).
- **MCP**: the CLI spawn spec is derived for the `--import` loader form, so the
  stdio server and the CLI stay in step (#543).
- **Docs**: adopter pattern doc for per-worktree ephemeral service containers,
  a UI + `/api/item` documentation refresh, ADR index rows added with ADRs
  0014/0015 → Accepted, and ADR 0019 amended with the claim/concurrency layer
  (decision point 4) that `start`'s stamp/detection implements.
- **Machine hygiene**: per-machine `.zcode/` harness state is no longer tracked —
  it churned `git status` and blocked `start` (bug-harness-config-churn).

### Fixed

- **start**: a fresh `start --worktree` always leaves a gate-usable install, or
  refuses before the claim with the named binaries, the preparation log and the
  `npm ci` remedy (#551); a stale primary install is reported as
  `manifestCoverage: "stale"` with the missing dependencies named.
- **start**: the single-writer detection reads **raw** `git status --porcelain`.
  A trimming helper shifted porcelain's positional status column, so the parsed
  path lost its first character and the detection silently never fired against
  real git — the unit fakes had masked it; the regression is now pinned against
  real git and the real CLI (#573).
- **Board**: the live-reload e2e spec waits on the server's readiness signals
  instead of an evaluate poll, which raced the reload and produced a false
  failure (#521).
- **init**: the generated `opencode.jsonc` no longer emits bare
  `"formatter": true`. The built-in prettier runs as `<prettier> --write $FILE`
  with the session's project directory as cwd and resolves `.prettierignore`
  from that cwd, so a session rooted in the primary checkout that edited a file
  in a sibling `arggon start --worktree` worktree bypassed the ignore file and
  reformatted gitignored files into large style-only churn. The template ships a
  `formatter.prettier.command` override that anchors the same invocation at the
  edited file's own git root: non-ignored files format exactly as before, and
  the command exits 0 without formatting when no prettier resolves (e.g. a cold
  worktree before `start` links the install) (#541, #531).
  **Adopter migration:** `init` never rewrites an adopter-modified
  `opencode.jsonc`, so existing adopters must hand-apply the override — copy the
  `formatter` block from `templates/docs/opencode.jsonc` (or run a fresh
  `arggon init` on a scratch fixture) into their config.
- **Config**: this repo's own `opencode.jsonc` `permissions` block did not parse
  — the array closed early and one rule was stranded outside it, so the
  workflow gates were silently unenforced and agent sessions failed every shell
  call closed. Repaired, and pinned by `cli/src/opencode-permissions.test.ts`
  (#576).

## [0.4.1] - 2026-10-01

### Fixed

- **Board**: boards rendered through the tsx path embedded esbuild `keepNames`
  `__name(...)` calls into the page script, killing filter/drag/collapse/theme
  controls (`ReferenceError` at load); render now strips them, fails loudly on
  unknown shapes, and a tsx-path spawn gate + `@smoke` browser legs keep the
  class out (#510).
- **Frontmatter**: the writer quotes plain scalars the reader would decode as
  non-string (`0123`, `007`, `-0`, big ints, `null`, `~`, `true`, `false`) so
  titles/labels/extras keep their exact text on every rewrite (#509).
- **Validate**: dependency-cycle messages are canonical closed chains
  (`a -> b -> … -> a`), byte-identical under any traversal order (#506).
- **Done gate**: empty `- [ ] ` scaffold placeholders no longer wedge the
  auto-done flip; `create` scaffolds a comment placeholder instead (#507).
- **cleanup**: branch-delete failures are reported in `failures[]` (not only
  `pruned[]`), and both catch surfaces bound error text into the envelope
  (#515).
- **start --worktree**: readiness reports `gateBins` — which node_modules each
  gate binary resolves from (worktree/external/PATH/missing) — and both failure
  errors name the observed source + the `npm ci` remediation (#517).

### Changed

- All test spawn chains run `node --import <tsx loader>` directly instead of
  the tsx wrapper CLI (one process, no per-spawn IPC server — the root cause of
  the row-table CI flakes); test-only, enforced by a wrapper-reference gate
  (#513, #518).
- Packed tarball also excludes the compiled `dist/test-spawn.*` test
  helper, same class as `dist/test-tmp.*` (CI version guard demands the
  version move when the packaged `files` list changes;
  task-runcli-import-tsx-migration).
- `.zcode/` harness state is untracked and ignored — per-machine session churn
  no longer blocks `start`'s clean-tree precondition (#514).
- Kernel (`@arggondev/lib` 0.4.1): new `inspectGateBinResolution` /
  `GateBinResolution` exports and `gateBins` on the worktree dependency
  preparation (#517).

## [0.4.0] - 2026-09-22

### Added

- **Native-first OpenCode V2 surface** (`plan-native-first-011`, waves W0–W7;
  ADR 0011 + spec `spec-native-first-011`). OpenCode now drives the kernel
  through native surfaces instead of the CLI-driving seam:
  - **Native tool namespace** `tools.arggon.*` — the twelve kernel operations
    (`list`, `create`, `update`, `show`, `next`, `report`, `validate`,
    `comment`, `handoff`, `priority`, `sync`, `import_issues`) plus the worktree
    tools (`start`, `branch`, `cleanup`), each a thin in-process adapter
    returning the documented `--json` envelope; kernel failures surface as
    typed tool errors and the session continues.
  - **Eleven native commands** (`/arggon-next`, `-start`, `-done`, `-handoff`,
    `-review`, `-status`, `-spec`, `-adr`, `-explore`, `-playbook`, and the new
    `/arggon-adopt`) that drive the tools directly instead of shelling out to
    the adapter. Two of them keep sanctioned shell steps by design: `/arggon-adopt`
    runs the headless bootstrap (`npx arggon-manager init`, `adopt --ack`) and
    `/arggon-start` publishes the branch (`git push`, `gh pr create --draft`).
  - **Vendored single-file plugin** (`.opencode/plugins/arggon/index.ts`, the
    kernel inlined, no `node_modules` needed in the adopter tree) and the
    **TUI board/status panel** (`.opencode/plugins/arggon/tui.tsx`,
    `/arggon-board`).
  - **Worktree lifecycle** over the OpenCode worktree domain
    (`/arggon-start` records `branch` + `worktree_path`, `/arggon-done` and
    `cleanup` remove merged worktrees); the CLI (`arggon start --worktree`,
    `arggon cleanup --prune`) stays the documented fallback.
- **`ArggonManager/` tracker root** (ADR 0012): the tracker and all product
  docs live under `ArggonManager/`; legacy `tasks/` trees are still detected and
  migrate with `arggon migrate --layout` — no hard break.
- **Two-package distribution** (ADR 0013): `@arggondev/lib` (the kernel package)
  and `arggon-manager` (headless bin + templates + plugin). Pre-release they
  install from packed tarballs (both together — the root package alone cannot
  resolve the private kernel); after the release wave, one line:
  `npm install -g arggon-manager`.
- **Headless CI recipe** generated by `init`
  (`.github/workflows/arggon.yml`): install the packed bin →
  `arggon init --no-commit` → committed-seam drift gate →
  `arggon validate --json`, with no model, no MCP and no OpenCode. The fixture
  in `cli/src/headless-ci.test.ts` runs the recipe verbatim.
- **Skill progressive disclosure**: the `arggon-cli` skill ships as an umbrella
  `SKILL.md` plus `references/` (json-contract, methodology, orchestration,
  pitfalls), each read only when the task needs it, and a new `arggon-upgrade`
  skill walks adopters through template upgrades.

### Changed

- **OpenCode default path (W3): the plugin no longer auto-registers the MCP
  server.** The native tools are in-process and need no MCP client, so the
  generated `opencode.jsonc` carries no `mcp.servers.arggon` stanza and the
  plugin never touches `ctx.mcp` (ADR 0011 §5/§6). Consequence for existing
  adopters: re-running `arggon init` replaces the old plugin with the vendored
  bundle and **you lose MCP auto-registration** unless you configure
  `mcp.servers.arggon` yourself. `doctor` reports a present stanza as
  _optional_ (removal guidance) instead of recommending registration, and
  `.mcp.json` plus `arggon mcp` stay for non-OpenCode MCP clients that
  configure them explicitly.
- Generated seam: `.opencode/agents/*` and `.opencode/commands/*` are the
  native prompt templates, the config gains the minimal W4 shell gates (no
  `--no-verify`, no force-push; the base policy stays allow-all), and the
  vendored plugin + TUI entry are bundled with provenance as before.
- Upgrading: re-run `arggon init`. Untouched generated files refresh,
  adopter-modified ones are skipped (never overwritten) — `--backup` archives
  them to `backup/<date>/` before regenerating; `init --dry-run` previews the
  decisions and `init --propose` is the side-file channel for acked docs.

## [0.3.0] - 2026-09-17

### Added

- **Upgrade channel, complete**: `arggon init --dry-run` (plan-only preview), doctor `outdated` bucket, and `arggon init --propose` — section-level upgrade proposals for acked/modified docs (side files with anchors; originals untouched; `--propose-whole-file` for full renders). The bundled **arggon-upgrade skill** (delivered by init alongside the arggon-cli skill) walks adopters through the flow.
- **Convention v4: `priority` field** on every item type (`p0|p1|p2|p3`, optional): `create/update --priority`, `priority:` filter (`priority:none` = unprioritized), `arggon priority migrate` (moves legacy `pN` labels into the field), board chip. `arggon next` ranks the ready pool **priority-major** (ADR 0009) — priority first, downstream weight within a priority — with the cost of misprioritization visible in the reason.
- EOL-normalized provenance comparisons: `eol=crlf` working trees (`.gitattributes eol=crlf`, Windows checkouts) no longer produce false `acknowledgedDrifted`/inert proposals; `projectName` is recovered on re-runs (worktree/renamed-clone-safe renders); `init --dry-run`/`--propose` are worktree-safe.

### Fixed

- CRLF working trees no longer break doctor buckets, propose, or project-name recovery (bug-crlf-provenance-breakage).
- Project name no longer leaks from the working-directory basename into renders (bug-project-name-dir-derived).
- spawnSync e2e tests no longer flake at vitest's 5s default under load (bug-spawn-sync-test-timeout-flake).

## [0.2.0] - 2026-09-16

### Added

- Release discipline: every release bumps the version, gets a `vX.Y.Z` tag on the release commit in `main`, and a section here listing adopter-facing changes — so `arggonVersion` stamps in generated docs tell you which upgrades you missed. See `ArggonManager/docs/runbooks/release.md` (task-version-channel-discipline).
- Non-functional review bar and a blocking smoke gate in CI (ADR 0008).
- `spec import openspec` — import an existing OpenSpec tree.
- `spec analyze --baseline` / `--save-baseline` — diff spec analysis against a saved baseline.
- `spec audit` — audit a spec tree for convention violations.
- `arggon adopt` now injects task body content (corpus) into adopter context.
- Agent skill synced with the new command surface above.
- Self-hosted governance stack (story-dogfood-self-host): convention v3 with `branch_patterns` and `x-tracker.auto-commit` in the tracker `.convention.yml`; bundled agent skill at `.agents/skills/arggon-cli/SKILL.md`; generated adopter docs (`.editorconfig`, `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/copilot-instructions.md`, `SECURITY.md`, `SUPPORT.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `ArggonManager/docs/tracking.md`, `ArggonManager/docs/runbooks/README.md`); technology playbooks for node/typescript/vitest under `ArggonManager/docs/playbooks/`; a local pre-commit hook running `arggon validate`.

### Changed

- `cli/src/cli.test.ts`: the `hello` envelope test now reads the tree's convention version instead of hardcoding the default 0.

## [0.1.0] - 2026-09-14

### Added

- `doctor` now surfaces x-generated drift: modified/untouched generated docs are reported so agents can see ack drift.
- Comment lock: concurrent `arggon comment` runs on one item serialize instead of clobbering each other.
- Tracker autocommit retry + explicit reporting when the post-command commit fails.
- `ancestor:<id>` filter predicate for `arggon list`.
- `arggon update --parent <id>` reparenting.
- Version policy: package.json is bumped manually per release wave; `arggon --version` reads the package version; this changelog documents each wave.
- Init docs: `x-*` extensions section and an orchestration subsection in generated guidance.

### Fixed

- `board --serve --json` docs aligned with actual behavior.
- `arggon init` auto-commit fix.
