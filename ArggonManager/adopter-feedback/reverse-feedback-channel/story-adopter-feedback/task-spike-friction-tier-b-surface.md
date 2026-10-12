---
type: task
status: done
id: task-spike-friction-tier-b-surface
title: "Spike: Issues or Discussions as the tier-B prefilled surface?"
assignee: arggon-delivery-lead
branch: feat/task-spike-friction-tier-b-surface
parent: story-adopter-feedback
labels: [research]
priority: p3
created: "2026-10-02"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-tier-b-surface.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-tier-b-surface.
  CLI `arggon create task spike-friction-tier-b-surface` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: Issues or Discussions as the tier-B prefilled surface?

## Context

A **spike, not a task**: it answers one bounded question and recommends.

Tier B emits a prefilled URL that a human opens. Which surface? Ground truth at
decision time: `Arggon/ArggonManager` has `hasIssuesEnabled: true` and
`hasDiscussionsEnabled: false`; 21 issues exist, all closed, all created
2026-09-03 → 2026-09-11 — exactly the pre-tracker era, abandoned when the
in-tree tracker landed. `exploration-repo-visibility-011` recorded "issues enabled
but unused (tracker is in-tree)".

The trade is mechanical, not ideological:

- **Issues** — richer prefill (`title`/`body`/`labels` query params, Issue Forms
  YAML, six-form patterns in `claude-code`), label-driven triage, and a search
  surface a later stage-2 `gh issue list --search` can use. Cost: it is the one
  surface `docs/agents.md` §0 tells agents never to touch, so the channel's
  credibility rests entirely on the human-gate discipline holding.
- **Discussions** — semantically correct for a "this felt wrong" signal, needs a
  one-line ops change, and keeps Issues PR-only so the §0 line stays
  unqualified. Cost: weaker prefill, weaker triage, no label-driven search.

This is a one-line ops change the maintainer can take independently of the code,
which is why it is a spike rather than a task in the plan.

## Acceptance

- [x] Both surfaces are compared on: prefill fidelity (which query params survive), triage/label support, machine-searchable for stage-2 dedupe, and the §0 interaction. — comparison table in the 2026-10-11 comment below.
- [x] The recommendation is recorded as a comment on this item, with the deciding reason. — **Issues**, decided on the stage-2 dedupe contract.
- [x] If Discussions wins, the ops change is named exactly (one repo setting) so the maintainer can take it without the code. — conditional did not trigger (Issues wins); the exact one-setting fallback is still recorded in the comment so the product owner can take it without the code.
- [x] The answer feeds `task-friction-tier-b-url-and-optout`; that task is updated or its tier-B URL constant changed in the same PR that acts on the answer. — the answer and the constant are recorded in the comment below; the task itself stays `todo` (gated on `task-friction-dedupe-and-report`) and is untouched by this spike.

### 2026-10-11 @ses_ed69ddc7affeBPLsLP78ghgbNf
**Recommendation: Issues.** Tier B keeps `https://github.com/Arggon/ArggonManager/issues/new?title=…&body=…`, with one repo-side amendment (an Issue Forms template) so the label lands without depending on the filer's permissions.

## Ground truth, re-verified 2026-10-11 (not taken from this item's body)

- `gh api repos/Arggon/ArggonManager` → `has_issues: true`, `has_discussions: false` (GraphQL agrees). `open_issues_count: 3` corresponds to the three open PRs; the issue search reports **0 open issues**.
- Issues: **27 total, all closed**, all created 2026-09-03 → 2026-09-11 — the pre-tracker era, nothing filed since. (The body recorded 21; the six extra are the same era and all closed, so the conclusion is unchanged.) `exploration-repo-visibility-011`'s "issues enabled but unused (tracker is in-tree)" still holds.
- No `.github/ISSUE_TEMPLATE/` exists yet; 22 labels exist, none named `adopter-friction` (a `duplicate` label does exist and is free for triage).
- External precedent verified live: claude-code's template directory carries six files (five Issue Forms YAML + `config.yml`); `bug_report.yml` is the pattern — `title: "[BUG] "` and `labels: [bug]` front matter, a required preflight checkbox, version/model dropdowns. Its 27.6% duplicate rate and OpenCode's 72-hour `duplicate-issues.yml` auto-close remain the standing counter-evidence from `exploration-adopter-feedback-channel-024`.

## Comparison

| Dimension | Issues | Discussions |
| --- | --- | --- |
| **Prefill fidelity** | Documented params `title`, `body`, `labels`, `milestone`, `assignees`, `projects`, `template`; Issue-Forms custom text fields prefill by their `id`; the template chooser accepts params too. | Undocumented `category`, `title`, `body` only — community-attested (community#2838, answered by GitHub staff, 2022); **no `labels` param anywhere**. Probed `discussions/new?category=q-a&title=…&body=…` → 404 on this repo while discussions are off. |
| **Triage / labels** | Labels, assignees, milestones, projects; a template's `labels:` front matter applies repo-side regardless of filer permission. | Labels now exist (docs "Managing labels" names discussions; GraphQL `Discussion.labels` verified on cli/cli), but land only via the category form's `labels:` key or by someone with triage. One category per discussion (max 25); no assignees, milestones or projects. |
| **Machine-searchable (stage-2 dedupe)** | `gh issue list --search` / `--label`, REST `search/issues` (issues only — `is:issue` → 27, `is:pr` → 654 on this repo), JSON output. Plus GitHub's own **duplicate suggestions at filing time**: title filled + body ≥100 chars → up to 3 suggestions, non-blocking — the only self-service dedupe aid either surface offers. | `gh discussion list --search/-S` and `--label/-l` **do exist** — shipped in gh v2.94.0 (changelog 2026-06-10), present in the installed 2.98.0. So the item body's "no label-driven search" cost is stale: discussions are searchable, but on a second surface the plan never named, and REST search does not return discussions. |
| **§0 interaction** | §0's letter survives through the human gate (ADR 0024 §4: "the agent never opens an issue; a human does"), but the marked trigger block must then carry an explicit carve-out sentence beside §0's prohibition in the very files generated from the playbook whose first section is §0 — the claude-code#93077 instruction-precedence hazard and the deftai#3633 lesson ("a capability in the wrong place is absent") say an ambiguous trigger is silently dropped. | §0 stays unqualified — "GitHub is for PRs only" remains literally true and no carve-out sentence is needed. Semantically the right home for a "this felt wrong" signal. This is Discussions' real and only decisive advantage. |

Shared, so not distinguishing: the human gate is identical on both surfaces (no tier auto-submits; tier C stays out of spec per spec-friction-capture-020), and URL length is bounded on either surface — documented `414 URI Too Long` above the server limit, observed 200 up to ~6.5 KB, 5xx around 7 KB, 414 at 8.2 KB; the 64/200/500-char field caps keep the emitted URL far below.

## The deciding reason (one)

The channel's only durable payoff is the stage-2 fingerprint dedupe — the `[adopter-friction] ` title prefix plus the fenced `arggon-fingerprint` block must stay findable at scale, because the story exists to kill a *measured* duplicate-filing debt (10 repeat items in this tracker; claude-code's 27.6%). **Issues is the only surface where that signal is first-class in the documented, on-plan toolchain** — `gh issue list --search`/`--label`, REST search, and duplicate suggestions firing at filing time. Discussions can be filed into, but its prefill is undocumented and label-less and its search lives in a gh subcommand the plan never named: a weaker contract for exactly the payoff the channel is being built for. The §0 argument for Discussions is real, but it is a discipline question the human gate already answers (identical on both surfaces), whereas the dedupe contract is what earns the maintainer's attention at all.

## Two amendments this answer forces (fed to `task-friction-tier-b-url-and-optout`)

1. The `labels=adopter-friction` URL param **cannot land for an outside adopter**: GitHub's docs require "permission to add a label to an issue" for the `labels` query parameter, and this repo has one collaborator. Ship `.github/ISSUE_TEMPLATE/adopter-friction.yml` (Issue Forms: `title: "[adopter-friction] "`, `labels: ["adopter-friction"]`, version/OS dropdowns — claude-code's verified pattern, repo-side config so filer permission is irrelevant) and emit `?template=adopter-friction.yml&title=…&body=…`. Neither the template nor the label exists today; both are one small PR.
2. The trigger block in `templates/docs/opencode/agents/arggon-{worker,coordinator}.md` gains one sentence — "emit this URL for a human to submit; never submit it yourself — §0 still forbids agents from opening issues" — a behavioral carrier change inside the already-budgeted PR (ADR 0024 §2).

## If the product owner prefers Discussions (the §0-clean fallback)

Exact ops change, no code: Settings → General → Features → enable **Discussions**, create one category "Adopter friction" (slug `adopter-friction`), add `.github/DISCUSSION_TEMPLATE/adopter-friction.yml` with `title: "[adopter-friction] "` and `labels: ["adopter-friction"]`. The tier-B constant then becomes `https://github.com/Arggon/ArggonManager/discussions/new?category=adopter-friction&title=…&body=…`, and `task-friction-tier-b-url-and-optout`'s acceptance plus spec-friction-capture-020 §tiers change with it. (Recorded for completeness; not the recommendation.)

## How this feeds `task-friction-tier-b-url-and-optout`

That task **stays `todo`** (it depends on `task-friction-dedupe-and-report`) and is untouched by this spike. The answer pins its tier-B URL constant to **Issues** — unchanged from the spec — with amendments (1) and (2) above landing in the same PR that implements it; that PR also creates the `adopter-friction` label and the Issue Forms template, which do not exist yet. No new items filed: the only new fact worth acting on (the `gh discussion` subcommand postdating the plan's stage-2 wording) is recorded here and travels with that task's feed rather than as new scope.

### handoff 2026-10-11 @ses_ed69ddc7affeBPLsLP78ghgbNf (session: ses_ed69ddc7affeBPLsLP78ghgbNf) — next: Delivery lead reviews the 2026-10-11 comment (recommendation: Issues) and hands the URL constant + Issue Forms template amendments to task-friction-tier-b-url-and-optout, which stays todo.
- branch: feat/task-spike-friction-tier-b-surface
- open questions: Product owner may prefer the Discussions fallback (one repo setting, named in the comment); if so the spec tier section and the tier-B acceptance change with the URL constant.
