---
type: bug
status: todo
id: bug-stale-vendored-plugin-copy
title: Stale vendored plugin copy survives init re-runs (shared x-generated checksum vs per-checkout artifact)
parent: native-redesign
labels: [opencode-seam, init, dogfood]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-stale-vendored-plugin-copy.md
  Leaves live only under a story. id is the filename stem: bug-stale-vendored-plugin-copy.
  CLI `arggon create bug stale-vendored-plugin-copy` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Stale vendored plugin copy survives init re-runs (shared x-generated checksum vs per-checkout artifact)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @Arggon
## Context

Reported from an OpenCode TUI load failure in the primary checkout (`/home/arggon/Projects/ArggonManager-opencode2`, OpenCode v2.0.13):

```
Export named 'ARGON_BOARD_PANEL' not found in module
'/home/arggon/Projects/ArggonManager-opencode2/.opencode/plugins/arggon/index.ts'.
```

(`~/.local/share/opencode/log/opencode.log`, 2026-09-22T13:01:53Z, run `5eeae8da`, entrypoint `…/tui.tsx`, 3 reconciliation attempts, role=cli.) The server entry `index.ts` loaded fine; only the TUI entry failed.

**Root cause.** `.opencode/plugins/arggon/index.ts` is a gitignored, per-checkout artifact vendored from the committed `opencode/plugins/arggon/index.bundle.ts`. In this checkout it was a pre-bundle raw-source vendoring:

- 48,211 B, sha256 `325d10f9…`, first line `// arggon:generated template="opencode/plugins/arggon/index.ts"` — byte-exact stamp of `opencode/plugins/arggon/index.ts` at `df84e447` (2026-09-18): no board module, no native tools.
- `ArggonManager/.convention.yml` records the destination checksum `988e2cd8…` (arggonVersion 0.3.0, generatedAt 2026-09-21T20:54:09Z), which is the stamp of the bundle at `55e2638f` — recorded in a **different checkout** (worktree) and merged.
- `arggon init` therefore decides `modified-skip` ("adopter-modified — kept") and never re-vendors the file, while the W5 `tui.tsx` (correctly refreshed) imports five board names — `ARGON_BOARD_PANEL`, `boardSnapshot`, `boardTreeLines`, `emptyBoardSnapshot`, `sidebarStatusLine` — that exist only in the bundle wrapper.

Confirmed with `npm run arggon -- init --dry-run --json`: `.opencode/plugins/arggon/index.ts` → `modified-skip`. Only a test run (`cli/src/plugin-copy.test.ts`) self-heals the derived copy; `init` cannot, and nothing warns. The W5 review flagged the related gap as P3 ("stale-dogfood trap for W7").

**Local workaround applied** (2026-09-22): `npx vitest run cli/src/plugin-copy.test.ts` regenerated the copy from the committed bundle (assert-before-write gate passed; `npm run check:plugin` clean, 39 modules / 338,601 B); a node import resolves all five names; OpenCode reconciled cleanly (plugins 12 → 13, no warning at 13:05:12Z). The recorded state checksum is still stale, so the trap remains for the next bundle change.

## Acceptance

- [ ] Semantics for derived (gitignored) destinations decided and documented: their x-generated checksum is shared across checkouts while their bytes are per-checkout, so "checksum vs state" cannot be the only signal. Options: exclude them from the tracked state and always compare on-disk bytes against the current render; or treat a state mismatch on these paths as "re-vendor the committed artifact"; or at minimum add a `doctor` check that reports the stale copy loudly.
- [ ] Regression test: state generated in checkout A, derived copy generated in checkout B (the merge scenario) is detected or healed — no silent `modified-skip` for `.opencode/plugins/arggon/index.ts` / `tui.tsx`.
- [ ] `arggon init` and/or `arggon doctor --json` surfaces a stale vendored plugin before OpenCode fails to load the TUI entry, without reading OpenCode logs.
- [ ] Docs updated where init provenance is described (`ArggonManager/docs/playbooks/opencode.md`, `ArggonManager/docs/convention.md`), and the primary-checkout path is covered by `npm run smoke:tui` or an equivalent check.
- [ ] `npm test`, `npm run check:plugin`, `npm run arggon -- validate --json` green.

## Evidence

- Log: `~/.local/share/opencode/log/opencode.log` — failure at 2026-09-22T13:01:53Z, clean reconciliation at 13:05:12Z (`plugins=13`).
- `ArggonManager/.convention.yml` x-generated entry for `.opencode/plugins/arggon/index.ts`.
- `git show df84e447:opencode/plugins/arggon/index.ts` + stamp = sha256 `325d10f9…` (stale on-disk bytes).
- `git show 55e2638f:opencode/plugins/arggon/index.bundle.ts` + stamp = sha256 `988e2cd8…` (recorded state).
