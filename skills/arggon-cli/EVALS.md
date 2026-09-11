# Evals — arggon-cli skill

Method: for each case, derive commands using ONLY `SKILL.md` (fresh-eyes read), run them with `node dist/cli.js` in a temp fixture repo, and score the predicate. Fix the skill on failures, re-run failures + regression.

Fixture setup per round: `node dist/cli.js init <tmp>` then seed via `create` (initiative `eval-mvp` → epic `auth` → story `story-login` → task `task-a`).

| ID  | Task (skill-only derivation)                              | Pass predicate                                                     | R1 | R2 |
|-----|-----------------------------------------------------------|--------------------------------------------------------------------|----|----|
| E1  | Find open work as JSON                                    | `ok:true`, `items` array, every item `status==todo`                | ✅ | ✅ |
| E2  | Filter with zero matches (`--status done`)                | `ok:true`, `items:[]` (empty is success)                           | ✅ | ✅ |
| E3  | Claim `task-a` as `qa-bot`                                | `item.status==in_progress`, `assignee==qa-bot`                     | ✅ | ✅ |
| E4  | Second agent claims same item, no `--force`               | exit≠0, `error.code==UPDATE_FAILED`, assignee unchanged            | ✅ | ✅ |
| E5  | Create task under `story-login`                           | id starts `task-`, `path` under story dir                          | ✅ | ✅ |
| E6  | Create with missing parent                                | exit≠0, `error.code==CREATE_FAILED`                                | ✅ | ✅ |
| E7  | `update --status blocked` without reason                  | exit≠0 (rejected)                                                  | ✅ | ✅ |
| E8  | `update --labels sec,net` then `--labels net`             | second call leaves exactly `["net"]` (full replace)                | ✅ | ✅ |
| E9  | `validate --json` on healthy tree                         | `ok:true`                                                          | ✅ | ✅ |
| E10 | `board` from repo subdirectory                            | `<root>/board.html` exists, `<sub>/board.html` absent              | ✅ | ✅ |
| E11 | Envelopes of list/create/update/validate/board            | each has `schemaVersion:1` + matching `command`                    | ✅ | ✅ |
| E12 | `list --assignee @me` with `GITHUB_USER=qa-bot`            | returns only qa-bot items                                          | ✅ | ✅ |
| E13 | `update --labels "Bad Label"` (non-kebab)                 | rejected, exit≠0                                                   | —  | ✅ |
| E14 | `create task --id probe2`                                 | id becomes `task-probe2` (prefix kept)                             | —  | ✅* |
| E15 | `list` without `--json`                                   | human table, exit 0, not JSON                                      | —  | ✅ |
| E16 | `validate --json` on tree with `status: bogus` file       | `ok:false` + `VALIDATE_FAILED` + exit 1                            | —  | ✅ |
| E17 | `update <claimed> --status todo`                          | status todo + assignee null (unclaim)                              | —  | ✅* |
| E18 | `list --json` outside any repo                            | exit≠0, `LIST_FAILED`                                              | —  | ✅ |

Target: 18/18. Current best: 18/18 (R2).

*R1 failures were harness bugs (E14 id collision with fixture seed; E16/E17
ordering — update scans the whole tree so the broken file had to land after
E17), fixed in `evals/run.mjs`. No skill or CLI changes needed for any eval.
