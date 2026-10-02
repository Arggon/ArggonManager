---
type: task
status: done
id: task-cleanup-declared-services
title: cleanup --prune reaps per-worktree Compose projects only when the repo declares them
assignee: Arggon
branch: feat/task-cleanup-declared-services
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cleanup, worktree]
created: "2026-10-01"
updated: "2026-10-02"
depends_on: [task-env-contract-start]
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cleanup-declared-services.md
  Leaves live only under a story. id is the filename stem: task-cleanup-declared-services.
  CLI `arggon create task cleanup-declared-services` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune reaps per-worktree Compose projects only when the repo declares them

## Context

The reaping side of [ADR 0019](../../../../docs/adr/0019-worktree-runtime-isolation.md)
layer 2: an adopter following the per-worktree services pattern creates a
Compose project named `<repo>-<item-id>` per worktree; when the worktree is
reaped (`cleanup --prune`), the project must go with it — or it becomes
permanent docker residue (exploration 016 F2/F8: 3.3 GB reclaimable observed
on one machine). Safety by construction: the kernel may invoke Docker **only**
for projects the repo's committed convention declares (a Compose/services
manifest naming the project); with no declaration — or no Docker — cleanup
stays report-only. Sequencing only: `depends_on: task-env-contract-start`
settles the convention shapes this task consumes.

## Acceptance

- [x] `cleanup` lists (and with `--prune` removes) Compose projects whose name matches the declared convention, only for worktrees that otherwise qualify (done/cancelled + merged branch). — evidence: `x-worktree.services` declaration (convention grammar: `true` = `<repo>-<item-id>`, a base name = `<base>-<repo>-<item-id>`, lowercased; `lib/src/worktree.ts` `worktreeComposeProject`), reaped in the `runCleanup` prune loop (`cli/src/cleanup.ts`) only for `entries.filter(removable)`, BEFORE `git worktree remove`; tests `reaps <repo>-<item-id> for services: true…`, `derives <base>-<repo>-<item-id>…`, `reaps the residue of an already-removed worktree…`.
- [x] No Docker invocation when the repo declares nothing or Docker is absent — the report-only path is covered by tests that need no daemon (CI-safe). — evidence: executor-injected tests (no daemon): `never invokes Docker when the repo declares nothing` (spy never called, `compose` field absent), `absent docker CLI (ENOENT) degrades to report-only and still prunes` (`compose.dockerUnavailable: true`, failures empty, prune completes), `never reaps an adopter-run project the convention does not declare` (exactly one call, only the declared derivation), plus end-to-end human-path leg on a docker-less PATH (`the human run reports the docker-absent degradation…`).
- [x] Removal uses `docker compose -p <repo>-<item-id> down -v --remove-orphans`; failures land in the existing `failures[]` surface (see task-cleanup-json-exit-code for the exit-code contract) and never abort the run. — evidence: `defaultComposeDown` spawns exactly that argv (bounded 120s); `reports a reap failure on BOTH surfaces and never wedges the removal` pins `failures[]` + `pruned[].action: "failed"` + the worktree/branch/record still reaped; already-gone project = exit 0 no-op (live-verified Docker 29.7.2 / Compose 5.5.1, 2026-10-01); exit code stays 0 on partial prune (existing contract, unchanged).
- [x] Docs updated in the same PR (README cleanup section; `json-output.md` if the payload changes); impact class stated; skill copies byte-equal. — evidence: README cleanup paragraph + convention.md §Worktree bootstrap `services` bullet + json-output.md additive `compose` row/prose (prettier-clean) + worktree-services.md "Planned" row → Shipped; impact class **Behavioral (ADR 0016)** stated in the PR description and the item comment; skill sources untouched (copies byte-equal).
- [x] `npm test` green; `arggon validate` ok. — evidence: `npm test` 2081 passed (incl. 9 new compose-reap tests + convention/lib units); `npm run lint`, `npm run build`, `npm run check:plugin` (bundle regenerated), `npm run smoke:native-start-cold` all green; `arggon validate` ok:true.

## Notes

- Manifest shape (ADR 0019 left it open — decided minimally per its "the pattern is a name and a manifest" guidance): a single scalar declaration `x-worktree.services` in `.convention.yml` — the reaper needs only the project NAME (`down` resolves the project through container labels, no Compose file and no YAML parsing), so the declaration is exactly that name: `true` (canonical worktree id) or the adopter's base name. Recorded in convention.md; the parse-time validation enforces Compose's project alphabet.
- Scope note for review: the OpenCode plugin's `nativeCleanup` keeps its own prune loop and does NOT reap Compose (safe by construction — report-only); the MCP surface (`arggon_cleanup`) spawns the CLI and reaps. Native parity is a follow-up for the coordinator.

### 2026-10-02 @ses_f061e465effeTJZ6pCepJBk192
Implemented; PR #569 (feat/task-cleanup-declared-services, not merged — coordinator review). Impact class: **Behavioral (ADR 0016)** — new x-worktree.services convention key + additive cleanup --json compose field; skill copies byte-equal (sources untouched).

**Manifest shape (ADR 0019 left it open; decided minimally per its "a name and a manifest" guidance):** scalar `x-worktree.services` in .convention.yml — `true` = canonical worktree-id naming (<repo>-<item-id>), a base name = pattern-doc naming (<base>-<repo>-<item-id>, lowercased), absent/false = no Docker ever. Rationale: `down` resolves projects by container label, so the reaper needs only the NAME; parse-time validation enforces Compose's alphabet ([A-Za-z0-9][A-Za-z0-9_-]*).

**Reap semantics:** docker compose -p <project> down -v --remove-orphans per removable entry (done/cancelled + merged, unchanged), BEFORE git worktree remove; already-gone project = exit-0 no-op (live-verified Docker 29.7.2/Compose 5.5.1 2026-10-01); absent docker = report-only (compose.dockerUnavailable, never a failure); reap failures on BOTH pruned[].error and failures[] (#515 discipline, boundedEnvelopeText), never wedging the removal, exit code 0 (task-cleanup-json-exit-code unchanged). Preservation pinned by test: only derived names reach the executor; undeclared adopter projects (incl. the primary's own) are never touched.

**Commands run / expected vs observed:** npm test → 2081 passed (9 new compose tests + convention/lib units; daemon-free, CI-safe); npm run lint → 0; npm run build → green; npm run check:plugin → green AFTER the prescribed separate "chore: regen plugin bundle" commit (kernel modules are inlined into the vendored bundle, so lib changes drifted it — expected, recorded as its own commit 00df6ad1); npm run smoke:native-start-cold → passed (all legs incl. "checkout unchanged"); npm run arggon -- validate → ok:true. One initial red herring: headless-ci failed until the worktree's root `npm run build` produced dist artifacts (the suite asserts them) — environment, not code.

**Finding (follow-up for coordinator):** the OpenCode plugin's nativeCleanup keeps its own prune loop and does NOT reap Compose (safe by construction — report-only). MCP arggon_cleanup spawns the CLI and reaps. Native parity is unfiled per the no-self-filing rule; worktreeComposeProject is kernel-exported so the plugin can adopt it trivially.

### handoff 2026-10-02 @ses_f061e465effeTJZ6pCepJBk192 (session: ses_f061e465effeTJZ6pCepJBk192) — next: Review + merge PR #569 (do not merge before review); file the nativeCleanup Compose parity follow-up
- branch: feat/task-cleanup-declared-services
- open questions: Native plugin cleanup parity (compose reaping in nativeCleanup) — follow-up filed by coordinator?; bundle regen commit 00df6ad1 must ride the same merge
