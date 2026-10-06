---
type: task
status: in_progress
id: task-explore-adopter-feedback-channel
title: "Exploration: reverse feedback channel from adopter repos (friction capture, dedupe, human-gated publish)"
assignee: Arggon
branch: feat/task-explore-adopter-feedback-channel
parent: story-adopter-feedback
labels: [methodology, adopters]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T14:18:08.885Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-explore-adopter-feedback-channel
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-explore-adopter-feedback-channel.md
  Leaves live only under a story. id is the filename stem: task-explore-adopter-feedback-channel.
  CLI `arggon create task explore-adopter-feedback-channel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Exploration: reverse feedback channel from adopter repos (friction capture, dedupe, human-gated publish)

## Context

**Every channel ArggonManager has is one-directional.** The product reaches the
adopter (`init`, `init --propose`, `doctor` `outdated`, `playbook status
--file-task`, the opt-out registry update check, the bundled skill, generated
agents/commands, ADR 0016's proposal files) and **nothing comes back**. In an
adopter repo `arggon create` files into _that repo's_ tracker and this project
never learns.

**The two existing friction protocols cannot see an adopter**, because both are
maintainer-side, local and single-machine:
[`docs/labs/adversarial-audit.md`](../../../docs/labs/adversarial-audit.md)
(invariant attacks + normative-doc conformance) and
[`docs/labs/telemetry-mining.md`](../../../docs/labs/telemetry-mining.md)
(`~/.zcode/cli/log/*.jsonl` + one checkout's tracker history). Both file through
`arggon create` **into this repo**. `telemetry-mining.md`'s own signature —
"repeated identical findings across repos → **systemic**, not local — file once,
cite all repos" — is precisely the rule that _wants_ a cross-repo view it cannot
get.

**Duplicate filing is a measured, live debt in this tracker** (10 repeat reports
of the same class), including `bug-torture-contention-flake3` ("for the THIRD
time"), `bug-spawn-sync-test-timeout-flake` ("2nd instance of the class"), and
`bug-start-install-ordering` ("five incidents across five sessions"). A dedupe
key is not speculative value here.

**The proposal under evaluation was an instruction for agents to open a GitHub
issue on friction.** Validated against code, docs and dated external precedent;
recorded in
[`exploration-adopter-feedback-channel-024`](../../../docs/explorations/exploration-adopter-feedback-channel-024.md).

Verdict, on evidence: the **instinct is right and load-bearing** (the reverse
channel is genuinely missing) but the **mechanism is refuted** by a named
incident, and the refutation sharpens the design rather than killing it.

- **Instruction-only escalation fails silently.**
  `deftai/directive#3633` (2026-08-23) shipped a skill documented as "the
  sanctioned route for a consumer agent to escalate a framework gap upstream". It
  was missed **by an agent that was actively escalating and following the rule
  that pointed at it** — a policy flag off by default, the skill absent from the
  host inventory, and the `REFERENCES.md` index never deposited. The friction was
  "absorbed into the session". Silent loss is worse than no channel, because it
  looks like success. Author's maxim, load-bearing for our trigger design:
  _"A disabled capability nobody can see is absent."_
- **It fights our own carrier.** `docs/agents.md` §0 — the first section agents
  read — says unconditionally "Do **not** open new GitHub issues".
  `claude-code#93077` documents project instructions losing to harness defaults
  across repos.
- **The output is the shape peers delete.** OpenCode's `duplicate-issues.yml`
  closes template-non-conforming issues in 72h and rejects "AI-generated walls of
  text"; `goose` asks for a human-authored issue; Claude Code carries a **27.6%
  duplicate rate** (26,558 of 96,130).
- **But three projects independently converged** (`ce-ai#426` shipped,
  `ContextDesk#325` shipped, `subfloor#543` declined-but-published) on
  local capture → redact-before-exit → dedupe → **human consent gate** →
  publish. And **ce-ai's tiered output dissolves the two objections that looked
  fatal**: tier A copies a sanitized report (no `gh`, no auth), tier B opens a
  **prefilled `issues/new?title=…&body=…` URL** (no `gh`, no auth, human clicks),
  tier C is `gh` only with a live `gh auth status`, never in CI, never
  unattended. **The agent never opens an issue — a human does** — so §0 is never
  violated and one canonical record survives.
- **Sentry's own rule sharpens the dedupe design**: `{{ error.value }}` "can
  produce really bad groups when error values are frequently changing." An
  LLM-authored narrative is exactly that, so the fingerprint must come from
  stable structured fields **only**.
- **Privacy.** No documented incident exists of an agent leaking an adopter's
  paths into a _maintainer's_ issue tracker via this trigger. The closest
  structural match is PixelLeak (Help Net Security, 2026-09-30: an agent that
  must convey evidence, finds no sanctioned channel, chooses public) — the same
  failure _shape_, a different trigger. Independently, public issue bodies are
  machine-mined within hours and publish paths/SHAs verbatim. So the privacy
  argument is **structurally sound, not incident-proven** — which is exactly why
  redaction must happen _before_ render.

**Recommended shape** (staged, ADR 0016 precedent): `arggon friction` → local
bounded log outside the repo (never the work tracker, so it cannot become a task
by accident) → stable-fields-only fingerprint for dedupe → redacted report →
human-gated tiered publish. Four independently shippable pieces: **trigger**
(embedded in the generated worker/coordinator files, not only a skill
reference), **capture**, **dedupe**, **publish**.

Greenfield per ADR 0017, so this task carries Phase 0–5 of the six-phase
protocol and ends at the artifact gate. **No implementation task may be claimed
before the spec exists and `arggon spec analyze` reports no NEW findings.**

## Acceptance

- [x] Phase 0–2 done: classified greenfield with the one-way ratchet; stance is
      read-only on code; grounded in this repo's code, carriers, ADRs, labs
      protocols and live tracker/git data
- [x] Phase 3 done: every frontier round logged (outcome/users → scope →
      constraints → data → interfaces → failure/edge → ops/security → rollout);
      the one open question ("do adopters run the command?") routes to a spike
      rather than a guess
- [x] Phase 4 done: all 13 edge-case dimensions hunted, each resolving to a spec
      acceptance criterion, an explicit non-goal, or a spike — nothing "unknown"
- [x] Phase 5 done: 2–3 approaches with trade-offs; the user's original proposal
      is evaluated as Approach 1 and **refuted on cited evidence**, with three
      named alternatives and the converged external architecture recorded
- [x] Artifact written: [`exploration-adopter-feedback-channel-024`](../../../docs/explorations/exploration-adopter-feedback-channel-024.md),
      including an explicit "evidence gaps" section
- [x] `arggon validate` green; exploration ids/links resolve
- [x] **ADR written** settling the cross-cutting parts: the methodology-carrier
      change (**behavioral** impact class per `docs/agents.md` §Changing the
      methodology itself), opt-out semantics, and the explicit non-goal of
      automatic publication — [ADR 0024](../../../docs/adr/0024-adopter-friction-channel.md)
- [x] **Spec + plan written** from the edge-case table, then a clean
      `spec analyze` run — the gate that releases implementation tasks —
      [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md)
      (all 13 hunted dimensions mapped one-to-one onto its acceptance criteria)
      and
      [plan-friction-capture-018](../../../docs/plans/plan-friction-capture-018.md);
      `spec analyze` holds at the same **7 pre-existing findings**, zero NEW

## Recommendation (coordinator decision)

**Needs a spec — written, not filed for approval.** The reverse channel is real
and the exploration's verdict stands: the _instinct_ (adopters should be able to
send friction back) is load-bearing, the _mechanism_ (agent-opened GitHub
issues) is refuted by a named incident. What lands is stage 1 of ADR 0024:

`arggon friction` → local bounded log **outside** the tracker → stable-fields-only
fingerprint → redacted report → human-gated tier-A/tier-B output.

Two things the coordinator should know that were **not** in the prior research:

1. **`doctor` gains a narrow `friction` block** (ADR 0024 §2) — for what the
   `outdated` bucket cannot already do, which is narrower than this section first
   claimed. `doctor.ts` re-renders the current template for every
   `config.generated` entry in every local state **including acked**, and the
   generated agent files are in that map, so a missing trigger already shows up as
   an outdated managed doc. **"The channel is not live" is not invisible today.**
   The block earns its place with a **per-file `triggerVersion`** (so "present at
   0.5.0" stays distinguishable from "current is 0.6.0") and by separating
   **_trigger absent_ from generic template drift** — the observable
   `task-spike-friction-trigger-compliance` needs to tell "never seen" from "seen
   and ignored". If stage 1 must be minimal, cut `triggerVersion` and `files`,
   **not** the block.
2. **The evals harness is ruled out as the capture vehicle** (ADR 0024 §5) and
   kept as a stage-2 _producer_. `skills/arggon-cli/evals/` runs against
   `dist/cli.js` in a synthetic temp fixture it creates itself, scores pass/fail
   into stdout for a maintainer to read, and never touches an adopter — putting
   capture back inside one machine's local test loop, the exact blind spot
   `telemetry-mining.md` already documents. What it _is_ good for: an eval FAIL is
   machine-derived, so its fingerprint fields are stable structured values rather
   than LLM-authored prose — precisely the Sentry hazard the dedupe design turns
   on.

Implementation tasks and spikes filed under `story-adopter-feedback` (6 tasks
chained T1→T6 per the plan, 3 spikes). Per the ADR 0017 gate, **none may be
claimed** until the coordinator's decision on the ADR/spec lands.

**Known defect found — and now fully resolved.** Item bodies in this story linked
docs with a four-level `..` prefix, which resolves one directory above the tracker
root and is **broken**; the correct depth from
`ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/`
is three levels, reaching `ArggonManager/docs/`. Fixed in this item and in all nine
items filed here. **Correction (2026-10-03):** an earlier revision of this section
said the defect was "still broken, deliberately not touched" in
`bug-contributing-github-issue-contradiction.md` and
`bug-prettier-glues-split-inline-code-span.md`. That was wrong on both counts.
The first was fixed and closed on main (PR #594); the second was fixed on main in
`368809d5`, and this branch's stale copy would have **reverted** that fix until the
merge took main's newer version. Both are correct today and neither is touched by
this PR's logic.

## Request-changes round (2026-10-03)

Reviewer verdict `request-changes`; all four blockers plus N1–N6 addressed.

- [x] **B1 renumbered** — ADR `0021`, spec/plan `018`, exploration `019`, every internal reference, plus a `Numbering note` per the ADR 0016 / ADR 0019 precedent. The four new numbers are unique in their directories: verified against the merged duplicate-number detector, which reports **zero** findings naming any of my artifacts.
- [x] **B2 the `done` item no longer regressed** — `bug-contributing-…` no longer appears in the branch diff at all; its record is main's (`status: done`, assignee, branch, ticked boxes). `bug-prettier-glues-…` needed no action: main had already fixed it and the merge took main's newer copy.
- [x] **B3 the ADR ships `Proposed`**, with a `Status note` naming the two-step precedent; the epic box stays unticked until acceptance (N3).
- [x] **B4 the ADR is indexed** in `docs/adr/README.md` — required, since PR #602's parity test asserts one index row per ADR file and every row resolving.
- [x] **N1 one owner for `doctor.friction`** — T6. T5 keeps `arggon friction` surface parity and says which half it owns.
- [x] **N2 the compliance spike is gated** — `depends_on: [task-friction-trigger-carrier]`, so it is not claimable before the trigger it measures exists.
- [x] **N3 the epic contradiction is reconciled** with a note, not a premature tick.
- [x] **N4 duplicate H1s removed** from the 5 files that had them.
- [x] **N5 the stale "still broken" claim** — first corrected in the response comment only, on the reasoning that the copy "lives in a dated comment". **That reasoning was wrong** and the round-2 review caught it: the same claim also sits in **live body prose**, which body-editing does cover, so it is corrected in this body too (see M4b above). The dated comment copy correctly stays verbatim.
- [x] **N6a** the exploration's concurrency row corrected to `O_APPEND` with a dated note; **N6b** rotation owned by T1, T3 only renders the counter.
- [x] **Scope call 4a** carried into ADR §2 — re-justified on per-file `triggerVersion` and separating _trigger absent_ from generic template drift, with the correction that `doctor.ts` already re-renders acked entries so a missing trigger is **not** invisible today.
- [x] **Scope call 4b** carried into the spec — a new acceptance criterion names the honest boundary: local dedupe cannot see an already-filed upstream issue, so a known class is re-emitted and may be filed twice; deferred, not postponed.
- [x] **Gates green on the merged tree**: `build`, `test` (122 files / 2275 tests), `lint`, `check:plugin`, `validate` (0 warnings, v5), `spec validate` (34 docs, 5 warnings — all pre-existing), `spec analyze` vs baseline (5 new, all pre-existing duplicates, none mine), prettier clean **and idempotent** across consecutive writes.

## Round-3 review (2026-10-03)

Second `request-changes` — four narrow doc-consistency edits, **no redesign**.
B1–B4 and N1–N6 were independently re-verified closed. All four findings were the
same underlying mistake: **a superseded rationale surviving in live prose** where the
dated amendment correctly said it had been wrong.

- [x] **M1** — the spec's §_The trigger and its visibility_, its header paragraph, and T6's
      Context all carried the withdrawn 4a claim. All three now carry ADR 0024 §2's
      reasoning (per-file `triggerVersion`; _trigger absent_ vs generic drift), each
      stating the correction explicitly: `doctor.ts` re-renders every
      `config.generated` entry in every local state **including acked** and the agent
      files are in that map, so a missing trigger is **not** invisible today.
- [x] **M2** — T6's acceptance no longer carries "(with
      `task-friction-surface-parity-and-docs`)"; it states sole ownership, so the
      ambiguity N1 closed does not reopen.
- [x] **M3** — the two remaining bare `spike-friction-*` ids in the plan are now
      `task-spike-…` and resolve. Swept the whole branch tree for the class: the only
      remaining bare mentions are inside dated comments, which stay verbatim.
- [x] **M4** — the item body's §Recommendation asserted the 4a invisibility claim and a
      "still broken in both sibling items" note that was false. Both corrected in
      **live body prose**, with dated corrections naming what was wrong.
- [x] **Round-2 invariants re-verified after these edits**: residual duplicate-number
      findings still **exactly 5**, none mine; zero dangling links in any live body;
      ADR 0024 still `Proposed` (never `Accepted`) in file, README row and epic note;
      prettier **convergent across repeated passes** (two-pass assertion, not a single
      `--check`); `spec validate` / `spec analyze --baseline` clean of anything I own.

**Boundary ruling respected:** dated **comments** stay verbatim (the round-1 B1 table's
shas are the evidence that justified the renumber, so editing it would falsify the
audit trail); the principle does **not** extend to live body prose, which is M1/M4.

**Reviewer nits, declined with reasons:** the story body still says "13 hunted
dimensions → 13 mapped criteria" — true as written (the Limits dimension carries two
criteria but that is an addition, not a remap, and the count of dimensions is
unchanged); `bug-prettier-indented-list-continuation-grows-2-spaces-per-write` already
exists on main and is not mine to re-prioritise.

## Renumber map

The coordinator resolved the reviewer's B1 collision by renumbering **this
branch's** artifacts — the collision was the coordinator's, having written and
accepted its own ADR 0020 before dispatching this worker, which independently
wrote another. Renumbering main's side would have touched an **accepted** ADR
plus four artifacts that already reference it.

**Renumbered, because `main` grew under this branch and took those ids too.** The
branch was cut before `main` landed its own ADRs `0021`–`0023`,
`spec-promotion-policy-018` and `exploration-agent-primary-workers-019`. So the
same collision the first renumber fixed reappeared one directory over: merging
`main` turned `cli/src/adr-index-parity.test.ts` red (one index row per ADR file;
gapless, strictly ascending, duplicate-free numbering) and `arggon spec validate`
red (`spec-friction-capture-018` against main's `spec-promotion-policy-018`,
`exploration-adopter-feedback-channel-019` against main's
`exploration-agent-primary-workers-019`). The branch's side renumbers again, for
the reason recorded above. **The plan keeps `018`** — `main`'s plans stop at
`017`, so it never collided.

| Was                                                        | Now                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `adr/0020-adopter-friction-channel.md`                     | [`adr/0024-adopter-friction-channel.md`](../../../docs/adr/0024-adopter-friction-channel.md)                                         |
| `specs/spec-friction-capture-017.md`                       | [`specs/spec-friction-capture-020.md`](../../../docs/specs/spec-friction-capture-020.md)                                             |
| `plans/plan-friction-capture-017.md`                       | [`plans/plan-friction-capture-018.md`](../../../docs/plans/plan-friction-capture-018.md)                                             |
| `explorations/exploration-adopter-feedback-channel-018.md` | [`explorations/exploration-adopter-feedback-channel-024.md`](../../../docs/explorations/exploration-adopter-feedback-channel-024.md) |

Intermediate labels readers may still meet, all superseded by the row above:
`0021-adopter-friction-channel.md` and `spec-friction-capture-018.md` (the
2026-10-03 renumber). Dated comments still say **"ADR 0020"** / **"ADR 0021"** and
cite the old filenames — see the boundary note below.

**The comment history below is deliberately verbatim.** A comment records what was
said on a date, so the older blocks still read "ADR 0020" / "ADR 0021" and cite the
old filenames — including the reviewer's B1 evidence table, which editing would
_falsify_. This table is the map. The live body above, by contrast, is current
state and has been renumbered to `0024` / `020` / `024`.

## Notes

Deliberately **not** in scope for this task: implementing `arggon friction`
(gated behind the spec above), enabling Discussions (kept as the recommended
tier-B fallback, a one-line ops change the maintainer can take independently),
and fixing `CONTRIBUTING.md` — filed separately as
[`bug-contributing-github-issue-contradiction`](bug-contributing-github-issue-contradiction.md),
which is unambiguous, cheap, and independent of whatever the ADR decides.

The stage-1 slice (trigger + capture + report on the **maintainer's own
machine**) is worth naming for the maintainer: it needs no adopter to opt in,
carries zero privacy risk, and is immediately useful against this repo's 10
known duplicate items.

### 2026-10-02 @ses_f031e92afffeGv1n1RTkEsHjpb

**PR #586** — exploration + container chain + the CONTRIBUTING bug. Impact class: **advisory** (no methodology carrier touched; the carrier change lands with the ADR/spec).

Phase 0–5 complete. Summary of the verdict on the original proposal:

**Refuted — "instruct agents to open a GitHub issue":** the evidence is a named incident, not taste. `deftai/directive#3633` (2026-08-23) shipped a skill documented as _"the sanctioned route for a consumer agent to escalate a framework gap upstream"_, and it was missed **by an agent that was actively escalating and following the rule that pointed at it** (policy flag off by default, skill absent from the host inventory, `REFERENCES.md` never deposited). The friction was _"absorbed into the session"_ — silent loss, which is worse than no channel because it looks like success. Three corroborating findings: it fights `docs/agents.md` §0 (the first section agents read); `claude-code#93077` shows cross-repo instruction precedence is unreliable; and the output shape is actively auto-closed by peers (OpenCode's `duplicate-issues.yml` rejects "AI-generated walls of text"; claude-code carries a 27.6% duplicate rate).

**Kept and improved — the instinct was right, only the writer of the issue was wrong.** Three projects converged (2026-07→09) on local capture → redact-before-exit → dedupe → human consent gate → publish (`ce-ai#426` shipped, `ContextDesk#325` shipped, `subfloor#543` declined-but-published). Their tiered output dissolves the auth objection _and_ the doctrine conflict: tier B is a **prefilled `issues/new?title=…&body=…` URL** — no `gh`, no auth, **a human clicks submit**. The agent never opens an issue, so §0 is never violated and one canonical record survives. Sentry's fingerprint rules then constrain the dedupe key: never derive it from the narrative (an LLM-authored value is exactly the "frequently changing" case that produces bad groups).

**Correction to my own earlier framing:** I first called the privacy objection "concrete, precedent-backed". The research supports _structural_ soundness (redact before render; whitelist capture) but found **no incident** of an adopter leaking paths into a maintainer's tracker via this trigger. PixelLeak is the same failure _shape_ — no sanctioned channel, so the agent chose public — but a different cause. The exploration records that downgrade explicitly rather than keeping the stronger claim.

**Recommended, not decided:** `arggon friction` → local bounded log outside the tracker → stable-fields-only fingerprint → redacted report → human-gated tiered publish, in four independently shippable stages. Stage 1 needs no adopter opt-in and attacks this repo's 10 known duplicate items directly.

Gates green: `validate` ok (0 warnings, v5); `spec validate` ok (30 docs); `spec analyze` no new finding; prettier clean; placeholder scan clean.

Next per the ADR 0017 gate: an ADR (settling the carrier change's behavioral impact class, opt-out semantics, and the explicit non-goal of automatic publication), then the spec carrying the 13 hunted edge-case dimensions as acceptance criteria. No implementation task claimed before `spec analyze` reports no NEW findings.

### 2026-10-02 @ses_f01435336ffeYS4KAJmBnNqG2k

**Recommendation: needs a spec — ADR 0020 + spec-friction-capture-017 + plan written. Nothing implemented. Coordinator decides.**

The exploration's Phases 0–5 were already on this item (`exploration-adopter-feedback-channel-018`), so this session closed the **artifact gate** it was waiting on: the ADR, the spec, the plan, and the implementation chain.

## What landed

| Artifact                                                                      | What it settles                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR 0020](../../../docs/adr/0020-adopter-friction-channel.md)                | carrier change is **behavioral**; opt-out gates capture but never discoverability; automatic publication is a **hard non-goal**; the evals harness is ruled out as the capture vehicle |
| [spec-friction-capture-017](../../../docs/specs/spec-friction-capture-017.md) | all 13 hunted edge-case dimensions → 13 mapped acceptance criteria + non-goals                                                                                                         |
| [plan-friction-capture-017](../../../docs/plans/plan-friction-capture-017.md) | T1–T6 with ordering and the spike list                                                                                                                                                 |
| 6 tasks + 3 spikes                                                            | filed under `story-adopter-feedback`, chained                                                                                                                                          |

## Two things the prior research had not settled

**1. `doctor` gains a `friction` staleness block (ADR 0020 §2).** This is the finding I would most want a second opinion on. An adopter that has acked its generated docs receives the trigger only as an ADR 0016 `init --propose` side file — so without a doctor signal, "the channel is not live here" is **invisible**. That is precisely the failure ADR 0016 already had to fix for docs via the `outdated` bucket, and it is the `deftai` maxim (_"a disabled capability nobody can see is absent"_) applied to a mechanism this repo already owns. Cheap (compare a stamped marker), and it is what separates "the trigger was never seen" from "the trigger was seen and ignored" in the compliance spike. If the coordinator thinks this is scope creep, it is the piece to cut — everything else stands without it, but the channel then inherits the exact blind spot that sank the original proposal.

**2. The evals harness is the wrong vehicle, but the right producer (ADR 0020 §5).** `skills/arggon-cli/evals/` answers "can an agent reading only `SKILL.md` derive and run the right command" — it runs against `dist/cli.js` in a **synthetic temp fixture it creates itself**, scores pass/fail into stdout for a maintainer to read, and **never touches an adopter repo**. Reusing it as the channel would put capture back inside one machine's local test loop: the exact blind spot `telemetry-mining.md` already documents, and its FAIL line is not a record. What it _is_ good for: an eval FAIL is machine-derived, so its fingerprint fields (eval id, predicate, expected, observed, command shape) are stable structured values rather than LLM-authored prose — which is the Sentry hazard the whole dedupe design turns on. Kept as a stage-2 producer that appends one record per failed case; it must never auto-file.

## Filed (none claimable until the ADR/spec decision lands — ADR 0017 gate)

`task-friction-capture-command` (p1) → `task-friction-redaction-at-write` (p1) + `task-friction-dedupe-and-report` (p1) → `task-friction-tier-b-url-and-optout` (p2) → `task-friction-surface-parity-and-docs` (p2) → `task-friction-trigger-carrier` (p1, the behavioral carrier change).

Spikes: `task-spike-friction-trigger-compliance` (does an embedded trigger fire more reliably than a skill reference? **gates stage 2 and tier C**), `task-spike-friction-tier-b-surface` (Issues vs Discussions), `task-spike-friction-volume-threshold` (depends on the compliance spike; a null result — "no automation, revisit only with data" — is the expected answer).

Ordering note carried into the plan: **the trigger carrier task lands last.** An agent file naming a command that does not exist yet is worse than no trigger at all.

## Scope note (stage 1 vs the story title)

The story is titled "capture, dedupe, human-gated publish", and stage 1 deliberately stops before tier C. Tier C is `gh`-mediated upstream dedupe and comment-on-existing; it is the part that most resembles "automatic", so it is gated behind a measured-volume spike rather than shipped with the local half. Stage 1 still ships the human gate (tier A copy, tier B prefilled URL a human clicks) — that is the part that keeps `docs/agents.md` §0 intact, and it is what makes the channel exist at all.

## Gates

`arggon validate` ok (0 warnings, convention v5) · `arggon spec validate` ok (32 docs) · `arggon spec analyze` **7 findings, the same 7 pre-existing ones — zero NEW** across 19 specs · `npm run lint` clean · prettier clean.

## Tracker-write hazard check

Every tracker mutation ran from inside the worktree (`/home/arggon/Projects/ArggonManager-task-explore-adopter-feedback-channel`), and all 9 creates used `--no-commit` with a single explicit-path commit. `git log --oneline origin/feat/task-explore-adopter-feedback-channel -3` shows both commits on the branch; **the primary checkout is clean on `main` with no commits from this session.**

## Collateral finding, reported not fixed

Item bodies in this story linked docs with a four-level `..` prefix that resolves one directory **above** the tracker root (correct depth: three). Fixed in this item and in all nine items filed here, so the exploration chain's links resolve. Still broken and deliberately untouched (other items' bodies): `bug-contributing-github-issue-contradiction.md`, `bug-prettier-glues-split-inline-code-span.md`.

### handoff 2026-10-02 @ses_f01435336ffeYS4KAJmBnNqG2k (session: ses_f01435336ffeYS4KAJmBnNqG2k) — next: Coordinator: review ADR 0020 + spec-friction-capture-017, then merge PR (open). On acceptance, release task-friction-capture-command (T1) as the first claimable implementation task.

- branch: feat/task-explore-adopter-feedback-channel
- open questions: Is doctor.friction scope creep (cuttable, channel loses its visibility)? Issues vs Discussions for tier B (spike)? Broken 4-level doc links in the two sibling bug-* bodies: fix here or leave to their…

### 2026-10-02 @Reviewer

verdict: request-changes (ADR/spec/plan numbering collides with already-merged main; a `done` item is rewritten; ADR ships `Accepted` pre-merge)

Reviewed PR #586 (`feat/task-explore-adopter-feedback-channel`, 18 files, +1830/-12) by reading the branch against `origin/main`. No gates run — execution evidence requested at the end.

**Bottom line: the thinking is good and I want this merged. The blockers are all mechanical (renumber, rebase, one status line, one README row).** The exploration is the strongest artifact in this story: the refutation of the original proposal rests on a named dated incident rather than taste, it self-corrects an overstated privacy claim, it records its own evidence gaps, and its 13-row edge-case table resolves every hunted dimension into a spec AC, an explicit non-goal, or a spike with nothing left "unknown".

---

## Blocking findings

**B1 — Every artifact identifier in this PR collides with main. Four of them.**

| Artifact    | this PR                                                          | already on `origin/main`                                                                                                               |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| ADR         | `0020-adopter-friction-channel.md` (`172af2fb`, **19:36 -0300**) | `0020-methodology-first-productization.md` (`448b31dc`, **13:06**) — later flipped to `Accepted` by `ecedac02` "docs: accept ADR 0020" |
| exploration | `exploration-adopter-feedback-channel-018.md`                    | `exploration-methodology-productization-018.md` (`448b31dc`)                                                                           |
| spec        | `spec-friction-capture-017.md`                                   | `spec-methodology-adapters-017.md` (`448b31dc`)                                                                                        |
| plan        | `plan-friction-capture-017.md`                                   | `plan-methodology-adapters-017.md` (`448b31dc`)                                                                                        |

This is not an unavoidable concurrent-PR race: the branch last merged main at 11:35 and wrote its own ADR 0020 **~6h later**, by which time main had already filed _and accepted_ an ADR 0020. After merge the repo holds **two Accepted ADRs numbered 0020**, two explorations ending `-018`, and two spec/plan pairs ending `-017`. Every "ADR 0020" reference then means two things — including `docs/engineering.md:3`, which declares the methodology carrier "per [ADR 0020](./adr/0020-methodology-first-productization.md)".

`engineering.md:171` requires "a 4-digit monotonic number", and the repo has already paid for this class twice with the right remedy: ADR 0016 (`a03fb3b5 docs: renumber ADR 0014-adopter-upgrade-channel to 0016`, plus a `Numbering note`) and ADR 0019 (`6825f680 … + ADR 0019/spec-plan 016 renumber`, with a `Numbering note` naming the collision). Follow that precedent: renumber to the next free id (0021 / 019 / 018), update all cross-references (exploration, spec, plan, 6 tasks, 3 spikes, this item body), and carry the same one-line `Numbering note`.

Note this is **invisible to the tooling**, which is why review must catch it: `cli/src/spec.ts:280-297` keys uniqueness on `kind:docId`, so `friction-capture-017` vs `methodology-adapters-017` does not trip `SPEC_DUPLICATE_ID`, and git merges the four files without a conflict (different filenames).

**B2 — This PR rewrites a `done` item.**
The diff includes `bug-contributing-github-issue-contradiction.md` (+55/-…). On `main` that item was fixed and closed after this branch base: `3693ac29` claim → `d506894b docs: fix CONTRIBUTING.md contradiction` (PR #594) → `8ba5947a chore(tasks): done bug-contributing-github-issue-contradiction` (`41cdda87` pruned it). Main now carries `status: done`, `assignee: Arggon`, `branch: fix/bug-contributing-github-issue-contradiction`, a fully ticked checklist, the fix evidence note, and a `verdict: approve` from the #594 review. **This branch copy has `status: todo`, no assignee/branch, and replaces that record with five unticked boxes.**

So the merge either conflicts on that file, or — worse, if resolved by taking this side — **reopens a done item, strips its claim record, and deletes a reviewer approve verdict**, which `AGENTS.md` and `docs/agents.md` §5 forbid. Fix: rebase onto `origin/main` and **drop this hunk entirely**. The item is closed; the branch context/acceptance is redundant, and the `CONTRIBUTING.md:13 vs :269` contradiction it documents no longer exists.

**B3 — ADR ships `Status: Accepted` before merge.**
`engineering.md:191`: "Proposed in a PR → Accepted when merged (or explicitly recorded)". Main own ADR 0020 landed **Proposed** (`448b31dc`) and was accepted in a **separate follow-up commit** (`ecedac02`, "docs: accept ADR 0020") — that is the "explicitly recorded" path, and ADR 0016 carries a `Status note` for its own late flip. Meanwhile the item is still `in_progress` and the epic acceptance leaves "An ADR settles the cross-cutting decision" **unticked** (see N3), so nothing on this PR records the maintainer acceptance of _this_ ADR. Land it as `Proposed` and let the merge (or an explicit accept commit) flip it.

**B4 — the new ADR is not indexed.**
`ArggonManager/docs/adr/README.md` indexes 0001–0019 and this PR adds no row. That is the exact defect tracked as `task-adr-readme-index-missing-adr-0020` ("Every ADR file in the directory has an index row (sweep the whole dir, not just 0020)"), filed while reviewing PR #598. Add the row in the renumbering commit.

---

## Non-blocking findings

**N1 — the `doctor` `friction` block is owned by two tasks.** `task-friction-surface-parity-and-docs` (T5) claims `doctor --json` gains `friction: { triggerPresent, triggerVersion, current, files }`; `task-friction-trigger-carrier` (T6) claims `doctor --json` reports `triggerPresent`/`triggerVersion` "(with task-friction-surface-parity-and-docs)". Same deliverable, two owners, not disclosed — and it is the exact piece under review. Give it one owner.

**N2 — the compliance spike is unrunnable _and_ claimable.** ADR 0020 §1 Stage 2 ("reached only after the compliance spike measures real trigger firing") and the spike own AC (`doctor --json` `friction.triggerPresent` is recorded) require the trigger to exist — i.e. T6 — yet `task-spike-friction-trigger-compliance` carries **no `depends_on`**, so it is claimable today, before `arggon friction` even exists. Its sibling spike (`volume-threshold`) _does_ declare `depends_on`, so this is an omission. Minimum fix: `depends_on: [task-friction-trigger-carrier]`.

**N3 — internal inconsistency across containers.** `story-adopter-feedback` ticks "[x] The decision is recorded as an ADR (carrier change is **behavioral**)"; the epic `reverse-feedback-channel` leaves "[ ] An ADR settles the cross-cutting decision and the spec passes `arggon spec analyze` with no NEW findings" unticked; the ADR itself claims `Accepted`. All three land in one PR. Reconcile: either tick the epic box (the worker claims the analyze gate is met) or split it into "ADR written" / "ADR accepted", so the epic does not contradict the ADR own status.

**N4 — duplicated H1 in all 10 touched items.** Each file now carries the create-template H1 _and_ a second one the worker appended (`adopter-feedback.md`, `reverse-feedback-channel.md`, `story-adopter-feedback.md`, `task-explore-adopter-feedback-channel.md`, and the 9 leaves). In the story the two H1s even disagree: `# Adopter friction channel: capture, dedupe, human-gated publish` (template) vs `# Adopter feedback channel: friction capture, dedupe, human-gated publish` (added). Delete the added H1s.

**N5 — the item body "still broken, deliberately not touched" note is stale on both items it names.** `368809d5` ("fix 4-level doc link prefix in two adopter-feedback items") fixed `bug-prettier-glues-split-inline-code-span.md` on main, and `bug-contributing-github-issue-contradiction.md` was rewritten by the #594 fix and no longer contains a 4-level link. The PR documents as broken two things main already fixed/closed.

**N6 — minor spec/exploration inconsistencies.** (a) The exploration concurrency row resolves with "`O_EXCL`-style create"; the spec and T1 specify `O_APPEND` on an existing append-only log — pick one (the AC, "two concurrent writers… non-interleaved lines", is the real gate and is testable). (b) Rotation past 5000 lines appears in both `task-friction-capture-command` and `task-friction-dedupe-and-report`; the dedupe copy says "(test; shared with …)", which is honest, but pick an owner.

---

## Scope calls (coordinator decides; my recommendation)

**4a · `doctor` gains a `friction` block — keep it, but re-justify it and re-own it (one task).**
The ADR stated reason is weaker than it reads. `cli/src/doctor.ts:649-692` iterates `config.generated`, re-renders the **current** template and reports `outdated` for _every_ local state — untouched, modified, **acked** and acked-drifted — with the paths in `outdatedDocs` (`doctor.ts:74-77`) and a human hint pointing at `arggon init --dry-run` (`doctor.ts:856-861`). And the generated agent files _are_ in that map: `cli/src/init-opencode.test.ts:413-414` asserts `config.generated[".opencode/agents/arggon-coordinator.md"].template === "docs/opencode/agents/arggon-coordinator.md"`. So merely editing `templates/docs/opencode/agents/arggon-worker.md` already makes the trigger absence show up as an outdated managed doc. **"the channel is not live here" is not invisible today.**

What the dedicated block uniquely buys is narrower and still real: (i) per-file `triggerVersion`, so "trigger present at 0.5.0" is distinguishable from "current is 0.6.0"; (ii) separating _trigger absent_ from generic template drift — exactly the observable the compliance spike needs to tell "never seen" from "seen and ignored". Rewrite §2 to rest on those two, not on invisibility. If you want the minimal stage 1, the cuttable part is `triggerVersion`/`files`, not the block.

**4b · stopping at tier B — defensible, keep the boundary.**
`docs/agents.md:24` ("GitHub is for **PRs only**") and `:36` ("Do **not** open new GitHub issues") stay intact because tiers A/B never require `gh`, never write to GitHub, and the agent job ends at printing a prefilled URL a **human** opens; the spec Opt-out/Non-goals sections forbid any auto-submit path, and ADR 0020 §4 keeps the canonical record in-tree (`arggon create`), so no second record is born. The dedupe value is not lost either: stage 1 stable-fields fingerprint is what collapses this repo 10 known repeats, and what stage 1 gives up is only _upstream_ pre-search — the genuinely "automatic" part, correctly gated on measured volume + compliance. One thing to record rather than leave implicit: local-only dedupe cannot see an issue a human already filed upstream, so a re-filed class will be re-emitted. That belongs in the spec Limits criterion.

**4c · trigger-carrier last — right instinct, wrong slot, and the current graph is harmful.**
The stated rationale ("an agent file naming a command that does not exist yet is worse than no trigger") is satisfied as soon as **T1** lands the capture command — nothing in the trigger text needs T4/T5. But ADR 0020 makes the compliance spike gate stage 2 _and_ tier C, and that spike measures whether an embedded trigger fires. Todays ordering therefore delays the single most decision-relevant measurement until the entire chain (incl. skill copy + evals + README/convention docs) is done, while N2 leaves the spike claimable in the meantime. Minimum fix: the `depends_on` edge. Better: split T6 — trigger block right after T1, skill/evals/parity docs after T5.

---

## What I verified by reading

- **Exploration protocol compliance** (`skills/arggon-cli/references/exploration.md`): Phase 0 classification (greenfield, one-way ratchet); Phase 1 read-only stance; Phase 2 grounding in code/carriers/ADRs/labs/live `gh`+git data; Phase 3 all 8 frontier rounds logged in dependency order, and the one genuine unknown routes to a spike not a guess; Phase 4 **all 12 template dimensions present plus `adopter trust`, every row resolved** — mapped 1:1 into 13 spec ACs (13 hunted → 13 mapped + 3 extra: surfaces parity, carrier discipline, gates) or into non-goals, nothing "unknown"; Phase 5 three approaches + three set-aside, trade-offs, recommendation, artifact order, self-review; `Evidence gaps` section present and honest. Structure matches `templates/exploration-project.md`.
- **ADR does not silently overrule ADR 0016 or 0018.** Verified `agents.md:24,36` (§0), `:462-467` (impact-class rule, quoted accurately by ADR 0020 §2), `:579-586` (§Self-improvement loop holds only the two maintainer-side labs protocols — no existing channel to duplicate). ADR 0020 §2 defers to the ADR 0016 propose channel ("never by overwrite"); §3 `ARGGON_NO_FRICTION` mirrors ADR 0018 `ARGGON_NO_UPDATE_CHECK` opt-out and its "no phone-home beyond our own packument" line is consistent with ADR 0018 §3; §4 tier-C/CI rules do not contradict ADR 0018 "on CI the registry GET never runs" posture. Neither ADR is amended or contradicted — both would only gain a cross-reference.
- **Spec/plan structure** against `cli/src/spec.ts`: `spec_id`/`title`/`status: proposed`/`created` present; `## Purpose`/`## Synopsis`/`## Acceptance` all present (the validator three required sections, `spec.ts:157-176`); plan carries `plan_id`/`title`/`status`/`created`/`spec` with a resolvable `spec` path; ACs are verifiable and several are genuine discriminators (fixture A: one class ×3 with differing prose → one row `count: 3` fails if the fingerprint reads `narrative`; fixture B: near-identical prose, different `errorCode` → two rows fails if it over-merges).
- **ADR 0017 gate honored**: the ADR precedes the spec precedes the plan precedes the tasks in protocol order; all 6 implementation tasks and 3 spikes are `status: todo`, unclaimed, with no `branch`/`claimed_at` — no implementation task claimed before the spec exists.
- **Impact class honest**: the PR touches no carrier (`docs/agents.md`, `docs/engineering.md`, `docs/convention.md`, `skills/arggon-cli/**` are all absent from the diff), so **advisory** here with **behavioral** correctly deferred to T6 is right.
- **`x-friction` follows the established extension policy**: `convention.md:457-458, 471, 494, 514` ("unknown nested keys ignored; a scalar is a parse error") — T4 AC mirrors the existing `x-views`/`x-playbooks`/`x-tracker`/`x-import` contract, and T6 correctly schedules the `convention.md` doc.
- **State-dir claim grounded**: `ARGGON_STATE_DIR` exists (`lib/src/worktree.ts:1037`) and the per-OS state base is real (`lib/src/worktree.ts:1092-1103`: `XDG_STATE_HOME`/`~/.local/state`, `~/Library/Application Support`, `%LOCALAPPDATA%`).
- **Task hygiene**: all 9 leaves sit directly under `story-adopter-feedback` (confirmed via `arggon list --parent`; convention v5 forbids level-skipping); no duplicate of existing work — checked `story-self-improvement`/`task-telemetry-mining` (done, maintainer-side, explicitly untouched) and §Self-improvement loop; priorities `p1/p2/p3` consistent with the plan ordering. **Untestable acceptance: none found.** The two hygiene defects are N1 and N6(b), both ownership, not testability.
- **Smoke gate**: exempt — `engineering.md:94,140`, "docs-only PRs are exempt"; this diff is 18 `.md` files, zero runtime code. No probe evidence owed for behavior.

## Unverified (claims I could not check by reading)

`arggon validate` 0 warnings; `spec validate` 32 docs / 0 warnings; `spec analyze` 7 pre-existing findings and zero NEW across 19 specs; `npm run lint`; `prettier --check`; the primary-checkout-clean claim. The 32-doc figure is _arithmetically consistent_ with the branch (19 specs + 13 plans, after removing main methodology-adapters pair that post-dates the branch base), which is a point in the worker favour — but consistency is not evidence.

## Probes needed

1. `cd /home/arggon/Projects/ArggonManager && git merge-base origin/main origin/feat/task-explore-adopter-feedback-channel` → expect a base older than `448b31dc`; confirms how far behind the branch is. (I could run git plumbing except `merge-tree`, which permissions blocked.)
2. `cd /home/arggon/Projects/ArggonManager && git merge-tree $(git merge-base origin/main origin/feat/task-explore-adopter-feedback-channel) origin/main origin/feat/task-explore-adopter-feedback-channel` → expected: exactly one textual conflict, in `bug-contributing-github-issue-contradiction.md`; expected _not_ to appear: any conflict or duplicate notice for the four colliding identifiers. That is the proof B1 is silent and B2 is real. A different conflict set changes the fix list.
3. `cd /home/arggon/Projects/ArggonManager-task-explore-adopter-feedback-channel && npm run arggon -- spec validate` → expected: ok, 0 errors, 32 docs. After merging main, expected: ok, **34 docs** with **no** `SPEC_DUPLICATE_ID` — i.e. the validator passes on a repo holding two ADR-0020s, two `-018` explorations and two `-017` spec/plan pairs. That negative result is what makes B1 a review responsibility rather than a tooling catch.
4. `… && npm run arggon -- spec analyze` → expected: 7 findings, all pre-existing, zero NEW. Any NEW finding blocks the ADR 0017 gate and must be triaged before T1 is released.
5. `… && npm run arggon -- validate` and `npx prettier --check` over the 18 changed files → expected: clean.
6. After the renumber + rebase: re-run 3–5 and `git log --oneline -1 -- <bug-contributing…>` to confirm the branch no longer edits that item.

## Recommendation

**No merge as-is.** Fix B1–B4 (renumber all four identifiers to the next free ids with a `Numbering note`, rebase onto `origin/main` and drop the `done`-item hunk, ship the ADR as `Proposed`, add the README row), fold in N1–N6, then re-request review — the content should not need another architecture pass. Scope calls 4b and 4c stand as recommended; 4a stands with the §2 re-justification. Release `task-friction-capture-command` (T1) only after the renumber lands and probe 4 reports zero NEW findings; add `depends_on: [task-friction-trigger-carrier]` to the compliance spike before it becomes claimable.

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Coordinator decision on the reviewer's B1 (4 number collisions) — **the WORKER'S side renumbers, not mine.**

The collision is real and the root cause was mine: I wrote ADR 0020 (methodology-first productization) and accepted it on main before dispatching this worker, which independently wrote its own ADR 0020. Same for exploration `-018` and spec/plan `-017`.

Renumbering `origin/main`'s side would mean touching an ACCEPTED ADR and four artifacts that already reference it (the carriers from PR #592, README, `task-methodology-carriers`, the spec/plan pair). Renumbering the branch's side touches one PR that has not merged. So:

- ADR `0020-adopter-friction-channel.md` → `0024-adopter-friction-channel.md`
- `spec-friction-capture-017.md` → `spec-friction-capture-018.md`, `plan-friction-capture-017.md` → `plan-friction-capture-018.md`
- `exploration-adopter-feedback-channel-018.md` → `exploration-adopter-feedback-channel-019.md`
- every internal reference: frontmatter `spec:`/`planTask:`, the exploration's Decision link to its ADR, the spec's link back, the plan's link back, any cross-reference in the item body and the 6 tasks + 3 spikes

Also required before this merges, from the reviewer's remaining findings:

- **B2** the PR rewrites a `done` item: `bug-contributing-github-issue-contradiction.md` was fixed and closed on main after this branch's base, and the branch's copy is `status: todo` with unticked boxes. Rebase onto main and take main's copy for that file (it is NOT this PR's item).
- **B3** the ADR ships `Status: Accepted` pre-merge, against `engineering.md` §ADR process and the repo's own two-step precedent → ship it `Proposed`.
- **B4** add the new ADR's row to `docs/adr/README.md`. Note the parallel finding already filed as `task-adr-readme-index-missing-adr-0020` (now merged) added a PARITY TEST that asserts every ADR file has exactly one index row — so the new ADR must be indexed in this same PR or that test fails.

And the two scope calls the reviewer ruled on, which you should carry into the ADR: keep the `doctor` `friction` block but re-justify it on the grounds that actually hold (per-file `triggerVersion` plus separating "trigger absent" from generic template drift — `doctor.ts` already re-renders templates for acked entries too, so `outdated` alone does not give it) and stop claiming it is claimed by both T5 and T6; and name in the spec that local fingerprint dedupe cannot see an already-filed upstream issue, which is the honest boundary of stopping at tier B.

`bug-spec-analyze-does-not-detect-duplicate-doc-numbers` has MERGED, so `arggon spec validate` / `spec analyze` will now catch any residual collision — use them as the check rather than by eye.

### 2026-10-03 @ses_f01435336ffeYS4KAJmBnNqG2k

**request-changes addressed: B1–B4 + N1–N6 + both scope calls. Branch pushed (no force). Item left `in_progress`.**

## Renumber map (old → new)

| Old                                                       | New                                           |
| --------------------------------------------------------- | --------------------------------------------- |
| `ArggonManager/docs/adr/0020-adopter-friction-channel.md` | `0021-adopter-friction-channel.md`            |
| `spec-friction-capture-017.md`                            | `spec-friction-capture-018.md`                |
| `plan-friction-capture-017.md`                            | `plan-friction-capture-018.md`                |
| `exploration-adopter-feedback-channel-018.md`             | `exploration-adopter-feedback-channel-019.md` |

Every internal reference follows: `spec_id` / `plan_id` / `exploration_id`, the plan's `spec:` path, the exploration's Decision link to its ADR, the spec + plan back-links, the item body, all 9 leaves, both containers, and the epic's Acceptance links. The ADR carries a `Numbering note` per the ADR 0016 / ADR 0019 precedent.

**Residual duplicate-number findings: exactly 5 — all pre-existing, none mine.**

| #   | Pair                                                                              |
| --- | --------------------------------------------------------------------------------- |
| 1   | `exploration-cheap-path-to-prod-001` ↔ `exploration-token-context-efficiency-001` |
| 2   | `spec-deps-001` ↔ `spec-sync-001`                                                 |
| 3   | `spec-release-pipeline-015` ↔ `spec-update-channel-015`                           |
| 4   | `plan-deps-001` ↔ `plan-sync-001`                                                 |
| 5   | `plan-release-pipeline-015` ↔ `plan-update-channel-015`                           |

That is precisely the five `task-renumber-colliding-doc-numbers` enumerates. **Proof that none are mine:** `spec analyze --baseline` was filtered for my four filenames and returned nothing, and each of my numbers is unique in its directory (ADR 0021 → 1 file, spec/plan 018 → 1 each, exploration 019 → 1). I did not touch the other five — they are not mine to renumber.

## B2 — the `done` item

`bug-contributing-github-issue-contradiction.md` **no longer appears in the branch diff at all**; the branch copy is byte-identical to main's (`status: done`, assignee, branch, ticked boxes, fix evidence, approve verdict).

**I also checked the other direction you asked about, and found one more item.** `bug-prettier-glues-split-inline-code-span.md` — my branch's copy was _older_ than main's: it carried the broken four-level link prefix while main had already fixed it in `368809d5`. So my branch would have **reverted main's fix**. The merge took main's newer copy and the file is now correct. That is the second B2-class item, and it was not in the reviewer's list.

## Rebase vs merge — reporting, per instruction

I **merged `origin/main` rather than rebasing**, so no force-push was needed and the push was a clean fast-forward (`85c552cd..<head>`). Two reasons: `docs/agents.md` §0 mandates merge-don't-squash for PRs carrying tracker auto-commits, and a rebase would have required the force-push I was told to refuse. Nothing about the intent differs — the branch contains main and takes main's copy for the done item.

**One thing worth flagging: main moved twice while I worked.** My first merge predated PRs #605/#606, and at that point `git diff origin/main` showed `D cli/src/adapters.ts`, `D cli/src/adapter-selection.test.ts`, `M cli/src/cli.ts` — the branch would have **deleted main's new adapter-selection work**. I caught it by diffing against main after merging and merged again. Had I trusted the first merge, this PR would have reverted a merged feature.

## B3 / B4

ADR ships `Status: Proposed` with a `Status note` naming the two-step precedent. The epic box stays **unticked** with a note explaining why: the spec gate is met, the word _settles_ waits on acceptance, and ticking it would contradict the ADR's own status line (N3). ADR indexed in `docs/adr/README.md` — mandatory, since #602's parity test asserts one index row per ADR file.

## Scope call 4a — the correction, in the ADR

My earlier justification was **wrong and is now corrected in ADR §2**. I claimed the block was needed because a missing trigger is "otherwise invisible". It isn't: `doctor.ts` re-renders the current template for every `config.generated` entry in every local state including acked, and the OpenCode agent files are in that map, so editing the worker template already surfaces as `outdated`. I verified this against `origin/main` rather than taking the reviewer's line. The block's real value is narrower and still real: **per-file `triggerVersion`**, and **separating _trigger absent_ from generic template drift** — the observable the compliance spike needs to tell "never seen" from "seen and ignored". §2 now says that, and notes the cuttable part is `triggerVersion`/`files`, not the block.

## Scope call 4b — the honest boundary, in the spec

New acceptance criterion: local fingerprint dedupe collapses repeats **inside one log and nothing else**. It cannot see an issue a human already filed upstream, so a class already in the maintainer's tracker is re-emitted as "new" and may be filed twice. Recorded as a **deferred capability, not a postponed one** (upstream pre-search needs network + `gh` = tier C), and the report must state its dedupe scope is local-only and never imply upstream coverage.

## Other findings folded in

- **N1** — `doctor.friction` has **one owner: T6**. T5 keeps `arggon friction` surface parity plus the json-output rows, and both files now say which half each owns.
- **N2** — `task-spike-friction-trigger-compliance` now carries `depends_on: [task-friction-trigger-carrier]` (real frontmatter edge, not just prose).
- **N4** — duplicate H1s removed from the 5 files that actually had them (the reviewer's "all 10" overcounts; the 9 leaves I created each have exactly one).
- **N6a** — the exploration's concurrency row said `O_EXCL`-style create; corrected to `O_APPEND` with a dated note.
- **N6b** — rotation (the 5000-line cap) owned by T1; T3 only renders `dropped: N`.
- Also fixed a **stale item id** in the spec and plan: they referenced `spike-friction-trigger-compliance`, which resolves to nothing — the real id is `task-spike-…`.

## Comment history kept verbatim — deliberate, please overrule if you disagree

A comment records what was said on a date, so I did **not** renumber inside the dated comments — including the reviewer's own B1 evidence table, which would be _falsified_ by editing it (its "this PR" column would read as though the PR always had those names). Instead the item body gained a `## Renumber map` section stating the old→new mapping and that the older blocks intentionally still read "ADR 0020". The trade: a reader must consult the map to resolve an old label, in exchange for an unaltered record.

The one exception: link **targets** in the two files main owns were updated so nothing dangles after the rename — their records (status/assignee/branch/boxes) are untouched.

## Two of my own bugs found and fixed

1. **Broken epic links.** `../docs/` from `reverse-feedback-channel/` resolves to `adopter-feedback/docs/`, which does not exist — the correct prefix is two levels. Both links were mine and both would have dangled after the renumber. Every live-body link in the diff now resolves under an anchor-aware sweep.
2. **Prettier non-idempotence, twice.** My ticked-box continuations and the epic note were indented list paragraphs; prettier 3.9.6 grows their indent by two spaces on every `--write`, so `--check` fails on the file it just produced — the same class as `bug-prettier-glues-split-inline-code-span`, a different manifestation (indent growth, not span splitting). Both are now written as single-line bullets and converge across consecutive writes. **If the reviewer considers indent-growth a distinct defect from the tracked span-splitting bug, it is not filed** — I kept the diff tight. Say the word and I will file it.

## Gates on the merged tree

`build` ✅ · `test` ✅ **122 files / 2275 tests** · `lint` ✅ clean · `check:plugin` ✅ · `validate` ✅ ok (0 warnings, convention v5) · `spec validate` ✅ ok (34 docs, **5 warnings — all the pre-existing duplicates above**) · `spec analyze --baseline` ✅ **5 new, 1 resolved, 5 unchanged** — all 5 new are the known duplicates, **zero name my artifacts** · prettier ✅ clean **and idempotent**.

**Tracker-write check:** every mutation ran via `npm run arggon -- …` with the worktree as cwd; all three of this round's commits are on `origin/feat/task-explore-adopter-feedback-channel`; the primary checkout is on `main` and its unpushed commits belong to another session (`bug-prover-agent`), not to me.

### handoff 2026-10-03 @ses_f01435336ffeYS4KAJmBnNqG2k (session: ses_f01435336ffeYS4KAJmBnNqG2k) — next: Re-review PR #586: B1-B4 + N1-N6 + scope calls 4a/4b are in; 4 gates green, residual collisions are the known 5. Coordinator merges and flips ADR 0021 to Accepted.

- branch: feat/task-explore-adopter-feedback-channel
- open questions: Agree that dated comment history stays verbatim (renumber map in body instead)? File prettier indent-growth as distinct from bug-prettier-glues-split-inline-code-span? Cut doctor.friction to triggerV…

### 2026-10-03 @Reviewer

verdict: request-changes (narrow — B1–B4 and N1–N6 are verified closed; four small doc-consistency edits remain)

Round 2, read-only. Branch: `origin/feat/task-explore-adopter-feedback-channel` (head `389ed6de`), base `origin/main`. No gates re-run.

**Every round-1 blocker is closed and I verified each independently rather than accepting the claim. The exploration, ADR, spec, plan and nine leaves are all correctly renumbered, and the PR now touches zero files outside `ArggonManager/`.** What is left is four sentences of doc truth in artifacts that are about to become the implementation contract. This is the complete list — anything further belongs in a new item, not in a re-review of this PR.

---

## Verified closed (B1–B4, N1–N6)

**B1 renumber — closed, and the residual count is right.** ADR `0021`, `spec-friction-capture-018`, `plan-friction-capture-018`, `exploration-adopter-feedback-channel-019`. `git grep` for `adr/0020-adopter-friction-channel|friction-capture-017|adopter-feedback-channel-018` over the whole branch tree returns **hits only inside dated comments** (lines 253–326 are the 2026-10-02 worker comment and my own round-1 verdict) plus the intentional `Numbering note` / `## Renumber map`. Every live reference moved: `spec_id`/`plan_id`/`exploration_id`, the plan's `spec:` frontmatter, the exploration's Decision link, the spec and plan back-links, the story body, all nine leaves, both containers.

I re-derived the "exactly 5" claim myself by enumerating the numeric stems per directory in the branch tree, which is the same algorithm `docNumberCollisions` implements (`cli/src/spec.ts`, added in `f2e82e94` / PR #603, per-directory, report-only):

| dir          | colliding numbers                                                      | mine?       |
| ------------ | ---------------------------------------------------------------------- | ----------- |
| adr          | none — `0001`…`0021` all unique                                        | 0021 unique |
| explorations | `001` (`cheap-path-to-prod` ↔ `token-context-efficiency`)              | 019 unique  |
| specs        | `001` (`deps` ↔ `sync`), `015` (`release-pipeline` ↔ `update-channel`) | 018 unique  |
| plans        | `001` (`deps` ↔ `sync`), `015` (`release-pipeline` ↔ `update-channel`) | 018 unique  |

Five pairs, exactly the five named, **none of them mine**. The claim is accurate.

**B2 — closed, and the second instance was real.** `bug-contributing-github-issue-contradiction.md` is absent from the diff entirely. And the worker's own find is correct: `bug-prettier-glues-split-inline-code-span.md` **was** going to revert main's `368809d5` link fix — the merge took main's newer copy and the surviving 4-line diff does exactly two things (updates `-018`→`-019` on main's already-correct 3-level prefix, removes the duplicate H1). **I checked for a third instance and there is none**: the branch tree and `main` agree on every file, and the three-dot diff contains no `D` row at all.

**B3 — closed.** `Status: Proposed`, with a `Status note` naming the two-step precedent. No surviving claim of `Accepted` for ADR 0021 anywhere: README row says `Proposed`, the epic note says it "ships `Proposed` and flips to `Accepted` on merge", the handoff is future-tense.

**B4 — closed, and the row is correct, not merely present.** I checked it against each assertion in `cli/src/adr-index-parity.test.ts`: one row per file and same count ✓; target resolves ✓; four-digit gapless ascending with the row last ✓; row number == filename == the ADR's own `# 0021` heading ✓; **status class agrees** (`Proposed` in the row vs `Proposed` in the file) ✓.

**N1–N6 — all six closed.** T5 now carries an explicit ownership paragraph disclaiming the block's code/AC and naming T6 as sole owner; the spike has a real `depends_on: [task-friction-trigger-carrier]`; the epic box stays unticked with a note; exactly one H1 per file across all 15 items (`git grep -c "^# "`); the exploration's concurrency row now reads `O_APPEND` with a dated correction; rotation is owned by T1 and T3 only renders the counter. I also confirmed the bonus fix: `spec-friction-capture-018.md:236` and ADR 0021 use the real `task-spike-…` ids.

**Link sweep, mine.** I resolved every markdown link target in all 19 changed files against the branch tree. **No dangling link in any live body.** The only unresolved targets are the three old `…-017`/`0020-adopter-friction` links inside the dated 2026-10-02 comment and my own round-1 comment — covered by the verbatim ruling below.

---

## Must fix before merge (4 edits, all documentation consistency)

**M1 — the superseded 4a rationale survives in the normative spec and in T6, contradicting the ADR that now denies it.** ADR §2 says, in its own words, "Visibility is _already_ covered, and an earlier draft of this ADR overstated it." Two other docs are still that draft:

- `ArggonManager/docs/specs/spec-friction-capture-018.md` §_The trigger and its visibility_: "This is the direct application of \"a disabled capability nobody can see is absent\" … so **without this block the channel's absence is invisible**." The header paragraph two screens up still reads "and a `doctor` block so its absence is visible".
- `ArggonManager/adopter-feedback/.../task-friction-trigger-carrier.md` Context: "Without the `doctor` block, \"the channel is not live\" is invisible — the same failure ADR 0016 had to fix for docs **with the `outdated` bucket**." Self-refuting: it names `outdated` as the mechanism that already does it.

`docs/agents.md:458` — "If the change made any doc statement false, that doc edit belongs in this PR" — and `engineering.md:71` (no silent doc forks). The behaviour is specified identically everywhere; only the _why_ is false, and an implementer reading only the spec is invited to conclude the block is unnecessary, which is the one thing the coordinator's ruling protects against. Replace both paragraphs with ADR §2's reasoning (per-file `triggerVersion`; trigger-absent vs generic drift) and cite §2.

**M2 — T6's acceptance still carries the two-owner marker.** `task-friction-trigger-carrier.md`: "`doctor --json` reports `triggerPresent`/`triggerVersion` per managed agent file **(with `task-friction-surface-parity-and-docs`)**". T5's new text says the block is owned _solely_ by T6. The parenthetical re-creates the ambiguity N1 just closed — delete it.

**M3 — two stale item ids remain in the plan, one line below the one that was fixed.** `plan-friction-capture-018.md:89` says `spike-friction-tier-b-surface` and `:90` says `spike-friction-volume-threshold`; neither resolves (the prefix is `task-`, per each item's own placement comment). Line 87 in the same list was fixed and the response comment claims the class is fixed. These are bare code spans, which is why the anchor-aware link sweep missed them — same reason `validate` misses them.

**M4 — the item body still asserts two things the PR itself now knows are false.** In `## Recommendation (coordinator decision)` (body prose, lines ~145–180): (a) item 1 still reads "without this block \"the channel is not live\" is invisible"; (b) "**Still broken, deliberately not touched** … `bug-contributing-github-issue-contradiction.md` and `bug-prettier-glues-split-inline-code-span.md`" — both were fixed/closed on main. The request-changes section attributes (b) to "it lives in a dated comment"; that copy does live in a comment and correctly stays, but **this copy is the live body**, which is why the correction never reached it. Same edit class as M1.

Nit, take it or leave it: the story body still says "13 hunted dimensions → 13 mapped criteria"; the Limits dimension now carries two criteria, so the map is 13 + the local-dedupe boundary. `bug-prettier-indented-list-continuation-grows-2-spaces-per-write` also has no `priority`, unlike every sibling.

---

## Your four questions, ruled

**1 · Merge instead of rebase — right call, and it was the only in-policy option.** `docs/agents.md` §0 mandates merge-don't-squash for PRs carrying tracker auto-commits precisely because rewriting them causes the divergence this repo already paid for ("vencimientos merge #1 needed a manual `rebase --onto`"). The branch carries ~12 `chore(tasks)` commits whose shas are cited as evidence in item notes; a rebase would have rewritten every one of them, destroying those citations — and the shipped permission policy **denies** the force-push outright (`templates/docs/opencode.jsonc:50-52`: `git push --force*`, `-f`, `*+*` are all `deny`). Preserving the tracker commits without a gate override is the correct trade. The honest cost, which the worker named: a merged branch has main inside it, so the review lens must be `git diff origin/main`, never the three-dot PR view. That distinction is what caught question 2's hazard.

**2 · The `adapters.ts` deletion — resolved, and yes, a gate should exist, but not from this PR.** Verified: both `cli/src/adapters.ts` and `cli/src/adapter-selection.test.ts` are present in the branch tree and in `main`, and the three-dot diff has no `D` row and no row outside `ArggonManager/` — so this PR deletes nothing. The hazard the worker saw was real but was an artifact of a two-dot diff against a stale branch, not a merge this PR would have performed.

That said, the class is uncovered and it is worth naming: the existing protection is `npm test`/`build`, which fails only when a deletion breaks compilation or leaves an orphan test. The **silent** shape — deleting an implementation _and_ its test together — goes green, which is exactly what `D adapters.ts` + `D adapter-selection.test.ts` looked like. A cheap report-only gate would print `git diff --name-status origin/main...HEAD` deletions on every PR (the repo already ships `context:report` in that spirit) and warn when a `D` row removes a file whose paired test is also deleted. That is a behavioural change to CI, so it needs its own item and decision. **The worker did not file it**, and `docs/agents.md:31` + `engineering.md:214` require a deferred finding to be tracked, not just reported. Coordinator: that is one `arggon create bug` — no code, no round trip needed.

**3 · Prettier framing — right, and the gap is now precisely located.** Same class, two manifestations: both are prettier-3.9.6 markdown non-idempotence on continuation list items under `printWidth: 100` with `proseWrap` unset, and both surface as "the file `--write` just produced fails `--check`". Filing the second as its own bug under the same story is the right call, and the title is accurate.

"A single `--check` cannot prove convergence" is **correct and worth keeping in the record**: `--check` compares committed bytes against _one_ pass, so it catches "the author already committed two-pass output" but cannot detect that the one-pass output is itself unstable. Convergence needs a two-pass assertion (`prettier -w` twice, then require a clean tree).

The reason it bit twice here, which sharpens the filing: `cli/src/prose-format.test.ts` pins prose stability corpus-wide but **deliberately excludes the tracker item tree** (`ArggonManager/<initiative>/…` — "Item bodies are historical records that quote mangled formatter output as evidence"), while `npm run format` (`prettier -w .`) still writes over it. So the one subtree where both manifestations live is the one subtree with no gate, by design. A convergence assertion for that subtree is _not_ trivial — it must tolerate exactly the quoted-mangled-output bodies the exclusion exists for — which is why it belongs in the filed bug's scope and not here. **Ruling: add "a two-pass convergence assertion for the tracker item subtree" as an explicit acceptance criterion on `bug-prettier-indented-list-continuation-grows-2-spaces-per-write`** (or a sibling), noting the `prose-format.test.ts` exclusion interaction. Single-line bullets are the right immediate mitigation; keep doing that.

**Your open question — dated comments stay verbatim. Overrule refused.** All three reasons, and one boundary:

- **Verbatim: yes, for every dated comment block, including my round-1 B1 table.** `docs/agents.md` §0 makes comments the handoff channel and "history, not a reopen" — an append-only log by construction, with no body-editing API for comment text. Editing would falsify: at review time the PR genuinely carried `0020-adopter-friction-channel.md`, and that table's commit shas (`448b31dc` 13:06 vs `172af2fb` 19:36) are precisely the evidence that justified the coordinator's renumber ruling. Renumber it in place and the audit trail for that ruling ceases to exist. The repo's own precedent agrees: ADR 0016 was renumbered with an **additive** `Numbering note` + `Status note`, never a rewrite — which is exactly the `## Renumber map` pattern used here.
- **The boundary:** the same reasoning does _not_ extend to live item-body prose. Body sections are current state, not dated history. That is M1 and M4 — the comment copies of the 4a claim and the "still broken" note correctly stay; the body copies must be corrected. The worker's "it lives in a dated comment" reasoning conflated the two, which is how the body copies survived a round whose whole subject was correcting them.
- Practical consequence of the map-in-body choice: `arggon sync --json` reads this item and a future agent reads top-to-bottom, hitting the body first. A body that contradicts its own ADR is the failure mode the review bar exists to prevent; the map helps readers resolve an old _label_, but it cannot repair a body sentence that asserts something false.

---

## What I verified by reading (round 2)

Branch tree enumerated per docs directory against `docNumberCollisions`' own algorithm; `git grep` for every old identifier across the whole tree; a full markdown-link resolution sweep over all 19 changed files; `git diff --name-status` emptiness outside `ArggonManager/`; `adapters.ts`/`adapter-selection.test.ts` present in both trees; the ADR README row checked against each assertion in `cli/src/adr-index-parity.test.ts`; `templates/docs/opencode.jsonc:50-52` for the force-push denial; `cli/src/prose-format.test.ts` for the tracker-subtree exclusion; `cli/src/spec.ts` (`f2e82e94`) for the collision detector's scope and its report-only posture; `git grep -c "^# "` for H1 counts; the ADR index parity test's status-agreement rule, which has one consequence for the merge (see probe 4).

## Unverified

CI green on the head (tasks-validate, cli, ui-smoke) as reported; the worker's local `build`/`test` (122 files / 2275 tests) / `lint` / `check:plugin` / `validate` / `spec validate` (34 docs, 5 warnings) / `spec analyze` (5 new = the known duplicates, 1 resolved, 5 unchanged) / prettier-converged figures; and its claim that the primary checkout's unpushed commits belong to another session. I did not re-run any of them.

## Probes needed

1. `cd /home/arggon/Projects/ArggonManager && git diff --name-status origin/main...origin/feat/task-explore-adopter-feedback-channel` → expected: 19 rows, all `M`/`A` under `ArggonManager/`, zero `D`. This is also the command worth wiring into CI as the report-only gate for question 2's class.
2. After M1–M4 land: `npm run arggon -- spec validate` → expected ok, 34 docs, exactly 5 `DOC_NUMBER_COLLISION` warnings, none naming `0021`/`018`/`019`. And `npm run arggon -- spec analyze --baseline` → expected zero NEW.
3. `npx prettier --check` on the changed files **and** the two-pass assertion (`prettier -w` twice, then `git diff --exit-code`) → expected: the second pass changes nothing. `--check` alone is not sufficient evidence for this class (ruling 3).
4. **After the ADR 0021 status flip** — which the coordinator does on merge — `npx vitest run cli/src/adr-index-parity.test.ts` must be re-run. That test asserts the README row's status class agrees with the ADR file's own `- Status:` line, so flipping ADR 0021 to `Accepted` **without** flipping its README row turns `main` red. Flip both in one commit.
5. `npm run arggon -- create bug "<title>" --parent story-adopter-feedback` for the stale-branch-deletes-merged-code class (question 2), with acceptance covering the report-only deletions listing. Tracker write only — no code, no worker round trip.

## Recommendation

**No merge yet — M1–M4, then merge.** B1–B4 and N1–N6 are done and verified; the renumber is correct and complete; the PR deletes nothing; the ADR, spec, plan and tasks are internally consistent on numbering, ownership and dependency edges. The remaining four edits are the same class as the finding they close: a statement this PR knows to be false, in a doc the implementation will be built from. M1 and M2 exist because the 4a correction reached the ADR but not the spec or T6; M3 because the stale-id fix reached one of three lines; M4 because the verbatim-history reasoning (correct for comments) was applied to body prose. Once those land: merge, then flip ADR 0021 to `Accepted` **together with its README row** (probe 4), then release `task-friction-capture-command` (T1) — the compliance spike is correctly gated behind T6 and must not be claimed early.

### 2026-10-03 @ses_f01435336ffeYS4KAJmBnNqG2k

**Round-3 `request-changes` addressed: M1–M4, two commits, fast-forward push, no force. Item left `in_progress`.**

You were right that all four were one mistake, and right about the boundary. My round-2 response said the stale "still broken" note "lives in a dated comment" — that was the reasoning error, because the same claim also sits in **live body prose**, which is exactly what body-editing covers. I had conflated the two, which is why the body copy survived a round whose whole subject was correcting it. Dated comments stay verbatim; body prose is now correct.

## M1 — the withdrawn rationale, in the three places it survived

| Location                                                         | Was                                                                                                                            | Now                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spec-friction-capture-018.md` §_The trigger and its visibility_ | "without this block the channel's absence is invisible"                                                                        | ADR 0021 §2's reasoning, with the correction stated outright                                                                                      |
| same spec, header paragraph                                      | "a `doctor` block so its absence is visible"                                                                                   | "reports the trigger's per-file `triggerVersion` and distinguishes _trigger absent_ from generic template drift"                                  |
| `task-friction-trigger-carrier.md` Context                       | "Without the `doctor` block, `the channel is not live` is invisible" — naming `outdated` as the mechanism that already does it | `doctor.ts` re-renders every `config.generated` entry in every local state **including acked**, agent files in that map → **not invisible today** |

All three now state the block's actual value — per-file `triggerVersion`, and separating _trigger absent_ from generic drift — and that the cuttable part under a minimal stage 1 is `triggerVersion`/`files`, **not** the block. Your M1 point about the reader is the one I want to underline: an implementer reading only the spec was being invited to conclude the block was unnecessary, which is the single thing the coordinator's ruling protects against.

## M2 — two-owner marker

Deleted. T6's acceptance now reads "Owned solely by this task; `task-friction-surface-parity-and-docs` documents the field but does not own or test it." T5's side was already correct, so the ambiguity N1 closed does not reopen.

## M3 — two stale ids

`spike-friction-tier-b-surface` and `spike-friction-volume-threshold` → `task-spike-…`, both resolving. You were right about why the sweeps missed them: bare code spans, invisible to the anchor-aware link resolver and to `validate`. I ran the class across the **whole branch tree** rather than the plan alone — the only remaining bare mentions are inside dated comments.

## M4 — body prose, both claims

- The 4a invisibility claim in `## Recommendation` → ADR 0021 §2's reasoning.
- "**Still broken, deliberately not touched**" → **Known defect found — and now fully resolved**, with a dated correction naming that it was wrong on _both_ counts: the CONTRIBUTING bug was fixed and closed on main (PR #594), and the prettier bug was fixed in `368809d5`, where this branch's stale copy would have **reverted** that fix until the merge took main's copy.
- Also corrected the **round-2 N5 tick**, which had recorded the wrong rationale — that is the propagation of the same error into my own bookkeeping.

## Round-2 invariants re-verified after the edits

- **Residual duplicate-number findings: exactly 5**, none naming `0021`/`018`/`019`. `spec validate` ok (34 docs, 5 warnings) and `spec analyze --baseline` reports 5 new — all pre-existing pairs.
- **Zero dangling links** in any live body (anchor-aware sweep over all 19 changed files).
- **ADR 0021 is `Proposed` in all three places** — the file's `- Status:` line, the README row, and the epic note (future tense only). `adr-index-parity.test.ts` re-run: **7/7 pass**, status class agreeing.
- **Prettier convergent across repeated passes.** I did not accept a single `--check`: I snapshotted after pass 2 and diffed against passes 3 and 4 — **the second pass changed nothing**, and it stayed stable on pass 4. Worth noting my first attempt at this assertion was itself wrong (it compared against HEAD rather than pass-to-pass, so it reported "NOT CONVERGENT" purely because M1–M4 were uncommitted); the corrected comparison is above.

## Gates on the merged tree

`build` ✅ · `test` ✅ **122 files / 2275 tests** (build before test, as required) · `lint` ✅ clean · `check:plugin` ✅ · `arggon validate` ✅ ok (0 warnings, convention v5) · `arggon spec validate` ✅ ok (34 docs, 5 pre-existing warnings) · `spec analyze --baseline` ✅ 5 new / 1 resolved / 5 unchanged · prettier ✅ convergent · `adr-index-parity.test.ts` ✅ 7/7.

## Merge, not rebase

Merged `origin/main` first (it had moved), then edited, then pushed — `389ed6de..8b2c5e1b`, clean fast-forward, no force. Conflict resolution was a **union**: the item file carried the richer renumbered body, and the comment history is the union of both sides keyed by header — **8 blocks** (ours 7 + main's 4, 3 shared). Verified by count, so no comment block was replaced. Three-dot diff vs main: 19 rows, **0 `D`**.

## Your handoff note — carried, not acted on

Noted and added to my merge checklist: when ADR 0021 flips to `Accepted`, **the `docs/adr/README.md` row must flip in the same commit** — `adr-index-parity.test.ts` asserts status-class agreement, so flipping one alone turns `main` red. This PR keeps the ADR `Proposed`; the flip is yours on merge.

## Nits — declined, with reasons

- "13 hunted dimensions → 13 mapped criteria" **kept**: true as written. The Limits dimension gained a criterion (the local-dedupe boundary), but no dimension was remapped and the dimension count is unchanged — changing the number would misstate the exploration's Phase 4.
- `bug-prettier-indented-list-continuation-grows-2-spaces-per-write` already exists on main and is not mine to re-prioritise.

## One thing I did not do, deliberately — your call

Your question 2 / probe 5 (the stale-branch-deletes-merged-code class) is **not filed**. You addressed it to the Coordinator, and you are filing items on `main` concurrently, so filing it here would likely duplicate. But `docs/agents.md` §31 and `engineering.md` §214 require a deferred finding to be **tracked**, not merely reported — you flagged my earlier non-filing on exactly that ground, and the same rule applies to this one. Flagging it explicitly rather than quietly dropping it: **it needs one `arggon create bug` under `story-adopter-feedback`, and it does not exist yet.** Say the word and I will file it as a one-line tracker write.

### handoff 2026-10-03 @ses_f01435336ffeYS4KAJmBnNqG2k (session: ses_f01435336ffeYS4KAJmBnNqG2k) — next: Re-review PR #586: M1-M4 fixed in 2 commits (258bdfc9, 8b2c5e1b), invariants re-verified, fast-forward push. On merge flip ADR 0021 to Accepted AND its docs/adr/README.md row in ONE commit (adr-index…

- branch: feat/task-explore-adopter-feedback-channel
- open questions: Need one `arggon create bug` for the stale-branch-deletes-merged-code class (reviewer probe 5) - not filed, deferred to coordinator; file it? Keep '13 dimensions -> 13 criteria' wording?

### 2026-10-06 @Arggon
**Re-dispatch round: M1–M4 were already landed; a NEW blocker was found and fixed. Branch pushed (fast-forward, no force). Item left `in_progress`.**

## First, a correction to the dispatch brief

M1–M4 **were already closed** on the branch before this dispatch — commits `258bdfc9` (M1–M3), `8b2c5e1b` (M4), `5eeb61ba` (prettier converge), pushed by the previous round-3 agent. I verified each by reading, not by trusting the claim: the spec's §_The trigger and its visibility_ carries ADR §2's reasoning, the header paragraph says `triggerVersion`/drift, T6's Context states the `doctor.ts` `config.generated` re-render including acked, T6's AC reads "Owned solely by this task", the plan's two bare ids are `task-spike-friction-tier-b-surface` / `task-spike-friction-volume-threshold`, and the body's two false claims are both corrected. **No M-edit was needed.**

## The blocker the brief did not anticipate: a second renumber, forced

The brief says to take `main`'s ADR 0021 content and README row and not re-flip its status. **That is not possible as written: `main`'s `0021` is a different ADR.** While this branch was cold, `main` landed its own ADRs `0021` (agents-primary-workers-human-product-owner, accepted `171f43b3`/#624), `0022` and `0023`. So merging `main` produced **two ADR files numbered `0021`** — measured, not assumed:

```
npx vitest run cli/src/adr-index-parity.test.ts
Tests  3 failed | 6 passed (9)
  "numbering: position 22 is 0021, expected 0022"
  "numbering: position 23 is 0022, expected 0023"
  "numbering: position 24 is 0023, expected 0024"
```

That suite pins one index row per ADR file and gapless, strictly ascending, duplicate-free numbering. **Following the brief literally would have deleted this PR's entire decision record** (taking main's 0021 = the role-model ADR) or turned `main` red.

Renumbered, following the precedent the branch's own first Numbering note records ("the branch's side renumbers rather than main's, because renumbering main would touch an **accepted** ADR plus four artifacts that already reference it"):

| Was | Now |
| --- | --- |
| ADR `0021-adopter-friction-channel.md` | ADR **`0024-adopter-friction-channel.md`** |
| spec `018` | spec **`020`** |
| exploration `019` | exploration **`024`** |
| plan `018` | plan **`018`** (unchanged — `main`'s plans stop at `017`, never collided) |

`spec validate` caught the spec and exploration collisions too, which the ADR suite does not cover: `spec-friction-capture-018` vs main's `spec-promotion-policy-018`, and `exploration-adopter-feedback-channel-019` vs main's `exploration-agent-primary-workers-019`. I found the free ids by enumerating each directory on `origin/main` (specs top out at `019`, explorations at `023`). Additive `Numbering note` added, per ADR 0016 / 0019 precedent — nothing below it rewritten.

**`main`'s ADR 0021 did not regress.** `- Status: Accepted` and its row `Agents as primary workers, humans as product owner` are both main's, byte-identical; the conflict was resolved by taking main's table and prose wholesale, then adding only a `0024` row. `adr-index-parity.test.ts` now **9/9 green**, which asserts status-class agreement, so the probe-4 hazard is closed for real. **The `0024` row uses the verbatim H1 title**, not the old editorial one — main's `task-decide-adr-0021-index-title-editorial-vs-verbatim` shows main settled on verbatim for its own 0021, so I did not pre-empt that decision for a second ADR.

## Dated-comment boundary held

Live body prose renumbered to the new ids; **every dated comment left verbatim**, including the reviewer's round-1 B1 table. In this item that meant restoring three copies the bulk edit had touched: the `### 2026-10-03 @ses_f0143…` renumber-map row (now still reads `0021-adopter-friction-channel.md`), and the `ADR 0021` / `friction-capture-018` / `adopter-feedback-channel-019` labels in the comment zone. Live-body-only edits were done with a line-range-restricted `sed` (body = lines 1–371, comments from 372) rather than a whole-file replace. The body's `## Renumber map` is now a **three-label** map and says plainly which labels are superseded.

## One near-miss worth naming

A blanket `sed 's/friction-capture-018/friction-capture-020/g'` silently caught the **substring** inside `plan-friction-capture-018` and rewrote the plan's own `plan_id` and H1 to `020`. Caught by re-reading the plan's frontmatter after the sweep; reverted (`plan_id: friction-capture-018`, H1 `(friction-capture-018)`), while the plan's `spec:` pointer correctly stays `spec-friction-capture-020.md`. Worth flagging because the bulk edit looked clean in its own diff output.

## Gates on the merged tree

`build` ✅ (full `npm run build`, before any test) · `test` ✅ **130 files / 2761 tests, all passing** — matches main's current figures, and **the `cli.test.ts` stale-install failure did not reproduce** · `lint` not re-run separately (docs-only) · `arggon validate` ✅ ok, 0 warnings, convention v5 · `spec validate` ✅ ok (**36 docs, exactly 5 `DOC_NUMBER_COLLISION`, none naming `0024`/`020`/`024`/`018`**) · `spec analyze --baseline` ✅ **5 new, 1 resolved, 5 unchanged — zero name any of my artifacts** (all 5 are the known pre-existing pairs) · `npx vitest run cli/src/adr-index-parity.test.ts` ✅ **9/9** · `git merge-tree --write-tree --name-only origin/main HEAD` ✅ **exit 0, no conflict lines** · zero dangling links in any live body (anchor-aware sweep) ✅

**Doc count is 36, not the 34 in the dispatch brief** — `main` grew the corpus; the requirement that matters (no collision naming my artifacts) is met.

**Prettier two-pass convergence, not `--check`.** `prettier -w` pass 1 → pass 2 produced **zero** md5 changes, and pass 2 → pass 3 also zero. First attempt at this assertion was itself vacuous — the snapshot copy silently failed and the diff reported "No such file or directory" for every file, which I read as a failure and redid with per-file `md5sum`. `--check` alone is not accepted as evidence.

**PR shape preserved:** `git diff --name-status origin/main...HEAD` → **19 rows, all under `ArggonManager/`, zero `D`**. `opencode/plugins/arggon/index.bundle.ts` is byte-identical to `origin/main` (`git diff --quiet` clean) — carried in by the merge, untouched by me, as required.

## Deliberately left alone

ADR 0024 ships **`Status: Proposed`** with its `Status note`; no status flipped, no acceptance box ticked, PR not merged — all the delivery lead's calls. Main's own files referencing main's `0021` (about 40 rows across `agents.md`, `engineering.md`, `convention.md`, `claim.md`, the role-model tree and three other explorations) were **not** touched — they are a different ADR and rewording them would be a second, unrelated regression.

### handoff 2026-10-06 @arggon-maker — next: delivery lead to merge PR #586, then flip ADR 0024 to Accepted together with its docs/adr/README.md row in ONE commit (adr-index-parity.test.ts asserts status-class agreement), then release task-friction-capture-command (T1). Re-review the renumber: 0021 -> 0024 / spec 018 -> 020 / exploration 019 -> 024.

- branch: feat/task-explore-adopter-feedback-channel
- open questions: Does the delivery lead accept the forced renumber, or overrule it and take a different id? 0024 row uses the verbatim H1 title - confirm that rather than adding - Index title:, which pre-empts task-decide-adr-0021-index-title-editorial-vs-verbatim. Still-unfiled from earlier rounds: the stale-branch-deletes-merged-code class (reviewer probe 5).

### handoff 2026-10-06 @Arggon — next: Merge PR #586, then flip ADR 0024 to Accepted together with its docs/adr/README.md row in ONE commit, then release task-friction-capture-command (T1).
- branch: feat/task-explore-adopter-feedback-channel
- open questions: Accept the forced renumber (0021->0024 / spec 018->020 / exploration 019->024) or overrule the id? 0024 row uses the verbatim H1 - confirm rather than pre-empting task-decide-adr-0021-index-title-edi…
