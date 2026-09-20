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

## Friction signatures

What to look for, in order of signal strength:

- **Retry**: the same command run twice in a row (identical argv). A retry is
  friction — a failed or unsatisfying first attempt.
- **Fallback**: a command followed by its error and then a *different*
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
