# Engineering reference

Read only the linked section needed for the current operation; the [operational core](../engineering.md) owns the entry points and retained contracts. Extracted detail remains normative unless it says otherwise.

## Repo structure (Phase 1)

### Locked / in-flight product layout

```text
ArggonManager/          # git-native work tree + product docs (see `ArggonManager/docs/convention.md`)
  docs/                 # product docs: convention, engineering, agents, adr/, specs/, plans/
lib/                    # @arggondev/lib kernel package (ADR 0013): TypeScript sources (lib/src)
  src/index.ts          # kernel entry: items, rules, paths, envelopes + operations
  src/operations.ts     # in-process operations: --json envelope + exit codes per command
cli/                    # root package (arggon-manager): CLI, seam generation, MCP adapter
  src/                  # commands + tests co-located
  src/package-assets.ts # root package root + bundled templates dir (injected into the kernel)
dist/                   # compiled bin (gitignored; npm run build)
lib/dist/               # compiled kernel package (gitignored)
templates/              # scaffolded by arggon init
skills/arggon-cli/      # agent skill for the CLI (keep in sync with `ArggonManager/docs/json-output.md`)
fixtures/               # golden trees for validate + integration tests
.github/workflows/      # ci.yml (build+test+lint), auto-done.yml
```

**Boundaries**

| Concern                               | Lives in                                                          | Does not                                       |
| ------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Task schema / statuses / folder rules | `ArggonManager/docs/convention.md` + sample `ArggonManager/` tree | CLI source comments as sole source of truth    |
| Eng process, review bar, ADR, DoD     | `ArggonManager/docs/engineering.md`                               | Product roadmap and acceptance (product owner) |
| CLI behavior                          | `cli/` (or stack equivalent)                                      | Phase 2 board UI, Phase 3 SDK                  |
| Durable decisions                     | `ArggonManager/docs/adr/`                                         | Long debate only in PR threads                 |

**Shipped beyond the original Phase 1 scope** (each behind its own ADR/PR): static board + drag-and-drop + local serve (ADR 0002), GitHub reconciliation (`sync`), stdio MCP server. **Still out without an ADR:** hosted/SaaS anything, a parallel task schema, or an agent-only dialect of the rules — [ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md) is one such ADR: it grants the four irreversible powers to a named human role and no agent a second rule set.

**Sample tree:** the fixture `fixtures/tasks-valid/tasks/launch-mvp/` is both the product demo and a test fixture. Changing convention requires updating samples and CLI tests in the same change set when the CLI exists.

---

### The decision brief (the request side of the authority map)

**The [core authority map](../engineering.md#authority-map) is unchanged by this convention** ([ADR 0026](../adr/0026-owner-decision-brief.md) §Decision; ADR 0021 §2 stands): the delivery lead still **recommends**, the product owner still **decides**, sequence is still not priority. What this adds is the missing **request side** — how the delivery lead brings a decision to the product owner, so a question does not land in a chat and the answer has somewhere durable to live.

A **brief** is an ordinary comment on the item, headed `decide:` and written by the delivery lead; the **answer** is an ordinary comment headed `decided:`, written by the product owner. Both use the dated heading `arggon comment` writes — `### <YYYY-MM-DD> @<author>` — and both are prose, never schema: there is no flag that writes a brief and no frontmatter field (ADR 0026 §6). A brief is **written for one reader whose vocabulary is not assumed**; the mechanical test is whether that reader could restate the choice and its consequence in their own words.

**The six fields, in this order** (ADR 0026 §1):

1. **The question**, in one sentence — any specialist term translated, at first use, into what it changes for the product.
2. **Why it matters**, in outcome terms — what changes for the people who use it, what it costs, what it risks; never in mechanism terms.
3. **The options** — two or three, **never one** — each with its consequence in plain words, and for the recommended one its honest cost stated rather than implied.
4. **The recommendation**, and why.
5. **The strongest argument against that recommendation**, written by the lead. A brief that omits this field is not a brief.
6. **The default**: what the lead will do if no answer arrives, and the **absolute** date after which it happens — never a relative deadline ("by Friday").

The **answer** carries the chosen option — the text of the option, or `other` for "none of these", which is a first-class, unremarkable reply — optionally with a scope note in parentheses, then the reasoning. A later `decided:` supersedes an earlier one, and a superseded brief is **never rewritten**.

**The routing rule — which decisions owe a brief** (ADR 0026 §5). A brief is owed **only** for the rows of the [core authority map](../engineering.md#authority-map) — direction and priority, product acceptance of a container, accepting residual risk, taking over another writer's claim, publishing a release — and for **hard-to-reverse calls** (those whose cost of being wrong later exceeds the time it takes to undo). Everything else the delivery lead **decides and records on the item as a plain comment**; a question with one real option is not a brief. A brief never replaces the record a row already has — the `priority` field, an `accept:` comment, the ADR 0015 waiver, the claim-takeover gate and the human-pushed release all keep their records: the brief is the **request**, not the answer. One item is canonical for a given decision; a second brief links to it. **This rule is normative, not advisory**: without it every decision becomes a brief, which inverts the [core promotion tiers](../engineering.md#product-acceptance-product-owner) — human attention must not rise per shipped change (a brief **replaces a chat question rather than adding a step**).

**The stated default is what makes a brief safe to send** (ADR 0026 §3). On the stated date the default executes and the record says so, so **silence selects a default the owner was shown in advance, never an answer by abstention**. The direction of that default is constrained: for a hard-to-reverse call it is the reversible or "hold" option, never the more aggressive one; if no reversible option exists the default is "hold" and the brief says so; for every other decision that owes a brief the default is the lead's own recommended option. The net effect is the property that lets a brief be sent without a blocker: **a brief can never make an irreversible act happen because nobody replied.**

**Report-only, never a gate** (ADR 0026 §6). This is inherited from the [core acceptance convention](../engineering.md#product-acceptance-product-owner), with its reasoning, not only its conclusion: the tracker has no identity layer, so an answer is attributed but never authenticated, and a gate built on it would be forgeable or unusable. No transition consults a brief, no command refuses because one is missing, and CI never fails on one. **The surface is `show`:** `arggon show <id> --json` carries an additive `decision_brief` field (`none` | `open` | `decided` | `self-decided`), and `arggon spec analyze` gains one additive, opt-in finding (`UNANSWERED-DECISION-BRIEF`, armed by the same `x-tracker.product-acceptance` as the acceptance detector); `arggon report --json` and `arggon sync --json` are **byte-identical** (a brief is an item-level record, so the container-level `report` and the PR-reconciled `sync` cannot carry it — the correction ADR 0021's own amendment records for the sibling artifact). **`self-decided` is a same-name hint, not an identity check** (ADR 0026, amendment of 2026-10-15): an item assigned to the product owner's own login is legitimate, and the owner answering a brief on their own item reads `self-decided` — the normal owner answer, never an agent answering its own brief, because attribution cannot tell the two apart without an identity layer.

**This project's worked example — software, an example only.** The convention's own language is the six field names and the two header tokens above; they are domain-neutral, and a reader who has never written anything technical can follow the convention itself. Software is **this project's** example and never the convention's vocabulary (ADR 0026 §7). A brief written in this repository's own terms, therefore, would read like this — "a shared library", "a feature flag", "a database index" are the ADR's own named software cases:

```
### 2026-10-06 @Arggon
decide: a shared library for the date handling (the logic three screens each use today)
- The question: should the date logic live in one shared library, or stay copied in each screen that uses it?
- Why it matters: today a fix must be made in three copies and a missed copy shows customers different behaviour in different screens; one library costs a release shared by three teams.
- The options: A — keep three copies, so each team moves independently and every fix is made by hand; B — one library, so a fix lands once for every screen, at the cost of a shared release.
- The recommendation: B — a wrong date in one screen is a customer-visible defect, three times over.
- The strongest argument against that recommendation: a shared library couples three teams' release timing, and one library change can hold up a team that would otherwise ship today.
- The default: B, from 2026-10-27 — one library is the recommendation, and this call is one we can reverse in a release.
```

A non-software adopter writes the same six fields in its own words; a library, a flag and an index are not required vocabulary. The non-software worked example lives in [`spec-owner-decision-brief-021`](../specs/spec-owner-decision-brief-021.md) §Synopsis.

### Smoke test (blocks merge)

Apply the [core blocking smoke bar and CLI/UI checks](../engineering.md#smoke-test-blocks-merge); the following are the surface-specific recipes and CI evidence.

- **TUI:** no browser automation applies; smoke is a scripted pty render check or a documented manual check in the verdict. The scripted check is `npm run smoke:tui-board` (`smoke/tui-board-smoke.ts`): it runs `arggon board --tui` in a pty via util-linux `script` and drives a 14-step scripted session — board frame (five status headers, seeded item, freshness stamp), live refresh (an item created behind the board appears without a keypress), the ready lens on and off, priority and next-rank sorts, the `/` search prompt filtering to the seeded task, card selection opening the detail pane, a chunk-split PgDn paging the pane while the pane stays open, and the board restored with selection and filter intact — then quits with `q`; it skips cleanly where `script` is unavailable.
- **Native worktree/start changes:** the deterministic check is `npm run smoke:native-start-cold` (`smoke/native-start-cold-smoke.ts`, model-free and offline): on a disposable git fixture it proves the dependency-requiring `pre-commit` gate fails in a cold worktree, then drives the real `tools.arggon.start` seam and requires an explicit bounded readiness/claim-commit receipt, a claim commit containing only the item file, a deterministic re-run attach with no duplicate commit, and an untouched canonical install. It is a durable gate, not a substitute for the model-driven `smoke:opencode` transcript, which stays the runtime-level evidence.

- **Permission-surface / seam-gate changes:** the per-runtime probe is `npm run smoke:permissions-probe` (`smoke/opencode-permissions-probe.ts`, `bug-task-permissions-enforcement-not-observed`): on hermetic fixtures (temp git repos, a local bare remote, a disposable HOME + XDG set) it runs one denied and one allowed command per supported runtime — the OpenCode V2 session (a fresh headless run, a session continued across a mid-session config edit, and a session attached to a long-lived background service), the ZCode and Claude `hooks/gate.mjs` gates, the kernel's reopen/steal refusals, and the vendored plugin's structurally empty own surface — each recorded as command / expected / observed / exit / does-NOT-prove. Its deterministic legs are model-free and are exercised by `npm test` through `smoke/opencode-permissions-probe.test.ts`; the V2 legs need the `opencode` binary and provider credentials and record a **skip — never a pass** where they cannot run (a provider death is a skip; a model that declines on its own is inconclusive, which fails the run). What it does not claim: shell-text matching stays best-effort, and the probe pins which layer honors the block on the build it ran on, not forever.
- **CI tier (`cli` job) for the native start path:** the last step of the `cli` job runs `npm run smoke:native-start-cold` (`task-wire-native-start-cold-smoke-into-ci`), after the `npm run build` whose kernel it drives, beside `test:structure` / `lint:structure`. The step is blocking by construction (no `continue-on-error`, no `|| true`, no advisory `if:`), so it fails the lane like any other node gate, and it is dev-only: offline, model-free, Chromium-free, no second install — which is why it is in `cli` and not the `ui-smoke` job. Observed runtime ~0.5s, so it is on every PR rather than label-gated. What it does not claim: it does not replace the model-driven transcript smoke, and its fixture install is synthesized, so it proves resolution rather than npm's reifier.
- **CI tier (`cli` job) for paired deletions (report-only):** `node cli/paired-deletion-guard.mjs` (bug-no-gate-warns-on-paired-impl-and-test-deletion) lists every `D` row of a PR's **three-dot** diff (`merge-base -> head`) and warns when a `D` row removes an implementation and its paired test together — the one deletion shape `npm test` / `npm run build` cannot see, because it compiles and leaves no orphan test. It is deliberately the only lane in this job that is **not** blocking: the shape is a legitimate, reviewed refactor step as often as it is an accident (measured: 0 paired deletions across the last 500 commits, out of 40 `D` rows), so the step annotates and exits 0 rather than paying for a `continue-on-error`-shaped bypass. The one exit code that still fails the lane is 2 — the run **could not look** (unresolvable base, no merge base, usage error) — because a check that quietly passes when it could not run is the same vacuity as one that reports nothing. `--strict` is the recorded promotion path to blocking (exit 1 on a pair) and is exercised on every `npm test`. Two disciplines are load-bearing and pinned by the suite: the diff is always `merge-base -> head` — a two-dot comparison against a base that moved ahead reports every file the base gained as `D` on the branch side, i.e. it recreates the PR #586 false positive the lane exists to name — and the step fetches the PR's own base and head by SHA, because the default shallow checkout has no shared history to merge-base against. What it does not claim: it does not detect a deletion whose test was renamed onto something else, it does not read the merge commit, and report-only means a reviewer must still read the annotation.
- **CI tier (`ui-smoke` job):** the durable `@smoke`-tagged `@playwright/test` spec (`e2e/board.smoke.spec.ts`, Chromium only, `npx playwright test --grep @smoke`) drives `board --serve` on a temp fixture — board loads, cards match `arggon list`, one status move round-trips and persists. The same job runs the TUI frame check above. The review-time gate above stays the blocking bar. Playwright is dev-only, Chromium-only in CI — never a runtime dependency.
- **Accessibility (automated, in the same `ui-smoke` lane):** the first `@smoke` test runs `@axe-core/playwright` (version-pinned devDependency, never shipped) against the served board, on the readiness signal the spec already waits for (`h1` present) and before the card-parity and round-trip tests move the page on. It asserts the **automatable WCAG A/AA set across all three WCAG versions** — `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` — so a 2.1/2.2 AA rule cannot pass unreported. AAA and `best-practice` are deliberately out of scope. The policy is **no blanket exclusions**: zero `disableRules`/`exclude`/`include`/narrowed rule lists, zero accepted exceptions; an accepted exception must record the exact rule id, the reason and an owner in a comment at the call site and in `CONTRIBUTING.md` § UI smoke tests. A violation is fixed in the board or filed as a linked item — never excluded to get a green lane. What it does not claim: axe automates only part of WCAG (keyboard interaction, focus order, reflow and non-text contrast stay manual — `task-board-non-text-contrast-and-drag-affordance`), and its state coverage is the list in `CONTRIBUTING.md` § UI smoke tests — the ready board, the open detail drawer, the static export, the lens/filtered states and the grouped-ancestry tree (`task-axe-board-drawer-and-lens-coverage`, `task-web-board-hierarchy-view`) — never the whole application or its interaction paths.
- **Flake reproduction harness (opt-in, env-gated — never wired into CI):** an intermittent e2e failure is reproduced under instrumented load, not chased by reruns. `e2e/helpers/flake-harness.ts` arms CDP `Emulation.setCPUThrottlingRate` (`E2E_THROTTLE=<n>`; 20 is the proven setting) plus host busy-spinner processes (`E2E_SPINNERS=<n>`; 16 saturates a 12-core box) for any Playwright spec that imports the harness `test` — `e2e/board.smoke.spec.ts` does — and both fixtures are strict no-ops without the env, so the default lane is unaffected. Recipe (proven on the live-reload race, bug-live-reload-sse-race / PR #521): `E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test --grep "<flaky spec>"`. A malformed value fails loud naming the variable; grep to the suspect spec (throttling every page makes the whole lane crawl). What it does not claim: it supplies the load, not the diagnosis — a reproduced failure still needs the evidence trail (#521's buffered server event log + HAR) to separate wait-mechanism defects from real signal loss.

### Session context (advice, never a gate)

**Not a bar — nothing here blocks a merge, and no command implements it.** When the session's context is visibly degrading — you re-read the same files, restart exploration you already finished, or pay for long tool output twice — ask the three questions [exploration-021](../explorations/exploration-harness-research-transfer-021.md) F8 takes from AutoCompact (arXiv:2610.02163v1):

- **When to compact** — in this loop, when to stop and carry over. The signal is visible behaviour (repetition, restarted exploration, output paid twice), never a token count.
- **What to preserve** — the bounded surfaces this project already measures ([ADR 0006](../adr/0006-token-context-efficiency.md)): the item's frontmatter (branch, `worktree_path`), its acceptance checklist and latest verdict, and the injected item block.
- **How to continue** — the handoff fields (`branch`, `next`, `open_questions`): the working state a fresh session resumes from.

**What this is not.** Compaction stays length-triggered by choice — `compaction.keep` in `templates/docs/opencode.jsonc` is untouched — and the published alternative requires training we do not run; the paper itself leaves harnesses like ours to future work. This is a diagnostic, never a compaction fix: no `compact()` action, no compaction tool, no executor.

---

## Testing expectations

A project declares its own layers and its own commands; this is ArggonManager's declaration, and the software rows below are the worked example every other project replaces with its own (ADR 0021 §6.2).

| Layer                        | Required                         | Notes                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit                         | Yes                              | Parsing, status transitions, claim rules, path/`id` checks                                                                                                                                                                                                                                                                     |
| Fixture / golden             | Yes                              | Valid tree must pass `validate`; each invalid layout rule has a failing fixture                                                                                                                                                                                                                                                |
| Integration                  | Yes for file-mutating commands   | `create` / `update` / claim against a temp copy of fixtures; assert git-friendly file output                                                                                                                                                                                                                                   |
| E2E against the real tracker | Optional                         | Nice-to-have; fixtures are the merge gate                                                                                                                                                                                                                                                                                      |
| Smoke (review gate)          | Blocking for behavior/UI changes | Probe evidence in the review verdict; UI changes get a real-browser drive via Playwright CLI ([ADR 0008](../adr/0008-review-smoke-gate.md)); docs-only exempt                                                                                                                                                                  |
| Smoke (CI `ui-smoke` job)    | Runs for board/TUI changes       | `npx playwright test --grep @smoke` (Chromium, dev-only) drives `board --serve` on a temp fixture and asserts the ready page against the automated WCAG A/AA rules (`@axe-core/playwright`, no blanket exclusions); `npm run smoke:tui-board` asserts the TUI frame in a pty; see [ADR 0008](../adr/0008-review-smoke-gate.md) |

**Rules**

- Convention changes that alter validate semantics ship with fixture updates in the **same** PR.
- Do not skip tests with “docs only” if the PR changes CLI behavior.

---

### Merging: a PR refused as out of date

`main` moves continuously (tracker auto-commits, auto-done flips), and branch protection requires a PR to be up to date with `main` before merging — so on a wave the second PR is refused: `BEHIND` ("the head branch is not up to date with the base branch") or _"Base branch was modified. Review and try the merge again."_ (2026-10-12: [#746](https://github.com/Arggon/ArggonManager/pull/746) and [#747](https://github.com/Arggon/ArggonManager/pull/747)). The refusal is the protection working — it is what stops two individually-green PRs from merging into a semantically broken combination — so refresh the branch, never relax the requirement.

- **Default — refresh server-side, no worktree dance.** Ask GitHub to update the PR branch, then merge once the checks finish; arming auto-merge once saves the second visit:

  ```bash
  gh api -X PUT repos/Arggon/ArggonManager/pulls/<n>/update-branch
  gh pr merge <n> --merge --auto
  ```

  Auto-merge does **not** refresh a branch that falls behind after it is armed, and `main` keeps moving — if the PR re-strands at `BEHIND` while armed, run the `update-branch` command again; the armed auto-merge completes once the checks pass.

- **Fallback — the API cannot apply the update** (a real conflict, or a 422 when GitHub cannot rebase the branch): merge locally in the item's worktree, resolve the conflicts there, push, then merge normally:

  ```bash
  git fetch origin && git merge origin/main
  # resolve, commit, push, then merge
  ```

  The API path cannot resolve conflicts and must not be retried in a loop; the local merge is the only path where a conflict gets a resolution and a reviewable diff.

- **Bot-owned PR branches are excluded.** A release-please release PR — and an auto-done flip PR — is managed by the bot's own rebase/retry path; never refresh or merge one by hand.

A **merge queue** on `main` would remove this step entirely — it refreshes queued PRs itself — but GitHub offers merge queues only to organization-owned repositories, and this repo is owned by a user account: the precondition is an org transfer (or a non-native queue). Until then, the refresh flow above is the remedy.

---

## Phase 2 / 3 (boundary notes only)

- **Viewer/board (shipped):** the static board and the local `--serve` route go through the same kernel read/update paths; drag-and-drop parity with the CLI rules is test-enforced. Spike constraints: [`ArggonManager/docs/viewer-spike.md`](../viewer-spike.md).
- **Agent hooks (partially shipped):** the stdio MCP server and the `agent` caller flag enforce the same validate/claim rules as the CLI; no private agent dialect. A fuller SDK still requires an ADR.

Details belong in later ADRs — do not pre-build those packages in Phase 1.

---
