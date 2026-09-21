---
type: task
status: in_progress
id: task-native-dogfood-release
title: "Dogfood, ADR 0006 measurement and release"
assignee: Arggon
branch: feat/task-native-dogfood-release
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-21"
claimed_at: "2026-09-21T19:10:15.951Z"
depends_on: [task-native-headless-ci]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-dogfood-release
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-dogfood-release.md
  Leaves live only under a story. id is the filename stem: task-native-dogfood-release.
  CLI `arggon create task native-dogfood-release` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Dogfood, ADR 0006 measurement and release (W7)

## Context

W7 of `plan-native-first-011`. Migrate this repo's own `.opencode` seam to the native surface; run `context:report --strict`; finish packaging/release docs; tag. Closes the program.

## Acceptance

- [ ] ADR 0006 budgets re-measured and within limits; item block ≤ 1024 B.
- [ ] Dogfood scenarios green on this repo's own tracker.
- [ ] Packaging/release docs updated; release checklist executed.
- [ ] Release notes cover the W3 default-path change: the plugin no longer
      auto-registers the MCP server; an adopter re-running `init` loses
      auto-registration unless they configure the stanza (`doctor` reports it
      as optional).
- [ ] `arggon validate` and `spec validate` green.

## Notes

- Watch the ADR 0006 native-tools headroom: after W4/W5 the advisory bound is
  at 12,182 B ≤ 12,288 B (~106 B). Re-measure and either trim schemas, decide
  `options.pinned`, or raise the bound deliberately in this wave.

- Depends on W3–W6; this is the program's closing gate.

### 2026-09-21 @Arggon
### W7 evidence (worker, 2026-09-21) — dogfood, ADR 0006 re-measure, release prep

Branch `feat/task-native-dogfood-release`, worktree `/home/arggon/Projects/ArggonManager-opencode2-task-native-dogfood-release`.

**Commits**

- `b944d7f` chore(dogfood): migrate this repo's .opencode seam to the native surface (W7)
- `55e2638` perf(plugin): trim redundant output-schema bytes for ADR 0006 headroom (W7)
- `473b60d` docs(release): native-first release notes, publish runbook, ADR 0006 re-measure (W7)
- `cd24ec1` chore(tasks): record the vendored plugin's trimmed-bundle state (W7)

**Dogfood — seam migration with `init` + provenance**

- `init --dry-run --json` (before): created 10, updated 15, modified-skip 2 (`AGENTS.md`, `CONTRIBUTING.md`), backedUp 0, skipped 9.
- `init --no-commit`: wrote the 25; the two adopter-modified files are byte-untouched (`modified[]`/`skipped[]`) — never overwritten, as the provenance contract requires.
- Idempotent: a second `init --no-commit` left every content file byte-identical (`git diff` over all files except the state file, sha256 `0e339997…` before == after); the post-run `init --dry-run --json` shows `created: []` and the same 25 as `updated` (identical renders). Only the state file's `generatedAt` bookkeeping refreshes by design.
- `.github/workflows/arggon.yml` is now committed by the product repo itself; its drift-gate command run locally (`git status --porcelain -- . ':(exclude)ArggonManager/.convention.yml'`) is **clean**.

**Dogfood — real/headless sessions over THIS repo**

- Live session (this worker session after `session_move` to the worktree): the Code Mode catalog switched to the native namespace — `search` lists `tools.arggon.{branch,cleanup,comment,handoff,import_issues,list,next,priority,report,show,start,sync,update,validate}` (14 of 15; `create` hidden by the worker agent's `arggon_create` deny — W4 permissions live). `tools.arggon.list({status:"in_progress",type:"task"})` returned this item; `tools.arggon.next({})` → `task-native-lib-hygiene`, identical to `arggon next --json`.
- Tools, headless (`opencode run --auto -m opencode-go/deepseek-v4.1-flash`, cwd = worktree, exit 0): `execute` ran `tools.arggon.list({status:"todo"})` + `show({id:"task-native-dogfood-release", meta:true})` → `{open: 11, marker:"/home/arggon/Projects/ArggonManager-opencode2-task-native-dogfood-release"}`, no errors.
- Command, headless: `opencode run "/arggon-status"` — the V2 loader expanded the migrated `.opencode/commands/arggon-status.md` (body text present in the transcript) and the model called exactly `tools.arggon.report({})`, `list({status:"blocked"})`, `list({stale:true})`; no CLI shell-out.
- Panel: `npm run smoke:tui` → 13/13 (init seam, discovery, PTY `/arggon-board`, render, corrupt-tracker degradation). Over this repo: TUI loads the vendored entry with no plugin failure, the palette lists _Open Arggon board_, the sidebar renders `arggon ▶ task-…`, and the board preview renders this repo's tree with the `… 77 more item(s)` counter. Caveat, reported honestly: with the 277-item tracker the 30–45 s PTY capture showed the palette preview focused on the active item, not the `arggon board · N item(s)` header line (the header assertion is covered by the fixture smoke, which passes).

**ADR 0006 re-measured** — `npm run context:report -- --strict` → exit 0, `regressions: []`

- native `arggon` tools: **11,821 B ≤ 12,288 B (467 B headroom)** — 15 definitions, 9 pinned; was 12,182 B / 106 B.
- injected item block: bound 1,024 B, measured 193 B / 252 B (fixture items).
- generated AGENTS.md 2,005 B ≤ 2,048 B · MCP `tools/list` 10,507 B ≤ 12,288 B (9 tools, compatibility surface) · fixed total 25,275 B · compaction keep.tokens 15,000.
- Decision recorded in ADR 0006 §Consequences (2026-09-21): keep the bound; trim only redundant bytes — the 12 kernel output schemas drop `additionalProperties: true` (absent means true in JSON Schema; 336 B) and the namespace line keeps both facts in 104 B (25 B). `options.pinned` unchanged (the lever selects catalog render priority, it does not shrink this payload).

**Release prep (docs + checklist; nothing published, no tag, no bump)**

- `CHANGELOG.md` `[Unreleased]`: W0–W7 adopter-facing notes with the **W3 default-path change** explicit — the plugin no longer auto-registers the MCP server; an adopter re-running `init` loses the auto-registration unless they configure `mcp.servers.arggon` (doctor reports the stanza as optional; `.mcp.json` and `arggon mcp` stay for non-OpenCode clients).
- `ArggonManager/docs/runbooks/release.md`: publish section for both packages (dependency order, `private` removal, post-publish verification, deprecate-not-unpublish rollback), the owner-only decision boundary, the post-release `ARGGON_REF` pin step, and the checklist as executable steps.
- Checklist executed up to the owner gate: `arggon --version` → `0.3.0 (cd24ec1, feat/task-native-dogfood-release)`; `npm pack --dry-run` rehearsal → 109 files / 328,481 B, `dist/cli.js` + plugin bundle present, no `.test.*`/`test-tmp` leakage.
- Deliberately NOT executed (product-owner decision): version bump, `private: true` removal, tag, npm publish.

**Gates**

- `npm test` 89 files / **1,454 tests** green · `npm run lint` clean · `npm run build` ok · `npm run check:plugin` exit 0 (bundle rebuilt + committed)
- `arggon validate` ok (0 warnings) · `arggon spec validate` ok · `context:report --strict` all bounds pass
- `smoke:tui` 13/13 · `smoke:opencode:wave` 2 fixtures / 0 failures · `smoke:opencode` **26 scenarios / 0 failures** (144 checks, exit 0). A first full run flaked 2 checks in the `/adopt` scenario while the model-driven wave smoke ran concurrently (a 300 s provider stall left the session half-done); the isolated `/adopt` re-run (3/3) and the clean full re-run both pass.

**Owner decision pending — publication/tagging (not taken; exact steps)**

1. Bump `0.3.0` → `0.4.0` in `package.json` (minor: new tools/commands/plugin/TUI/layout) and rename `[Unreleased]` to `## 0.4.0 (YYYY-MM-DD)`.
2. Remove `private: true` from `package.json` and `lib/package.json` in the release PR.
3. Merge to `main`, `git tag v0.4.0 && git push origin v0.4.0`, then `npm publish --workspace @arggon/lib` followed by `npm publish` (kernel first — the root cannot resolve `@arggon/lib` from the registry otherwise); verify `npm view` + a clean global install.
4. Follow-up PR: pin `ARGGON_REF: v0.4.0` in `templates/docs/github/workflows/arggon.yml`, re-run `init`, and switch README/ci.md to the registry one-liner.

**CI (draft PR #381, base `opencode2`)**
- `cli` (build + `check:plugin` + `npm test` + lint) — **pass** (3m55s).
- `tasks-validate` — the generated `.github/workflows/arggon.yml` (W6 recipe) running on the product repo — **pass** on both the push and the pull_request event (33 s / 31 s), including the committed-seam drift gate.

**Open questions / follow-ups**

- Committing `.github/workflows/arggon.yml` makes the product repo run the W6 recipe on every push (it clones the repo from GitHub at the moving `opencode2` ref). Reviewer may drop it if CI cost outweighs the seam drift gate; the seam migration itself does not depend on it.
- `smoke:opencode:wave` (cited by `opencode2.md`) is model-driven: a first run overlapped `npm test` and flaked on 2 reviewer-verdict checks; the isolated re-run passed 0 failures. Worth documenting "run alone".
- Tier-2 docs (`ARCHITECTURE.md`, `CHANGELOG.md`, `SUPPORT.md`, `runbooks/README.md`) are acked (adopter-owned) and intentionally not regenerated by `init`.
