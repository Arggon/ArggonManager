# Telemetry mining protocol

> Task: `task-telemetry-mining` (story-self-improvement). First run: 2026-09-14.

## Purpose

Organic signal from **real usage** that synthetic experiments miss. Two audit
findings (dirty-tree dance, lost-push cleanup failure) came from reading
session logs and tracker commit history, not from attacking the tool. This
protocol makes the mining repeatable.

## Sources

1. **ZCode session logs**: `~/.zcode/cli/log/*.jsonl` — per session id:
   `tool.call.started` sequences (repeated commands), error/failure events,
   per-session command counts. **Known limitation (2026-09-14 first pass)**:
   the records carry only `toolName`/`status`/`durationMs`/`toolCallId` — no
   command payloads — so the retry/fallback signatures degrade to failure
   clustering (which tool failed, how often, per session) and duration
   outliers; argv-level mining needs transcript-level logs.
2. **Tracker commit history of the live experiment repos**:
   `/home/arggon/Projects/{ArggonManager,racha,estanteria,cuentas-claras,guardian,suizo}`
   — `git log --oneline -- ArggonManager/` for tracker-mutation patterns.
3. **`.evidence/` dirs** in those repos — captured outputs from experiments
   (cross-check them against filed items; unfiled evidence is a miss).
4. **CI workflow runs** (added 2026-10-13): GitHub Actions run logs and their
   check-run annotations — the only event-level surface for merge-time kernel
   refusals, which are ephemeral by design. Method and traps:
   [CI workflow logs](#ci-workflow-logs) below.

## CI workflow logs

Added 2026-10-13 by the first CI-mining pass (`task-done-gate-refusal-rate-substrate`,
following `task-sweep-auto-done-refusal-warnings`). Trigger: a done-gate refusal
is **ephemeral by design** — the flip's `fail()` returns an error envelope and
commits nothing — so the item stays `in_progress` and git records no refusal at
all. CI is the only place the event exists.

How to read it:

- **Enumerate runs by workflow** and pin the window to a named run:
  `gh api --paginate "repos/<owner>/<repo>/actions/workflows/<wf>.yml/runs?per_page=100"`,
  keeping `id` + `created_at`. A window bounded only by "now" drifts between
  reads and silently changes the denominator.
- **The executed-warning trap — the reason the first measurement was wrong.** An
  executed `::warning::` workflow command is rendered by the runner as
  `##[warning]<msg>` in the raw log. The literal `::warning::` appears _only_ as
  script source (echo/heredoc text), never as executed output, so a pattern keyed
  on it matches nothing executed. Require the line to start with `##[warning]`
  after the timestamp; the two renderings are not interchangeable.
- **Check-run annotations are an independent second source, not a second
  coverage surface**: `GET /repos/{o}/{r}/actions/runs/{id}/jobs`, then
  `GET /repos/{o}/{r}/check-runs/{job_id}/annotations` (an Actions job id **is**
  the check-run id). Compare per run, not only in totals.
- **Verify coverage before trusting a count.** A failed or throttled annotation
  fetch looks exactly like a run with no annotations: a suppressed error hid one
  of 52 refusals in the first pass, until the runs that returned zero rows were
  re-fetched serially. Coverage is the set of runs that returned rows, not the
  number of requests made.
- **Reconstruct "what the tool saw" from the run's own log**, never from commit
  dates: this repo's flip step prints `HEAD is now at <sha>` right after
  `git reset --hard origin/main`. `git rev-list --before=<time>` is unreliable
  here — a flip commit's committer date can precede its arrival on `main` by
  minutes, which mis-classified three events in the first pass.
- **A generic annotation is not a classification.** The workflow's refusal
  warning does not name which refusal reason fired; the kernel does. Classify by
  running the kernel's own predicate (`acceptanceGate` in `lib/dist`) over the
  item body at the reconstructed tree.

First pass, `auto-done`, 534 runs (2026-09-11 → 2026-10-13): 52 done-gate refusals
over 49 items — **26 an untouched `create` scaffold** (no live contract authored),
**22 an authored contract with unticked boxes at merge**, **4 the pre-ADR-0025
whole-body scan** (all before 2026-10-06; none after). Two further refusals after
the cutoff have the same second cause. All refused items were completed by hand,
48 of 49 within 24 h (median 11 min). **Decision: the refusals are the done gate
tolerating an incomplete contract exactly as ADR 0015/0025 designed — no gate or
substrate change;** the levers are authoring-side and already tracked
(`task-create-needs-a-body-flag-to-author-a-live-contract`,
`task-migrate-7-leaves-with-no-live-acceptance-contract`). Counts, per-run
examples and limits: `task-done-gate-refusal-rate-substrate`; the question behind
the measurement:
[exploration-021](../explorations/exploration-harness-research-transfer-021.md).

## Friction signatures

What to look for, in order of signal strength:

- **Retry**: the same command run twice in a row (identical argv). A retry is
  friction — a failed or unsatisfying first attempt.
- **Fallback**: a command followed by its error and then a _different_
  invocation of the same intent. That is a gap — the tool offered no path.
- **Manual tracker git work**: a manual `git add ArggonManager/ && git commit` right
  after tracker mutations. Either pre-auto-commit leftover behavior or a
  mutation the auto-commit does not cover.
- **Resets/reverts of tracker files**: `git revert`/`reset`/`checkout -- ArggonManager/…`
  implies a mutation the user had to undo by hand (e.g. squash-merge flip noise).
- **Chore-commit clusters**: runs of `chore(tasks): …` commits in quick
  succession (the dirty-tree dance — flip → commit → unrelated dirty file
  swept in → amend).
- **Claim/flip sequences**: claim → unclaim → re-claim → claim of the same item
  within one session (claim conflicts or wrong-item starts).
- **Repeated identical findings across repos**: the same friction in ≥2
  experiment repos is **systemic**, not local — file once, cite all repos.

## Procedure

Per repo and per session log:

1. **Extract candidates**: apply the signatures above; for session logs, script
   a pass that groups `tool.call.started` by session and flags repeats and
   error-adjacent invocations.
2. **Dedupe**: against already-filed items (`grep -r "<keyword>" ArggonManager/`) and
   against candidates from other repos (collapse to one systemic item).
3. **Classify** each candidate:
   - `bug` — the tool did something wrong;
   - `aspereza` — correct but rough (missing guard, noisy output, extra step);
   - `ergonomics` — right result, avoidable friction;
   - `not-actionable` — record in the run report, do not file.
4. **File** actionable items via the tracker under the owning story with
   evidence links (repo + commit sha, or session id + log excerpt) — or report
   **zero-findings** explicitly per repo/session.

## Cadence

After each real-usage session or adoption experiment — **not on a timer**.
Mining without fresh usage produces noise, not findings.

## Filing rules

Same as the audit protocol (`ArggonManager/docs/labs/adversarial-audit.md` §Filing rules):
literal repro + evidence per finding, file under the owning story, never patch
the tool from the mining pass, already-filed patterns are confirmations not
re-files.
