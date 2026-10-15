---
type: task
status: in_progress
id: task-spike-friction-trigger-compliance
title: "Spike: does an embedded trigger fire more reliably than a skill reference?"
assignee: arggon-delivery-lead
branch: feat/task-spike-friction-trigger-compliance
parent: story-adopter-feedback
labels: [method, research]
priority: p2
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T23:18:37.313Z"
depends_on: [task-friction-trigger-carrier]
worktree_path: /home/arggon/Projects/ArggonManager-task-spike-friction-trigger-compliance
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-trigger-compliance.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-trigger-compliance.
  CLI `arggon create task spike-friction-trigger-compliance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: does an embedded trigger fire more reliably than a skill reference?

## Context

A **spike, not a task**: it builds nothing and implements nothing. It answers the
one open question
[exploration-adopter-feedback-channel-024](../../../docs/explorations/exploration-adopter-feedback-channel-024.md)
deliberately refused to guess at, and it **gates stage 2**.

The question: do adopters run the command? The evidence says instruction-only
compliance is insufficient — `deftai/directive#3633` shipped a skill documented
as the sanctioned escalation route and an agent that was actively escalating and
following the rule pointing at it still missed it, because a policy flag
defaulted off, the skill was absent from the host's skill-discovery inventory,
and the `REFERENCES.md` index the managed `AGENTS.md` told agents to scan was
never deposited. But that is evidence about a **skill reference**. It says
nothing about a command embedded in the agent files the adopter already loads —
which is exactly the change ADR 0024 makes and exactly what stage 1 ships.

So the spike measures the thing stage 1 actually changed.

Two real adopters exist on this machine: `../ArggonStores` and this repo.

## Pre-registered criterion (2026-10-15, before the sweep)

**The question.** Do adopters run `arggon friction` once the command is embedded
in the agent files they already load — the carrier `task-friction-trigger-carrier`
(PR #850) shipped — rather than only referenced from a skill?

**Population.** Every git work tree on this machine carrying an ArggonManager
tracker (`ArggonManager/.convention.yml` or `tasks/.convention.yml`), observed
read-only on 2026-10-15. `../ArggonStores` is the non-maintainer adopter; this
repo's own checkouts are the maintainer comparator, recorded separately and never
counted as adopter evidence.

**Primary pass/fail — fixed before the numbers are read.**

- **PASS** — at least one observed **non-maintainer adopter** repo yields ≥1 record
  of an actual invocation: a line in its friction log whose `reporterId` matches
  that repo's absolute path, or an invocation recorded in the repo's own history
  (commit message, diff or comment).
- **NULL (fail)** — zero adopter-attributable records across N observed adopter
  repos.
- Anything else — records present but unattributable to any observed path — is
  recorded as `INCONCLUSIVE` with the reason, never folded into either arm.

**Covariates recorded per repo.** They decide what a NULL _means_; they do not
move the bar.

1. `arggon doctor --json`'s `friction.triggerPresent`, per managed agent file,
   with `triggerVersion`. "Never seen" ≠ "seen and ignored".
2. Reachability of the command at that repo: the generated-commands inventory in
   `.agents/skills/arggon-cli/SKILL.md`, `references/friction.md`, and the vendored
   plugin's native tool set. A NULL is only meaningful where the command was
   reachable.
3. Provenance of the generated files (`x-generated` `generatedAt` /
   `arggonVersion`): an adopter whose files predate PR #850 cannot have seen the
   trigger.

**Decision rule for stage 2.**

- **PASS** → tier C (`gh` upstream dedupe) may proceed as stage 2.
- **NULL + `triggerPresent` false everywhere (never seen)** → the trigger has
  never been observable at an adopter on this machine. Record `NOT-YET-MEASURABLE`,
  defer stage 2, and re-measure after the adopter's next `arggon init` (a
  re-measurement trigger, not a win and not a loss).
- **NULL + `triggerPresent` true (seen and ignored)** → the trigger is not
  sufficient; tier B (the prefilled URL a human opens) becomes the whole channel.
  **No added instruction pressure.**
- A NULL is recorded explicitly as the input to that choice — never as a failed
  spike.

**What this measurement can and cannot establish.** It CAN establish, at one
instant, whether any record exists that is attributable to an observed repo, and
whether the trigger bytes were on disk at that instant. It CANNOT establish
longitudinal behaviour: this is a point-in-time observation, on one machine, where
maintainer and adopter share a human, and where only one of the 15 adopter
repositories (`../ArggonStores`) is a live product adoption with a materialized
seam — the rest are the maintainer's own tooling experiments and dormant trees. It
cannot separate "no agent ever hit friction" from "an agent hit friction and did
not record it" — only the log and the repos' own history speak, which is the exact
silence/absence ambiguity the `deftai` post-mortem failed on, and the reason this
criterion is committed before the sweep rather than written after it.

**Disclosure on ordering.** Unstructured reconnaissance preceded this
registration: reading the merged carrier item and the spec, and a first look at
`../ArggonStores`'s generated-file dates and at the machine friction log, while
setting up. What that reconnaissance had already established is the _provenance_
covariate (the adopter's files predate PR #850) and the fact that the log needed a
noise audit — so the audit is a named covariate rather than a surprise. It did not
touch the registered question: no `doctor --json` had been run in any observed
repo, and no record in any friction log had been attributed to a repo path, when
this section was committed (`cf2a88bc`, 2026-10-15 20:28:05 -0300, before the sweep
at 20:29:05).

## Observation evidence (2026-10-15, one point in time)

**Window.** The trigger block landed on `main` at 2026-10-15 19:57:12 -0300
(`b178c0f1`, PR #850). Tooling check 20:28:17, sweep 20:29:05–20:29:17, log audit
to 20:33, the two self-written records at 20:34:12 / 20:34:24 — all -0300. The
trigger was **32 minutes old on `main`** when the sweep ran.

**Method.** One `arggon doctor --json` per checkout, run with the post-#850 build
(0.10.0, `cef717f8`) from that checkout's own directory. A before/after snapshot
(`git status --porcelain` plus a SHA-256 per managed agent file) was compared for
every checkout: `wrote=no` on **27/27**, so the observation itself wrote nothing
in any observed repo — no `init`, no tracker write, no seam refresh. Transcripts
live in `/tmp/opencode/spike-transcripts/` (`00-tooling-check-*doctor.json`,
`01..27-*-doctor.json`, `sweep.json`, `reachability.json`).

**Table** — grouped into distinct git repositories by `--git-common-dir`:

| Repository                                                                                                  | Class      | Checkouts | Carrier files            | `friction.triggerPresent` | `triggerVersion` | Command in the generated skill inventory | Records |
| ----------------------------------------------------------------------------------------------------------- | ---------- | --------- | ------------------------ | ------------------------- | ---------------- | ---------------------------------------- | ------- |
| `ArggonManager` (primary + my branch)                                                                       | maintainer | 8         | 2/2                      | **true** on 2, false on 6 | `0.10.0`         | yes                                      | 0       |
| `ArggonStores` (5 worktrees)                                                                                | adopter    | 5         | 2/2                      | false                     | `null`           | yes (since 2026-10-14 08:25 -0300)       | 0       |
| `EPC`, `RealMMORPG`, `dotnet-batchyard`, `evajoyas`, `opencode-scheduled-tasks`, `zcode-seam-live-verify`   | adopter    | 6         | 2/2                      | false                     | `null`           | no                                       | 0       |
| `arggon-cv`, `casa-pendiente`, `cuentas-claras`, `estanteria`, `guardian`, `racha`, `suizo`, `vencimientos` | adopter    | 8         | 0 — no seam materialized | false                     | `null`           | no                                       | 0       |

**Numbers (with denominators).**

- **N = 16** distinct repositories carrying a tracker observed, in **27
  checkouts**: 1 maintainer repo, **15 adopter repos**.
- **27/27** checkouts: the observation wrote nothing (`wrote=no`).
- **2/27** checkouts (**1/16** repos, **0/15** adopter repos) reported
  `friction.triggerPresent: true`, both at `triggerVersion 0.10.0`; **17/27**
  carried the two carrier files with the trigger absent; **8/27** had no seam
  materialized at all, so no carrier file exists to be absent.
- **0/27** checkouts (**0/16** repos) had any friction record attributable to
  their absolute path at window close — checked in the machine's only `arggon`
  friction log **and** in the per-worktree state dir that
  `../ArggonStores/.arggon.env` names.
- The machine's friction log held **200** lines: **200 distinct `reporterId`s**,
  one argv (`--command validate`), one narrative (`no override`), **2**
  fingerprints — the pre/post length-prefix split, exactly the degradation the
  spec documents. So **200/200 records (100%)** are the one non-hermetic line in
  `cli/src/friction.test.ts:145-152`, and **0/200** come from any observed repo.
- The spike then wrote **2** records itself (20:34:12 / 20:34:24 -0300,
  `reporterId 21a4d8edc71c` = this worktree). They are the maker's own ArggonManager
  friction, disclosed separately and **not** counted as adopter evidence.
- Every other `friction.jsonl` on the machine (**14** files, including
  `../ArggonStores/.zcode/harness/friction.jsonl`) is the **AutoHarness
  exec-failure log** — a different artifact with a different schema
  (`plugin` / `kind` / `tool` / `sessionHash` / `project`), **not** an
  `arggon friction` record. They are not counted here and must not be counted as
  channel output.

**ArggonStores, end to end (the non-maintainer adopter).**

- `arggon doctor --json` → `friction.triggerPresent: false`,
  `triggerVersion: null`, `files: 2`, both rows false. The human-readable verdict
  and the machine-readable one agree.
- Carrier set actually on disk (tracked): `.agents/skills/arggon-cli/SKILL.md`
  (one generated-commands inventory line) and `.opencode/plugins/arggon/index.ts`
  (the inlined kernel; it registers **no** native `friction` tool, and 0.10.0's
  MCP server exposes no `arggon_friction`). **No file anywhere in the tree carries
  the `arggon:friction-trigger` marker**, `AGENTS.md` has no friction mention,
  `references/friction.md` is not bundled, and no `x-friction` opt-out is set.
- Provenance: `.opencode/agents/arggon-maker.md` is recorded
  `arggonVersion 0.10.0`, `generatedAt 2026-10-14T11:21:31.256Z` — one day and
  eight hours **before** the trigger landed on `main`. Its history shows the
  string entering through `7cfee718` (2026-10-14 08:25:59 -0300) and no
  invocation since.
- Records written: **0**.

**Verdict against the pre-registered criterion.** **NULL** — zero
adopter-attributable records across 15 observed adopter repos / 19 adopter
checkouts. The covariate `triggerPresent` was false at all 19, so by the
registered decision rule this is **NOT-YET-MEASURABLE** for the embedded trigger.
The negative evidence about the skill-reference route is recorded as it stands:
at ArggonStores the command has been in the generated skill inventory for ~39
hours (2026-10-14 08:25 → 2026-10-15 20:29 -0300) with zero records.

## Acceptance

- [x] `depends_on: [task-friction-trigger-carrier]` is present, so this spike is not
      claimable before the trigger it measures exists (reviewer N2: the ADR makes it
      the gate on stage 2 **and** tier C, yet it was claimable while `arggon friction`
      did not exist).
- [x] A pass/fail criterion is written **before** any observation is collected (the `deftai` post-mortem failed partly because "silent" was indistinguishable from "absent").
- [x] At least one non-maintainer adopter repo is observed end to end: `arggon friction` invoked, or demonstrably not, with the transcript kept.
- [x] `arggon doctor --json`'s `friction.triggerPresent` is recorded for each observed repo, so "the trigger was never seen" is distinguishable from "the trigger was seen and ignored".
- [ ] The result is reported as a number with its denominator (N repos observed, N with the trigger present, N with a record written) — not as a qualitative impression.
- [ ] The finding is filed as a comment on this item, and the answer decides whether **stage 2** (tier C, `gh` upstream dedupe) proceeds, is deferred, or is abandoned in favor of a human-only channel.
- [ ] Explicitly recorded even if the answer is "nobody ran it": a null result here is the input to choosing tier B as the primary channel rather than tier C.

## Notes

Non-goal: shipping any code in this spike. If the answer is negative, the honest
response is to make tier B (the prefilled URL a human clicks) the whole channel —
not to add instruction pressure.

Ticked in `## Acceptance`: the four boxes the file itself can show —
`depends_on` in the frontmatter, the pre-registered criterion with its
commit-ordering evidence, the end-to-end `../ArggonStores` observation, and the
per-repo `friction.triggerPresent` table. The remaining three boxes are the
**finding**, and a spike's acceptance is the recorded answer: they are answered in
the 2026-10-15 comment, not ticked here.

### 2026-10-15 @arggon-maker
## Finding — task-spike-friction-trigger-compliance (2026-10-15)

**Answer: nobody ran it — and the reason matters, because it is not yet a
measurement of the trigger.**

### 1. The criterion as written (pre-registered; commit `cf2a88bc`, 2026-10-15 20:28:05 -0300)

PASS = at least one observed **non-maintainer adopter** repo yields ≥1 record of an
actual invocation — a friction-log line whose `reporterId` matches that repo's
absolute path, or an invocation in the repo's own history. NULL = zero
adopter-attributable records across N observed adopter repos. Covariates
(`friction.triggerPresent` per repo, command reachability, generated-file
provenance) decide what a NULL *means*; they do not move the bar. Decision rule:
PASS → tier C proceeds; NULL + trigger never seen → `NOT-YET-MEASURABLE`, defer and
re-measure after the adopter's next `arggon init`; NULL + trigger seen and ignored
→ tier B becomes the whole channel, with **no added instruction pressure**.

### 2. Numbers (with denominators)

- **N = 16** distinct repositories carrying a tracker observed, in **27 checkouts**:
  1 maintainer repo (`ArggonManager`) + **15 adopter repos**.
- **2/27** checkouts (**1/16** repos, **0/15** adopter repos) reported
  `arggon doctor --json` `friction.triggerPresent: true`, both at
  `triggerVersion 0.10.0` — the maintainer's primary checkout and this worktree.
- **17/27** checkouts carried the two carrier files with the trigger **absent**;
  **8/27** materialized no seam at all (no carrier file exists to be absent).
- **0/27** checkouts (**0/16** repos) had any friction record attributable to their
  absolute path — checked in the machine's only `arggon` friction log **and** in the
  per-worktree state dir that `../ArggonStores/.arggon.env` names.
- The log held **200** lines: **200 distinct `reporterId`s**, one argv
  (`--command validate`), one narrative (`no override`), **2** fingerprints (the
  pre/post length-prefix split — exactly the degradation the spec documents).
  **200/200** are the one non-hermetic line in `cli/src/friction.test.ts:145-152`;
  **0/200** come from any observed repo.
- The observation itself wrote nothing: `wrote=no` on **27/27** (before/after
  `git status --porcelain` + a SHA-256 per managed agent file).
- **14** other `friction.jsonl` files on this machine are the **AutoHarness
  exec-failure log** — a different artifact with a different schema
  (`plugin`/`kind`/`tool`/`sessionHash`/`project`), **not** channel output.

| Repository | Class | Checkouts | `friction.triggerPresent` | Command in the generated skill inventory | Records |
| --- | --- | --- | --- | --- | --- |
| `ArggonManager` | maintainer | 8 | true on 2, false on 6 (`0.10.0`) | yes | 0 |
| `ArggonStores` | adopter | 5 | false (`null`) | yes (since 2026-10-14 08:25 -0300) | 0 |
| `EPC`, `RealMMORPG`, `dotnet-batchyard`, `evajoyas`, `opencode-scheduled-tasks`, `zcode-seam-live-verify` | adopter | 6 | false (`null`) | no | 0 |
| `arggon-cv`, `casa-pendiente`, `cuentas-claras`, `estanteria`, `guardian`, `racha`, `suizo`, `vencimientos` | adopter | 8 | false — no seam materialized | no | 0 |

### 3. ArggonStores end to end (the one live product adopter)

`arggon doctor --json` run from that tree: `friction.triggerPresent: false`,
`triggerVersion: null`, `files: 2`, both rows false. **No file anywhere in the tree
carries the `arggon:friction-trigger` marker**; `AGENTS.md` has no friction mention;
`references/friction.md` is not bundled; the vendored plugin registers **no** native
`friction` tool and 0.10.0's MCP server exposes no `arggon_friction`; no
`x-friction` opt-out is set. The only on-disk carriers of the command are the one
generated-commands inventory line in `.agents/skills/arggon-cli/SKILL.md` and the
inlined kernel in `.opencode/plugins/arggon/index.ts`. Provenance:
`generatedAt 2026-10-14T11:21:31.256Z` — 1 day 8 hours **before** the trigger landed
on `main` (2026-10-15 19:57:12 -0300). History: the string entered through `7cfee718`
(2026-10-14 08:25:59 -0300) and no invocation appears since. Records written: **0**.

### 4. Verdict: **NULL**, and by the registered rule it is `NOT-YET-MEASURABLE`

Zero adopter-attributable records across 15 adopter repos / 19 adopter checkouts,
with `triggerPresent` false at all 19. So the honest label is **not** "adopters do not
run it" — it is "the embedded trigger has never been observable at an adopter on this
machine": it was 32 minutes old on `main` when the sweep ran, and every adopter's
generated files predate it. The one real negative signal is about the route the
evidence already condemned: at `ArggonStores` the command has sat in the generated
skill inventory for ~39 hours (2026-10-14 08:25 → 2026-10-15 20:29 -0300) with zero
records — consistent with `deftai/directive#3633`, worth recording, and still a
different measurement from the one this spike exists to make.

### 5. Recommendation for stage 2: **DEFER** (neither proceed nor abandon)

- **Defer tier C.** Not because it lost — because it has not been tested. Shipping
  `gh` upstream dedupe on a null that cannot separate never-seen from
  seen-and-ignored would be exactly the papering-over the item's Notes forbid.
- **Keep tier B as the primary channel**, which stage 1 already does. A null is the
  input to preferring tier B, and this is a null.
- **Name a re-measurement trigger, not a re-litigation:** after `../ArggonStores` runs
  `arggon init` (the ADR 0016 upgrade channel) and the trigger has been present there
  for a stated window, re-run this same sweep — criterion, table and attribution
  script are all in the item and in `/tmp/opencode/spike-transcripts`. If the trigger
  is present and the record count is still zero, **that** is the seen-and-ignored arm,
  and tier B becomes the whole channel with the evidence to say so. (14 days is
  enough for a point-in-time re-read; I would claim nothing more from it.)
- **Add no instruction pressure** meanwhile. The item's Notes are explicit, and the
  measured gap so far is a carrier-chain gap, not an agent's unwillingness.

### 6. What this cannot establish (stated plainly)

Point-in-time, one machine, one human on both sides, one live adopter. It cannot
separate "no agent ever hit friction" from "an agent hit friction and did not record
it". It says nothing about any adopter that does not exist on this machine. N = 1 live
adopter is not a population.

### 7. Two ArggonManager defects found while measuring (recorded as local friction, not filed)

Written with `arggon friction` from this worktree at 20:34:12 / 20:34:24 -0300
(`reporterId 21a4d8edc71c`), so they are visible in the log this spike measured —
disclosed here so they are never miscounted as adopter records:

1. `TEST_NOT_HERMETIC` / `npm test` — `cli/src/friction.test.ts:145-152` passes
   `ARGGON_STATE_DIR: ""`, so the "no override" case appends one **real** record per
   run to the platform state base, while the file's own docstring claims "every run
   passes `ARGGON_STATE_DIR`". Every real capture on this machine is drowned in it;
   this is why the log needed an attribution audit at all.
2. `DOCTOR_MISSING_UNNAMED` / `doctor --json` — `docs.missing` is a bare count with no
   paths (only `outdatedDocs` is named), so a destination recorded in `x-generated`
   and absent from disk — the `deftai` "never deposited" shape — is not
   machine-observable. Concretely: `.agents/skills/arggon-cli/references/friction.md`
   is recorded generated at `2026-10-15T22:16:58.575Z` and is **not** on disk in the
   primary checkout.

Neither is filed as a tracker item: this is a spike, and review findings become items
only when the delivery lead consolidates them.

### 8. Commands run — expected vs observed

- `arggon doctor --json`, once per checkout (27 runs, from each checkout's own
  directory, post-#850 build `0.10.0 cef717f8`) — expected an additive `friction`
  block with per-file `triggerPresent`/`triggerVersion`; observed it on **27/27**, with
  `wrote=no` on 27/27 before/after snapshots. Transcripts `01..27-*-doctor.json`.
- A `readFrictionLog`-equivalent audit of `~/.local/state/arggon/friction.jsonl`
  (200 lines) plus a `sha256(machineSalt ‖ repoAbsPath)` attribution sweep over every
  work tree on the machine — expected adopter-attributable records; observed **0**,
  with 200/200 matching the test line's argv and narrative.
- `git log --all --grep` / `-S "arggon friction"` per repo, plus a tracked-file grep in
  `../ArggonStores` — expected an invocation in adopter history; observed only the
  seam-absorption commit `7cfee718`.
- `arggon friction` twice (the two defects above) — expected one appended, redacted
  record each; observed exactly that (200 → 202 lines).

### 9. Which acceptance boxes are ticked, and where the rest are answered

Ticked in the file: the four boxes the file itself shows — `depends_on`, the
pre-registered criterion with its commit-ordering evidence, the end-to-end adopter
observation with its transcript path, and the per-repo `friction.triggerPresent` table.
Boxes 5, 6 and 7 are the **finding**; they are answered in this comment (§2, §3–4 and
§4 respectively) and deliberately left unticked, because a spike's acceptance is the
recorded answer rather than a tick. No code ships in this spike — the only commits on
`feat/task-spike-friction-trigger-compliance` are the item's own bookkeeping.
