# 0024 Adopter friction channel

- Status: Accepted

> Numbering note (2026-10-06): renumbered a second time, `0021` → `0024`, for the same reason as the first time and under the same precedent. This PR was cut before `0021`, `0022` and `0023` landed on `main`; `0021-agents-primary-workers-human-product-owner.md` (accepted in `171f43b3`, PR #624), `0022-decline-autoharness-autocontext-autocompact.md` and `0023-ci-wall-clock.md` now occupy those ids, so merging `main` would have produced two ADRs numbered `0021` and turned `main` red — `cli/src/adr-index-parity.test.ts` pins one index row per ADR file and gapless, strictly ascending, duplicate-free numbering, and failed on exactly that after the merge. The branch's side renumbers again for the reason recorded below: renumbering `main` would touch an **accepted** ADR plus the artifacts that already reference it. Decision content unchanged; nothing below this note is rewritten.
> Numbering note (2026-10-03): originally filed as `0020-adopter-friction-channel.md` in collision with `0020-methodology-first-productization.md` (landed earlier on main, PR #592, accepted in `ecedac02`). Renumbered to the next free id on the coordinator's decision; the branch's side renumbers rather than main's, because renumbering main would touch an **accepted** ADR plus four artifacts that already reference it. Decision content unchanged. Same precedent as ADR 0016 and ADR 0019.
> Status note (2026-10-03): shipped **Proposed**, per `docs/engineering.md` §ADR process ("Proposed in a PR → Accepted when merged (or explicitly recorded)") and this repo's two-step precedent — main's ADR 0020 landed `Proposed` and was accepted in a separate follow-up commit. Flip to `Accepted` on merge or in an explicit accept commit.

- Date: 2026-10-02
- Deciders: Gonzalo Arganaraz
- Input: [exploration-adopter-feedback-channel-024](../explorations/exploration-adopter-feedback-channel-024.md) (2026-10-02)

## Context

Every channel this product has is one-directional. The product reaches the
adopter (`init`, `init --propose`, `doctor`'s `outdated` bucket, `playbook
status --file-task`, the opt-out registry update check, the bundled skill, the
generated agents/commands) and **nothing comes back**. In an adopter repo,
`arggon create` files into _that repo's_ tracker and this project never learns.

The two existing friction protocols cannot see an adopter, because both are
maintainer-side, local and single-machine:
[adversarial-audit](../labs/adversarial-audit.md) and
[telemetry-mining](../labs/telemetry-mining.md). Both file through `arggon
create` into this repo. `telemetry-mining`'s own signature — "repeated identical
findings across repos → **systemic**, not local — file once, cite all repos" — is
precisely the rule that _wants_ a cross-repo view it cannot get. Duplicate
filing is a measured, live debt in this tracker: 10 items are repeat reports of
the same class.

The exploration validated the proposed mechanism ("instruct agents to open a
GitHub issue on friction") against code, docs and dated external precedent and
**refuted it on evidence**: `deftai/directive#3633` shipped a skill documented as
the sanctioned escalation route and it was missed by an agent that was actively
escalating and following the rule that pointed at it — the friction was
"absorbed into the session", which is silent loss, i.e. worse than no channel
because it looks like success. It also fights `docs/agents.md` §0 (the first
section agents read), and its output is the shape peers delete (OpenCode's
`duplicate-issues.yml` rejects "AI-generated walls of text"; `claude-code`
carries a 27.6% duplicate rate). Three projects independently converged on the
replacement architecture instead — local capture → redact before exit → dedupe →
**human consent gate** → publish — and `ce-ai`'s tiered output dissolves both
remaining objections, because the agent's job ends at emitting a **prefilled
`issues/new?title=…&body=…` URL** that a human clicks.

What is left open by the exploration is exactly what an ADR settles: how the
carrier change reaches adopters, what the opt-out means, and where the hard line
sits.

## Decision

### 1. Architecture: four pieces, staged, never a new tracker

`arggon friction` appends a bounded, structured record to a **local, append-only
JSONL log outside the work tracker**, dedupes by a stable-fields-only
fingerprint, and renders a **redacted** report that a human acts on. Four
separable pieces: **trigger** → **capture** → **dedupe** → **publish**.

The single inviolable rule: **the friction log is not the tracker.** It never
becomes a task by accident, never commits, never stages, and never appears in
`arggon validate`. "The in-tree tracker is the system of record"
(`docs/agents.md` §0) stays true, and `friction` cannot become a back door into
it.

Rollout is staged on the ADR 0016 precedent:

- **Stage 1 (this spec's scope):** trigger + capture + dedupe + report, local
  only, plus tier-A (copy) and tier-B (prefilled URL) output. Needs no adopter
  opt-in, carries no privacy risk, and is immediately useful against this repo's
  10 known duplicate items.
- **Stage 2:** tier C (`gh`-mediated upstream pre-search and
  comment-on-existing), reached only after the compliance spike measures real
  trigger firing.
- **Stage 3:** anything automatic. **Not decided and not scheduled** — it needs a
  measured volume threshold, which is a spike
  (`task-spike-friction-volume-threshold`), and that spike's own answer may be
  "no automation; revisit only with data".

### 2. The carrier change is behavioral, and reaches adopters by proposal

The trigger is a rule agents must re-learn, so per `docs/agents.md` §Changing the
methodology itself this is a **behavioral** impact class: the skill and its
bundled copies stay byte-equal in the same PR, every doc statement the change
makes false updates in that PR, and adopters receive it through the ADR 0016
propose channel (`init --propose` → side file → normal work item), never by
overwrite.

Two consequences are settled here rather than left to implementation:

- **The trigger must live in the generated agent files, not only in a skill
  reference.** The `deftai` incident's lesson is that a capability in the wrong
  place is absent. `templates/docs/opencode/agents/arggon-worker.md` already
  tells the worker to report work it finds; the new text is the carve-out for
  friction in _ArggonManager itself_, which is not adoptable work.
- **`arggon doctor` grows a narrow `friction` block — for two specific reasons,
  not for visibility.** Visibility is _already_ covered, and an earlier draft of
  this ADR overstated it. `cli/src/doctor.ts` re-renders the current template for
  every entry in `config.generated` and reports `outdated` for **every local
  state — untouched, modified, acked and acked-drifted** (the
  `Object.entries(config.generated)` walk that fills `outdatedDocs`), and the
  generated OpenCode agent files are in that map (`.opencode/agents/arggon-worker.md`
  → template `docs/opencode/agents/arggon-worker.md`, asserted in
  `cli/src/init-opencode.test.ts`). So editing the worker template already makes
  "the trigger is not here yet" show up as an outdated managed doc.
  **`outdated` does not retire this block; it simply is not the argument for it.**
  What the block uniquely buys is:
  1. **a per-file `triggerVersion`**, so "the trigger is present at 0.5.0" stays
     distinguishable from "the current template is 0.6.0" — one boolean against a
     template that also moves for unrelated reasons cannot say which;
  2. **separating _trigger absent_ from generic template drift** — the observable
     the compliance spike needs to tell "never seen" from "seen and ignored",
     which is the distinction that decides whether stage 2 is worth building.

  If stage 1 has to be minimal, the cuttable part is `triggerVersion` and
  `files`, **not** the block.

### 3. Opt-out gates capture, never discoverability

Two keys, one meaning: `x-friction: false` in the tracker `.convention.yml`
(tree-wide, ignore-unknown per the extension policy) and `ARGGON_NO_FRICTION=1`
(per invocation, mirroring `ARGGON_NO_UPDATE_CHECK`). Opting out means records
are not written and `--report` is empty. It **does not** remove the trigger text
from the generated agent files and **does not** make the command undiscoverable:
an adopter who opted out and later wants the channel back must be able to find
it, and an agent that cannot see the rule cannot tell the user it exists. This
is the one place the exploration's own evidence overrides the usual
"respect the opt-out completely" instinct, and it is deliberate.

### 4. Hard non-goals

- **No automatic publication, ever, by the agent.** No tier auto-submits. Tier C
  requires an explicit human action _and_ a live `gh auth status`, never runs in
  CI, and never runs unattended. This is `subfloor#543`'s stated principle
  ("do not make automatic capture publish externally") and it is what keeps
  `docs/agents.md` §0 intact: **the agent never opens an issue; a human does.**
- **The tool never reads or processes inbound issue bodies.** Arggon therefore
  adds no new instance of the untrusted-input class behind CVE-2026-54316 /
  GHSA-wpqr-6v78-jr5g / Clinejection. Any maintainer-side automation that later
  reads these reports is consuming untrusted input and must say so.
- **No phone-home.** Capture writes one local file. The only outbound request is
  the existing opt-out packument GET plus tier B's URL, which a human opens.
- **Friction never enters the work tracker.** A report is input to a human
  decision; the resulting `arggon create` is the canonical record, exactly as
  every other finding in this repo.
- **The free-text narrative is data, never an instruction.** It is passed through
  verbatim, never parsed, never rendered as a directive.

### 5. The evals harness is not the capture vehicle — it is a producer

`skills/arggon-cli/evals/` + `EVALS.md` (18 scored cases, `run.mjs`) answers
"can an agent that reads only `SKILL.md` derive and run the right command
correctly". It runs against `dist/cli.js` in a **synthetic temp fixture** the
harness itself creates via `init`, scores pass/fail into stdout for a maintainer
to read, and never touches an adopter repo. Reusing it as the channel would put
capture back inside one machine's local test loop — the exact blind spot
`telemetry-mining` already documents — and its FAIL line is not a record.

What it _is_ is the best available **producer** of high-quality friction: an eval
FAIL is machine-derived, so its fingerprint fields (eval id, predicate,
expected, observed, command shape) are stable structured values rather than
LLM-authored prose — precisely the `{{ error.value }}` hazard Sentry's
fingerprinting rules warn about. Stage 2 may add an eval-FAIL producer that
appends one record per failed case. It must never auto-file, and wiring it into
CI to publish is forbidden by §4.

## Consequences

- A friction report becomes a human decision with a machine-prepared,
  already-redacted input, instead of an agent-authored issue that a peer's
  template check would close in 72 hours.
- The maintainer's attention budget becomes the design's primary optimization:
  the report is sorted by cross-adopter fingerprint count, so a class seen in
  three repos outranks three one-offs, and one-off noise is visible as such.
- Adopters take on a recurring duty: run `init --propose`, merge the trigger
  proposal, and re-run when `doctor` reports the trigger stale. Accepted — the
  alternative (auto-rewriting acked agent files) breaks the ack contract that
  makes adoption safe, the same trade ADR 0016 already made.
- The behavioral impact class requires the skill sources and their bundled
  copies to stay byte-equal in the same PR, and the PR description plus an item
  comment to state the impact class.
- Volume is unknown. Stage 2 and Stage 3 stay unbuilt until the compliance spike
  reports whether an embedded trigger fires more reliably than the `deftai` skill
  did; nothing above assumes an adopter ever runs the command.

## Alternatives considered

- **Instruct agents to open a GitHub issue** (the original proposal) — refuted
  on evidence in the exploration; see Context. Silent, authenticated, and
  §0-violating.
- **Human-only Issues + Discussions, no agent involvement** — kept as tier B's
  fallback surface, not the answer: it fixes the human's blocked door but
  generates no agent-shaped signal and leaves the duplicate-filing debt
  untouched.
- **Automatic rolling issue per fingerprint** (`ripple/xrpl-wasm-stdlib#311`) —
  proven, but a maintainer-side automation over one repo's own signals, and
  unattended publication is forbidden by §4. Revisit only as a maintainer-side
  aggregate once volume exists.
- **Phone-home telemetry at install/update time** — crosses the "no phone-home
  beyond reading our own packument" line, needs a server, and answers "how often",
  not "what broke".
- **Agent-side `AGENTS.md` patching** — accepted only as a fallback of last
  resort (the drift failure mode is documented in `tuna-os/mandelbrot#128`),
  never as the primary path.
- **Reuse the evals harness as the channel** — rejected in §5.
