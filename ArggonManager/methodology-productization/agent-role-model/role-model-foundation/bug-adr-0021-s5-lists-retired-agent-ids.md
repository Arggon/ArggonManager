---
type: bug
status: done
id: bug-adr-0021-s5-lists-retired-agent-ids
title: "ADR 0021 §5 still lists the four retired agent ids as what agents claim as — factually wrong since PR #641"
assignee: arggon-delivery-lead
branch: fix/bug-adr-0021-s5-lists-retired-agent-ids
parent: role-model-foundation
labels: [docs, adr, roles]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
worktree_path: /home/arggon/Projects/ArggonManager-bug-adr-0021-s5-lists-retired-agent-ids
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-adr-0021-s5-lists-retired-agent-ids.md
  Leaves live only under a story. id is the filename stem: bug-adr-0021-s5-lists-retired-agent-ids.
  CLI `arggon create bug adr-0021-s5-lists-retired-agent-ids` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0021 §5 still lists the four retired agent ids as what agents claim as — factually wrong since PR #641

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

PR #641 (`db8f9821`) renamed the four shipped agent ids to their role ids
(ADR 0021 §6.2a′). ADR 0021 **§5 — the authority map — still lists the old ids** in the
"agent" rows, so the decision record now states something factually false about the
artifacts it governs:

| old id               | new id                      |
| -------------------- | --------------------------- |
| `arggon-coordinator` | `arggon-delivery-lead`      |
| `arggon-reviewer`    | `arggon-standards-reviewer` |
| `arggon-worker`      | `arggon-maker`              |
| `arggon-prover`      | `arggon-verifier`           |

Reported by the seam worker, which correctly did not edit an ADR it did not own.

## Acceptance

- [x] §5's authority-map rows name the four shipped ids (or point at §6.2a′'s mapping table, which is the single source)
- [x] Added as a **dated amendment** in the header block, in the same style as §6.1 / §6.2 /
      §6.2a′ — the decision body is not rewritten
- [x] Checked for the same drift in §1, §2 and §6.1's tables: any other place naming a retired id is corrected in the same amendment
- [x] ADR index parity green (`cli/src/adr-index-parity.test.ts`); prettier clean; `arggon validate` ok

**Deviation from the literal wording of box 2**, per the dispatch: the retired ids are
corrected **in place** and each site carries its own dated note saying what it said
before, instead of leaving the false text in place and annotating it from a distance.
Nothing is silent (`docs/engineering.md` §ADR process: "never silently rewritten"), and
§6.2a′'s mapping table stays the single source.

### 2026-10-05 @arggon-maker
Docs-only carrier repair on `fix/bug-adr-0021-s5-lists-retired-agent-ids`. One file changed:
`ArggonManager/docs/adr/0021-agents-primary-workers-human-product-owner.md`.

**What changed, and why (ADR process: dated amendment, never a silent rewrite)**

1. **Header block — new dated amendment** (after §6.2b, same blockquote style as §6.1/§6.2/§6.2a′):
   the retired ids are restated at the shipped ones, §6.2a′'s mapping is named the single
   source, and a "deliberately not changed" list records what stays as taken (the decisions,
   §6.1's dated table rows, §6.2/§6.2b role prose, §6.2a's rejected clause, §6.2a′'s
   pre-rename inventory, role nouns in prose).
2. **§5 Agent identity** — the id list agents claim as now names the shipped ids. The
   decision is untouched ("a shipped role id, never the product owner's login"); a dated
   note quotes what it said before (`arggon-coordinator`, `arggon-worker`, `arggon-reviewer`,
   `arggon-prover`) and why (PR #641, `db8f9821`, renamed them).
3. **§2 authority map** — the three agent rows name `arggon-standards-reviewer` /
   `arggon-verifier` / the delivery lead, matching `docs/engineering.md` §Roles and
   authority → Authority map. Their two `agents.md:293` / `agents.md:308` line citations
   became `agents.md` §Orchestration (the rename moved those lines). Dated note records
   the previous wording; **no authority row changes**.
4. **§6.1** — the "Shipped id" column header is now dated `_(2026-10-04)_` and a dated note
   says the rows are the ids as shipped that day. Rows untouched, for the same reason §6.2a
   is left as taken.
5. **§6** — "prover" restated as "verifier", with a dated note.

Retired ids still appear in the file **only** where they belong: §6.1's dated table (annotated),
§6.2a's superseded clause (pre-annotated by itself), §6.2a′'s mapping table (the source), the
§6.2a′ inventory (annotated), and the dated notes that quote what was written before.

**Gates run in the worktree** (all green)

- `npm run arggon -- validate` → `arggon validate: ok (0 warning(s), convention v5)`
- `npm run lint` → exit 0, no output
- `npm run test:structure` → `test result: ok. 5 passed; 0 failed`
- `npm run lint:structure` → exit 0
- `npm run build` → exit 0 (`build:plugin — 42 modules inlined, 464829 bytes`); plugin bundle byte-identical (`git status` clean apart from the two intended files)
- `npm test` → `Test Files 128 passed (128)`, `Tests 2680 passed (2680)` — `cli/src/headless-ci.test.ts` passed here, so the known flake did not reproduce in this worktree
- `npx prettier --check` on the ADR → `All matched files use Prettier code style!`
- `npx vitest run cli/src/adr-index-parity.test.ts cli/src/prose-format.test.ts` → 2 files, 10 tests passed

**Found, not fixed (out of scope — report to the delivery lead)**

- **ADR 0010 §Context** (`0010-opencode2-native-architecture.md:53–54`) still names
  `arggon-coordinator` / `arggon-worker` / `arggon-reviewer` as the shipped agents. Same
  drift class, different ADR — untouched here to keep this diff to one file.
- **Stale line citations inside this ADR**: §6 cites `docs/engineering.md:12` (today an
  intro paragraph; the review bar is `§Review bar`) and §Context cites
  `docs/engineering.md:12,75–78`. Left alone deliberately — the same class as the open
  `bug-docs-ts-stale-example-path`.
- §6.2a′'s `/(^|:)arggon-reviewer$/` gate matcher is a record of the pre-rename tree; the
  live matcher in `templates/docs/zcode/arggon/hooks/gate.mjs:152` is
  `/(^|:)arggon-standards-reviewer$/` and `cli/src/init-zcode.test.ts` binds the two by
  deriving the id from the matcher. Verified, nothing to change.

### handoff 2026-10-05 @arggon-maker — next: Delivery lead: review the ADR 0021 dated amendments, then push + open the PR (not pushed)
- branch: fix/bug-adr-0021-s5-lists-retired-agent-ids
- open questions: ADR 0010:53-54 has the same retired-id drift (out of scope here) - file a follow-up?; §6/Context cite stale docs/engineering.md:12 - sibling item?

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
Merged: PR #648, all three lanes green (`cli`, `tasks-validate`, `ui-smoke`), `MERGEABLE/CLEAN`. Reviewed against `engineering.md` §Review bar: architecture/boundaries, docs travelling with the change, scope held to one file, and the blocking end-to-end check.

Note on the `headless-ci` lane: it passed on this run. That file is environment-sensitive and did not reproduce here or in the maker's 10 full runs — consistent with `bug-headless-ci-twin-init-nondeterministic` being load- or cache-dependent rather than universally broken. The blocker I reported earlier was real but is not deterministic, and I am no longer treating it as a hard gate on every PR.
