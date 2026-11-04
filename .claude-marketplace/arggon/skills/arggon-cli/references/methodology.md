<!-- arggon:generated template="claude/arggon/skills/arggon-cli/references/methodology.md" -->
# Engineering methodology — what does this work need?

Part of the `arggon-cli` skill (`SKILL.md`). Before implementing, classify the
work: size and risk decide the paperwork, and the paperwork is created in the
same PR as the change — never as a follow-up TODO.

| Work is...                                                                                                                      | Required process                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trivial** (typo, one-line fix, copy tweak)                                                                                    | Just the task. No spec, no ADR.                                                                                                                                                                                                                                                                                                                                          |
| **A non-trivial feature** (new behavior, endpoint, scene or module)                                                             | **Spec first** (`arggon spec new <slug>` → `ArggonManager/docs/specs/`): purpose, synopsis, invariants, acceptance criteria. Then a **plan** (`--plan`) breaking it into ordered tasks with verifiable criteria that link back to the spec. Then implement — and flip spec/plan status to `implemented` in the same PR as the landing feature.                           |
| **Greenfield** (a new project, subsystem, or interface others will depend on — no existing flow to read)                        | **Exploration first** (`references/exploration.md`, ADR 0017): the six-phase protocol — classify, stance, ground, frontier rounds, edge-case hunt — then the greenfield exploration doc, ADRs, and a spec with the hunted cases as acceptance criteria. **Hard gate:** no implementation task claimed before the spec passes `arggon spec analyze` with no NEW findings. |
| **A cross-cutting or hard-to-reverse decision** (stack choice, schema/convention change, identity model, new top-level package) | **Exploration spike** (`arggon stack explore <topic>`): candidates, criteria, findings with dated sources. Then an **ADR** in `ArggonManager/docs/adr/` (NNNN-title, Proposed → Accepted on merge; supersede, never rewrite). Only then implement.                                                                                                                       |
| **Introducing or upgrading a technology** (new dependency, framework, major version)                                            | **Playbook** (`arggon playbook new <tech> --version <v>`): researched current version + best practices with dated sources; the project's AGENTS.md points agents at it. `arggon playbook status` flags stale ones (>90d or `x-playbooks.max-age-days`) — re-research, `arggon playbook refresh`, and file the re-research task in the tracker (`--file-task`).           |
| **Operational/infra behavior someone has to run or debug** (deploy, alerting, data migration, recovery)                         | **Runbook** in `ArggonManager/docs/runbooks/`: trigger → diagnosis → mitigation → escalation → rollback. Write steps individually automatable.                                                                                                                                                                                                                           |
| **A finding from review/audit/incident**                                                                                        | A tracked follow-up (`arggon create task                                                                                                                                                                                                                                                                                                                                 | bug ... --parent <story-id>`) with context and acceptance — never only a PR comment. |

When in doubt between two levels, take the heavier one — but keep the artifacts
lean. A 40-line spec beats a 4-page one nobody reads.

## Scope and ordering

- Check `arggon next --ready` before picking work; declare `--depends-on` when your
  task orders after another (the graph is the plan — keep it true).
- One claimable item per branch/PR; keep PRs small; reference the item id.
- If the work reveals more work, file it (`arggon create task|bug`) — don't grow
  the PR's scope, and don't leave it only in code comments.

## Quality bar

The project's canonical bar is `ArggonManager/docs/engineering.md` §Review bar;
its verdict and promotion conventions live there too. Operational done is
`ArggonManager/docs/agents.md` §5; the acceptance grammar and kernel gate are
`ArggonManager/docs/convention.md`. Follow those sections, not another checklist
maintained in this reference. The change-type-to-document map is
`ArggonManager/docs/references/documentation.md` §Documentation maintenance.

## Pipeline references

- **Specs/plans:** `ArggonManager/docs/specs/spec-<slug>-NNN.md` + `ArggonManager/docs/plans/plan-<slug>-NNN.md`.
  `arggon spec validate` is the structural gate; `arggon spec analyze` is a
  report-only ambiguity/consistency scan (resolve findings by editing the spec).
  Multi-wave refactors gate each wave with `spec analyze --baseline <file>`.
- **ADRs:** the process and minimum template live in `ArggonManager/docs/engineering.md`
  §ADR process — 4-digit id, kebab-case title, Status/Date/Deciders + Context /
  Decision / Consequences / Alternatives considered.
- **Playbooks:** `ArggonManager/docs/playbooks/<tech>.md`, pinned version + Setup / Conventions /
  Testing / Security / Upgrade policy.
- **Adoption:** `arggon adopt` requires an initialized tree and files the tracked
  migration task; the executing agent follows `ArggonManager/docs/agents.md` §Adoption sweep.
- **OpenCode V2:** the generated commands `/arggon-spec`, `/arggon-adr`,
  `/arggon-explore`, `/arggon-playbook` drive these same scaffolds from a session.
