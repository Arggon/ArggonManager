# 0010 OpenCode2 native architecture: portable kernel, native V2 surface

- Status: Proposed
- Date: 2026-09-18
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Research: [exploration-opencode-v2-native-009](../explorations/exploration-opencode-v2-native-009.md) (task-opencode-v2-proposal)
- Program: [spec-opencode2-009](../specs/spec-opencode2-009.md) · [plan-opencode2-009](../plans/plan-opencode2-009.md)

## Context

The product owner asked for a **complete refactor of ArggonManager** to adapt it
to OpenCode V2 and optimize it to the maximum inside that runtime, **keeping the
essence and the working method**: the git-native `tasks/` tracker as the single
source of truth, the claim → worktree → PR → review → merge → done loop, one
rules kernel shared by every entry point, and the methodology pipeline
(explorations, ADRs, specs, plans, playbooks, runbooks).

The research spike (exploration above, V2 docs accessed 2026-09-17, local
`opencode v2.0.7`) mapped every V2 capability against ArggonManager and found:
skills under `.agents/skills/` and `AGENTS.md` already integrate implicitly; the
generated `.mcp.json` is **unverified for V2** (V2 registers servers under
`mcp.servers`); V2 adds hooks, transforms, native commands and agents, session
utilities, compaction control and permission primitives that ArggonManager does
not use at all today; and several V2 features are documented but inert
(`instructions` config, agent `request` overlays, session sharing).

Constraints carried from [docs/engineering.md](../engineering.md): rules live in
one kernel (`cli/src/rules.ts`); no agent-only dialect; generated files never
overwrite and carry provenance; the dependency surface stays minimal; docs
travel with code; smoke evidence gates behavior changes.

## Decision

**Two layers, one logic path, no lock-in.**

1. **Portable core (unchanged contracts).** `tasks/`, the kernel, the CLI
   (human + `--json`), and the stdio MCP server remain the product and the
   single enforcement point. No OpenCode dependency is introduced anywhere in
   the core; CLI/MCP keep parity tests and remain first-class for non-OpenCode
   agents (Claude Code, Codex, CI).
2. **Native V2 surface (new, generated, zero-config, optional).** `arggon init`
   bundles a surface that OpenCode V2 discovers without configuration:
   - **Plugin** (vendored source in-repo, bundled to `.opencode/plugins/arggon/`
     with a generated marker and a byte-parity test, like the bundled skills).
     It contributes **ambient behavior only** — it never reimplements rules:
     MCP auto-registration when no `arggon` server is configured
     (`ctx.mcp.transform`, `editor.get` guard); session ↔ work-item correlation
     via `ctx.storage`, the VCS branch, and observed `arggon` invocations;
     bounded current-item context injected through `session.hook("context")`
     (naturally re-injected after compaction, since it runs per model call);
     optional tracker-hygiene warning after shell commits; session rename to
     the item id when a claim is detected.
   - **Agents** (`.opencode/agents/`): `arggon-coordinator` (primary),
     `arggon-worker` (subagent), `arggon-reviewer` (subagent with the review bar
     encoded as permissions: edits denied, reads/tests allowed). V2 subagent
     nesting default (one level) matches the existing orchestration model.
   - **Commands** (`.opencode/commands/`): `/arggon-next`, `/arggon-start`,
     `/arggon-done`, `/arggon-handoff`, `/arggon-review`, `/arggon-status`,
     plus methodology entry points (`/arggon-spec`, `/arggon-adr`,
     `/arggon-explore`, `/arggon-playbook`). Markdown prompt templates that
     drive the MCP tools; **no shell blocks with argument placeholders**
     (documented as running outside tool permissions).
   - **Skill**: `.agents/skills/arggon-cli` stays the single advertised skill,
     refactored for progressive disclosure (`references/` supporting files) so
     operational detail loads on demand instead of living in always-on prose.
   - **Config seam**: a root `opencode.jsonc` generated **only when the adopter
     has no OpenCode config** (root or `.opencode/`); it registers the MCP
     server, enables the formatter, and sets a sane compaction retention. When
     a config exists, `arggon doctor` reports the stanza instead.
   - **AGENTS.md**: slimmed to a router (essence + pointers), with operational
     detail moved into the skill.
3. **One logic path.** Every state transition still goes through the kernel:
   the plugin shells out to the CLI (`execFile`, argument arrays, `--json`
   envelopes) or calls MCP; native plugin tools are deliberately **not**
   duplicated in this program (revisit trigger: a proven MCP limitation).
   `_meta.sessionID` attribution is added kernel-side (MCP), benefiting every
   client.
4. **Version and packaging policy.** The vendored plugin is version-pinned to
   the V2 API it was built against, feature-detects optional surfaces, degrades
   gracefully (a plugin failure must never block the CLI/MCP), and is upgraded
   by re-running `arggon init` under the existing provenance semantics. A
   published npm plugin package is **deferred**; revisit when third-party
   repos need `opencode plugin add` upgrades without a local checkout.
5. **Waves.** W0 foundation (this ADR, spec, plan), W1 declarative seam, W2
   plugin core, W3 session context, W4 orchestration, W5 methodology commands,
   W6 context measurement, W7 dogfood + release. Each wave ships value alone.

## Consequences

- **Positive**: every V2 primitive that matters is used where it is strongest
  (hooks for ambient context, agents/commands for workflow entry points, skills
  for progressive disclosure, MCP for the tool surface); adopters get a
  zero-config native experience; the same tracker and rules keep working for
  every other agent; context spend per session drops because detail moves from
  always-on instructions to on-demand skills and per-item injection.
- **Negative / accepted risks**: a second surface to maintain (mitigated by
  generation + parity tests + provenance, not by hand-copying); V2 API churn at
  2.0.x (mitigated by pinning, feature detection, graceful degradation, and a
  recorded revisist trigger); vendored copies in adopters are upgraded only by
  re-running `init` (accepted until npm publishing is justified).
- **Neutral**: the plugin is optional by construction; ACP, desktop and web
  clients inherit the surface without extra work; inert V2 features
  (`instructions` config, `request` overlays, sharing) are documented as
  non-reliances, not used.

## Alternatives considered

- **Status quo (A)** — keep docs + MCP + skill only. Rejected: leaves the
  `.mcp.json` gap, no hooks, no native workflow entry points, no context
  injection.
- **MCP-only with generated config** — rejected: gives tools but no ambient
  behavior (item context, session correlation, hygiene) and no zero-config
  discovery.
- **Native plugin tools instead of MCP** — deferred: duplicates a
  parity-tested surface for no proven gain; revisit only if MCP limits appear.
- **Publish `@arggon/opencode-plugin` to npm now** — deferred: release/CI
  burden and a new top-level package before the surface proves stable.
- **In-process kernel import in the plugin** — deferred: requires publishing
  the core as a library; the CLI subprocess keeps one logic path with no
  packaging change.
- **SDK embedding (D) / OpenCode as a core dependency** — rejected for this
  program: inverts the dependency and breaks the cross-agent essence.
- **Rewrite the CLI as an OpenCode plugin only** — rejected: destroys the
  portable core, MCP parity and cross-agent support, the repo's stated essence.
