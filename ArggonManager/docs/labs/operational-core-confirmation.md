# Issue #868 — fresh-agent operational-core confirmation

- Date: 2026-11-04 (America/Buenos_Aires, UTC−03:00).
- Core fingerprint/read began: 09:20:11−03:00. Final verification: 13:43:25−03:00; execution was interrupted between merge and closeout and resumed in the same fixture.
- Result: **completed** — real tracked task, CLI-managed claim/worktree, verified typo correction, on-item review verdict, actual local default-branch merge, actual CLI `update --status done`, committed/pushed terminal record. No blocker.
- Preserved fixture: `/tmp/arggon-core-868.UWuoaP`; primary checkout `/tmp/arggon-core-868.UWuoaP/repo`; linked worktree `/tmp/arggon-core-868.UWuoaP/repo-task-correct-welcome-typo`; bare origin `/tmp/arggon-core-868.UWuoaP/remote.git`.

## Read boundary and exact core at read

This was a fresh delegated agent with no prior methodology context. Initially read only the four current core files below, followed by required root [AGENTS.md](../../../AGENTS.md). No docs references, skill references, existing walkthrough, ADR, runbook, fixture-generated governing prose, or implementation source was loaded for methodology. The source CLI was executed, not read. CLI help supplied interface syntax only. Fixture work items and the welcome document were read as task data. `init` generated reference files, but they were not opened.

Fingerprints were captured immediately before the core reads, using `wc -c` and `sha256sum` from the parent ticket checkout. Total: **97,080 bytes**, below 122,880; start-here page: 19,809 bytes, below 20,480.

| Core path                                       | UTF-8 bytes | SHA-256 at read                                                    |
| ----------------------------------------------- | ----------: | ------------------------------------------------------------------ |
| [agents.md](../agents.md)                       |      19,809 | `7beec900a26a4a680575d81c447019a94851fd5233d2462a34d933b9fb26172f` |
| [convention.md](../convention.md)               |      40,011 | `bb21fccdcecbcb529bb55e4e3f79ac384c5f2ddbe11c4cddaaa4978137747fbf` |
| [engineering.md](../engineering.md)             |      28,860 | `6d0fa5c69f2d2ae69bd365dd37b150d3ea1b35cf07518daafaea397d8d7affb0` |
| [SKILL.md](../../../skills/arggon-cli/SKILL.md) |       8,400 | `30f6d123104097b7243f0221b3b2a6c9de937e515efbf4f57d8498298db5493f` |

## Method derived from core

- [agents.md](../agents.md#L37-L50): create the missing initiative/epic/story chain; author real Context and live Acceptance; explicitly stage only this task's files.
- [agents.md](../agents.md#L54-L88): bounded `next`/`show`; local-only branch/worktree inspection instead of GitHub-dependent `sync`; `start --worktree`; use its returned path; confirm claim; validate before commits.
- [agents.md](../agents.md#L135-L147): trivial work stays inline; trivial documentation correction does not require loading the documentation reference.
- [engineering.md](../engineering.md#L114-L164): T0 leaf self-certification, docs-only smoke exemption, on-item `verdict: approve` with expected-versus-observed evidence. No independent verifier/approver was impersonated.
- [agents.md](../agents.md#L98-L119): complete real acceptance, actually land completing change on default before CLI done, leave bounded completion context, and avoid accidental container completion with `--no-cascade`.
- [engineering.md](../engineering.md#L193-L205): a typo does not need an ADR. The nontrivial-feature spec/plan trigger does not apply.

## Concrete task and edits

Created hierarchy `local-docs` → `welcome-content` → `welcome-accuracy` → `task-correct-welcome-typo`, all initially `todo`, unassigned, without product-owner priority changes. Containers have real, broader editorial-review criteria; this small typo task does not certify those broader reviews.

The task's Context identifies the misspelling. Its live Acceptance requires exact document bytes and a passing tracker validation plus an on-item evidence verdict. Both criteria were ticked only after verification/verdict, before merge.

Change in [fixture welcome document](/tmp/arggon-core-868.UWuoaP/repo/WELCOME.md):

```diff
 # Welcome

-Welocme to the local project.
+Welcome to the local project.
```

[Final task record](/tmp/arggon-core-868.UWuoaP/repo/ArggonManager/local-docs/welcome-content/welcome-accuracy/task-correct-welcome-typo.md) contains the acceptance ticks, `verdict: approve (trivial documentation correction, T0)`, commands/expected/observed results, and merge completion context. Assignee is `arggon-delivery-lead`, working branch `feat/task-correct-welcome-typo`, terminal `status: done`, `claimed_at: null`.

## Commands, expectations and observed exits

The CLI was always invoked with fixture cwd, never parent tracker cwd. In the commands below, `a` denotes this exact source invocation (notation only, not an installed fixture dependency):

```sh
/home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356/node_modules/.bin/tsx \
  /home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356/cli/src/cli.ts
```

Commands within successful `set -e` groups all completed; final explicit exit markers were 0. Initial allocation/help and seed/init calls also returned successfully. No shell command returned a reported nonzero exit. The interrupted call's overall exit is **unknown**, not claimed as 0; recovery is recorded below.

| Cwd / command                                                                                                                                                                                                                                                                                                                         | Expected                                                                                    | Observed / exit                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parent: `pwd`; `wc -c` and `sha256sum` for the four core paths; `date -Iseconds`                                                                                                                                                                                                                                                      | Identify checkout and current core bytes                                                    | Checkout `/home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356`; hashes above; successful                                                                                                                                              |
| `/tmp`: `mktemp -d /tmp/arggon-core-868.XXXXXX`; `git init --bare --initial-branch=main "$BASE/remote.git"`; `git init --initial-branch=main "$BASE/repo"`                                                                                                                                                                            | New local-only fixture                                                                      | Allocated preserved path above; both repositories initialized; successful                                                                                                                                                                                           |
| Fixture primary: `git config user.name arggon-superagent`; `git config user.email arggon-superagent@users.noreply.github.com`; `git remote add origin /tmp/arggon-core-868.UWuoaP/remote.git`                                                                                                                                         | Required identity, no hosted remote                                                         | Applied; successful; final all-commit identity assertion passed                                                                                                                                                                                                     |
| CLI help: `a init --help`, `a create --help`, `a start --help`, `a comment --help`, later `a update --help`                                                                                                                                                                                                                           | Resolve init/adapters, batch creation, worktree, comment author, terminal/no-cascade syntax | Help printed; each successful, captured help exits 0 (first help returned successfully without an explicit printed marker)                                                                                                                                          |
| Primary: create seed document with file tool; `git add WELCOME.md`; `git commit -m 'docs: Seed welcome document'`; `git push -u origin main`                                                                                                                                                                                          | Typo seed published locally                                                                 | `fd7d24c354b7c3160628f87d1d4873de5eaa3e55`; exit 0                                                                                                                                                                                                                  |
| Primary: `a init --no-agents --json`; `git push origin main`                                                                                                                                                                                                                                                                          | Initialize tracker without adapter seams                                                    | `ok:true`, convention 5, generated-doc commit `c537d2ef59e1fc29152695264e61a48d0af76637`; exit 0                                                                                                                                                                    |
| Primary: `a create initiative 'Local documentation' --id local-docs --no-commit --json`                                                                                                                                                                                                                                               | New unclaimed root                                                                          | `ok:true`, `todo`; exit 0                                                                                                                                                                                                                                           |
| Primary: `a create epic 'Welcome content' --id welcome-content --parent local-docs --no-commit --json`                                                                                                                                                                                                                                | Correct parent edge                                                                         | `ok:true`, `todo`; exit 0                                                                                                                                                                                                                                           |
| Primary: `a create story 'Welcome accuracy' --id welcome-accuracy --parent welcome-content --no-commit --json`                                                                                                                                                                                                                        | Correct parent edge                                                                         | `ok:true`, `todo`; exit 0                                                                                                                                                                                                                                           |
| Primary: `a create task 'Correct welcome typo' --id correct-welcome-typo --parent welcome-accuracy --no-commit --json`                                                                                                                                                                                                                | Tracked standard task, not bug                                                              | `task-correct-welcome-typo`, `todo`; exit 0                                                                                                                                                                                                                         |
| Primary: author Context/Acceptance using read/edit tools; `a validate --json`; explicit `git add` of four created item paths; `git commit -m 'tasks: Define welcome typo acceptance contract'`; `git push origin main`                                                                                                                | Non-placeholder contract; publish only fixture tracker batch                                | `ok:true`, errors/warnings empty; `f8e548066c8ad69e85e814243dcee90570059327`; exit 0                                                                                                                                                                                |
| Primary: `a next --json`; `a show task-correct-welcome-typo --body --json`; `git branch -a`; `git worktree list --porcelain`                                                                                                                                                                                                          | Read full acceptance and establish no competing claim in local-only fixture                 | One suggestion; only `main`, `origin/main`, and primary worktree; exit 0. `sync` not called: core explicitly says it requires GitHub                                                                                                                                |
| Primary: `a start task-correct-welcome-typo --worktree --assignee arggon-delivery-lead --json`                                                                                                                                                                                                                                        | Managed claim, branch/worktree and push                                                     | `ok:true`, `in_progress`, `pushed:true`, `manifestCoverage:satisfied`, claim stamped; exact returned worktree path used; exit 0                                                                                                                                     |
| Returned worktree: `a show task-correct-welcome-typo --meta --json`                                                                                                                                                                                                                                                                   | Claim matches identity/branch/path                                                          | `arggon-delivery-lead`, `feat/task-correct-welcome-typo`, recorded fixture worktree; exit 0                                                                                                                                                                         |
| Worktree: read/edit welcome typo; exact-byte Node assertion shown below; `git diff --check`; `git diff -- WELCOME.md`; `a validate --json`                                                                                                                                                                                            | Exact intended document; one-line typo diff; no whitespace/tracker errors                   | PASS; exactly one substitution; no whitespace output; `ok:true`, errors/warnings empty; all exits 0                                                                                                                                                                 |
| Worktree: `a comment task-correct-welcome-typo --author arggon-delivery-lead --no-commit --json <multiline-verdict>`                                                                                                                                                                                                                  | On-item approval/evidence, not hosted PR comment                                            | `ok:true`, recorded header and command evidence; exit 0                                                                                                                                                                                                             |
| Worktree: tick two criteria with file edit; `a validate --json`; `git diff --check`; explicit `git add WELCOME.md ArggonManager/local-docs/welcome-content/welcome-accuracy/task-correct-welcome-typo.md`; `git commit -m 'docs: Correct welcome typo (task-correct-welcome-typo)'`; `git push origin feat/task-correct-welcome-typo` | Honest acceptance and reviewed implementation published                                     | `99a2350cae0ac6e9f07d2b8a13716192e9590542`; clean worktree; exits 0                                                                                                                                                                                                 |
| Primary: `test "$(git branch --show-current)" = main`; `git merge --no-ff feat/task-correct-welcome-typo -m 'merge: Complete task-correct-welcome-typo'`; `git push origin main`                                                                                                                                                      | Actual default-branch merge, preserving claim/review records                                | Two-parent merge `6127bbbb17b5f793d8ef578ac41456d0fb06c610`; pushed bare origin; exits 0                                                                                                                                                                            |
| Primary: `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main`; `git --git-dir=/tmp/arggon-core-868.UWuoaP/remote.git symbolic-ref HEAD`; `git rev-list --parents -n 1 HEAD`; `git merge-base --is-ancestor 99a2350cae0ac6e9f07d2b8a13716192e9590542 main`; repeat exact-byte assertion                                | Establish real default and implementation ancestry                                          | Bare HEAD `refs/heads/main`; two parents recorded below; ancestry 0; document PASS 0                                                                                                                                                                                |
| Worktree, interrupted group: `git merge --ff-only origin/main`; `a comment task-correct-welcome-typo --author arggon-delivery-lead --json <completion-context>`; `git push origin feat/task-correct-welcome-typo`; `a update task-correct-welcome-typo --status done --no-cascade --json`                                             | Record actual merge then CLI terminal transition                                            | Tool call aborted during session interruption; overall exit unknown. Resume inspection found comment commit `3414b9fa5bba4d7f9db073f5c0142785da7061d8`, and an uncommitted CLI-written `done` mutation. No completion claim was based solely on that aborted output |
| Resume, same worktree: `git status --short`; `git log -3`; `a show task-correct-welcome-typo --body --json`                                                                                                                                                                                                                           | Determine actual side effects before retrying                                               | Terminal mutation present, criteria ticked, verdict/context present; exit 0                                                                                                                                                                                         |
| Worktree: `a update task-correct-welcome-typo --status done --no-cascade --json`                                                                                                                                                                                                                                                      | Capture successful CLI done result without reopening                                        | `ok:true`, status `done`, `claimed_at:null`, `autoCompleted:[]`, `cascadeLevels:[]`, `cascadeSkipped:[]`; exit 0. Repeat was idempotent; it did not invent a new transition                                                                                         |
| Worktree: `a validate --json`; `git diff --check`; explicit add of task path; `git commit -m 'tasks: Complete welcome typo after verified merge'`; `git push origin feat/task-correct-welcome-typo`                                                                                                                                   | Persist interrupted terminal mutation only                                                  | `ee8fec2ff388b61e758abad55218175618863366`; validation clean; exits 0                                                                                                                                                                                               |
| Primary: `git merge --ff-only feat/task-correct-welcome-typo`; `git push origin main`; `a show task-correct-welcome-typo --meta --json`; `a validate --json`; `a doctor --json`; `a cleanup --json`                                                                                                                                   | Terminal record on default; clean valid tracker; inspect, do not prune                      | Default and origin at `ee8fec2`; `done`; validation errors/warnings empty; doctor dirty false, 4 items/3 todo; cleanup removable true, `pruned:[]`, `failures:[]`; all exits 0                                                                                      |
| Both checkouts: `git status --short`; final primary identity/content/remote-equality/ancestry assertions                                                                                                                                                                                                                              | Preserve inspectable clean fixture, required identities                                     | Both clean; all 8 commits have required author and committer; exact document bytes, main equality, ancestry passed; exits 0                                                                                                                                         |

The byte assertion executed in the task worktree (and again on default):

```sh
node -e 'const fs=require("node:fs"); const actual=fs.readFileSync("WELCOME.md","utf8"); const expected="# Welcome\n\nWelcome to the local project.\n"; if(actual!==expected) throw Error("welcome bytes differ"); console.log("PASS: exact welcome bytes; only intended spelling correction");'
```

The file-edit tool once refused ticking acceptance because the CLI comment had changed the file since its prior read. It was re-read and the same targeted edit succeeded; no overwrite or gate bypass occurred. This was a tool observation guard, not a CLI exit or normative core gap.

## Merge and done receipts

```text
claim          3479adbe52e939bb8f346e8ec56b5ba2f3a08b75
implementation 99a2350cae0ac6e9f07d2b8a13716192e9590542
actual merge   6127bbbb17b5f793d8ef578ac41456d0fb06c610
merge parent 1 f8e548066c8ad69e85e814243dcee90570059327
merge parent 2 99a2350cae0ac6e9f07d2b8a13716192e9590542
merge context  3414b9fa5bba4d7f9db073f5c0142785da7061d8
terminal       ee8fec2ff388b61e758abad55218175618863366
local main     ee8fec2ff388b61e758abad55218175618863366
bare main      ee8fec2ff388b61e758abad55218175618863366
```

Successful captured CLI done receipt (compact excerpt):

```json
{
  "ok": true,
  "command": "update",
  "item": {
    "id": "task-correct-welcome-typo",
    "status": "done",
    "assignee": "arggon-delivery-lead",
    "branch": "feat/task-correct-welcome-typo",
    "claimed_at": null
  },
  "autoCompleted": [],
  "cascadeLevels": [],
  "cascadeSkipped": []
}
```

Every fixture commit's author **and** committer was verified as `arggon-superagent <arggon-superagent@users.noreply.github.com>`. No fake hosted PR, GitHub issue, GitHub write, parent tracker write or parent git operation was performed. Apart from this new evidence file, all writes were confined to the disposable fixture. The worktree and branches remain preserved; cleanup was inspect-only.

## Departures, questions and limitations

- **Normative departures: none. Necessary unanswered core questions: none for this bounded task.** Used the default-branch completion alternative explicitly provided by core, and the core's explicit local-only substitute for `sync`.
- Operational interruption required inspecting side effects, idempotently reissuing CLI done, and committing its already-written mutation. The first interrupted call has no known exit; the later actual CLI call and final persistent state are independently evidenced above.
- A local merge does **not** test hosted PR approvals, hosted merge protection, or CI. No hosted PR state or green CI is claimed.
- A trivial docs task does **not** exercise nontrivial planning, specs, exploration, multi-agent orchestration, independent review delegation, or behavior-change smoke requirements.
- This is an operational confirmation of the bounded core-only path, not proof that all reference-dependent work can be completed from core alone.
