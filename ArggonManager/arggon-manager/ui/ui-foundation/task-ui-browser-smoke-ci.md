---
type: task
status: done
id: task-ui-browser-smoke-ci
title: "Browser smoke in CI: @smoke Playwright spec + TUI frame check"
assignee: Arggon
branch: feat/task-ui-browser-smoke-ci
parent: ui-foundation
labels: [ui, smoke, ci]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
depends_on: [bug-ci-version-guard-dev-only]
worktree_path: /home/arggon/Projects/ArggonManager-task-ui-browser-smoke-ci
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ui-browser-smoke-ci.md
  Leaves live only under a story. id is the filename stem: task-ui-browser-smoke-ci.
  CLI `arggon create task ui-browser-smoke-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Browser smoke in CI: @smoke Playwright spec + TUI frame check

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

ADR 0008 chose two tiers: review-time Playwright CLI (used ad hoc today) and an optional CI `@smoke` `@playwright/test` spec that was never implemented. Every UI change in the `ui` epic will need a durable regression net; the TUI exception (scripted pty render check) is already prototyped in `smoke/tui-smoke.ts`.

## Acceptance

- [ ] A `@smoke`-tagged Playwright spec: `board --serve` on a fixture renders cards matching `arggon list`, one status move round-trips and persists (verified with `arggon show`), and a filter reduces the view
- [ ] A CI job runs the spec on Chromium only; Playwright stays dev-only (never a runtime dependency) and the job skips cleanly when browsers are unavailable
- [ ] The TUI gets a scripted frame assertion (reuse the smoke fixture pattern) or a documented manual step in the same docs section
- [ ] docs/engineering.md testing table + CONTRIBUTING.md commands updated; CI green on the PR

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Coordinator amendment (2026-09-22, pre-claim)

Two scope clarifications before this item is claimed:

1. **Drop the filter assertion from the spec's initial scope.** The board has no filter UI yet — that is `task-board-filter-lenses` (wave 1) and its own acceptance already requires a filter smoke. The `@smoke` spec here must cover what exists today: board renders, cards match `arggon list --json`, one legal status move round-trips and persists (`arggon show`), and the spec is structured so later UI features add cases. The wave-1 item extends the spec.
2. **`bug-ci-version-guard-dev-only` is a hard prerequisite and is in scope here** (dependency recorded): adding `@playwright/test` to devDependencies trips the inline version guard in `.github/workflows/ci.yml`, which fails on any `package.json` change while v0.4.0 is tagged. Fix the guard scoping (publish-relevant fields only) in this PR, reference the bug id and this item in the PR body, and keep the release-forgotten behavior for shipping fields with a local probe as evidence. This is an authorized, documented scope addition, not diff creep.

Everything else in the original acceptance stands.

### 2026-09-22 @ses_f34ab7c2effeGb96Q5UOGLzjgq
## Evidence — wave 0 worker (branch `feat/task-ui-browser-smoke-ci`, commit `50c89218`, PR #401)

### Delivered
- `@playwright/test@^1.63.0` devDependency only (npm `dist-tags` latest is 1.63.0; 1.64 is alpha/next; local Playwright is 1.63.0) + root `playwright.config.ts` (`testDir: "e2e"`, explicit Chromium project, 1 worker, 60s timeout, retries 1 in CI). `dependencies` in package.json unchanged — no runtime dependency.
- `e2e/board.smoke.spec.ts`: temp fixture (`git init` + identity + initial commit, `arggon init`, initiative→epic→story→task created with the CLI), starts the **built** bin (`node dist/cli.js board --serve --port 0`), parses the printed `http://127.0.0.1:<port>` URL and waits for readiness; asserts board load + card `data-id` parity with `arggon list --json`, drives one legal move (`todo → cancelled`, no prompts) with a real HTML5 drag, waits for the ok toast (POST answered) then re-checks persistence with `arggon show --json`; `afterAll` SIGTERM→SIGKILL closes the server and removes the fixture.
- `smoke/tui-board-smoke.ts` + npm `smoke:tui-board` (plus `smoke/tui-board-smoke.test.ts` pinning the frame predicate, `opencode-smoke.test.ts` pattern): runs `arggon board --tui` in a pty via util-linux `script`, quits with `q` once the frame rendered, asserts the five status headers + seeded item id. Skip path verified: `PATH=/nonexistent` → `skipped: util-linux 'script' (PTY bridge) not available`, exit 0.
- `.github/workflows/ci.yml`: new `ui-smoke` job — `npm ci` → `npm run build` → `npx playwright install --with-deps chromium` → `npx playwright test --grep @smoke` → `npm run smoke:tui-board`. Generated `.github/workflows/arggon.yml` untouched.
- Docs: `ArggonManager/docs/engineering.md` testing table + CI tier; `CONTRIBUTING.md` local smoke commands. `docs/json-output.md` untouched (no behavior change).
- Coordinator amendment honored: no filter assertion (wave-1 `task-board-filter-lenses` extends the spec).

### bug-ci-version-guard-dev-only (fixed in this PR)
`cli/version-guard.mjs` scopes the demand to `name`, `version`, `private`, `bin`, `files`, `dependencies`, `engines`; dev-only changes pass with a clear message. Predicate probe, expected vs observed:
1. devDependencies/scripts-only vs v0.4.0 tagged → expected PASS → observed exit 0: `package.json changed, but none of the publish-relevant fields (...) — dev-only change, no version bump required`
2. `dependencies` change vs v0.4.0 tagged → expected FAIL → observed exit 1: `version 0.4.0 already tagged - bump package.json (publish-relevant fields changed: dependencies)`
3. `dependencies` change, version 9.9.9 untagged → expected PASS → observed exit 0: `version 9.9.9 is not yet tagged - ok`

Related finding fixed in the same step: the old guard was **silently dead on PRs** — CI run 35794199343 logs show `fatal: origin/main...HEAD: no merge base` in the shallow checkout, and the `if !` then exited 0. The step now fetches `github.event.pull_request.base.sha` (`--depth=1`) and diffs two-dot. Shallow-repo replay: old command finds nothing, new one lists `package.json`, base content fetched, predicate behaves as probed. On this PR's CI the step now actually runs and prints the dev-only pass (log excerpt in the PR body).

### Local gates (all green, run in the worktree)
- `npm run build` OK; `npm run check:plugin` OK (no bundle drift); `npm test` → 94 files / 1508 tests passed (e2e/ not collected by vitest); `npm run lint` clean; `npm run arggon -- validate --json` → `{"ok":true,...,"errors":[],"warnings":[]}`.
- `npx playwright test --grep @smoke` → 2 passed `[chromium]` (2.2s); `--repeat-each=2` → 4 passed; `npm run smoke:tui-board` → `ok  the TUI frame carries the five status headers and the seeded item id`.

### CI on PR #401 (all checks green)
- `cli`: https://github.com/Arggon/ArggonManager/actions/runs/35796091354/job/106975592148 (guard step prints the dev-only pass; `cli/version-guard.test.ts` 6 tests pass)
- `ui-smoke`: https://github.com/Arggon/ArggonManager/actions/runs/35796091354/job/106975592439 (2 Playwright tests + TUI frame check passed)
- `tasks-validate`: pass

### Flags for the coordinator
- PR #401 is the merge vehicle for both items; merge-merge (tracker commits ride the branch).
- Acceptance boxes left unchecked for you to tick at completion.
- `ui-smoke` adds ~1.5 min wall time (measured 1m30s, Chromium install included); kept Chromium-only/one-worker per ADR 0008.

### handoff 2026-09-22 @ses_f34ab7c2effeGb96Q5UOGLzjgq (session: ses_f34ab7c2effeGb96Q5UOGLzjgq) — next: Coordinator: review PR #401 (both ids referenced), merge-merge, tick acceptance, set done. CI green on 50c89218: cli, ui-smoke, tasks-validate all pass.
- branch: feat/task-ui-browser-smoke-ci
- open questions: ui-smoke adds ~1.5 min wall time (Chromium install) — acceptable? Guard step is now live in CI (shallow-checkout fix); confirm the scoped field list matches intent.

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Coordinator review — PASS (lead architect) + merge verification

Reviewed PR #401 (rebase-merged; auto-done #403 marked this item done).

**Scope.** `@playwright/test` as a devDependency only; `playwright.config.ts` (testDir `e2e`, Chromium, 1 worker); `e2e/board.smoke.spec.ts` (temp git fixture + `init` + 4-item CLI chain; exact card-id parity with `arggon list --json`; `todo → cancelled` through a real HTML5 drag; toast-gated persistence check via `arggon show`; SIGTERM/SIGKILL cleanup); `smoke/tui-board-smoke.ts` pty frame check (+ predicate test) with `smoke:tui-board`; `ui-smoke` CI job; docs (`engineering.md` testing table, `CONTRIBUTING.md`); run artifacts gitignored. The coordinator amendment was honored (no filter assertion — wave-1 `task-board-filter-lenses` extends the spec).

**Independent coordinator verification.**
- `npx playwright test --grep @smoke` in the worktree: **2 passed** (1.7s), real Chromium.
- `npm run smoke:tui-board`: **passed** (pty frame carries the five headers + seeded id).
- CI on the rebased head: `ui-smoke` 1m28s, `cli` 4m19s, `tasks-validate` 34s.
- Guard fix probes on merged main: dev-only change → exit 0 ("no version bump required"); shipping field change with v0.4.0 tagged → exit 1. `cli/version-guard.test.ts` pins the predicate.

**Acceptance — verified.** Durable `@smoke` spec runs in CI Chromium-only with a dev-only dependency; TUI frame check scripted; docs updated; required `cli` check untouched and green.

**Extra finding handled in-PR:** the old version guard was silently dead on every PR (shallow checkout has no merge base, so the `! grep` short-circuit always passed); the step now fetches the PR base by SHA and diffs two-dot — the bug item records it.
