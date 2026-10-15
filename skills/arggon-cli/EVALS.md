# Evals — arggon-cli skill

Method: for each case, derive commands using ONLY the skill (fresh-eyes read of `SKILL.md` plus the `references/` files it points to), run them with `node dist/cli.js` in a temp fixture repo, and score the predicate. Fix the skill on failures, re-run failures + regression.

Fixture setup per round: `node dist/cli.js init <tmp>` then seed via `create` (initiative `eval-mvp` → epic `auth` → story `story-login` → task `task-a`).

| ID  | Task (skill-only derivation)                         | Pass predicate                                                    | R1  | R2  | R3  |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------- | --- | --- | --- |
| E1  | Find open work as JSON                               | `ok:true`, `items` array, every item `status==todo`               | ✅  | ✅  | ✅  |
| E2  | Filter with zero matches (`--status done`)           | `ok:true`, `items:[]` (empty is success)                          | ✅  | ✅  | ✅  |
| E3  | Claim `task-a` as `qa-bot`                           | `item.status==in_progress`, `assignee==qa-bot`                    | ✅  | ✅  | ✅  |
| E4  | Second agent claims same item, no `--force`          | exit≠0, `error.code==UPDATE_FAILED`, assignee unchanged           | ✅  | ✅  | ✅  |
| E5  | Create task under `story-login`                      | id starts `task-`, `path` under story dir                         | ✅  | ✅  | ✅  |
| E6  | Create with missing parent                           | exit≠0, `error.code==CREATE_FAILED`                               | ✅  | ✅  | ✅  |
| E7  | `update --status blocked` without reason             | exit≠0 (rejected)                                                 | ✅  | ✅  | ✅  |
| E8  | `update --labels sec,net` then `--labels net`        | second call leaves exactly `["net"]` (full replace)               | ✅  | ✅  | ✅  |
| E9  | `validate --json` on healthy tree                    | `ok:true`                                                         | ✅  | ✅  | ✅  |
| E10 | `board` from repo subdirectory                       | `<root>/board.html` exists, `<sub>/board.html` absent             | ✅  | ✅  | ✅  |
| E11 | Envelopes of list/create/update/validate/board       | each has `schemaVersion:1` + matching `command`                   | ✅  | ✅  | ✅  |
| E12 | `list --assignee @me` with `GITHUB_USER=qa-bot`      | returns only qa-bot items                                         | ✅  | ✅  | ✅  |
| E13 | `update --labels "Bad Label"` (non-kebab)            | rejected, exit≠0                                                  | —   | ✅  | ✅  |
| E14 | `create task --id probe2`                            | id becomes `task-probe2` (prefix kept)                            | —   | ✅* | ✅  |
| E15 | `list` without `--json`                              | human table, exit 0, not JSON                                     | —   | ✅  | ✅  |
| E16 | `validate --json` on tree with `status: bogus` file  | `ok:false` + `VALIDATE_FAILED` + exit 1                           | —   | ✅  | ✅  |
| E17 | `update <claimed> --status todo`                     | status todo + assignee null (unclaim)                             | —   | ✅* | ✅  |
| E18 | `list --json` outside any repo                       | exit≠0, `LIST_FAILED`                                             | —   | ✅  | ✅  |
| E19 | `arggon friction --report` from the AGENT FILE alone | trigger block names both modes; capture + report render `count:1` | —   | —   | ✅  |

Target: 19/19. Current best: 22/22 checks (R3, E1–E19).

*R1 failures were harness bugs (E14 id collision with fixture seed; E16/E17
ordering — update scans the whole tree so the broken file had to land after
E17), fixed in `evals/run.mjs`. No skill or CLI changes needed for any eval.

**R3 (task-friction-trigger-carrier)** adds E19 and repairs the harness, which had
been silently stale: `init` moved the tracker to `ArggonManager/` (ADR 0012) while
the fixture still wrote `tasks/` (an ENOENT that killed the run before the last
case could be scored), and `validate` began refusing the scaffold placeholder
bodies (`PLACEHOLDER_BODY`) that bare `create`s leave behind, so E9 failed. Both are
harness fixes — the tracker root is now read from disk and the placeholders are
filled before E9 — and no skill or CLI change was needed for E1–E18 to pass again.

**E19 is the `deftai` lesson as a regression test.** `deftai/directive#3633` shipped
a skill documented as the sanctioned escalation route and an agent that was actively
escalating still missed it, because the skill was absent from the host's discovery
inventory — the friction was "absorbed into the session", which is silent loss and
looks like success. So E19 deletes the whole bundled skill tree from the fixture
(`.agents/skills/`) and derives the command from the generated agent file
(`.opencode/agents/arggon-maker.md`) alone: the marked `arggon:friction-trigger`
block must name both modes, and a capture followed by `friction --report --json`
must render one class. If the trigger text stops carrying the workflow, this case
fails instead of a real session going silent.
