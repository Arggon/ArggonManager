# Operational-core fresh-agent walkthrough — #868

**Result: completed**, 2026-11-04 (America/Buenos_Aires, UTC−03). A fresh delegated agent independently executed a trivial docs task, including actual CLI claim, validation, item verdict, local default-branch merge, and CLI `done`. No parent conversation was read; no parent tracker was mutated. The only repository file written by this agent is this evidence document.

## Input boundary

Ticket implementation baseline: **`f0138d77`** (`f0138d77c4d01f5c6f77de618bd76a000beea5a5`); the issue's original measurement cites `6d9b971f`. This is validation of the parent's **live working-tree extraction**, not of unchanged baseline bytes: checkout HEAD at initial inspection was `d3246abb6d94777794fdfecc884360c42ce20508`, with existing parent edits.

Initial reading was restricted to the four core files, plus automatically supplied root instructions. Complete UTF-8 source reads on **2026-11-04, approximately 09:12–09:13 UTC−03**:

| Core file                                           | Actual bytes read | SHA-256 at initial measurement                                     |
| --------------------------------------------------- | ----------------: | ------------------------------------------------------------------ |
| [agents.md](../agents.md)                           |            16,808 | `a2ae889e8eb413db069e7bf19c7415ae64e48fd0752f344ce6f01e5e2d6565f7` |
| [convention.md](../convention.md)                   |            40,490 | `7aa778eadf9574666ab5e7e1c8f6922c04dd50d1ec96e71a986d1569618e30d5` |
| [engineering.md](../engineering.md)                 |            28,860 | `6d0fa5c69f2d2ae69bd365dd37b150d3ea1b35cf07518daafaea397d8d7affb0` |
| [CLI umbrella](../../../skills/arggon-cli/SKILL.md) |             7,712 | `e72895ac0c004c47a73276a286da1bfdd2b3fc1147f5521b700845eb29b37441` |
| **Total**                                           |        **93,870** | Below the 122,880-byte core limit; start-here below 20,480 bytes   |

Canonical paths are `ArggonManager/docs/agents.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/engineering.md`, and `skills/arggon-cli/SKILL.md`. Two initial attempts to resolve the umbrella under the docs/tracker directory returned not-found; neither read other material. A setup probe ended exit 1 because `tsx` was not on PATH; the executable checkout-local runner was then confirmed and used successfully. Node was `v26.13.0`.

## Fixture and actual interface

- Fixture: `/tmp/arggon-868-walkthrough.RjFrMN`.
- Default checkout: `/tmp/arggon-868-walkthrough.RjFrMN/repo`, branch `main`.
- Local bare origin: `/tmp/arggon-868-walkthrough.RjFrMN/remote.git` (both fetch and push).
- CLI-returned item worktree: `/tmp/arggon-868-walkthrough.RjFrMN/repo-task-correct-welcome-typo`.
- Full command/output record: [commands.log](/tmp/arggon-868-walkthrough.RjFrMN/commands.log); wrapper: [run.sh](/tmp/arggon-868-walkthrough.RjFrMN/run.sh). These disposable files may not survive host cleanup.

Every fixture CLI command used the absolute **source CLI** from the fixture cwd, not an installed distribution or the parent tracker:

```bash
SOURCE=/home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356
# The log expands both absolute executable paths, arguments, cwd and actual exit.
"$SOURCE/node_modules/.bin/tsx" "$SOURCE/cli/src/cli.ts" <arguments>
```

All fixture commits were explicitly authored and committed as `arggon-superagent <arggon-superagent@users.noreply.github.com>`; a final assertion checked **all 14 commits**. `ARGGON_NO_FRICTION=1` prevented incidental capture outside the fixture. No GitHub writes, PRs, real-repository pushes, package installation or replacement CLI were used.

## Concrete task and execution evidence

Task: correct **“Welcomme” → “Welcome”** in the introductory paragraph of fixture [README.md](/tmp/arggon-868-walkthrough.RjFrMN/repo/README.md). No behavior change, spec, implementation plan or non-trivial planning trigger. All four hierarchy items received real Context and live Acceptance sections before selection/claim; no scaffold bodies were left. The three container checklists intentionally remain open, using `--no-cascade` for leaf close-out.

Below, `CLI` denotes the absolute source invocation above. Unless explicitly noted, **expected exit 0 / observed exit 0**. The full log includes supporting `git add`, commits, all local pushes and full assertion expressions.

| Actual command(s) / operation                                                                                                                                                                                | Expected → observed                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git init -b main repo`; `git init --bare --initial-branch=main remote.git`; configure identity and local origin; seed typo; `git push -u origin main`                                                       | Local repositories and upstream → created, pushed locally                                                                                                         |
| `CLI init --no-agents --json`                                                                                                                                                                                | Initialized tracker → `ok:true`, convention 5, auto-commit `df5cb4e`                                                                                              |
| `CLI create initiative 'Fixture documentation' --id fixture-docs --json`                                                                                                                                     | Root item → `fixture-docs`, `todo`                                                                                                                                |
| `CLI create epic 'Intro quality' --id intro-quality --parent fixture-docs --json`                                                                                                                            | Epic → correct parent, `todo`                                                                                                                                     |
| `CLI create story 'Readable introduction' --id readable-intro --parent intro-quality --json`                                                                                                                 | Story → correct parent, `todo`                                                                                                                                    |
| `CLI create task 'Correct welcome typo' --parent readable-intro --json`                                                                                                                                      | Leaf → `task-correct-welcome-typo`, `todo`                                                                                                                        |
| Author all live bodies; `CLI validate --json`; explicit-path commit; push each primary tracker commit to local origin                                                                                        | Real contracts and valid tree → `errors:[]`, `warnings:[]`; authored-contract commit `8a3d9b8`                                                                    |
| `CLI next --json`; `CLI show task-correct-welcome-typo --body --json`                                                                                                                                        | Select/read actual unclaimed leaf → selected correct task, full live contract read                                                                                |
| `CLI sync --json`                                                                                                                                                                                            | Initially expected 0 → **observed 1**, `SYNC_FAILED`: “Cannot determine GitHub repository. Pass --repo or ensure origin is a GitHub remote.” See departure below. |
| `git for-each-ref --format='%(refname)' refs/heads refs/remotes`; `git worktree list --porcelain`                                                                                                            | Prove fresh local claim pool → only `main`, `origin/main`, one default checkout; no competing item branch                                                         |
| `CLI start task-correct-welcome-typo --worktree --assignee arggon-superagent --json`                                                                                                                         | Claim/create/push actual worktree → `in_progress`, correct assignee, `feat/task-correct-welcome-typo`, `created:true`, `pushed:true`, `prUrl:null`, claim stamped |
| From returned worktree: `CLI show task-correct-welcome-typo --meta --json`; `git status --short --branch`                                                                                                    | Confirm claim and correct working tree → matching recorded assignee/branch/path, clean                                                                            |
| Targeted edit in returned worktree; Node exact-content assertion and comparison with `git show HEAD:README.md`; `git diff --check`; `git diff --stat`                                                        | Intro exactly corrected, typo absent, only one-word correction → PASS; one README insertion/deletion; whitespace clean                                            |
| `CLI validate --json`; tick all three live leaf acceptance criteria; `CLI validate --json`; commit explicit README/item paths                                                                                | Actual passing criteria → zero errors/warnings; implementation/checklist commit `d84b9e8`                                                                         |
| `CLI comment task-correct-welcome-typo <multiline verdict> --author arggon-superagent --json`; push item branch                                                                                              | Item verdict with expected/observed evidence → `verdict: approve (T0 trivial docs correction, self-review)`, commit `a2dab0d`                                     |
| On fixture main: `CLI validate --json`; `git merge --no-ff feat/task-correct-welcome-typo -m 'docs: merge reviewed fixture correction'`; `git merge-base --is-ancestor d84b9e8 main`; `git push origin main` | Completing change actually on default before done → merge `b62fa2b`, ancestry exit 0, pushed to local bare origin                                                 |
| In item worktree: `CLI validate --json`; `CLI update task-correct-welcome-typo --status done --no-cascade --json`                                                                                            | Honest terminal transition after merge → `status:done`, commit `011bf78`, no ancestors completed                                                                  |
| `CLI comment task-correct-welcome-typo <completion context> --author arggon-superagent --json`; push branch; merge close-out to main with `--no-ff`; push main                                               | Bounded completion context on item and default → comment `6464681`, final merge **`64744c2`**                                                                     |
| Final `CLI validate --json`; `CLI doctor --json`; `CLI next --json`; `CLI show task-correct-welcome-typo --meta --json`; `CLI cleanup --json`                                                                | Valid, completed, inspect cleanup → validate clean; doctor initialized and `dirty:false`; next `suggestion:null`; leaf `done`; worktree removable, nothing pruned |
| `git merge-base --is-ancestor feat/task-correct-welcome-typo main`; `git status --porcelain=v1` in both checkouts; `git rev-list --left-right --count <branch>...origin/<branch>` for main and item branch   | Merged, clean, pushed → exit 0; **empty status in both**; **`0 0` for both**                                                                                      |
| Node assertion over `git log --all --format='%an <%ae>\|%cn <%ce>'`                                                                                                                                          | All commits have required author/committer → **PASS, all 14**                                                                                                     |

The completed [task record](/tmp/arggon-868-walkthrough.RjFrMN/repo/ArggonManager/fixture-docs/intro-quality/readable-intro/task-correct-welcome-typo.md) contains three ticked live criteria, the review verdict with execution evidence, and the post-merge completion note. `show`'s `acceptance:"none"` is product-acceptance classification, not a failure of the completed live checkbox contract.

## Departures and point-of-use reference loads

1. **Required docs-maintenance routing, not missing core commands.** Exact question: “For this typo correction, which related documents must change in the same delivery?” Followed core agents §Documentation maintenance to [documentation reference:1–20](../references/documentation.md#L1-L20), reading only the opening maintenance table. **No fact from this table was actually necessary to perform the typo correction:** the core already required same-delivery documentation maintenance, and the edit changed no behavior, schema, CLI interface or planning artifact. The load was caused by the core's unconditional docs-edit routing, not by a missing typo-workflow instruction; it only confirmed that no additional document category applied.
2. **Local-only sync gap.** Exact question after actual failure: “Can sync reconcile branch claims without a GitHub remote?” Loaded only [JSON contract:745–779](../json-output.md#L745-L779) around `sync` (the final displayed lines begin the next section). It documents local git branch reads but no offline/local-only sync mode. Rather than invent a flag, fake `gh`, or point at a hosted repository, inspected every local/fetched ref and worktree in this freshly created fixture. Thus **the core's sync envelope/branchClaims step was not successfully exercised**. This local-only accommodation is recorded, not represented as a successful sync.
3. **Interface references.** Consulted CLI `--help` for `init`, `create`, `start`, `show`, `sync`, `comment`, and `update` to select actual flags (`--no-agents`, `--id`, `--body`, `--author`, `--no-cascade`). These are command-interface lookups, not additional methodology bundles. No command/flag was invented.
4. **Authorized no-hosted-PR variant.** Used the explicitly allowed default-branch completion criterion. Maker/verification/review work stayed inline for this trivial T0 leaf, with self-review honestly labeled. Fixture initialization, hierarchy/body setup and default-branch merge commits occurred in its primary checkout; implementation, acceptance editing, verdict and done commits occurred in the CLI-created item worktree. No primary checkout branch was switched.

No other methodology references, ADRs, specs, plans, recovery documents or parent task context were loaded. Generated fixture root instructions and its item files were read as fixture data.

## Limitations and final observations

- **This does NOT test hosted PR approval, hosted CI enforcement, GitHub merge-state verification, auto-done, native adapter/session binding, independent reviewer separation, or multi-agent orchestration.** Actual local merge and post-merge CLI completion are proven; no hosted PR exists.
- Docs-only exemption applies to software smoke/tests/lint/typecheck/build. The actual docs assertions and tracker validation passed; this is not a CLI implementation regression suite.
- `doctor` exited 0 but was **not entirely current**: it reported two outdated generated skill documents. Parent source files were changing concurrently; end-of-run hashes of agents, convention and umbrella differed from the initial measurement. The fixture was deliberately not regenerated. This is not a frozen-source adoption-upgrade test.
- The successful task does not claim that four-core-only operation required zero reference lookups: the docs-maintenance route and failed local sync needed the narrowly identified loads above.
- Fixture worktrees/branches were retained as inspectable evidence; cleanup was read-only. The parent owns any code, tracker follow-up, repository commit, or PR arising from #868.
