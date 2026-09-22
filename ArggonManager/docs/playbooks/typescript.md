---
playbook_id: typescript
version: 5.8.2
researched: 2026-09-13
status: current
---

# typescript playbook

Technology playbook: the chosen version and the current best practices for
typescript. The version/best-practices research happened when this file was
created — cite dated sources (URL + access date) in every section so the next
reader can re-verify, and keep this file current via
`arggon playbook status`.

**Research record (2026-09-13):** npm `latest` for `typescript` is **7.0.2**
(published 2026-07-08, the Go-native compiler line); the 5.x line's last
dot-release is 5.8.2 (published 2025-02-28). Source: `npm view typescript
version` / `npm view typescript time --json` (npm registry, accessed
2026-09-13). This repo pins **~5.8.2** (`typescript ^5.8.2` in package.json) —
a deliberate stay on the stable 5.8 compiler; TS 7 adoption is a stack decision
requiring an ADR (docs/engineering.md).

## Setup

- `npm i -D typescript@~5.8.2` (pinned minor — compiler behavior stays stable
  within the pin; bump the pin deliberately, never via a blanket `npm update`).
- Config: `tsconfig.json` with `strict: true`,
  `module`/`moduleResolution: NodeNext`, `target: ES2022`, `declaration: true`,
  ESM emit to `dist/`.
- Typecheck gate: `npx tsc -p tsconfig.json --noEmit` (CI runs it via
  `npm run build`).
- Linting: `typescript-eslint` ^8.26.1 with `eslint` ^9 (flat config), gate:
  `npm run lint`.

## Conventions

- Strict mode everywhere — no `any` leaks into kernel modules; prefer `unknown`
  - narrowing at I/O boundaries (frontmatter, fs reads).
- ESM imports use `.js` extensions on relative specifiers (NodeNext emits and
  resolves ESM); `import type` for type-only imports.
- No `enum`/parameter properties (TS-only runtime constructs) — plain objects
  and unions keep the emitted JS clean; data schema stays plain YAML frontmatter.
- Kernel modules (items/status/rules/relations) carry no CLI I/O; types shared
  with docs live in one place (docs/json-output.md is the contract mirror).

## Testing

- Types are exercised through vitest 5 against temp trees (co-located
  `*.test.ts`); the `--noEmit` gate is the type-level test.
- Golden JSON envelopes are asserted in `cli/src/contract.test.ts` — update in
  the same PR that changes the envelope (docs/json-output.md).

## Security

- TypeScript itself ships no runtime; the supply-chain risk is the toolchain
  (typescript, typescript-eslint, @types) — review transitive diffs on bump.
- `skipLibCheck: true` trades full .d.ts verification for speed; acceptable
  because dependencies are pinned and audited via `npm audit`.
- Watch GitHub advisories for the `typescript` package:
  [github.com/Microsoft/TypeScript/security/advisories](https://github.com/Microsoft/TypeScript/security/advisories)
  (accessed 2026-09-13).

## Upgrade policy

- Quarterly re-research: `arggon playbook status` flags this file stale after
  90 days; re-run `npm view typescript version` and note the date.
- Staying on 5.8.x is the default until an ADR approves TS 7 (native compiler):
  evaluate after 7.x settles (breaking changes: config/deprecation surface, see
  the TypeScript 7 announcements on
  [devblogs.microsoft.com/typescript](https://devblogs.microsoft.com/typescript/),
  accessed 2026-09-13).
- Patch/minor bumps within ~5.8: run the full gates (tsc, eslint, vitest) in
  the same PR; then `arggon playbook refresh typescript --version <new-pin>`.
