---
type: bug
status: in_progress
id: bug-tsx-board-dead-script
title: tsx-rendered-board-dead-script
assignee: Arggon
branch: fix/bug-tsx-board-dead-script
parent: ci-stability
labels: []
priority: p1
created: "2026-09-30"
updated: "2026-09-30"
claimed_at: "2026-09-30T23:56:07.824Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-tsx-board-dead-script
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-tsx-board-dead-script.md
  Leaves live only under a story. id is the filename stem: bug-tsx-board-dead-script.
  CLI `arggon create bug tsx-board-dead-script` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# tsx-rendered-board-dead-script

## Context

<!-- What went wrong / how to reproduce. -->

`npm run arggon -- board` (tsx path) embeds controller functions with `Function.toString()`; under tsx those sources carry esbuild keepNames `__name(...)` calls the page never defines, so the body script throws `ReferenceError: __name is not defined` on load and every control is dead. See the coordinator's verified context below.

## Acceptance

- [x] Root cause confirmed (which transform injects `__name` and why toString carries it) and the chosen fix recorded.
- [x] `npm run arggon -- board` output contains zero `__name(` references and every control works in a real browser (Playwright drive, expected vs observed).
- [x] `npm run arggon -- board --serve` interactivity verified the same way.
- [x] Regression gate added (rendered-script assertion + a tsx-path smoke leg) so it cannot return.
- [x] Gates: full suite, lint, build, check:plugin, validate; README unaffected (dist path unchanged).

## Notes

### 2026-09-30 @Arggon

### Root cause + chosen fix (worker, 2026-09-30)

**Root cause (confirmed).** `tsx` compiles the CLI with esbuild, which enables `keepNames`. Lowering nested function declarations/closures renames symbols, and keepNames preserves `.name` by splicing `__name(target, "name")` calls INTO the enclosing function body — three shapes: statement (`__name(inner,"inner");`), comma-list (`__name(a,"a"),__name(b,"b");`) and expression wrapper (`const cb=__name(fn,"cb");`). `Function.toString()` of the transformed function returns that body, and `renderBoardHtml` embeds exactly those sources, so the page script references a `__name` that is nowhere defined and the whole block dies at load. `tsc` (dist bin) and vitest's oxc transform never inject it — which is why CI, `npm test` and the dist-driven smoke lane were all blind.

**Chosen fix: strip at render time (option 2, strip variant), fail loud on unknown shapes.** `__name` returns its first argument, so replacing the call with that argument restores the exact tsc shape for all three forms. New `cli/src/board-embed.ts`: `embeddedFunctionSource(fn)` = `stripKeepNamesCalls(fn.toString())` — a syntax-aware scanner (strings, templates, comments, regex literals) so literals containing `__name(` are never touched; any code-context `__name` it cannot classify as a known shape **throws at render time** (a future esbuild emission change must fail the render loudly, never ship a dead page). Identity under tsc/oxc, so `board-parity.test.ts`'s `toString()` parity assertions hold unchanged and dist output is byte-identical. Rejected: dist-output rendering (stale/absent dist, divergent sources) and a page-side `__name` shim (output would still carry the artifacts; the item bar is zero references). Not feasible: disabling keepNames (tsx exposes no knob).

**Gates added.** `cli/src/board-embed.test.ts` (shape + literal-safety + fail-loud units); `cli/src/board.test.ts` (no-`__name(` rendered-script assertion, static + serve, plus a spawn gate running `node tsx cli/src/cli.ts board` — the real keepNames path — asserting clean output); `e2e/board.smoke.spec.ts` new `@smoke` describe driving the tsx path in Chromium (serve: zero console/page errors, no `__name(` in served script, filter visibly filters, status move round-trips and persists via `show --json`, theme/density/collapse respond and persist; static export: script-clean, filters offline).

**Gates run.** vitest board/board-embed/board-parity: 120/120. `npm run lint`, `npm run build`, `npm run check:plugin` (no drift), `npm run arggon -- validate` (ok), `test:structure` (3/3), `lint:structure`: green. `npm test` full suite: 1942/1946 — the 2-4 failures (headless-ci packed-bin byte-identical, prose-format prettier code-span, flaky pack/success-stdout spawn tests under load) reproduce on the **clean tree** in this worktree environment (blocked esbuild postinstall) and are pre-existing; CI is authoritative. Full `@smoke` Playwright lane: 32 passed + 1 pre-existing timing failure ("a live reload preserves…", `Execution context was destroyed` race — also fails on the clean tree, machine-timing). README: no statement becomes false.

### 2026-09-30 @Arggon

### Context (found by the task-board-theme-density worker; verified by the coordinator 2026-10-01)

Boards rendered through the **tsx path** (`npm run arggon -- board`, or `--serve` from source) embed a body script that dies on load: esbuild's `keepNames` transform (tsx) rewrites embedded function sources so `Function.toString()` carries `__name(...)` helper calls, but the helper is never defined in the page. Verified on this checkout: `npm run arggon -- board` → `board.html` contains **4 `__name(` calls, 0 definitions** (`applyBoardFilter`, `wireBoardColumns`, `wireBoardTheme`, …). The script throws `__name is not defined`, so **filter, drag, collapse, theme and density controls are dead** on that path (the `<head>` theme boot survives — separate script block).

Reproduced at `d55e0933` — **pre-existing**, not a theme-item regression. Invisible to every gate: vitest transforms via oxc (no `__name` in `Function.toString()`), and the smoke lane + CI drive `dist/cli.js` (tsc output, no `__name`). A reviewer driving the Playwright bar from source (`npm run arggon -- board --serve`) hits a dead page; from dist it passes.

### Fix shape (decide among)

- Render embedded board scripts from the **tsc-built dist output** rather than tsx-transformed sources;
- or **strip `__name(...)` calls / inject the helper** for toString-embedded sources at render time;
- or disable keepNames for the tsx run of the board path (esbuild/tsconfig knob) — verify the page script then round-trips.
  Plus a **gate**: an e2e/unit assertion that the rendered page script contains no unresolved `__name` references (and a smoke leg driving the tsx path), so the class cannot return silently.

### Acceptance checklist

- [x] Root cause confirmed (which transform injects `__name` and why toString carries it) and the chosen fix recorded.
- [x] `npm run arggon -- board` output contains zero `__name(` references and every control works in a real browser (Playwright drive, expected vs observed).
- [x] `npm run arggon -- board --serve` interactivity verified the same way.
- [x] Regression gate added (rendered-script assertion + a tsx-path smoke leg) so it cannot return.
- [x] Gates: full suite, lint, build, check:plugin, validate; README unaffected (dist path unchanged).

(Note: filed under `ecosystem-ops/ci-stability` because the owning `ui` containers are closed; it is a board render-path defect.)

### 2026-10-01 @Arggon
Fix on fix/bug-tsx-board-dead-script (dffaa47e): strip-at-render via new cli/src/board-embed.ts (embeddedFunctionSource / stripKeepNamesCalls) wired into all 12 toString() embeds in renderBoardHtml. Fail-loud on unrecognized keepNames shapes; identity under tsc/oxc so board-parity toString assertions and dist output are unchanged. Chosen over dist-output rendering (stale/dist divergence) and a page-side __name shim (output must carry zero __name references). keepNames cannot be disabled: tsx exposes no knob.

Smoke evidence (ADR 0008; Playwright Chromium, fixture via createFixture, npx playwright test):
- BEFORE (tsx render, pre-fix): /tmp board render had 4 __name( lines, 0 definitions. AFTER: 0 __name( references, controllers present.
- npx playwright test --grep "tsx path" → 4/4 passed: (1) tsx board --serve: h1 renders, served html has no __name(, zero console/page errors, theme auto→light→dark flips body bg to rgb(13,17,23), density→compact, column collapse + all three persist across reload; (2) filter label:smoke visibly narrows to the one labelled card, count line + URL hash updated; (3) drag todo→cancelled round-trips, ok toast, persists (show --json → cancelled); (4) tsx static export: file clean, filters offline from file://, zero page errors.
- Full @smoke lane after rebuild: 32 passed + 1 pre-existing failure ("a live reload preserves the filter…" — Execution context was destroyed race); the single test fails identically on the CLEAN tree (verified via stash), machine-timing flake unrelated to this change. Everything else in the dist lane (filter, moves, dialogs, theme/density, axe scans) green.

Gates: board/board-parity/board-embed vitest 120/120 (incl. new tsx spawn gate: node tsx cli/src/cli.ts board output has zero __name(). npm run lint clean; npm run build ok; npm run check:plugin no drift; npm run arggon -- validate ok; test:structure 3/3; lint:structure clean. npm test full suite 1942/1946: failures reproduce on the clean tree in this worktree env (headless-ci packed-bin byte-identical, prose-format prettier code-span; plus load-flaky pack/success-stdout spawn tests) — pre-existing, CI authoritative. README: no statement falsified.

Env notes for the coordinator: (1) start --worktree left no node_modules here (claim commit initially failed its pre-commit gate); fixed by npm install in the worktree + re-attach. (2) A working-tree incident mid-session (stashes + a tool-side reset) briefly lost the uncommitted fix; recovered in full from stash@{0} (74f7e78, left in place). (3) .zcode/config.json carries runtime-only changes from the zcode tooling (plugin registration + reformat) — not mine, deliberately unstaged.

### handoff 2026-10-01 @Arggon (session: ses_f0b410d36ffe1kgCM7j0P2Cztm) — next: Review PR (fix(board) dffaa47e); merge after verdict; drop stash 74f7e78 post-merge
- branch: fix/bug-tsx-board-dead-script
- open questions: Pre-existing env test failures (headless-ci packed-bin, prose-format prettier) need a non-worktree CI run to confirm green; live-reload Playwright race worth a follow-up item

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review, PR #510)
- Architecture: render-time strip in a dedicated transform-neutral module (cli/src/board-embed.ts) — the right shape: keeps dist as source of truth for CI, no tsx knob exists, page __name shim rejected (bar is zero references). Strip is identity under tsc/oxc; parity suite untouched and still exact-equality.
- Fail-loud: syntax-aware scanner (strings/templates/comments/regex), all four unrecognized-shape throw paths unit-tested; all 12 embeds routed (zero raw .toString() embeds remain).
- Tests travel with behavior: spawn-the-CLI tsx gate + CI-wired @smoke tsx browser legs (filter/drag-persist/theme/density/collapse + static export offline). Reviewer confirmed the in-process render assertion is correctly treated as a general invariant, with the real gate on the tsx path.
- Coordinator independent verification: board trio 120/120; tsx-rendered board.html = 0 __name( with controllers intact; drove all 4 tsx-path Playwright specs myself — 4/4 pass (boot clean, visible filter, persistent round-trip, script-clean export).
- Reviewer bars 1-5 pass, no blocking findings; notes (regex-division heuristic adjacency, obj.__name( gate-vs-stripper strictness, item-bullet mangle) recorded as polish, no change request.
- Merged: squash -> 4c407064; CI cli/tasks-validate/ui-smoke green on the final reconciled head (ui-smoke now runs the new tsx legs authoritatively).
