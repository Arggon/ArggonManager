---
playbook_id: vitest
version: 5.0.0
researched: 2026-09-13
status: current
---

# vitest playbook

Technology playbook: the chosen version and the current best practices for
vitest. The version/best-practices research happened when this file was
created — cite dated sources (URL + access date) in every section so the next
reader can re-verify, and keep this file current via
`arggon playbook status`.

**Research record (2026-09-13):** npm `latest` for `vitest` is **5.0.0**
(published 2026-09-03); this repo pins `vitest ^5.0.0` — already on the
current major. Source: `npm view vitest version` / `npm view vitest time
--json` (npm registry, accessed 2026-09-13).

## Setup

- `npm i -D vitest@^5.0.0`; scripts: `"test": "vitest run"` (CI gate),
  `"test:watch": "vitest"` (local loop).
- No separate vitest config file: defaults (co-located `*.test.ts`, node
  environment) cover this repo; add `vitest.config.ts` only if a second
  environment (jsdom/browser) is ever needed.
- Run: `npx vitest run` (full suite, 674 tests as of 2026-09-13); single file:
  `npx vitest run cli/src/validate.test.ts`; `-t "<name>"` filters cases.

## Conventions

- Tests co-located with source as `<module>.test.ts` in `cli/src/` — never a
  separate top-level test tree.
- Filesystem tests build **temp trees** (`mkdtempSync` under `tmpdir()`) and
  mutate only there; tests never write into this repo's live `tasks/`.
- Spawned-CLI tests go through `tsx cli/src/cli.ts` with parsed-JSON
  assertions on the `schemaVersion: 1` envelope (see `cli/src/cli.test.ts`).
- Determinism: inject clocks/dates where the kernel allows (`now` options);
  no real network in unit tests (`gh` is shimmed via a fake PATH bin).

## Testing

- Coverage is not gated; the CI gate is `npm run test` green plus `npm run
  build` and `npm run lint`. Add tests in the same PR as behavior changes
  (docs/engineering.md review bar).

## Security

- Vitest advisories to watch (none apply to this repo's usage — we never
  enable `api.server` or browser mode, and tests never bind public ports):
  - GHSA-5xrq-8626-4rwp / CVE-2025-24964 (2025-02-05): RCE via cross-site
    WebSocket hijacking when `api: { server: true }` is exposed.
  - GHSA-8gvc-j273-4wm5 / CVE-2025-24963 (2025-02-05): arbitrary file read via
    the browser-mode HTTP server `__screenshot-error` handler.
  - GHSA-g8mr-85jm-7xhm (2026): browser-mode `cdp()` API can proxy Chrome
    DevTools Protocol and overwrite config.
  Sources: [github.com/vitest-dev/vitest/security/advisories](https://github.com/vitest-dev/vitest/security/advisories)
  (accessed 2026-09-13).
- Run `npm audit` on dependency bumps; vitest ships as a devDependency only —
  it never ships to users of the built `dist/cli.js`.

## Upgrade policy

- Quarterly re-research: `arggon playbook status` flags this file stale after
  90 days; re-run `npm view vitest version` and note the date.
- Major bumps (e.g. 5 → 6): read the vitest release notes
  ([github.com/vitest-dev/vitest/releases](https://github.com/vitest-dev/vitest/releases),
  accessed 2026-09-13), migrate, and run the full suite in the same PR.
- Minor/patch bumps within ^5: full gates (tsc, eslint, vitest run) in the
  bump PR; then `arggon playbook refresh vitest --version <new>`.
