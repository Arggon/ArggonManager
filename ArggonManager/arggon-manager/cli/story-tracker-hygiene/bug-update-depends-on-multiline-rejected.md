---
type: bug
status: in_progress
id: bug-update-depends-on-multiline-rejected
title: "A wrapped frontmatter list value (depends_on: + an indented [...] block) is refused as BROKEN_YAML, so a prettier-formatted item becomes un-flippable"
assignee: arggon-delivery-lead
branch: fix/bug-update-depends-on-multiline-rejected
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-18"
claimed_at: "2026-10-18T20:21:15.069Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-update-depends-on-multiline-rejected
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-update-depends-on-multiline-rejected.md
  Leaves live only under a story. id is the filename stem: bug-update-depends-on-multiline-rejected.
  CLI `arggon create bug update-depends-on-multiline-rejected` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# update --depends-on serializes multi-line flow YAML that validate rejects as BROKEN_YAML

## Context

Found 2026-10-12 by the delivery lead while wiring `depends_on` on `task-validate-refuses-placeholder-bodies`: `tools.arggon.update({ id, depends_on: [6 ids] })` returned `ok:true` and auto-committed a frontmatter block of the form `depends_on:\n  [\n    a,\n    ...,\n  ]` — which `arggon validate` rejects with `BROKEN_YAML: invalid frontmatter line: "  ["`. The kernel frontmatter parser (`lib/src/frontmatter.ts`) is strictly single-line `key: value`; any continuation line throws. So the write path produces bytes the read path refuses, and the failure surfaces only at the next `validate` (here, the pre-commit hook), not at the `update` call that caused it. Hand-repair to single-line flow style passes validate but trips `prettier --check` (printWidth 100); block `- ` style passes prettier but fails validate the same way. There is no serialization that satisfies both — the write path must emit what the read path accepts.

## Acceptance

- [x] `update --depends-on` / `--add-depends-on` (CLI + native) emits single-line frontmatter the kernel parser accepts, for any entry count — a round-trip test pins write→validate→read
- [x] The fix covers `labels` and any other list field sharing the serializer, or states why depends_on is the only one
- [x] `npm test` green; prettier clean; `arggon validate` green; PR opened

## Notes

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
**Second producer observed (2026-10-15, delivery lead), recorded here so the fix covers all producers.** While closing `task-cli-start-remediation-tail-clipped-on-human-channel`'s sweep item the standard close-out path (acceptance tick → `npx prettier --write <item.md>` → validate) produced the same unparseable shape from a THIRD producer — the repo's own formatter reflowing a long INLINE list:
```yaml
depends_on: [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
```
becomes
```yaml
depends_on:
  [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
```
and the strict single-line parser then refuses `invalid frontmatter line: "  [task-…, task-…]"` — `arggon validate` red and `arggon update --status done` refuses, so the close-out flow itself can make an item un-flippable. So the producers are: the `update` writer (block form, this item) and the formatter (two-line inline, plus `bug-start-claim-commit-frontmatter-fails-prettier`'s `title:` quoting hunk and `bug-session-formatter-normalizes-tracker-item-files`'s body normalisation). One parser/writer-side fix that accepts the wrapped-list shape — scoped so a genuinely broken line is still refused — closes my instance; my filed instance (`bug-prettier-reflow-breaks-item-frontmatter`) is being closed as a duplicate so the fix is not split across two items on the same parser line.

### 2026-10-18 @Arggon

verdict: request-changes (item-body record rewritten by formatter churn in the merge commit — the code change itself is approved on reading, pending the probes below)

Standards review of PR #862 (branch `fix/bug-update-depends-on-multiline-rejected`, read-only; I ran no gates — execution evidence is the verifier's, routed below).

## What I read

`git diff origin/main...HEAD` (6 files); full `lib/src/frontmatter.ts`; the diffs of `cli/src/frontmatter.test.ts` and `cli/src/deps.test.ts`; the `ArggonManager/docs/convention.md` hunk in its §Frontmatter schema context; the item body with all comments; the PR #862 body and its CI rollup (`cli` / `tasks-validate` / `ui-smoke` SUCCESS, `CLEAN`); merge commit `82f19eb2` and **both its parents'** copies of this item file; the vendored parser region of `opencode/plugins/arggon/index.bundle.ts`; `.github/workflows/ci.yml`; `cli/src/adopter-template-invariant-drift.test.ts`; `ArggonManager/docs/agents.md` §Changing the methodology itself; `cli/src/spec.ts` `parseDocFrontmatter`; `cli/src/playbooks.ts` frontmatter writer; `lib/src/items.ts` (`softTryLoadItem`, `stringField`).

## Verified by reading (so the verdict is not resting on the maker's report)

1. **The writer is unchanged and always inline.** `formatValue`'s array branch (`lib/src/frontmatter.ts:352-363`) returns `[${…join(", ")}]` for any entry count. The item's original premise ("`update` serializes a multi-line flow block") is wrong and the maker's correction is right: the reflow producer is the formatter, which is why the failure only appeared at the next `validate`. There are 4 tracked item files with list lines over `printWidth: 100` (e.g. `task-validate-refuses-placeholder-bodies.md`, a 230-char `depends_on:`) — i.e. the wedge was latent across the tree, not a one-off.
2. **The widening is genuinely scoped, by reading it line by line.** `readValue` consumes following lines only for (a) an indented `[`-opening flow sequence and (b) indented `- ` block entries; anything else leaves `key:` null so the next iteration refuses that line by name (`INVALID_FRONTMATTER_LINE` → `BROKEN_YAML`). `readFlow` refuses an unterminated sequence instead of swallowing it, and its depth scan is quote-aware (doubled single quotes, backslash escapes) — so a `]` inside a quoted element cannot close early, which the writer's own quoting makes reachable. Both loops terminate (`end + 1 < lines.length`, bounded block loop); no writes, no new runtime dependency.
3. **The tests discriminate.** Every newly accepted shape was a hard throw before the change (a continuation line with no `:`), so the four-shape unit test and the two integration tests fail on `main` — they are not vacuous. `deps.test.ts` drives the kernel path (`runUpdate` from `@arggondev/lib`), which is exactly where the changed reader lives; the write→validate→read round trip and the `todo → in_progress → done` flip are pinned there. One honest gap: the CLI _argument_ half of acceptance box 1 is not separately driven, and the formatter step is a pinned literal rather than a real `prettier` run (probes 1-3 close both).
4. **Docs travel with the change.** `convention.md` §Frontmatter schema gains the grammar the implementation actually has, in the same PR. Grepping the old strictness across `README.md` / `docs/**` / `skills/**`: the only hits are item Notes history (append-only; correctly left alone) and the abridged adopter template `templates/docs/docs/convention.md`, which states no line grammar at all — so no template or skill sync is owed (and `adopter-template-invariant-drift` pins only the carriers' invariants/scope bullets, not this section). `cli/src/spec.ts`'s separate `parseDocFrontmatter` deliberately ignores list/nested lines for prose docs, and `playbooks.ts` writes scalars only — the widening creates no second reader and no silent fork.
5. **Methodology impact class: behavioral, correctly declared on both required surfaces** (PR description and an item comment — `agents.md` §Changing the methodology itself), with the ADR 0016 channel referenced. The ADR-process list does not owe an ADR for a permissive read-form widening (not a reserved namespace, not a breaking schema change); the impact declaration is the required surface and it is present and correct.
6. **The vendored surface is covered.** `ci.yml:48` runs `check:plugin` in the `cli` job, so green CI pins `index.bundle.ts` to `lib/src`; I compared the bundle's embedded `parseFrontmatter`/`readValue`/`readFlow`/`parseValue` against the source and they are equivalent modulo type erasure. No other vendored copy of the parser exists (only `lib/dist`, an artifact, and the gitignored `.opencode/` build).

## F1 — BLOCKING: this branch's merge commit rewrote another writer's dated note in this item's body

Evidence (read, not inferred):

- `git show b5da6e12:<item>` **and** `git show 82f19eb2^2:<item>` both carry the §Notes/2026-10-15 record with its before/after pair: the first fence is the single-line `depends_on: [task-cli-…, bug-three-…]`, the second the wrapped form.
- `git diff 82f19eb2^1 82f19eb2 -- <item>` shows the merge commit itself replacing the **first** fence's content with the already-wrapped form, adding a blank line after the closing `---` (now line 13) and after the `### 2026-10-15 @…` heading. The current file (lines 37-51) therefore reads "wrapped … becomes … wrapped", directly contradicting its own lead-in ("…the formatter reflowing a long INLINE list:").

Why this blocks: the item body is the durable, append-only record and that dated note belongs to the delivery lead (2026-10-15), not to this branch's writer — a maker must not mutate another writer's recorded note. It is worse here than noise: the destroyed evidence is the before/after that _this very bug_ exists to document. The blank-line-after-`---` hunk is the exact signature of `bug-start-claim-commit-frontmatter-fails-prettier`, and body normalization is what `bug-session-formatter-normalizes-tracker-item-files` exists to stop — so this PR carries a live instance of that class, in `story-tracker-hygiene`.

Fix (narrow, item file only, no code change): restore the 2026-10-15 note's two blocks verbatim from `82f19eb2^2` and drop the incidental blank-line churn — **do not** `git checkout <main> -- <item>`, which would also drop the claim lines (`status`/`assignee`/`branch`/`claimed_at`/`worktree_path`) that must stay. Then re-run `npm run arggon -- validate`.

## F2 — not blocking (pre-existing class; worth its own item)

The tolerance is scoped by **shape**, never keyed on the field: `readValue` does not see the key, so `title:` + an indented block list now loads as `["a","b"]` and `stringField` (`lib/src/items.ts:277`) silently coerces it to `"a,b"` with no validate error. This is **not introduced in kind** by this change — `title: [a, b]` on a single line already produces `String(["a","b"]) === "a,b"` on `main` — the PR only extends an existing gap to one more shape. Recommendation: file a follow-up bug ("frontmatter fields are not type-checked; a list in a scalar field is silently comma-joined"; fix = per-field type check in the shape checks). Not this PR's scope and not a fork of the documented grammar.

## F3 — not blocking, but it must be filed (maker's finding 3)

The naive `,` split in `parseValue` is real and correctly deferred: `assertLabels` (`lib/src/ids.ts:72`) and the id patterns forbid `,`, so no CLI path can build a list element containing a comma. But review-bar item 8 says deferred work needs an item — the lead should file it (or record a decision not to) before merge, together with F2.

## F4 — advisory: `convention.md` describes less than the implementation accepts

Two accepted read shapes are not named by the new paragraph: (a) a flow sequence opened on the key's own line and continued below (`depends_on: [a,` / `  b]`), and (b) the `parseValue` empty-part drop (a trailing comma is dropped — documented indirectly — and an interior empty element `[a, , b]` is dropped too, where it previously became `""`). One more clause is worth having: a value that merely _starts_ with `[` is now treated as a flow sequence, so a previously-loadable scalar such as `x-note: [TODO` now refuses loudly. That direction is conservative (loud, not silent) and consistent with the stated rule, but a reader of the contract should know it. Single sentence, non-blocking.

## F5 — advisory: an unverified mechanism claim is being handed on as guidance

Finding 2 ("in this sandbox `npx prettier` does not reformat markdown frontmatter for paths under `/tmp`") is recorded for other reviewers, and I could not verify it by reading. Prettier 3 infers the parser from the file extension and resolves config from the file's directory, so a temp file whose name has no `.md` extension (or with no config in scope) is at least as likely an explanation — probe 4 settles it. The test as written is fine either way (the literal is the captured formatter output); only the _explanation_ should not be codified as a rule before it is probed.

## Not verified by me (needs the verifier)

The real `prettier` bytes on a repo path; the end-to-end close-out on the built binary (the maker's expected/observed table is maker-reported and I reproduced none of it); the `/tmp` mechanism.

## Probes needed

1. cwd `/home/arggon/Projects/ArggonManager-bug-update-depends-on-multiline-rejected`, after `npm run build`: `mkdir -p .probe && cp ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-validate-refuses-placeholder-bodies.md .probe/ && npx prettier --write .probe/task-validate-refuses-placeholder-bodies.md && sed -n '1,20p' .probe/task-validate-refuses-placeholder-bodies.md`. Demonstrates the byte shape real prettier emits for a 230-char `depends_on:` line, on a repo path. **Would change the verdict** if prettier emits a shape `readValue` refuses or mis-reads (e.g. a block sequence, or a folded scalar) → the change is then incomplete and the code goes back to the maker.
2. Same cwd: place that wrapped file at an item position in a temp tree (`node dist/cli.js init <tmp-repo>`) and run `node dist/cli.js validate --json` → expected `ok:true`, `errors: []`. Control on unmodified main (primary checkout, after its own build): the same file → expected `BROKEN_YAML` with `invalid frontmatter line: "  ["`. Demonstrates the fix is what makes it pass, not merely a green suite.
3. Same cwd, on a temp fixture: `node dist/cli.js update <leaf> --depends-on <8 long ids> --json` (expect one physical `depends_on:` line, `item.dependsOn` = 8 ids) → `validate --json` (expect `errors: []`) → `npx prettier --write <item.md>` → `validate --json` (expect `errors: []`) → `update --status in_progress` then `--status done` (expect both ok). This is acceptance box 1 and the reported close-out wedge, on the real binary.
4. Same cwd: write the same >100-char inline list to `/tmp/arggon-probe/x.md` and to `.probe/x.md`, run `npx prettier --write` on each plus `npx prettier --config .prettierrc.json --write /tmp/arggon-probe/x.md`, and report which reflow. Settles F5 before the `/tmp` claim is codified (and tells the lead whether a playbook note is worth writing).
5. Same cwd: `cp ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-update-depends-on-multiline-rejected.md .probe/item-copy.md && npx prettier --write .probe/item-copy.md && diff <(git show 82f19eb2^2:ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-update-depends-on-multiline-rejected.md) .probe/item-copy.md`. Expected: the same churn that landed in `82f19eb2` (inline example inside the ```yaml fence reflowed, blank lines added after the `### <date>` heading and after the closing `---`). Demonstrates what rewrote F1's record and supplies `bug-session-formatter-normalizes-tracker-item-files` with its evidence.
6. Same cwd: refusal controls on the real binary — an item with `labels:` + an indented `garbage` line, and one with an unterminated `labels: [a,` — `validate --json` → expected `BROKEN_YAML` for each. Demonstrates the permissiveness is scoped on the CLI surface, not only in unit tests.

## Merge call

**No merge yet.** F1 is a narrow, mechanical fix on the item file and touches no code; the code change itself is approved as read (scoped widening, discriminating tests, docs in the same PR, correct impact class, vendored bundle pinned). Re-approval after the fix needs only the restored record, the probe results and the two follow-up items filed.

### 2026-10-18 @arggon-verifier
verdict: all six probes pass — the code change is confirmed at the CLI surface (not only by unit tests); probe 4 refutes the advisory `/tmp` mechanism claim (see below).

Read-only execution on branch `fix/bug-update-depends-on-multiline-rejected` (HEAD `d825c9f2`), worktree `/home/arggon/Projects/ArggonManager-bug-update-depends-on-multiline-rejected`. Prerequisite: `npm run build` → exit 0; the regenerated `opencode/plugins/arggon/index.bundle.ts` was byte-identical to the committed one. No tree change; scratch dirs deleted; `git status --short` empty at the end.

## Probe 1 — real prettier byte shape for the 230-char `depends_on:` on a repo path
- command: `mkdir -p .probe && cp ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-validate-refuses-placeholder-bodies.md .probe/ && npx prettier --write .probe/task-validate-refuses-placeholder-bodies.md && sed -n '1,20p' .probe/task-validate-refuses-placeholder-bodies.md`
- expected: a shape `readValue` now accepts (wrapped flow sequence), not a block sequence or folded scalar
- observed: reflowed to a wrapped FLOW sequence — `depends_on:` then indented `[`, one element per line, trailing comma
- exit 0. Does not prove: that the new reader parses it (probe 2 does); one file is not all shapes; printWidth only reflows above 100 chars.

## Probe 2 — real binary on the wrapped file, and the CONTROL on unmodified `main`
Control method: instead of `git worktree add` (a git write) `main` was reproduced with `git archive main | tar -x` into `/tmp/opencode/ctl-862`, `node_modules` symlinked per-entry with `@arggondev/lib` pointed at the archive's own `lib/`, and its own `npm run build` (exit 0). No git write; the item worktree was untouched.

- 2a command: `cd /tmp/opencode/arggon-p2 && node <WT>/dist/cli.js validate --json` (temp tree: `init`, epic/story chain, 6 dep items, the prettier-wrapped task file placed at a leaf position)
  - expected `ok:true, errors:[]` → observed `{"ok":true,…,"errors":[],"warnings":[]}`, exit 0
- 2b command: `cd /tmp/opencode/arggon-p2 && node /tmp/opencode/ctl-862/dist/cli.js validate --json` (same tree, same bytes, unmodified `main` parser)
  - expected `BROKEN_YAML` with `invalid frontmatter line: "  ["` → observed exactly that, `"code":"BROKEN_YAML"`, exit 1

→ The fix is what makes the tree pass; the reported failure reproduces on `main` for identical bytes.

## Probe 3 — close-out wedge end-to-end on the real binary (acceptance box 1)
- command: `node dist/cli.js update task-probe-closeout --depends-on <8 long ids> --json`; count physical `depends_on:` lines; `validate --json`; `npx prettier --write <item>`; `validate --json`; `update --status in_progress --json`; `update --status done --json`
- expected: one physical `depends_on:` line, 8 ids, validate `errors:[]` before AND after prettier, both flips ok
- observed: update `ok:true`, 8 ids (JSON key is `item.depends_on`); physical `depends_on:` lines **1** (length 324); validate after update `{"ok":true,…,"errors":[]}`; prettier reflowed it to `depends_on:` + indented `[…]`; validate after prettier `{"ok":true,…,"errors":[]}`; `in_progress` `ok:true`; `done` `ok:true` — exits 0/0/0/0/0

→ Decisive: after `npx prettier --write` reflowed the list the item stayed valid **and flippable** — the exact close-out path this item documents as previously producing an un-flippable item. Does not prove: entry counts beyond 8; the temp tree is a fixture.

## Probe 4 — `/tmp` reflow mechanism: MECHANISM REFUTED, true cause identified
- command: the same >100-char inline list written to (A) `.probe/x.md`, (B) `/tmp/opencode/arggon-probe/x.md`, (C) same as B with `npx prettier --config .prettierrc.json --write`, plus (D) `/home/arggon/arggon-probe-outside/x.md`
- observed: A **REFLOWED**; B **NOT reflowed** (byte-identical); C **NOT reflowed** (`--config` made no difference); D **REFLOWED** (full multi-line block)
- causal follow-up (decisive): the file is **ignored**, not unformattable. Prettier's default `ignorePath` is `[".gitignore", ".prettierignore"]` and this repo's `.gitignore` line 62 is `/tmp/` (line 63 `tmp/`). `--ignore-path /dev/null` on `/tmp/t1.md` → REFLOWED; default ignore-path → unchanged; `--check /tmp/t1.md` → "All matched files use Prettier code style!" (the ignored-file signature).

→ The claim recorded from the maker ("in this sandbox `npx prettier` does not reformat markdown frontmatter for paths under `/tmp`") is **wrong on both counts**: not sandbox-specific, not markdown/frontmatter-specific — prettier skips the whole file because the repo's own `.gitignore` `/tmp/` pattern matches via the default ignore-path. The reviewer's alternative hypothesis (missing config / missing `.md` extension) is also not the cause. The test in the PR is fine (its literal is real repo-path output); only the explanation must not be codified. Delivery lead: recorded as refuted in the lead verdict; no code change owed.

## Probe 5 — formatter churn vs merge commit `82f19eb2^2`
- command: `cp <item> .probe/item-copy.md && npx prettier --write .probe/item-copy.md && diff <(git show 82f19eb2^2:<item>) .probe/item-copy.md`
- expected: the churn that landed in `82f19eb2` — the inline example inside the ````yaml` fence reflowed; blank lines added after the closing `---` and after the `### <date>` heading
- observed: reproduced — the first fence's single-line `depends_on: […]` became the wrapped form, plus a blank line after the closing `---` and blank lines around the `### <date>` heading
- exit 1 (diff found differences, as expected). Does not prove: that this is the only rewrite producer; it demonstrates the mechanism on this one item file.

→ Supplies `bug-session-formatter-normalizes-tracker-item-files` with its evidence.

## Probe 6 — refusal controls on the real (fixed) binary
- command: `validate --json` on a valid fixture tree plus two malformed leaves
- expected: `BROKEN_YAML` for each malformed item
- observed: `{"ok":false,…,"errors":[{"path":"…/task-bad-garbage.md","message":"invalid frontmatter line: \"  garbage\"","code":"BROKEN_YAML"},{"path":"…/task-bad-open-bracket.md","message":"invalid frontmatter line: \"labels: [a,\"","code":"BROKEN_YAML"}]}` exit 1

→ The permissiveness is scoped by shape on the CLI surface, not only in unit tests. Does not prove: the full space of broken shapes (two controls are two controls; scoping is key-agnostic, per F2).

## Summary
| # | Probe | Expected | Observed | As specified |
|---|---|---|---|---|
| 1 | prettier on a repo-path item copy | wrapped shape the reader accepts | wrapped flow sequence | yes |
| 2a | fixed binary, wrapped file at an item position | `ok:true, errors:[]` | exact match | yes |
| 2b | control: unmodified `main`, same bytes | `BROKEN_YAML` `invalid frontmatter line: "  ["` | exact match | yes |
| 3 | update → validate → prettier → validate → in_progress → done | 1 physical line, 8 ids, both validates green, both flips ok | all met | yes |
| 4 | repo path vs `/tmp` path reflow | report which reflow | repo reflows, `/tmp` never (any config) | mechanism claim refuted; cause = `.gitignore` `/tmp/` |
| 5 | `diff` pre-merge item vs prettier(item) | merge churn reproduced | reproduced | yes |
| 6 | malformed items on the fixed binary | `BROKEN_YAML` ×2 | exact match | yes |

## Unverified / limits
- Any `depends_on` entry count beyond 8 (probe 3 used 8 long ids).
- The full set of genuinely broken shapes beyond the two refusal controls.
- The `main` control ran from a `git archive` extract of `main`, not the primary checkout — functionally equivalent for the parser, stated for the record.
