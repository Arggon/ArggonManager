---
type: bug
status: todo
id: bug-update-depends-on-multiline-rejected
title: update --depends-on serializes multi-line flow YAML that validate rejects as BROKEN_YAML
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-18"
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

- [ ] `update --depends-on` / `--add-depends-on` (CLI + native) emits single-line frontmatter the kernel parser accepts, for any entry count — a round-trip test pins write→validate→read
- [ ] The fix covers `labels` and any other list field sharing the serializer, or states why depends_on is the only one
- [ ] `npm test` green; prettier clean; `arggon validate` green; PR opened

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

### 2026-10-18 @ses_eaf525ec2ffeqC8K8Wm9a6jf2r
### 2026-10-18 @arggon-maker — fix implemented, PR #862 opened (behavioral)

**Branch** `fix/bug-update-depends-on-multiline-rejected` (commit `b5da6e12`) → PR https://github.com/Arggon/ArggonManager/pull/862

**Diagnosis (corrects one premise in this body).** The write path never emits multi-line YAML: `formatValue` in `lib/src/frontmatter.ts` always writes a list inline (`depends_on: [a, b, …]`), for any entry count — verified on the built CLI in a temp fixture. The breakage comes from the *repo formatter* reflowing that line (prettier, `printWidth: 100`), which is why `update` returned `ok:true` and the failure only appeared at the next `validate`. So this is one parser defect with three producers (the recorded notes), and the fix is parser-side as the cancelled duplicate `bug-prettier-reflow-breaks-item-frontmatter` cross-posted.

**Expected vs observed (built `dist/cli.js`, temp fixture tree, real prettier):**

| step | expected | observed |
| --- | --- | --- |
| `update task-long-dependency-identifier-000 --depends-on <6 ids> --json` | ok, single physical `depends_on:` line | raw file: `depends_on: [task-…-001, …, task-…-005]` (one line, >100 chars); item `depends_on` = the 6 ids |
| `validate --json` after that write | `ok:true`, `errors: []` | `ok=True errors=[] warnings=[]` |
| real `prettier --write` on that item file | reflows to `depends_on:\n  [\n    id,\n …\n  ]` | exactly that shape (captured byte-for-byte; also the 2-line `depends_on:\n  [a, b]` short wrap) |
| `validate` on the prettier-wrapped file — **unmodified main checkout's parser** | (before fix) refuse | `error …: invalid frontmatter line: "  [" [BROKEN_YAML]` |
| `update --status in_progress` on that file — **unmodified parser** | (before fix) refuse | `arggon update: …: invalid frontmatter line: "  ["` |
| `validate` on the prettier-wrapped file — **this branch's parser** | green | `ok=True errors=[] warnings=[]` |
| close-out flip `--status in_progress` then `--status done` (this branch) | both succeed | both succeed; final `validate: ok (0 warning(s), convention v5)` |

**Change.** `parseFrontmatter` now assembles a list value continued over the following lines when those lines are a wrapped flow sequence (with the formatter's trailing comma) or an indented block sequence (`- item`), and returns exactly the list the single-line form yields. Scoped: an indented line that is neither a block entry nor an open flow sequence, and an unterminated flow sequence, still fail `INVALID_FRONTMATTER_LINE` → `BROKEN_YAML`. The writer is unchanged.

**Coverage of the list class (acceptance box 2).** The fix is on the shared value reader, not keyed on `depends_on`: `labels` and any `x-*` list go through the same path on both sides (`formatValue`'s array branch writes them, `readValue`/`parseValue` reads them). Pinned for `labels` and `depends_on` in `cli/src/frontmatter.test.ts` (all four shapes) and the integration half in `cli/src/deps.test.ts`.

**Gates run (this worktree):** `npm test` 167 files / 3699 tests passed; `npm run arggon -- validate` ok (0 warnings, convention v5); `npm run lint` green; `npm run test:structure` 5 passed/0 failed; `npm run lint:structure` green; `prettier --check` on all changed files clean; `npm run check:plugin` clean (bundle regenerated and committed); `npm run build` green.

**Methodology impact class: behavioral.** `ArggonManager/docs/convention.md` is an ADR 0020 carrier and a command contract widens — files the reader used to refuse now load through `validate`/`update`. References the adopter-upgrade channel (ADR 0016). No `skills/**` file changed, so no skill-copy sync is owed.

**Findings for the lead (NOT implemented here):**
1. `bug-start-claim-commit-frontmatter-fails-prettier` and `bug-session-formatter-normalizes-tracker-item-files` stay out of scope as instructed; nothing in this change touches the `title:` quoting or the blank line after the closing fence.
2. Environment observation for reviewers writing prettier-based tests: in this sandbox `npx prettier` **does not reformat markdown frontmatter for paths under `/tmp` or `/var/tmp`** (it leaves the inline list alone) while the same bytes under `/home/…` or a repo path reflow. A formatter-integration test in a `mkdtemp` (i.e. `/tmp`) would therefore be vacuous, which is why the new tests pin the formatter's captured output shapes as literals instead of re-running prettier. Not a defect of this change; flagging it so a reviewer does not read a green prettier run in `/tmp` as evidence.
3. Pre-existing, unreachable-via-CLI: `parseValue` splits a flow list on `,` naively, so an element containing a comma (writer-side quoted, e.g. `labels: ["a, b"]`) would not round-trip. `assertLabels`/`assertValidId` forbid commas, so no reachable path produces it; left alone rather than widening this diff — say the word and I will file it as its own bug.

Acceptance boxes 1–3 are met by this branch + PR #862; leaving the tick/flip to you.
