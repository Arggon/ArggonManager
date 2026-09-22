---
playbook_id: node
version: 24
researched: 2026-09-13
status: current
---

# node playbook

Technology playbook: the chosen version and the current best practices for
node. The version/best-practices research happened when this file was
created — cite dated sources (URL + access date) in every section so the next
reader can re-verify, and keep this file current via
`arggon playbook status`.

**Research record (2026-09-13):** Node 24 is the Active LTS line (EOL
2028-04-30); Node 26 (released 2026-05-05) is Current and enters Active LTS in
October 2026; Node 22 is in Maintenance LTS. Sources:
[nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases)
(accessed 2026-09-13); local runtime `node -v` → v26.7.0. Pinned here: **24**
(the Active LTS line this repo targets).

## Setup

- Pin the minimum runtime in `package.json`: `"engines": { "node": ">=22.12.0" }`
  (22.12 is the last 22.x line with require(esm) unflagged, which this ESM-only
  repo relies on).
- Install a specific toolchain with a version manager:
  `nvm install 24 && nvm use 24` or `fnm use 24`.
  CI (`.github/workflows/ci.yml`) runs `node-version: 22` to prove the
  minimum-supported line; local development on 24 LTS is fine because engines
  floor it.
- Package manager: npm (lockfile `package-lock.json` committed); install with
  `npm ci` in clean checkouts/CI.

## Conventions

- **ESM only**: `"type": "module"` in `package.json`; all imports use the
  `.js` extension on relative specifiers (TS emits ESM). No CommonJS
  escape hatches without an ADR.
- One module per command in `cli/src/`; tests co-located as `*.test.ts`.
- Build with `npm run build` (tsc) → `dist/`; `dist/` is gitignored.
- Errors: CLI paths set `process.exitCode = 1` and keep stdout reserved for the
  JSON envelope; human diagnostics go to stderr (docs/json-output.md).

## Testing

- Runner: vitest 5 (`npm run test` → `vitest run`); watch mode
  `npm run test:watch`. See [vitest.md](vitest.md) for the runner playbook.
- Tests build temp trees (`mkdtemp`) instead of mutating this repo's live
  `tasks/`; golden trees live in `fixtures/`.
- Full gates before every PR: `tsc -p tsconfig.json --noEmit`, `eslint`,
  `vitest run` (674 tests as of 2026-09-13).

## Security

- Run a Node line inside its support window: 24 LTS (until 2028-04-30) or 22
  Maintenance (security fixes only); Node 20 is EOL — do not use.
- `npm audit` before upgrading dependencies; CI (`.github/workflows/ci.yml`)
  builds and tests on every PR — add Dependabot (`.github/dependabot.yml`) when
  automated update PRs are wanted.
- Node security releases land as patch versions — rebase onto them promptly;
  release feeds: [nodejs.org/en/blog/vulnerability](https://nodejs.org/en/blog/vulnerability)
  (accessed 2026-09-13).

## Upgrade policy

- Track the Node release schedule quarterly: `arggon playbook status` flags
  this file stale after 90 days; re-verify against
  [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases).
- When the Active LTS line bumps (e.g. 26 → LTS in Oct 2026): update the
  `engines` floor decision deliberately (never drop a supported line mid-story),
  update CI matrix, then `arggon playbook refresh node --version 26`.
- Update the Research record above with new dated sources on every refresh.
