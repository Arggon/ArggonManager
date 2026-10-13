---
type: task
status: in_progress
id: task-seam-footprint-config-inline-evaluation
title: "Seam footprint: evaluate loading the OpenCode plugin via config and inlining agents/commands into opencode.json(c) — 15 tracked files + generated plugin copies vs config keys"
assignee: arggon-delivery-lead
branch: feat/task-seam-footprint-config-inline-evaluation
parent: story-opencode-adapter
labels: [opencode-seam, methodology, evaluation]
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T23:39:26.165Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-seam-footprint-config-inline-evaluation
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-seam-footprint-config-inline-evaluation.md
  Leaves live only under a story. id is the filename stem: task-seam-footprint-config-inline-evaluation.
  CLI `arggon create task seam-footprint-config-inline-evaluation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Seam footprint: evaluate loading the OpenCode plugin via config and inlining agents/commands into opencode.json(c) — 15 tracked files + generated plugin copies vs config keys

## Context

Raised by the product owner, 2026-10-12: "we have inside the `.opencode` folder
a lot of stuffs. Are them really necessary? can't we just add the plugin to the
`plugins` inside `.opencode/opencode.json`?"

Measured inventory in this repo (2026-10-12):

| Path                                             | Size  | Tracked            | What it is                                                                                                     |
| ------------------------------------------------ | ----- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `.opencode/agents/*.md` (4)                      | 28K   | yes, `x-generated` | Role agents (delivery-lead, maker, standards-reviewer, verifier) materialized by `arggon init`                 |
| `.opencode/commands/*.md` (11)                   | 44K   | yes, `x-generated` | `/arggon-*` commands                                                                                           |
| `.opencode/plugins/arggon/index.ts` + `tui.tsx`  | ~497K | no (gitignored)    | Generated vendored copies of the committed bundles — the seam's loading mechanism ("no `node_modules` needed") |
| `opencode.jsonc` (repo root)                     | small | yes                | Generated project config (adopter-editable)                                                                    |
| `.opencode/opencode.json` + `.opencode/harness/` | small | no, not ignored    | **Not ArggonManager's**: a local agent-harness plugin's config/state                                           |

Schema facts (fetched 2026-10-12 from `https://opencode.ai/config.json`): the
config field is **`plugin`** (singular; array of string | [string, object]) —
not `plugins` — and the schema supports inline **`agent`** (`prompt`,
`description`, `mode`, `permission`, …) and **`command`** (`template`, …)
objects. So both halves of the question have real options:

- **agents/commands as file vs config keys**: inlining would collapse 15 tracked
  files into config, but loses per-file `x-generated` provenance, `init`'s
  per-file refresh/ack/adopter-edit semantics, `doctor --agents` per-file
  statuses, and markdown-diff readability. The capability matrix and the seam
  tests pin the current shape.
- **plugin vendored copy vs config `plugin` entry**: a config entry still needs
  a resolvable artifact (absolute path — machine-specific, like the owner's
  harness example; or a package spec — requires an install the seam deliberately
  avoids). For adopters the vendored copy IS the artifact; in this repo pointing
  at the committed `opencode/plugins/arggon/index.bundle.ts` is conceivable but
  diverges this repo's seam from every adopter's and interacts with `doctor`'s
  staleness detection.

## Acceptance

- [ ] Decide, with reasoning recorded on this item: keep the file seam (and say
      what the file count/size actually is — 72K of md + one generated bundle),
      inline agents/commands into `opencode.json(c)`, load the plugin via a
      config `plugin` entry in this repo only, or a mix
- [ ] If inlining: the `x-generated`/ack/refresh model and `doctor --agents` get
      an explicit replacement story (or a recorded scope reduction), the seam
      tests and capability matrix are updated in the same change, and adopters'
      trees see the same shape
- [ ] If config-referencing the plugin in this repo: `doctor`'s vendored-plugin
      staleness detection, `npm test`'s rewrite step, and the `.gitignore`
      entries are reconciled in the same change
- [x] Regardless of decision: the two clearly-local artifacts
      (`.opencode/opencode.json`, `.opencode/harness/`) are kept out of
      ArggonManager's seam accounting — either gitignored (they already trip
      worktree pruning and `git status`) or documented as machine-local
- [x] The owner's config idiom is validated as part of the decision: the
      published schema names the field `plugin` (singular) — if the runtime
      being used applies `plugins`, record which client/version accepts it

## Notes

### Verified inventory (re-measured 2026-10-12, this worktree + the primary checkout)

Tracked under `.opencode/` (`git ls-files .opencode` → 15 files) plus the root
config:

| Path                                             | Files | Content bytes | `du` |
| ------------------------------------------------ | ----- | ------------- | ---- |
| `.opencode/agents/*.md`                          | 4     | 19,812        | 28K  |
| `.opencode/commands/*.md`                        | 11    | 12,093        | 44K  |
| `opencode.jsonc` (root, tracked, adopter-edited) | 1     | 3,088         | 4K   |

The seam's real content weight is **15 tracked files / 31,905 B of markdown**
(72K in 4K blocks — the item's 28K+44K figures are block usage, not content)
plus the 3,088 B root config.

Gitignored, derived (recreated by `arggon init` or `npm test`'s
`cli/src/plugin-copy.test.ts`; the committed artifacts are drift-gated, never
auto-healed):

- `.opencode/plugins/arggon/index.ts` — expected 549,029 B today (marker +
  committed `opencode/plugins/arggon/index.bundle.ts`, 548,958 B). The primary
  checkout's copy is 481,162 B, i.e. **stale**: `arggon doctor` in the primary
  reports `plugin.current: false` + the stale hint. This worktree has no copy
  (`doctor --agents` reports `missing`) until init/tests regenerate it.
- `.opencode/plugins/arggon/tui.tsx` — committed source 18,524 B; primary copy
  15,742 B (stale too).
- The item's "~497K" = 481,162 + 15,742 = 496,904 B for the primary's current
  copies; a current-bundle copy is ~549 KB.

Untracked and **not ignored** — the primary checkout's `git status --short` is
exactly these two lines:

- `.opencode/opencode.json` — 115 B; the owner's local harness registration
  (`{"plugins": ["/home/arggon/Projects/opencode-autoharness/src"]}`, a
  machine-absolute path). The project config is the tracked `opencode.jsonc`.
- `.opencode/harness/` — 3,623 B (`friction.jsonl` 3,598 + `.policy-shown` 25);
  that harness's state.

`arggon init --dry-run --json` here: the 15 agent/command files `updated`
("untouched since last generation — regenerated"), the 2 plugin copies
`created`, `opencode.jsonc` `modified-skip` (adopter-modified), `.gitignore`
`modified-skip`. `arggon doctor --agents --json`: opencode = 18 destinations,
15 `present`, 1 `adopter-edited` (`opencode.jsonc`), 2 `missing` (plugin
copies) — the per-file status model the seam is built on.

### How the plugin actually loads (probed, not read from docs)

- **Convention directory**: V2 auto-discovers `.opencode/plugins/arggon/index.ts`
  (+ `tui.tsx` beside it). In the primary checkout, `opencode api plugin.list`
  returns the project entry
  `{"id":"arggon","source":{"type":"local","path":"/home/arggon/Projects/ArggonManager/.opencode/plugins/arggon/index.ts"}}`
  — it fails only with `Duplicate plugin ID: arggon` because a global
  `~/.config/opencode/plugins/arggon` install also exists.
- **Config entry**: a git repo with `.opencode/opencode.json`
  `{"plugins":["/tmp/opencode/seam-d/plug"]}` and a minimal valid `{ id, setup }`
  plugin, run with `opencode run --standalone --print-logs`, logs
  `msg="loading plugin" id=/tmp/opencode/seam-d/plug entrypoint=file:///tmp/opencode/seam-d/plug/index.ts`
  and the plugin's setup marker file appears. Repeating with `"plugin"`
  (singular) loads identically.

### Schema facts + the owner's idiom (acceptance 5)

- Published `https://opencode.ai/config.json` (fetched 2026-10-12, 39,039 B,
  root `$ref: #/$defs/Config`): the plugin field is **`plugin`** (singular;
  array of `string | [string, object]`); there is **no `plugins`**. It does
  define inline **`agent`** (record of AgentConfig: `prompt`, `description`,
  `mode` `subagent|primary|all`, `permission`, `model`, `tools`, `temperature`,
  …) and **`command`** (record; each entry requires `template`, optional
  `description`/`agent`/`model`/`variant`/`subtask`).
- V2 docs (opencode.ai/v2/docs/config, /v2/docs/build/plugins) document
  **`plugins`** (plural), incl. local dirs / absolute paths / `file://` and
  `{package, options}`.
- Installed runtime: `opencode v2.0.26` (CLI) plus the running 2.0.27 desktop
  service. **Both spellings load**; the singular is a legacy alias that
  `opencode debug config` shows normalized to `plugins` in the parsed document
  (the file on disk keeps `plugin`). Invalid values under either key are
  silently dropped (V2 ignores excess/invalid properties) — so a config that
  "passes" is not proof the key was applied; the load log is.
- Conclusion: the owner's `plugins` is the **correct V2 spelling**; the
  published schema is the stale V1 shape, and `docs/agents.md`'s "field-level
  source of truth is https://opencode.ai/config.json" inherits that drift.
  Editor IntelliSense will flag `plugins`; the runtime applies it. The owner's
  file was not touched.

### Options and real costs

| Option                                                               | Real cost                                                                                                                                                                                                                     | What it buys                                                                                                                                                                                                                           | What it breaks / would take                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Keep the file seam (current shape)                               | 15 tracked files / 31,905 B content (72K blocks) + 3,088 B config; 2 gitignored derived copies (~549 KB + 18.5 KB sources)                                                                                                    | Per-file `x-generated` provenance + checksum state (refresh / modified-skip / ack baseline / backup / propose), `doctor --agents` per-file statuses, orphan reaping by recorded template, markdown diffs, capability-matrix derivation | Nothing — no change. The copies never enter git accounting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| (b) Inline agents/commands into `opencode.json(c)`                   | Collapses 15 files into `agent`/`command` keys — the schema supports `prompt`/`template` etc.                                                                                                                                 | One config surface; fewer files per adopter tree                                                                                                                                                                                       | Per-file provenance becomes per-key (no checksum/ack/backup/propose model exists for keys); `init` has no config-merge story — today **any** existing `opencode.json(c)`/`.opencode/opencode.json(c)` makes it skip the generated config entirely (`OPENCODE_CONFIG_CANDIDATES`), so adopters with their own config would get no agents/commands at all; `doctor --agents` per-file statuses need a per-key comparator; `capability-matrix.json`'s opencode derivation and its tests name the generated `.opencode/agents`/`.opencode/commands` + `opencode.jsonc`; prompts (3.4–6.2 KB agents, 0.5–1.9 KB commands) become escaped JSON strings. Would take a config-key generator + merge/update path, a per-key provenance/ack model (or a recorded scope reduction), doctor rework, matrix + seam-test updates (`init-opencode.test.ts`, `adapter-selection.test.ts`), and an adopter migration story. |
| (c) Load the plugin via a config `plugin(s)` entry in this repo only | Still needs a resolvable artifact: absolute path (machine-specific, like the owner's harness), a package spec (requires the install the seam deliberately avoids), or the committed `opencode/plugins/arggon/index.bundle.ts` | One loading path in config instead of directory discovery                                                                                                                                                                              | Pointing at the committed bundle diverges this repo from every adopter's seam (they have no `opencode/` dir; they vendor the copy) and interacts with: `doctor`'s staleness detection (compares copy bytes vs the committed bundle; with no copy it reports missing/unverified — new comparator needed), `npm test`'s copy-rewrite step, the `.gitignore` entries for the copies, and the TUI entry (`tui.tsx` is discovered beside `index.ts` in the convention dir — a config entry pointing at the bundle leaves the TUI undiscovered unless the dir stays, i.e. a mixed shape). Buys little: the convention dir already loads with zero config (verified).                                                                                                                                                                                                                                             |

### Recommendation + the strongest argument against it

**Recommendation: keep the file seam (a), and leave the plugin on the
convention directory.** The measured cost is 15 tracked files / 31.9 KB of
markdown + 3 KB config; the ~549 KB plugin copy is a gitignored derived
artifact that never enters the repo's accounting, and the runtime loads it with
zero config. In exchange the seam keeps the per-file provenance/ack/doctor
model that the config-key shape cannot express without a new subsystem, and
nothing here requires a decision to change.

**Strongest argument against it:** the real cost is not the 32 KB but the
_machinery_ — `x-generated` markers, checksums, ack baselines, orphan reaping,
per-file doctor statuses, seam tests and a capability-matrix derivation all
exist because these are files. Inlining would retire a whole subsystem, and
generated prompt blobs are not reviewed by hand anyway, so the readability loss
is mostly theoretical. If the owner's goal is minimal seam surface rather than
fewer bytes, (b) is the only option that removes machinery — that is a product
decision for the lead, not a footprint calculation.

Acceptance boxes 2 and 3 are conditional on decisions this item recommends
against; they stay unticked so the lead can tick them if the decision goes the
other way.

### Hygiene implemented (acceptance 4)

Root `.gitignore` gains, after the `.opencode/plugins/arggon/tui.tsx` block:

```
# task-seam-footprint-config-inline-evaluation: machine-local OpenCode
# agent-tooling scratch — NOT the seam. `.opencode/opencode.json` is this
# machine's local harness plugin registration (an absolute path outside the
# repo) and `.opencode/harness/` is that harness's state; the project config is
# the tracked `opencode.jsonc`. Untracked, they showed in `git status` and made
# `git worktree remove` refuse a worktree where a session had run the harness
# (untracked ≠ ignored). Ignored, they no longer block pruning; a fresh clone
# never sees them.
.opencode/opencode.json
.opencode/harness/
```

Evidence: the primary checkout's `git status --short` was exactly
`?? .opencode/harness/` + `?? .opencode/opencode.json`; probe — a fresh repo
with a linked worktree containing `.opencode/harness/friction.jsonl` refuses
`git worktree remove` ("contains modified or untracked files"), and succeeds
once `.opencode/harness/` is in the committed `.gitignore`. `start`'s scoped
clean-tree rule only blocks untracked files under the tracker dir, so these
never blocked `start`; the pruning refusal is the real cost.

**Template decision: no change to `templates/docs/gitignore`** (recorded, per
mandate). Reasons: (1) `.opencode/opencode.json` is a legitimate adopter
project-config location (one of `OPENCODE_CONFIG_CANDIDATES`) — ignoring it in
every generated tree would silently untrack an adopter's config; (2)
`.opencode/harness/` is opencode-autoharness's state, not an ArggonManager path
— the generated `.gitignore` deliberately carries only product-owned machine
state (`.arggon.env`, spec worktree-env-contract-016), and the `.zcode/`
precedent (bug-harness-config-churn) put that tool-specific ignore in this
repo's own `.gitignore`; (3) the template is written only when the adopter has
no `.gitignore`, so a dead line would rarely land. If the autoharness wants
adopters to ignore its state, that belongs in its own install docs.

### Gates (expected vs observed)

- `npm run arggon -- validate` → expected 0 errors; observed
  `arggon validate: ok (0 warning(s), convention v5)`.
- `npx prettier --check` on the changed markdown (this item) → expected pass;
  observed `All matched files use Prettier code style!`. `.gitignore` has no
  prettier parser (prettier does not format it), so the ignore lines are
  verified with `git check-ignore -v` instead.
- No template or init test touched → `test:structure` / `lint:structure` not
  required by the mandate; run anyway as extra evidence: `test:structure` →
  `5 passed; 0 failed`, `lint:structure` → clean (no findings).

### Out of scope, reported only

- `.opencode/agents/*.md` carry the `arggon:generated` marker **twice**
  (templates have one; `stampGeneratedContent` prepends another for
  frontmatter destinations). Cosmetic, pre-existing, not touched.
- The primary checkout's derived plugin copies are stale (`doctor`:
  `current: false`) — expected after releases; `arggon init` / `npm test`
  regenerates them.
- A global `~/.config/opencode/plugins/arggon` install duplicates the project
  plugin id, so the project copy loads as failed (`Duplicate plugin ID: arggon`)
  in the primary. The project seam still works where no global copy exists; the
  owner may want to uninstall the global one.

### 2026-10-13 @ses_ecd832dc8ffeqhaGFiLKLTG8Eh
Evidence (maker run, 2026-10-12; branch feat/task-seam-footprint-config-inline-evaluation, PR #754):

- Inventory re-measured: 15 tracked seam files = 19,812 B agents + 12,093 B commands = 31,905 B content (72K in 4K blocks); root opencode.jsonc 3,088 B tracked/adopter-edited; plugin copies gitignored derived (expected 549,029 B = marker + 548,958 B bundle; primary copy 481,162 B is stale, doctor plugin.current=false; tui.tsx primary copy 15,742 B vs 18,524 B source).
- Primary git status was exactly `?? .opencode/harness/` + `?? .opencode/opencode.json` (machine-local harness config 115 B + state 3,623 B).
- Loading probed, not read: convention dir `.opencode/plugins/arggon/index.ts` discovered (opencode api plugin.list, primary; fails only with Duplicate plugin ID because a global ~/.config/opencode/plugins/arggon install exists); config entry probe on opencode v2.0.26 via `opencode run --standalone --print-logs` logs `msg="loading plugin" id=/tmp/opencode/seam-d/plug entrypoint=file:///tmp/opencode/seam-d/plug/index.ts` and setup marker appears; same with `plugin` singular.
- Idiom: published config.json (fetched, 39,039 B) names `plugin` (singular) + inline agent/command; V2 docs/runtime use `plugins` (plural); both keys load and `opencode debug config` normalizes singular to plural. Owner's `plugins` is correct for V2; the published schema is stale V1. Owner's file untouched.
- Gates: `npm run arggon -- validate` → ok (0 warnings, convention v5); `npx prettier --check <item.md>` → pass (.gitignore has no prettier parser; verified with `git check-ignore -v`); `npm run test:structure` → 5 passed; `npm run lint:structure` → clean; ignore probe: simulated `.opencode/harness/friction.jsonl` + `.opencode/opencode.json` leave git status clean; `git worktree remove` refuses untracked harness state and succeeds once ignored.
- Out of scope, reported: agents carry the x-generated marker twice (templates have one); primary plugin copies stale; global arggon plugin duplicates the project id.

### handoff 2026-10-13 @ses_ecd832dc8ffeqhaGFiLKLTG8Eh (session: ses_ecd832dc8ffeqhaGFiLKLTG8Eh) — next: Review PR #754 (feat/task-seam-footprint-config-inline-evaluation); record the box-1 decision (recommendation: keep the file seam), then merge or spin follow-ups for boxes 2/3.
- branch: feat/task-seam-footprint-config-inline-evaluation
- open questions: Keep vs inline (boxes 2/3 conditional); global duplicate arggon plugin install in ~/.config/opencode; double x-generated marker on agents; stale primary plugin copies

### 2026-10-13 @arggon-standards-reviewer
verdict: request-changes (the inlining option is written in V1 key/field names; the decision input must be V2-shaped)

Scope: item text only. The `.gitignore` hygiene change is verified as-is and needs no change.

**Blocking finding — the (b) row and the "Schema facts" bullets state the inlining mechanism in the published (V1) schema's names, not V2's:**
- Item text: "Collapses 15 files into `agent`/`command` keys — the schema supports `prompt`/`template` etc."; the Context bullet lists `agent` (`prompt`, `description`, `mode`, `permission`, `tools`, `temperature`, …). The same item concludes that schema is the stale V1 shape, and `docs/agents.md`'s own rule is "Never map V1 fields into V2 config".
- V2 (the runtime in use) uses `agents`/`commands` (plural); the V2-native agent prompt field is `system`, permissions are `permissions`; the V2 agents guide says verbatim: "Do not use legacy top-level fields such as `temperature`, `top_p`, `prompt`, `permission`, `tools`, `disable`, or `maxSteps` in new V2 agent configuration." (V1 config is intended to stay compatible, so the V1 shape may still load — but then say that, and say which shape the option means.)
- Sources read today: https://opencode.ai/v2/docs/config (fields list `agents`, `commands`, `plugins`; a `commands` entry uses `template`), https://opencode.ai/v2/docs/agents (JSONC example under `agents` with `system`/`permissions`).
- Requested fix (2 lines): name the V2 keys/fields in the (b) row and the Context bullet (V2 `agents`/`commands`, `system`/`permissions`), or record the V1-compat route explicitly — but only claim alias acceptance if probed (`plugin` was probed; `agent`/`agents` was not).
- Same bullet, second item: "Invalid values under either key are silently dropped (V2 ignores excess/invalid properties)" has no probe recorded; probe it or mark it as an inference.

**Verified by reading (no action; evidence for the record):**
- Inventory exact: `git ls-files .opencode` = 15; `wc -c` agents 19,812 + commands 12,093 = 31,905 B; `du` 28K/44K; root `opencode.jsonc` 3,088 B tracked. Plugin copies gitignored/derived: primary 481,162 + 15,742 = 496,904 B (stale), expected 549,029 B = 71-B init marker + 548,958-B bundle (arithmetic checks against `stampGeneratedContent` + `BUNDLE_BANNER`).
- Owner's idiom: `plugins` is the V2 spelling and the published schema is V1 — additionally supported by the vendor's V2 guidance: "The schema served from https://opencode.ai/config.json may describe V1 ... Never use it to infer V2 field names or shapes." Citing that sentence removes the inferential character from the item's conclusion.
- (b)'s central cost is real: `findOpenCodeConfig` (cli/src/adapters.ts:70-75, cli/src/docs.ts:578-585) returns the first non-arggon config, and init present-skips the generated config (cli/src/docs.ts:1408-1419); cli/src/init-opencode.test.ts "opencode seam: conditional config" covers all four shapes. An adopter with their own config gets no generated config, so inlining agents/commands there would deliver nothing.
- Recommendation honesty: (a) is recommended and the strongest counter-argument (inlining retires a whole subsystem — a product decision) is stated; accepted.
- Hygiene: `git check-ignore -v` → `.gitignore:34:.opencode/opencode.json` and `.gitignore:35:.opencode/harness/` (both hit, nested files included). Live check: this worktree carries `.opencode/harness/.policy-shown` and `git status --short` is clean — the ignore works. It cannot hide a seam artifact: the generated config destination is root `opencode.jsonc` (`OPENCODE_CONFIG_DEST`, cli/src/docs.ts:421); `.opencode/opencode.json(c)` are adopter-config candidates only; `.opencode/harness/` is third-party state; .gitignore never affects tracked files.
- Template decision sound: `templates/docs/gitignore` carries only `.arggon.env` (4 lines) and is kept when the adopter has one; the `.zcode/` precedent sits in this repo's own .gitignore.
- Scope: `gh pr diff 754` = exactly `.gitignore` + the item; no seam rework; the owner's file is not in the diff. Acceptance: boxes 4/5 ticked with the evidence above, 2/3 conditional and honestly unticked, 1 left to the lead — correct by design.

**Non-blocking, record only:**
- `docs/agents.md:655` ("the field-level source of truth is https://opencode.ai/config.json") is contradicted by the vendor V2 guidance and is the drift this item found. It is a methodology carrier — the fix belongs in its own item with an impact-class statement; please file it (AGENTS.md: findings become items), e.g. under story-opencode-adapter.
- The machine-local file still participates in seam discovery: in the primary checkout `findOpenCodeConfig` sees `.opencode/opencode.json` and init present-skips the generated `opencode.jsonc` (same code path as (b)). Pre-existing and unchanged by gitignoring; one line in the item would keep box 4's "out of seam accounting" precise (out of git accounting, still a config candidate).
- Primary harness state grew between measurement and review (`friction.jsonl` 3,598 → 3,861 B) — live state; reinforces the machine-local argument.
- The double `arggon:generated` marker on agents is real (`.opencode/agents/arggon-maker.md` lines 2-3); the out-of-scope note is accurate.

**Verifier (for the merge record; this verdict does not turn on it):** reproduce the maker's gates in the worktree — `npm run arggon -- validate`, `npx prettier --check <item>`, `npm run test:structure`, `npm run lint:structure`, `git check-ignore -v .opencode/opencode.json .opencode/harness/`, the worktree-prune probe, and for box 5 `opencode api plugin.list` / the config `plugins` load probe.

— standards review, session ses_ecd6b7d30ffexsOrPyRjyceCMS (read-only; no project files touched)
