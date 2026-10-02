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
[`exploration-adopter-feedback-channel-018`](../../../docs/explorations/exploration-adopter-feedback-channel-018.md).

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
- [x] Artifact written: [`exploration-adopter-feedback-channel-018`](../../../docs/explorations/exploration-adopter-feedback-channel-018.md),
      including an explicit "evidence gaps" section
- [x] `arggon validate` green; exploration ids/links resolve
- [x] **ADR written** settling the cross-cutting parts: the methodology-carrier
      change (**behavioral** impact class per `docs/agents.md` §Changing the
      methodology itself), opt-out semantics, and the explicit non-goal of
      automatic publication — [ADR 0020](../../../docs/adr/0020-adopter-friction-channel.md)
- [x] **Spec + plan written** from the edge-case table, then a clean
      `spec analyze` run — the gate that releases implementation tasks —
      [spec-friction-capture-017](../../../docs/specs/spec-friction-capture-017.md)
      (all 13 hunted dimensions mapped one-to-one onto its acceptance criteria)
      and
      [plan-friction-capture-017](../../../docs/plans/plan-friction-capture-017.md);
      `spec analyze` holds at the same **7 pre-existing findings**, zero NEW

## Recommendation (coordinator decision)

**Needs a spec — written, not filed for approval.** The reverse channel is real
and the exploration's verdict stands: the _instinct_ (adopters should be able to
send friction back) is load-bearing, the _mechanism_ (agent-opened GitHub
issues) is refuted by a named incident. What lands is stage 1 of ADR 0020:

`arggon friction` → local bounded log **outside** the tracker → stable-fields-only
fingerprint → redacted report → human-gated tier-A/tier-B output.

Two things the coordinator should know that were **not** in the prior research:

1. **`doctor` gains a `friction` staleness block.** An adopter that has acked its
   generated docs receives the trigger only as an ADR 0016 proposal, so without
   this block "the channel is not live" is invisible — the same failure ADR 0016
   already had to fix for docs. It is the `deftai` maxim ("a disabled capability
   nobody can see is absent") applied to a mechanism this repo already owns.
2. **The evals harness is ruled out as the capture vehicle** (ADR 0020 §5) and
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

**Known defect found; fixed where in scope, reported where not.** Item bodies in
this story linked docs with a four-level `..` prefix, which resolves one directory
above the tracker root and is **broken** — the correct depth from
`ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/`
is three levels, reaching `ArggonManager/docs/`. Fixed in this item and in all
nine items filed here, so the links this exploration chain depends on resolve.
**Still broken, deliberately not touched** (outside this item's scope — they are
other items' bodies): `bug-contributing-github-issue-contradiction.md` and
`bug-prettier-glues-split-inline-code-span.md`.

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

| Artifact | What it settles |
| --- | --- |
| [ADR 0020](../../../docs/adr/0020-adopter-friction-channel.md) | carrier change is **behavioral**; opt-out gates capture but never discoverability; automatic publication is a **hard non-goal**; the evals harness is ruled out as the capture vehicle |
| [spec-friction-capture-017](../../../docs/specs/spec-friction-capture-017.md) | all 13 hunted edge-case dimensions → 13 mapped acceptance criteria + non-goals |
| [plan-friction-capture-017](../../../docs/plans/plan-friction-capture-017.md) | T1–T6 with ordering and the spike list |
| 6 tasks + 3 spikes | filed under `story-adopter-feedback`, chained |

## Two things the prior research had not settled

**1. `doctor` gains a `friction` staleness block (ADR 0020 §2).** This is the finding I would most want a second opinion on. An adopter that has acked its generated docs receives the trigger only as an ADR 0016 `init --propose` side file — so without a doctor signal, "the channel is not live here" is **invisible**. That is precisely the failure ADR 0016 already had to fix for docs via the `outdated` bucket, and it is the `deftai` maxim (*"a disabled capability nobody can see is absent"*) applied to a mechanism this repo already owns. Cheap (compare a stamped marker), and it is what separates "the trigger was never seen" from "the trigger was seen and ignored" in the compliance spike. If the coordinator thinks this is scope creep, it is the piece to cut — everything else stands without it, but the channel then inherits the exact blind spot that sank the original proposal.

**2. The evals harness is the wrong vehicle, but the right producer (ADR 0020 §5).** `skills/arggon-cli/evals/` answers "can an agent reading only `SKILL.md` derive and run the right command" — it runs against `dist/cli.js` in a **synthetic temp fixture it creates itself**, scores pass/fail into stdout for a maintainer to read, and **never touches an adopter repo**. Reusing it as the channel would put capture back inside one machine's local test loop: the exact blind spot `telemetry-mining.md` already documents, and its FAIL line is not a record. What it *is* good for: an eval FAIL is machine-derived, so its fingerprint fields (eval id, predicate, expected, observed, command shape) are stable structured values rather than LLM-authored prose — which is the Sentry hazard the whole dedupe design turns on. Kept as a stage-2 producer that appends one record per failed case; it must never auto-file.

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
