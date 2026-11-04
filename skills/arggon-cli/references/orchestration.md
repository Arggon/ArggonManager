# Orchestration — reading route

Part of the `arggon-cli` skill. In an adopting repository, read root `AGENTS.md`
and the project's own engineering/convention rules for dispatch and close-out;
the source-only paths below are not installed by `arggon init`.

In the ArggonManager source repository, read `ArggonManager/docs/agents.md`
§Orchestration for ordinary dispatch, claim-before-dispatch and the maker's
already-claimed worktree. That section is the canonical orchestration contract;
this skill does not maintain a second role table or handwritten claim/review/done checklist.

## Installed ordinary boundaries

The excerpts below are generated from the canonical core by `npm run skills:sync`
and travel with the skill, including when the source-only core is absent. Their
source sections remain authoritative; do not edit these copies by hand.

<!-- arggon:generated-excerpt start: dispatch -->

- **Claim before dispatch (task-coordinator-claims-through-native-start):** the lead calls `tools.arggon.start({ id, assignee, worktree: true })` before launching a maker, and passes the returned worktree path. Stamp the writer's role id, never the product owner's login. Never dispatch a maker as first claimant or hold an idle claim; unclaim **and release** unused worktrees.
- Launch makers foreground in headless OpenCode runs. Each maker confirms its existing claim and works only in the handed-off worktree; it does not re-claim, replace a live writer's stamp, or flip done.

<!-- arggon:generated-excerpt end: dispatch -->

<!-- arggon:generated-excerpt start: priority -->

1. **Delivery lead ≠ priority owner.** A delivery lead _sequences_ delivery; the product owner _sets_ the `priority` field. The delivery lead recommends priority changes and owns wave planning, dispatch and tracker state — the product owner's authority map below is unchanged.

<!-- arggon:generated-excerpt end: priority -->

| Need                                                                   | Canonical location in the project                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Claim before dispatch and per-item worktree                            | `ArggonManager/docs/agents.md` §Orchestration            |
| Role table, authority and product-owner decisions                      | `ArggonManager/docs/engineering.md` §Roles and authority |
| Review bar, verdict and promotion policy                               | `ArggonManager/docs/engineering.md` §Review bar          |
| Confirming the merge and closing the item                              | `ArggonManager/docs/agents.md` §4 and §5                 |
| Client permissions, session binding, worktree collisions and harnesses | `ArggonManager/docs/references/orchestration.md`         |
| Start preparation, goal-mode contract and opt-in automations           | `ArggonManager/docs/references/agent-runtime.md`         |
| Unclaim/release, cleanup refusal or a failed auto-done                 | `ArggonManager/docs/runbooks/agent-recovery.md`          |

Paths above are repository-root-relative, whether the skill is read from its
source or from `.agents/skills/arggon-cli/`. Open only the reference matching
the operation or failure at hand.
