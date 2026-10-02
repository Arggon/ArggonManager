---
exploration_id: adopter-feedback-channel-018
title: "Adopter feedback channel: capturing friction from adopting repos"
status: open
created: 2026-10-02
---

# Project exploration: Adopter feedback channel (adopter-feedback-channel-018)

Problem: every channel ArggonManager has is one-directional — the product
reaches the adopter (`init`, `init --propose`, `doctor` `outdated`,
`playbook status --file-task`, the opt-out registry update check, the bundled
skill, generated agents/commands, ADR 0016's proposal files) and **nothing
comes back**. In an adopter repo `arggon create` files into _that repo's_
tracker and this project never learns. The user's opening proposal — "an
instruction to open a new GitHub issue when an agent or subagent finds
friction" — was validated against code, docs and external precedent below. The
proposal is **half right**: the instinct (a reverse channel is missing) is
correct and load-bearing; the mechanism (agent-opened GitHub issues) is
refuted by a dated, named incident.

Investigated 2026-10-02 in code (`cli/src/`, `lib/src/`, `templates/docs/`,
`opencode/plugins/arggon/`) and docs (`docs/agents.md`, `docs/engineering.md`,
`docs/convention.md`, `docs/labs/*`, ADR 0016/0018, CONTRIBUTING.md), plus
external research (GitHub REST API, vendor docs, dated issue/PR reads).

## Classification

**Greenfield.** No existing flow to read; adopters — an unbounded external
population — will depend on the interface, and every methodology-carrier edit
propagates to them through `arggon init`. The six-phase protocol applies; the
ratchet only goes one way.

## Current mechanics (facts, not proposals)

**Local evidence.**

- `gh repo view` (2026-10-02): `Arggon/ArggonManager` is **public**, 0 stars,
  0 forks, **`hasIssuesEnabled: true`**, `hasDiscussionsEnabled: false`.
- `gh issue list --state all`: **21 issues, all CLOSED**, all created
  2026-09-03 → 2026-09-11 — exactly the pre-tracker era. The channel was used,
  then abandoned when the in-tree tracker landed and
  [`exploration-repo-visibility-011`](exploration-repo-visibility-011.md)
  recorded "issues enabled but unused (tracker is in-tree)".
- `npm run arggon -- --help`: **no command sends anything anywhere.** The only
  outbound network in `cli/src/`/`lib/src/` is the opt-out update check's single
  detached `GET registry.npmjs.org/arggon-manager/latest`; everything else is
  loopback (`board-serve`) or local.
- Two friction protocols exist, both **maintainer-side, local, single-machine**:
  [`docs/labs/adversarial-audit.md`](../labs/adversarial-audit.md) (attacks
  invariants + sweeps normative doc statements) and
  [`docs/labs/telemetry-mining.md`](../labs/telemetry-mining.md) (mines
  `~/.zcode/cli/log/*.jsonl` + one checkout's tracker history). Both file
  through `arggon create` **into this repo**. Neither can observe an adopter.
  `telemetry-mining.md`'s own cadence is "after each real-usage session or
  adoption experiment — **not on a timer**", and its "Repeated identical
  findings across repos → **systemic**, not local — file once, cite all repos"
  signature is the one rule that _wants_ a cross-repo view it cannot get.
- **Duplicate-filing is a measured, live pain in this tracker.** 10 items are
  repeat reports of the same class: `bug-torture-contention-flake2`,
  `bug-torture-contention-flake3` ("for the THIRD time (post-#214 hardening)"),
  `bug-spawn-sync-test-timeout-flake` ("2nd instance of the class"),
  `bug-ci-enotempty-rmretry` ("recurs even with rmSync retries"),
  `bug-autocommit-retry-budget-flake`, `bug-cli-spawn-suites-exit-1-flake`,
  `bug-spawn-lanes-load-flake`, `bug-row-table-flake`,
  `bug-tmp-fixture-leak`, `bug-start-install-ordering` ("five incidents across
  five sessions"). A dedupe key is not speculative value here; it is a debt
  this repo already pays.
- **The generated agents already carry the local half of the rule.**
  `templates/docs/opencode/agents/arggon-worker.md`: "reveals more work, report
  it to the coordinator instead of growing the diff"; the coordinator owns
  tracker decisions. But the coordinator's tracker is the **adopter's**, and
  nothing tells it that a defect _in ArggonManager_ is not adoptable work.
- `templates/docs/opencode.jsonc` denies exactly four shell patterns
  (`--no-verify`, force-push, `-f`, refspec `+`). No outbound-network policy
  exists, and none is needed for a design that never phones home.

**External evidence** (full source list at the end).

- **Arggon's in-tree-tracker doctrine is an outlier.** 10 surveyed peers
  (`anomalyco/opencode`, `anthropics/claude-code`, `Aider-AI/aider`,
  `OpenHands/OpenHands`, `aaif-goose/goose`, `cline/cline`,
  `continuedev/continue`, `RooCodeInc/Roo-Code`, `SWE-agent/SWE-agent`,
  `agentsmd/agents.md`): **0 of 10** use an in-tree tracker as the system of
  record. **0 of 10 disable GitHub Issues.** The de-facto split is consistent:
  _bug → structured issue form_ (enforced `blank_issues_enabled: false`),
  _feature → Discussions for voting_, _question → off-repo chat_. That is
  evidence about the category, not a mandate to abandon the doctrine — but it
  means Arggon has no category default to fall back on and must own the
  decision.
- **Instruction-only upstream escalation fails silently, with a named
  incident.** `deftai/directive#3633` (2026-08-23) shipped a
  `deft-directive-feedback` skill described as "the sanctioned route for a
  consumer agent to escalate a framework gap upstream". It was **missed by an
  agent that was actively escalating and following the rule that pointed at
  it**. Three stacked causes: a policy flag defaulted `false`; the skill was
  absent from the host's skill-discovery inventory; the `REFERENCES.md` index
  the managed `AGENTS.md` told agents to scan "before improvising" was never
  deposited. Post-mortem wording: _"the escalation path was missed by an agent
  that was actively escalating, and following the rule that tells it to"_ and
  _"the friction is absorbed into the session or into consumer-local notes"_.
  Author's maxim, directly load-bearing here: _"A disabled capability that
  announces itself is a prompt to enable it. A disabled capability nobody can
  see is absent."_ That project also **defaulted the reverse channel off**,
  naming the cost: "session context, nudge budget, GitHub attention".
- **Instruction precedence across repos is unreliable.**
  `anthropics/claude-code#93077` (2026-09-09): the harness injected
  `Co-Authored-By` trailers "this replaces any earlier attribution guidance",
  overriding an explicit project `CLAUDE.md` prohibition. Arggon's proposal
  would make "never open GitHub issues" a **standing rule in the adopter repo**
  and then ask the agent to open one in a third-party repo — precisely the
  ambiguous case.
- **Shipped agent files drift out of sync with practice.**
  `tuna-os/mandelbrot#128` (2026-09-25, automation ran daily): the fork's
  inherited `AGENTS.md` still forbade all action. Directly relevant: Arggon
  ships generated coordinator/worker/reviewer files into every adopter repo.
- **The convergent architecture (3 independent designs, 2 shipped).**
  `mastepanoski/ce-ai#426` (**shipped** — `src/commands/report_bug.rs`,
  `src/source/bug_reporter.rs` on `main`), `chriscase/ContextDesk#325`
  (**shipped**, P0–P4), `jedbjorn/subfloor#543` (**declined**
  `not_planned`, but published the clearest architecture diagram). All three:
  capture **locally** → redact **before exit** → dedupe against upstream →
  **human consent gate** → publish. subfloor's stated principles: _"Whitelist
  metadata rather than redact arbitrary transcripts"_, _"Keep bundles local and
  gitignored with bounded retention/rotation"_, _"Public GitHub submission
  always requires explicit Admin confirmation"_, and **"Do not make automatic
  capture publish externally."**
- **ce-ai resolves the two objections that looked fatal.** Its escalation is
  **tiered**: **(A)** copy the sanitized report — always works, no `gh`, no
  auth; **(B)** open a **prefilled `https://github.com/<repo>/issues/new?title=…&body=…&labels=bug` URL** — no `gh`, no auth, a human clicks submit; **(C)** optional `gh` connector. `--yes` is honored _only_ when `gh auth status` succeeds; otherwise it degrades to "installation guidance shown"; non-interactive **never auto-submits**, it prints the sanitized report + URL. ContextDesk adds a third tier (PAT in keychain) and the same three-tier ladder, plus "never auto-file without user click".
  **This dissolves both the auth objection and the doctrine conflict**: the
  agent's job ends at _emitting a redacted, prefilled URL_. The agent never
  writes to GitHub, so `docs/agents.md` §0 ("Do not open new GitHub issues") is
  never violated; a **human** submits, so §0's real invariant (one canonical
  record, never two) survives.
- **Sentry's fingerprinting rules carry a warning that lands exactly here**
  (docs.sentry.io, _Fingerprint Rules_): `{{ error.value }}` "can produce really
  bad groups when error values are frequently changing." **An LLM-authored
  friction narrative is exactly a frequently-changing value** — so the dedupe
  key must be built from _stable structured fields only_ (command shape, error
  code/class, harness, version), never from the human-readable text.
- **A rolling-issue-per-fingerprint precedent:**
  `ripple/xrpl-wasm-stdlib#311` (2026-09-24) runs `upstream-drift.yml` weekly and
  "opens / updates / closes an `upstream-drift` issue on real drift"; "a
  generator error fails the run without filing an issue." One label = one
  fingerprint = one rolling issue.
- **Big agent tools actively reject agent-shaped intake.**
  `anthropics/claude-code` maintains a `duplicate` label on **26,558 of 96,130**
  issues (**27.6% duplicates**). `anomalyco/opencode` runs an LLM on every
  incoming issue (`.github/workflows/duplicate-issues.yml`) whose TASK 1 is
  template-compliance and whose prompt hard-codes _"No AI-generated walls of
  text (long, AI-generated descriptions are not acceptable)"_; non-compliant →
  `needs:compliance` → 72-hour edit window → auto-close. Its own issue template
  says "avoid pasting giant AI generated summaries or your issue may be
  closed/ignored." `aaif-goose/goose` CONTRIBUTING: _"Please write the issue
  yourself. Your agent can do the research and help you explore, but you should
  understand the issue."_ **A verbose Arggon-authored friction body is the exact
  shape these automations were built to reject.**
- **Structured intake that does work.** GitHub Issue Forms YAML is the settled
  convention: `claude-code` runs six forms with title prefixes, auto-labels,
  required version/OS/model dropdowns, and a required preflight checklist
  ("I have searched existing issues and this hasn't been reported yet");
  `OpenHands` gates on a `ready-for-dev` label and requires an **Acceptance
  Criteria** field ("Testable, checkable bullets a reviewer can verify.
  Describe the _fixed_ state, not the bug") — which converges almost exactly
  with Arggon's existing acceptance-checklist doctrine.
- **Machine-parseable intake is supported, but not as YAML front matter.**
  `gh issue create --title/--body` is the documented non-interactive path;
  `title`/`body`/`labels`/`template` URL params prefill **any** Issue-Forms
  field; duplicate suggestions fire at ≥100 chars (max 3, non-blocking).
  **No evidence of any project parsing YAML front matter out of an issue
  _body_** — front matter is a file-format convention for Markdown in-tree, not
  a GitHub issue convention.
- **Privacy, with the honest caveat.** No documented incident exists of an
  agent leaking an _adopter's_ local paths into a _maintainer's_ issue tracker
  because of a report-friction feature. The closest structural match is
  **PixelLeak** (Help Net Security, 2026-09-30): 13,000+ internal screenshots
  from 300+ orgs across 900+ public repos, root cause _"GitHub's image upload
  for pull requests works only in the browser, and coding agents work from the
  command line… some agents posted them to public repositories"_ — reproduced
  by an agent reasoning _"Unable to attach screenshots from the private
  repository, the images had to be hosted elsewhere, so I created a new public
  repo"_. That is the failure **shape** (an agent that must convey evidence,
  finds no sanctioned channel, chooses public), not this exact trigger.
  Independently: GitHub issue bodies are machine-mined by secret scrapers
  within hours, publishing file paths, line numbers and SHAs verbatim (observed
  live: accounts auto-filing "leaked AI API key" issues; the _key_ is masked,
  the _paths_ are not). And a GitHub issue is, by design, reachable by
  unauthenticated strangers whose content may be consumed as instructions by
  CI agents — the class behind CVE-2026-54316 (Claude Code Action),
  CVE-2026-12537/GHSA-wpqr-6v78-jr5g (Gemini CLI, CVSS v4 10.0), and
  Clinejection (2026-08: one malicious issue **title** → cache poisoning → npm
  credential theft).

## Frontier-rounds log

- **Round 1 — outcome/users.** Who is the sender? An _agent_ inside an adopter
  repo that has never heard of this tracker, carrying Arggon's own §0
  prohibition. Who is the receiver? A **solo maintainer** (0 forks, 1
  collaborator) who already defaults reverse channels off elsewhere and is
  quoted naming the cost as "session context, nudge budget, GitHub attention".
  Settled: the receiver's attention budget is the scarcest resource in the
  system, so the design's primary optimization is **signal per unit of
  maintainer attention**, not capture volume.
- **Round 2 — scope/decomposition.** Decomposed into four separable pieces
  (they can ship independently): **(i) trigger** (make the agent stop working
  around it and record it), **(ii) capture** (structured, bounded, local),
  **(iii) dedupe** (fingerprint + upstream pre-search), **(iv) publish**
  (human-gated, tiered). Each is independently useful; (i)+(ii) alone already
  beats the status quo.
- **Round 3 — constraints.** From `exploration-open-source-agent-tooling-013`'s
  acceptance gates, which this repo already holds itself to: no hosted account,
  no remote database, no new runtime dependency, browser output is evidence and
  never tracker state, local-only reversibility. Plus
  `exploration-update-delivery-016`'s "opt-out registry check, no phone-home
  beyond reading our own packument". Settled: **the tool must never require
  `gh` or a token to function**, and **nothing may leave the machine without a
  human action**.
- **Round 4 — data.** The captured record is decided by the Sentry warning plus
  `telemetry-mining.md`'s existing signature list: **stable structured fields
  only** — `arggonVersion`, repo (redacted), os/arch, node, **command shape**
  (argv normalized: flags kept, paths and ids replaced with placeholders),
  **error class/code** (not prose), harness/agent id, session id, timestamp.
  The free-text narrative is captured but is **explicitly excluded from the
  fingerprint**. Bounded: every field capped, following the existing
  64/200/500-char cap conventions in `comment`/`handoff`/`cleanup`.
- **Round 5 — interfaces.** Three surfaces, in this order: `arggon friction`
  (CLI + `tools.arggon.friction` native + `arggon_friction` MCP — the tool
  surface must stay parity-tested per `docs/agents.md` §MCP), a local
  append-only log, and `--report` (render redacted). Publish is **not** a
  command: it is output the human acts on.
- **Round 6 — failure/edge.** The edge-case table below.
- **Round 7 — ops/security.** Redaction happens **before** the report is
  rendered, not at publish time (both PixelLeak-class incidents and the scraper
  observation say the same thing). Adoption of the `docs/labs` framing: audits
  and friction passes never patch the tool from the pass. Opt-out by config, and
  **the opt-out flag must not gate the trigger existing** (deftai's maxim).
- **Round 8 — rollout.** Stage it (ADR 0016 precedent): stage 1 ships the
  trigger + capture + report for the **maintainer's own machine** (immediately
  useful on this repo's 10 known duplicates, zero adopter risk); stage 2 ships
  publish as a tiered, human-gated output and enables the ADR 0016 proposal
  channel for the carrier edits; stage 3 — open question, needs a measured
  volume before deciding — is anything automatic. **"I don't know" (routes to a
  spike, not a guess): whether adopters will actually run the command.** The
  evidence says instruction-only compliance is insufficient (deftai) but says
  nothing about a command embedded in the agent files they already load.

## Edge cases

| Dimension                        | Hunted case                                                                                                                                           | Resolution                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| input validation / hostile input | A pasted command/evidence contains a credential, or an agent injects adversarial "instructions" into the body that a maintainer's CI agent then reads | Whitelist capture (stable fields only); token/secret/PEM redaction with cross-OS path-variant normalization (ce-ai's `\\?\`, `/private`, MSYS `/c/Users/…`, longest-first child-before-parent ordering); narrative is data, never an instruction — explicit non-goal to make the body agent-actionable                   |
| empty/loading/error states       | `friction` invoked with no observation, or `gh`/network absent                                                                                        | Empty body is a named error, not an empty report; **absent `gh` degrades to the prefilled-URL tier** and absent network degrades to the copy tier; neither is an error                                                                                                                                                   |
| concurrency / idempotency        | Two workers in two worktrees record the same friction; re-running `friction` with identical inputs                                                    | Append-only log + `O_EXCL`-style create; the fingerprint makes identical inputs idempotent by definition; concurrent writers never collide (the existing `commitTrackerMutation` lock does not apply — this log is **not** in the tracker)                                                                               |
| failure/retry/timeout            | Report generation fails mid-write; network hangs during upstream dedupe search                                                                        | Atomic write (tmp+rename, as the update-check cache already does); dedupe search is **best-effort with a hard timeout** and its failure is reported in the report as "dedupe: unavailable" — never silently treated as "not a duplicate"                                                                                 |
| authn/authz                      | No `gh`, no token, expired token, CI environment                                                                                                      | **No tier requires auth.** Tier A/C local; tier B is a URL a human opens; tier C requires a successful `gh auth status` or it degrades to B; **CI never auto-submits** (mirrors the update check's "on CI the GET never runs")                                                                                           |
| limits/quota/perf                | A noisy adopter floods the maintainer; report grows unbounded                                                                                         | Bounded fields; `maxObservations` per fingerprint per day; `perRepo` and `perRecipient` caps in the report; opt-out config. Maintainer attention is the scarce resource — the report is **sorted by cross-adopter fingerprint count**, not by arrival                                                                    |
| time/timezones/locale            | Non-ISO local timestamps; RTL/CJK titles in reports                                                                                                   | ISO-8601 UTC from the kernel clock; the report renders only the fingerprint count + stable fields; narrative is passed through verbatim and never parsed                                                                                                                                                                 |
| persistence/migration/rollback   | Log format changes between `arggon` versions; user wants to delete everything                                                                         | Append-only JSONL with an explicit `formatVersion`; readers must tolerate unknown trailing records; **one `arggon friction --clear`** removes the whole log; the log lives outside the repo by default so no migration is ever needed                                                                                    |
| observability/debuggability      | A report is rejected as unusable and nobody knows why                                                                                                 | `--report` states which optional signals were unavailable (`gh`, dedupe, version) rather than omitting them silently                                                                                                                                                                                                     |
| security/threat model            | (a) An adopter's agent uploads secrets; (b) a stranger's issue body reaches a maintainer's CI agent                                                   | (a) Redaction before render + whitelist capture; (b) **explicit non-goal: the tool never reads or processes inbound issue bodies**, so Arggon adds no new instance of the CVE-2026-54316 class. Any maintainer-side automation that reads these reports is out of scope and must be treated as consuming untrusted input |
| environment/platform             | Windows path forms, CRLF checkouts (this repo already has `bug-crlf-provenance-breakage`), sandboxed/air-gapped CI                                    | Cross-OS path normalization before redaction; the log is JSONL (no line-ending semantics); no network dependency in the capture path at all                                                                                                                                                                              |
| upgrade/data-loss                | An adopter upgrades and the new `arggon` cannot read the old log                                                                                      | `formatVersion` + tolerant reader; the log is cache-like, so worst case is "start fresh" — never a failure, never data the user authored                                                                                                                                                                                 |
| **adopter trust**                | An adopter's agent reports their _product's_ defects, or internal details, to a public tracker                                                        | The trigger fires **only** for friction in ArggonManager itself; the report is human-reviewed before it leaves; the default tier is copy-to-clipboard. Non-goal: any automatic publish                                                                                                                                   |

## Approaches considered

### Approach 1 — Instruct agents to open a GitHub issue (the original proposal)

Agent files and `AGENTS.md` gain a line: on friction, `gh issue create` against
`Arggon/ArggonManager`.

**Refuted on evidence, not taste.**

- The named incident: `deftai/directive#3633` — a _sanctioned_ escalation skill
  was missed **by an agent that was actively escalating**. Three causes, all
  discoverability (flag off, absent from inventory, index never deposited), and
  the failure is **silent** — the friction is absorbed into the session. Silent
  loss is strictly worse than no channel because it looks like success.
- The instruction fights Arggon's own carrier. `docs/agents.md` §0 — the first
  section agents are told to read — says unconditionally "Do **not** open new
  GitHub issues", and `CONTRIBUTING.md:13` says "GitHub issues are not used".
  `claude-code#93077` documents project-level instructions losing to harness
  defaults across repos. Ask an agent to carry rule A from repo X and violate it
  in repo Y and you have created an ambiguous instruction, not a channel.
- The output is the shape peers actively delete. OpenCode's
  `duplicate-issues.yml` closes non-template-conforming issues in 72h and
  explicitly rejects "AI-generated walls of text"; `opencode`'s own template
  warns such issues "may be closed/ignored"; `goose` asks for a human-authored
  issue. Claude Code carries a **27.6% duplicate rate** — 26,558 of 96,130.
- It requires `gh` + auth for the sender, breaking the standing acceptance gate
  "Local-only operation: no account, hosted API, or remote database required"
  (`exploration-open-source-agent-tooling-013`), and there is no native/MCP
  issue-creation tool in the 15-tool surface.
- It leaks. Public body, machine-mined within hours, paths/SHAs published
  verbatim. Adopters get no redaction, no consent gate, and no veto — the agent
  publishes the moment friction appears.

### Approach 2 — Human-only GitHub Issues + Discussions, no agent involvement

Turn on Discussions (currently off), keep Issues PR-only, point `CONTRIBUTING.md`
at them. Give humans a door; teach agents nothing.

Cheap and honest, and it fixes the one place a _human_ is stuck. But it does
not answer the question asked, generates no agent-shaped signal, and leaves
duplicate-filing (the 10 known items) untouched. **Keep as the complement, not
the answer.**

### Approach 3 — `arggon friction`: local structured capture → fingerprint → redacted report → human-gated tiered publish **(recommended)**

`arggon friction "<observation>" --command <shape> [--evidence <file>]` appends a
bounded record to a **local, gitignored, out-of-repo** log. It never touches the
work tracker, so it cannot become a task by accident and cannot violate "the
tracker is the system of record". Four separable pieces:

1. **Trigger** — generated into the **worker and coordinator agent files
   themselves** (not only a skill reference): friction in ArggonManager does not
   go in the adopter's tracker and is not silently worked around; record it.
   _Learning from deftai:_ the trigger must be where the agent already looks,
   and any opt-out flag must **not** gate the trigger being discoverable.
2. **Capture** — stable structured fields only (Sentry's rule); narrative
   captured but excluded from the fingerprint; every field bounded.
3. **Dedupe** — `fingerprint = sha256(command shape ‖ error class ‖ harness ‖
version-major)`, **never** from prose. Locally collapse repeats; before
   publish, best-effort upstream pre-search
   (`gh issue list --search <fingerprint>`) and emit "comment on the existing
   issue" instead of a new one. Address claude-code's 27.6% duplicate rate and
   this repo's own 10 known repeats head-on.
4. **Publish (human-gated, tiered)** — `arggon friction --report` renders a
   **redacted** report. Default tier A: print/copy. Tier B: a **prefilled
   `github.com/…/issues/new?title=…&body=…` URL** — no `gh`, no auth, human
   clicks. Tier C: `gh`, only with a successful `gh auth status`, never in CI,
   never unattended. Matches ce-ai/ContextDesk exactly and **keeps §0 intact**:
   the agent never opens an issue; a human does.

**Trade-offs.** It is more machinery than Approach 1 and depends on adopters
running a command (Round 8: unmeasured). It is the only option that produces
_deduplicated, redacted, aggregated_ signal — i.e. the only one that respects a
solo maintainer's attention budget. And its privacy property is structural
(redact before render, whitelist capture) rather than hopeful.

### Approaches considered and set aside

- **Automatic rolling issues per fingerprint** (`ripple/xrpl-wasm-stdlib#311`):
  attractive and proven, but it is a _maintainer-side_ automation over one repo's
  own signals, not an adopter→maintainer channel, and unattended publication is
  exactly what subfloor's "Do not make automatic capture publish externally"
  forbids. Revisit as a **maintainer-side aggregate** once volume exists.
- **Phone-home telemetry** (`init`/install-time anonymous counts): crosses the
  documented "no phone-home beyond reading our own packument" line, needs a
  server, and answers "how often" — not "what broke", which is the question.
- **Agent-side `AGENTS.md` patching**: accepted as a _fallback_ of last resort in
  `tuna-os/mandelbrot#128`, never as the primary path — drift is the documented
  failure mode.

## Decision

**Approach 3**, staged (ADR 0016 precedent), with **Approach 2 kept as its
tier-B fallback** and **Approach 1 explicitly rejected** on the evidence above.
Adopted by the maintainer 2026-10-02.

Decision record → [`task-explore-adopter-feedback-channel`](../../adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-explore-adopter-feedback-channel.md).
Cross-cutting decision → ADR: **not yet written**; the ADR should settle the
carrier change (methodology carrier edit = **behavioral** impact class per
`docs/agents.md` §Changing the methodology itself), the opt-out semantics, and
the explicit non-goal of automatic publication.

Artifacts, in protocol order: this doc → ADR → **spec** (the edge-case table
above becomes its acceptance criteria) → plan → tasks with `depends_on`. **No
implementation task may be claimed before the spec exists and `arggon spec
analyze` reports no NEW findings.**

Open questions that route to spikes, not guesses: does an embedded trigger fire
more reliably than the deftai skill did (measure on a real adopter); what volume
threshold justifies stage 3 automation (if ever); should tier B be Discussions
rather than Issues (semantically cleaner, weaker tooling).

## Sources

### Local (this repo, read 2026-10-02)

- `docs/agents.md` §0 (issue tracking), §Changing the methodology itself
  (behavioral impact class), §Orchestration, §Self-improvement loop;
  `docs/convention.md` §Hierarchy; `docs/labs/{adversarial-audit,telemetry-mining}.md`;
  `docs/adr/0016-adopter-upgrade-channel.md`; `docs/adr/0018-update-delivery-and-distribution-channel.md`;
  `docs/explorations/exploration-adopter-upgrade-experience-007.md`,
  `-repo-visibility-011.md`, `-update-delivery-016.md`,
  `-open-source-agent-tooling-013.md`, `-greenfield-exploration-015.md`;
  `CONTRIBUTING.md`; `templates/docs/opencode/agents/arggon-{worker,coordinator}.md`;
  `templates/docs/opencode.jsonc`; `cli/src/`, `lib/src/import-issues.ts`.
- `gh repo view` / `gh issue list --state all` on `Arggon/ArggonManager`;
  `npm run arggon -- --help`; `arggon validate` (ok, 0 warnings, convention v5).

### External (accessed 2026-10-02)

- Survey: <https://github.com/anomalyco/opencode>,
  <https://github.com/anthropics/claude-code>, <https://github.com/Aider-AI/aider>,
  <https://github.com/OpenHands/OpenHands>, <https://github.com/aaif-goose/goose>,
  <https://github.com/cline/cline>, <https://github.com/continuedev/continue>,
  <https://github.com/RooCodeInc/Roo-Code>, <https://github.com/SWE-agent/SWE-agent>,
  <https://github.com/agentsmd/agents.md>.
- Instruction-only failure: <https://github.com/deftai/directive/issues/3633>.
- Precedence: <https://github.com/anthropics/claude-code/issues/93077>.
- Agent-file drift: <https://github.com/tuna-os/mandelbrot/pull/128>.
- Convergent designs: <https://github.com/mastepanoski/ce-ai/issues/426>,
  <https://github.com/chriscase/ContextDesk/issues/325>,
  <https://github.com/jedbjorn/subfloor/issues/543>.
- Fingerprinting: <https://docs.sentry.io/concepts/data-management/event-grouping/fingerprint-rules/>.
- Rolling issue: <https://github.com/ripple/xrpl-wasm-stdlib/pull/311>.
- Anti-noise: <https://github.com/anomalyco/opencode/blob/dev/.github/workflows/duplicate-issues.yml>,
  <https://github.com/aaif-goose/goose/blob/main/CONTRIBUTING.md>.
- Intake mechanics: <https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue>.
- Privacy: <https://www.helpnetsecurity.com/2026/09/30/ai-coding-agents-github-screenshot-leak/>;
  <https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-coding-agent-cicd-secrets-20260808-csa/>;
  CVE-2026-54316, CVE-2026-12537 / GHSA-wpqr-6v78-jr5g.

### Evidence gaps (stated, not papered over)

- The research pass ran without `websearch`; coverage came from the GitHub REST
  API, `raw.githubusercontent.com`, DuckDuckGo HTML and vendor docs. GitHub
  _code_ search requires auth, so the `AGENTS.md` / `CLAUDE.md` corpus could not
  be surveyed systematically — the `deftai/directive` case may not be the only
  instance, merely the most detailed reachable.
- The three convergent designs are small-project work. They demonstrate
  **convergence and one working implementation**, not proven practice at scale.
  Treat the architecture as well-motivated and field-tested once.
- PixelLeak is a _structurally similar_ failure (no sanctioned channel → chose
  public), reached via secondary source; it is **not** an incident of this exact
  trigger. No such incident was found.
