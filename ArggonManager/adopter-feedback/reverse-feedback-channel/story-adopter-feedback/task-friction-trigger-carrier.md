---
type: task
status: in_progress
id: task-friction-trigger-carrier
title: "Friction trigger in generated agents, doctor visibility, skill reference"
assignee: arggon-delivery-lead
branch: feat/task-friction-trigger-carrier
parent: story-adopter-feedback
labels: [method, adopters]
priority: p1
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T21:36:41.708Z"
depends_on: [task-friction-surface-parity-and-docs]
worktree_path: /home/arggon/Projects/ArggonManager-task-friction-trigger-carrier
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-trigger-carrier.md
  Leaves live only under a story. id is the filename stem: task-friction-trigger-carrier.
  CLI `arggon create task friction-trigger-carrier` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Friction trigger in generated agents, doctor visibility, skill reference

## Context

Plan task T6 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md),
stage 1 of [ADR 0024](../../../docs/adr/0024-adopter-friction-channel.md).

**This is the behavioral carrier change and the highest-risk item in the plan.**
Per `docs/agents.md` §Changing the methodology itself this is a **behavioral**
impact class: a rule agents must re-learn. Consequences the ADR settles:

- The trigger must live in the **generated agent files**, not only a skill
  reference. `deftai/directive#3633` shipped a sanctioned escalation skill and an
  agent actively escalating and following the rule that pointed at it still missed
  it; the friction was "absorbed into the session" — silent loss, which looks
  like success. Author's maxim: "a disabled capability nobody can see is absent."
- Opt-out must **not** gate the trigger's presence (ADR 0024 §3).

The `doctor` block is owned **solely** by this task (ADR 0024 §2), and its
justification is narrow — note the self-correction, because this paragraph
previously argued the opposite while naming the mechanism that already works:

- `doctor.ts` re-renders the current template for every `config.generated` entry
  in every local state, **including acked**, and the generated agent files are in
  that map. So editing the worker template alone already surfaces a missing
  trigger as an outdated managed doc. **"The channel is not live" is not
  invisible today**, and this task must not be justified as though it were.
- What the block buys instead: a **per-file `triggerVersion`**, and separating
  **_trigger absent_ from generic template drift** — the observable
  `task-spike-friction-trigger-compliance` needs to distinguish "never seen"
  from "seen and ignored". That spike gates stage 2 and tier C, so the block's
  value is measured, not assumed.

If stage 1 must be minimal, cut `triggerVersion` and `files`, **not** the block.

`task-friction-tier-b-url-and-optout` must land first: the trigger text names the
command, and an agent file pointing at a missing command is worse than no trigger.

## Acceptance

- [ ] `templates/docs/opencode/agents/arggon-worker.md` and `…/arggon-coordinator.md` carry the marked `arggon:friction-trigger` block with `triggerVersion=<arggonVersion>`.
- [ ] The trigger text states that friction **in ArggonManager itself** is not adoptable work and must not be worked around or filed in the adopter's tracker.
- [ ] `doctor --json` reports `triggerPresent`/`triggerVersion` per managed agent file. Owned solely by this task; `task-friction-surface-parity-and-docs` documents the field but does not own or test it.
- [ ] `x-friction: false` does not strip the trigger from a generated agent file (test).
- [ ] `skills/arggon-cli/references/friction.md` added and routed from `SKILL.md`; both stay byte-equal to their `.agents/skills/` copies (modulo the generated marker) — `cli/src/skill-copy.test.ts` green.
- [ ] `EVALS.md` gains a case deriving `arggon friction --report` from the **agent file alone**, with the new reference not visible to the deriving agent — the `deftai` lesson turned into a regression test.
- [ ] `docs/agents.md` §Self-improvement loop and `docs/agents.md` §0 cross-reference the channel; `docs/convention.md` documents the `x-friction` key; `README.md` gains the one-paragraph channel summary — all in this same PR.
- [ ] The PR description **and** a comment on this item state the impact class as **behavioral** and reference the ADR 0016 channel.
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green.

### 2026-10-15 @Arggon
## Evidence — task-friction-trigger-carrier (PR #850)

Behavioral impact class per `ArggonManager/docs/agents.md` §Changing the methodology itself: this is a rule agents must re-learn, so the doc statements it makes false move in the same PR and the skill sources stay byte-equal with their bundled copies. Routed to adopters through the ADR 0016 channel; the PR body states the class.

### File-name note (the item's wording vs the seam at HEAD)

The item and the ADR/spec say `arggon-worker.md` / `arggon-coordinator.md`; the seam at HEAD ships the post-ADR-0021 ids **`arggon-maker.md`** and **`arggon-delivery-lead.md`** (`templates/docs/opencode/agents/`). Those two are the ADR's two files at their current ids — the template-family drift guard fails on a retired id, so renaming back was not an option. The zcode/claude seams ship only maker + standards-reviewer and their templates carry no block, which is why doctor reports no rows for them.

### Per-box evidence

1. **Templates carry the marked block, `triggerVersion=<arggonVersion>`** — `cli/src/init-opencode.test.ts` asserts, on a fresh `runInit`, that both generated files carry `<!-- arggon:friction-trigger begin triggerVersion=<running arggon> -->` + the end marker. The version is resolved at write time by `renderDocPlaceholders` (`cli/src/docs.ts`), a third render-time substitution beside `{{PROJECT_NAME}}`/`{{YEAR}}` and the CI-workflow pin; an older arggon's file keeps its older version, which is what makes a stale trigger visible.
2. **The carve-out text** — same test asserts `not adoptable work` and `do not file it in this repo's tracker` in both files, plus both modes (`arggon friction "<one line>" --command "<argv shape>"` and `arggon friction --report`) so the workflow is derivable from the agent file alone.
3. **`doctor --json` `friction` block, owned solely here** — 7 cases in `cli/src/doctor.test.ts`: present+current on a fresh tree; absent (the "never seen" reading, file named in the human line); a stale `triggerVersion` separated from an absent trigger; mixed versions reading `null`; a tree whose agent seam is not materialized (no rows, no false alarm); an uninitialized tree; and the additive `--json` field with `schemaVersion` still 1. Population is derived (managed destinations whose current template ships the block), each row reads the bytes on disk, and a carrier whose seam directory is absent is skipped — a claude-only adopter is never nagged about an opencode seam it does not carry. Justification kept narrow per the item's self-correction: `docs.outdated` already surfaces a template edit (the render-vs-disk compare runs for every local state), so what this block buys is the per-file version and absent-vs-drift, nothing more.
4. **`x-friction: false` does not strip the trigger** — `cli/src/init-opencode.test.ts` writes `x-friction: false`, deletes both agent files, re-runs `init` and asserts the block is regenerated; in the same fixture a capture writes nothing and `--report --json` reports `optedOut: true`, so the opt-out is proven live rather than dead.
5. **`references/friction.md` + routing, byte-equal copies** — `cli/src/skill-copy.test.ts`, `cli/src/init-claude.test.ts` (repo-self `.claude-marketplace` step) and `cli/src/provenance-audit.test.ts` green. `npm run skills:sync` wrote the per-checkout copy + its `x-generated` row; the committed `.claude-marketplace` copies were materialized through `renderGeneratedDoc` from the new template (precondition-verified against a sibling render) with their rows re-recorded the same way — no hand-written checksums.
6. **`EVALS.md` E19** — `node skills/arggon-cli/evals/run.mjs` → **22 passed, 0 failed**. E19 deletes `.agents/skills/` from the fixture first, so the only thing the deriving agent can read is `.opencode/agents/arggon-maker.md`: the marked block must name both modes, and a capture followed by `friction --report --json` must render one class.

### Gates (worktree, on the final commits)

`npm run arggon -- validate` ok (0 warnings) · `npm test` 165 files / 3656 passed · `npm run build` 0 TS errors · `npm run check:plugin` committed bundle == fresh build · `npm run lint` clean · `npm run test:structure` 5 passed · `npx prettier --check` clean on every touched file · evals 22/22.

### Commands run, expected vs observed

- `npm run arggon -- doctor --json` → `friction.triggerPresent: true`, `triggerVersion` = `current`, `files[]` = the two agent paths. Before the seam refresh in this PR it reported `triggerPresent: false, files: []`-shaped absence, which is the "never seen" reading the block is built to distinguish.
- `arggon friction --report --json` on a fresh state dir → `report: true, count: 0, classes: 0, optedOut: false, dedupeScope: "local-only"`; with `x-friction: false` → `optedOut: true` and an empty report.

### Known follow-ups (not filed — the maker files nothing)

- The spec's illustrative snippet shows `"files": 2` while the committed `docs/json-output.md` row (written by T5) says `friction.files` is an `object[]`; I followed the committed contract doc and the `friction.files[]` table in it now records the real shape. The spec snippet is unchanged.
- `skills/arggon-cli/evals/run.mjs` needed two pre-existing-staleness repairs to run at all (the fixture's hardcoded `tasks/` path after ADR 0012 moved the tree, and `PLACEHOLDER_BODY` making E9 fail on bare `create`s). Both are harness fixes, called out in the PR body.
- Locally, `test/kernel-artifacts.ts`'s freeze left `lib/dist` mode 555 after a full `npm test`; `chmod -R u+w lib/dist dist` restored it and `npm run build` then succeeded. Not caused by this change, worth knowing when a rebuild fails with EACCES.
