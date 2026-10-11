---
type: task
status: in_progress
id: task-claude-adapter-spec
title: "Claude Code adapter: spec + story filing (plan T6)"
assignee: arggon-delivery-lead
branch: feat/task-claude-adapter-spec
parent: story-claude-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:58:50.239Z"
depends_on: [task-opencode-prompt-stamp, task-opencode-event-panel, task-zcode-goal-mode, task-zcode-automations]
worktree_path: /home/arggon/Projects/ArggonManager-task-claude-adapter-spec
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-adapter-spec.md
  Leaves live only under a story. id is the filename stem: task-claude-adapter-spec.
  CLI `arggon create task claude-adapter-spec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude Code adapter: spec + story filing (plan T6)

## Context

File the Claude Code adapter story with acceptance: plugin bundle (skills/agents/hooks/commands/MCP), marketplace manifest, headless smoke bar; no code in this wave

## Acceptance

Expanded from the plan's T6 one-liner ("story filed with checklist, linked from the spec; no code in this wave") into the checkable contract, per `ArggonManager/docs/agents.md` §5. The story body itself is the delivery lead's tracker write (drafted in the comment below), so its box is the one open item.

- [x] A spec exists at the next **free** number under `ArggonManager/docs/specs/` — `spec-claude-code-adapter-024.md`, scaffolded by `arggon spec new` (024 was free, not "last plus one"; `spec new` never overwrites) — implementing §S6 with Purpose, Synopsis, Invariants, Acceptance criteria, a failure-path table and named open questions
- [x] The spec carries the shipped role vocabulary (`arggon-maker` / `arggon-standards-reviewer`, never §S6's pre-rename `coordinator/worker/reviewer`), states which roles a Claude Code tree can express, and puts the delivery lead's contract on the generated `CLAUDE.md` → `@AGENTS.md` carriers — never a plugin-root `CLAUDE.md`, which Claude Code does not load as context
- [x] The spec names the honest starting floor in writing — the generated `CLAUDE.md` → `@AGENTS.md` pointer and the generated `.mcp.json` → `arggon mcp` registration — plus the three non-gap and two gap rows the floor carries today and the row deltas the bundle is expected to produce, and nothing more
- [x] The spec carries the layout decision explicitly: the bundle is `templates/docs/claude/**` → `.claude-marketplace/**`, mirroring the shipped ZCode seam; §S6's stale `adapters/claude/` is not propagated, and `adapters/` stays the capability matrix (read, not edited)
- [x] No implementation in this wave: the diff is docs + tracker only — one new spec file and one link-only edit inside §S6. No bundle, no adapter seam file, no `init` / `doctor` / `lib` / `cli` change, no capability-matrix edit
- [x] `arggon spec validate` and `arggon spec analyze` are clean with no NEW finding naming this item: baseline 4 findings across 23 specs → 4 findings across 24 specs, the same four, none naming this item, the new spec or `story-claude-adapter`
- [x] `arggon validate` is green and `npx prettier --check` is clean on both touched files
- [x] Impact class stated: this wave is docs-only and touches no methodology carrier, so no class applies; the implementation wave is **Behavioral** under `ArggonManager/docs/agents.md` §Changing the methodology itself (it edits `agents.md` and the bundled skill)
- [x] The ADR 0017 decision is stated, not assumed: a Claude bundle is a **bounded port of the shipped ZCode shape**, so no exploration artifact is owed — with the one-way ratchet named so a contradicting client shape stops the wave and files the exploration
- [x] `story-claude-adapter` carries the full acceptance checklist with a link to `spec-claude-code-adapter-024` so both directions resolve — the delivery lead's write (the story file has been a placeholder shell since 2026-10-02); the complete draft is in the comment on this item, and the spec → story direction already resolves

## Notes

### 2026-10-11 @arggon-maker
## Draft for the delivery lead: file `story-claude-adapter` (plan T6)

The story **already exists** as a placeholder shell (`status: todo`, parent `native-agent-adapters`, `created: 2026-10-02`, empty `## Context` / template `## Acceptance`). T6's "file the story" is therefore a **body write on the existing item**, not a `create` — no new id, no parent change. Drafted here because `arggon-maker` cannot file and `arggon` has no `--body` flag.

### Recommended frontmatter (unchanged)

- title: `Claude Code adapter (spec S6, follow-on)` — keep as is; it already matches.
- parent: `native-agent-adapters` — keep as is (it is the epic for the adapter stories).
- labels: `[]` is correct — no label this repo uses changes routing for this story.

### Story body to write (verbatim, into `## Context` + `## Acceptance`)

```markdown
## Context

Implements [spec-methodology-adapters-017 §S6](../docs/specs/spec-methodology-adapters-017.md)
through its follow-on spec,
[spec-claude-code-adapter-024](../docs/specs/spec-claude-code-adapter-024.md).
Contract: a Claude Code adapter as a **bounded port of the shipped ZCode seam**
(ADR 0014), carrying the post-rename role vocabulary
(`arggon-maker` / `arggon-standards-reviewer`; ADR 0021 §6.1/§6.2a′), with the
delivery lead's contract riding the generated `CLAUDE.md` -> `@AGENTS.md` carriers.
No implementation in the spec-filing wave (`task-claude-adapter-spec`).

Honest starting floor (what an `arggon init` tree already gives this client with
no bundle): the generated `CLAUDE.md` -> `@AGENTS.md` pointer and the generated
`.mcp.json` -> `arggon mcp` registration, per the `claude` row of
`adapters/capability-matrix.json`.

## Acceptance

- [ ] `templates/docs/claude/**` exists: marketplace catalog, plugin manifest, the two agent files, the command set, the hooks pair, the seam README; nothing is written under `adapters/**`
- [ ] `arggon init` materializes `.claude-marketplace/**` with provenance, never overwrites an adopter-edited file, and `--json` reports per-file `written`/`skipped` with honest counts
- [ ] `arggon init --agents opencode,zcode` and `--no-agents` do not generate the bundle; an unknown agent name is still refused by name with nothing written
- [ ] The generated tree contains exactly the agents `arggon-maker` and `arggon-standards-reviewer`; no file names a lead agent, and every lead reference resolves to the generated `CLAUDE.md`/`AGENTS.md` carriers
- [ ] Exactly one MCP server is registered, keyed `arggon`, byte-equal in `command`/`args` to the generated `.mcp.json` entry; a live stdio round-trip against a fixture tracker returns the documented envelope
- [ ] The gate denies force-push and `--no-verify` for every session and denies writes for the reviewer window opened by the reviewer's `SubagentStart` and closed by `SubagentStop`, counting parallel dispatches and clearing on `Stop`
- [ ] The gate's reviewer matcher is bound to the id read out of the shipped `agents/arggon-standards-reviewer.md`, and the review command dispatches that same id — the backstop cannot be disarmed by a rename
- [ ] `skills/arggon-cli/**` in the bundle is byte-equal to `skills/arggon-cli/**` modulo the generated marker (one skill, two destinations)
- [ ] `cli/src/init-claude.test.ts` covers every box above and passes in CI with the `claude` binary absent; binary-present probes are recorded as `skipped: claude not installed`, never as passes
- [ ] `arggon doctor --agents` reports the bundle files with the documented status set and the `claude` gap rows, and no gap row is reported closed that the bundle does not close
- [ ] `ArggonManager/docs/agents.md` gains a Claude Code seam section beside §ZCode naming the marketplace install step, the one-server rule, the two-agent rule and the namespaced component names, with impact class stated as **Behavioral**
- [ ] `arggon validate`, the full test suite, lint, and `arggon spec analyze` are green with no new finding naming this story

### The back-link that closes the loop

The new story body's Context carries the link to `spec-claude-code-adapter-024` (verbatim above), and spec 024 already links `story-claude-adapter` — so after this write **both directions resolve**. That is the one unticked box on `task-claude-adapter-spec`'s live `## Acceptance`; tick it (or hand `task-claude-adapter-spec` back to `todo`) once this write lands.

## Greenfield-vs-port decision (asked for, decided in the spec)

**Bounded — a port of the ZCode shape. No exploration artifact owed.** ADR 0017 scopes the six-phase protocol to work "with no existing flow to read", and every decision this bundle turns on is already taken: ADR 0014 decided the structure (declarative plugin + MCP full surface + marketplace install + hooks replacing a permission DSL + a dispatch-scoped reviewer backstop); ADR 0021 §6.1/§6.2a′ fixed the roles and `docs/agents.md` §ZCode already states the rule extends to S6; `spec-zcode-native-seam-012` is the invariant-for-invariant contract to mirror; and the client surface is documented, shipped and versioned. The spec records the ADR 0017 **one-way ratchet**: if the wave hits a shape that contradicts one of those (a plugin format that cannot carry a component, a marketplace that refuses a repo-local root), it stops, files the exploration, and leaves its implementation tasks unclaimed until it lands.

## Gates run (in the worktree `feat/task-claude-adapter-spec`, commit 9ae4f1e0)

| Gate | Expected | Observed |
| --- | --- | --- |
| `npm run arggon -- spec validate` | ok, 0 warnings | `ok (38 doc(s), 0 warning(s))` — baseline was 37 docs |
| `npm run arggon -- spec analyze` | no NEW finding naming this item | `4 finding(s) across 24 spec(s)` — the same four pre-existing findings as the 23-spec baseline (`spec-opencode-seam-010`, `spec-opencode2-009`, `spec-spec-import-openspec-005` x2); none names this item, the new spec, or `story-claude-adapter` |
| `npm run arggon -- spec audit` | no duplicate of spec 017 / 012 | `276 pair(s) over 24 spec(s) — 0 duplicate, 0 merge` |
| `npm run arggon -- validate` | green | `ok (0 warning(s), convention v5)` |
| `tools.arggon.validate()` | green | `{ ok: true, errors: [], warnings: [] }` |
| `npx prettier --check` on the touched specs | clean | clean on both spec files |
| pre-commit hook on commit | gate passes | `arggon validate: ok`, commit landed |
| `git status` after commit | docs-only diff | clean; `spec-methodology-adapters-017.md` (+6 lines, link + superseded-detail note) and the item file changed, nothing else |

**One pre-existing trap I hit and corrected (worth a finding):** the item file's `depends_on:` line is 131 chars, so prettier wraps it into a multi-line YAML flow sequence — which the tracker's line-based frontmatter parser rejects (`BROKEN_YAML`, `arggon validate` fails). I restored the single-line form after the edit. This is `prettier -w .` versus the tracker frontmatter parser, pre-existing and tracker-wide (other committed item files already fail `prettier --check` for the same class of reason), so I left it alone rather than growing the diff.

### handoff 2026-10-11 @arggon-maker (session: ses_ed5430784ffeKRUj7DWUgBRv2Q) — next: Delivery lead writes the drafted story body into story-claude-adapter (comment above), then ticks the last live acceptance box and flips task-claude-adapter-spec done; implementation wave then follow…
- branch: feat/task-claude-adapter-spec
- open questions: Does claude plugin marketplace add accept a repo-local .claude-plugin/marketplace.json root? What is the namespaced slash-command form for a flat commands/arggon-*.md? Does carrying key arggon in bot…
### 2026-10-11 @ses_ed4c5d320ffeScEzxxks3AMgTV
verdict: approve (spec 024 + §S6 superseded-detail, docs + tracker only)

## What I read

- git -C /home/arggon/Projects/ArggonManager-task-claude-adapter-spec diff main...HEAD — 3 files, all under ArggonManager/: the new 416-line spec, a 6-line edit to spec-methodology-adapters-017.md §S6, and the item file.
- ArggonManager/docs/specs/spec-claude-code-adapter-024.md in full (416 lines) and templates/spec.md (the scaffold agents.md §Specs and plans points at).
- ArggonManager/docs/agents.md §Specs and plans (L487-498) and §Changing the methodology itself (L516-523).
- The whole specs directory listing, ArggonManager/docs/adr/ (0014, 0016, 0017, 0021 all present) and ArggonManager/docs/plans/ (plan-methodology-adapters-017.md present).
NaN

## What I checked, expected vs observed

**(a) Structure and frontmatter conform.** Expected: the shape agents.md §Specs and plans declares. Observed: frontmatter carries spec_id: claude-code-adapter-024, title, status: proposed, created: "2026-10-11" — exactly the four fields the convention names (the adr: field is a fifth, and there is precedent: spec-deps-022.md and spec-show-item-003.md both carry it). Body opens with "# Spec: Claude Code adapter (claude-code-adapter-024)" — the template's heading form with the id in parens — and then Purpose, Synopsis, Acceptance, which is the template's section set, plus Decision-pipeline classification, Invariants, Roles a Claude Code tree can express, The honest starting floor, Hook gates, MCP wiring, Marketplace, Headless smoke parity bar, Failure and error paths, Impact class, Non-goals and Open questions. A superset of the scaffold and richer than its nearest sibling (spec-zcode-native-seam-012), which is the right direction for a reviewable contract.

**(b) 024 was the next free number, not last+1.** Expected: the highest number in use in that directory plus one. Observed: I listed ArggonManager/docs/specs/ — 24 files, numbers 001-023 with exactly one gap-free run up to 023 (spec-update-channel-023.md) and no existing -024. So 024 = highest-in-use (023) + 1. It is emphatically not "whatever the last one was, plus one": the directory's last entries alphabetically are spec-worktree-env-contract-016 and spec-zcode-native-seam-012, which would have given 017 — already taken. plans/ carries its own 024-free set (max 020), so no cross-directory collision either. The maker also records that arggon spec new scaffolded it and never overwrites, which is the tool that enforces exactly this rule.

**(c) Claims checkable, invariants stated, non-goals honest.** Expected: every assertion falsifiable. Observed: nine invariants (One logic path, Same rules for humans and agents, Parity with the kernel, Generated with provenance / never overwrites, One server one name, No shell assembly, Hooks fail open, Adapters are enhancers), a five-row failure-and-error-path table, twelve acceptance boxes each phrased as an observable outcome ("the bundle registers exactly one MCP server, keyed arggon, byte-equal in command/args to the generated .mcp.json entry; a live stdio round-trip against a fixture tracker returns the documented envelope"), and seven non-goals including the honest ones — no verifier plugin agent, no second copy of the skill, no cursor/codex/gemini adapter, no blocking CI gate on adapter freshness. The "what the bundle is expected to move, and nothing more" table is the strongest part: it lists the three rows that stay delivered, the one row that closes, and the one row (docs-travel-with-code) that explicitly stays a gap because a plugin has no session-context hook. That is a spec declining to overclaim.

**(d) The greenfield-vs-port decision is argued.** Expected: reasons, not an assertion. Observed: §Decision-pipeline classification (ADR 0017) is four numbered, checkable points — the structure is decided (ADR 0014), the role vocabulary and the which-roles-a-client-can-express rule are decided (ADR 0021 §6.1/§6.2a′, and docs/agents.md §ZCode states the rule extends to S6), the invariant-for-invariant contract to mirror exists (spec-zcode-native-seam-012 plus its evidence shape cli/src/init-zcode.test.ts), and the client surface is documented, shipped and versioned. It then names the ADR 0017 one-way ratchet in operational terms: a plugin format that cannot carry a component, or a marketplace that refuses a repo-local root, stops the wave, files the exploration and leaves the implementation tasks unclaimed. Decisions argued, and the failure mode of the decision stated.

**(e) External-source claims.** Expected: dated, marked and verifiable. Observed: dated and marked — the client-surface facts are headed "Client surface facts the bundle is built against (Claude Code, accessed 2026-10-11)", which is the access date the convention asks for. **Not verifiable**: the list carries no citations, and the spec's own classification section then says "the plugin manifest reference and the hooks reference, cited above" — a reference that points at a list citing nothing. Non-blocking (see finding 1), because the residual unknowns are already quarantined into the three named open questions, each of which says it will be resolved by a recorded probe. But a recorded probe needs a source, so this should be closed before the implementation wave claims its tasks.

**(f) No implementation leaked.** Expected: docs + tracker only. Observed: the entire non-tracker diff is one new file under ArggonManager/docs/specs/ and a six-line edit inside spec-methodology-adapters-017.md §S6. No templates/docs/claude/** subtree, no cli/** or lib/** change, no adapters/capability-matrix.json edit, no package.json change, no smoke. The §S6 edit is itself the honest docs-travel fix: it records that the ids in §S6 are pre-rename and that adapters/claude/ is not the shipped bundle location, and points at 024, so the stale names in 017 stop propagating into a second bundle rather than being copied forward.

## Findings (none blocking)

1. **The external-source list has no citations, and the spec claims it does.** "the plugin manifest reference and the hooks reference, cited above" describes a list that cites nothing. Since the three open questions are explicitly "resolved by a recorded probe rather than an assumption", and the ADR 0017 ratchet is only triggerable against a concrete contradiction, a reader cannot re-verify the client facts from this document alone. Add the two URLs to the facts list (or drop the "cited above" clause). This is the one finding I would want closed before the implementation wave, and it belongs as a small task under story-claude-adapter rather than blocking a spec-filing wave.
2. The frontmatter adr: field is written as a repo-root-relative path (ArggonManager/docs/adr/0014-zcode-native-seam.md) while every other link in the file is relative (../adr/0014-…). Both resolve; the inconsistency is cosmetic but worth normalising while the file is new.
3. The last live acceptance box on task-claude-adapter-spec (the story body write) is correctly left unticked and correctly assigned: notes.md §Acceptance rows says the done gate reads the LIVE ## Acceptance section with dated comment blocks excluded, so a box ticked in a comment would not satisfy the gate. The drafted story body is complete and internally consistent (its Context links 024, and 024's header already links the story, so both directions resolve once the write lands).

## What remains unverified

Execution. I ran no gate. spec validate (38 docs / 0 warnings), spec analyze (4 findings across 24 specs, the same four as the 23-spec baseline), spec audit (276 pairs, 0 duplicates), argong validate and prettier on the two spec files are all unverified by me. What I did verify by reading is that 024 is the only -024 in the directory, that the ADRs and the plan the spec cites exist, that the story path in the header resolves, and that the non-spec diff is six lines inside §S6.

## Probes needed

1. cd /home/arggon/Projects/ArggonManager-task-claude-adapter-spec && npm run arggon -- spec validate && npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json — demonstrates the new spec is structurally valid and introduces no NEW finding. This is the load-bearing gate: ADR 0017's "no implementation task is claimed before a spec with clean spec analyze" is only satisfied if the baseline is genuinely unchanged, so a NEW finding here blocks the wave, not the spec.
2. Same cwd: npm run arggon -- spec audit — demonstrates spec 024 is not a duplicate or a merge candidate against spec-zcode-native-seam-012 / spec-methodology-adapters-017 (the two it most resembles). A DUPLICATE/MERGE verdict would mean the bounded-port argument in (d) has gone too far.
