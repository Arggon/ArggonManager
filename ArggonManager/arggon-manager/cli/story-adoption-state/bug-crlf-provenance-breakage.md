---
type: bug
status: done
id: bug-crlf-provenance-breakage
title: CRLF working trees (eol=crlf .gitattributes) break provenance checksums and project-name recovery
assignee: Arggon
branch: feat/bug-crlf-provenance-breakage
parent: story-adoption-state
labels: [p1]
created: "2026-09-17"
updated: "2026-09-17"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/bug-crlf-provenance-breakage.md
  Leaves live only under a story. id is the filename stem: bug-crlf-provenance-breakage.
  CLI `arggon create bug crlf-provenance-breakage` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CRLF working trees (eol=crlf .gitattributes) break provenance checksums and project-name recovery

## Context

Found live on 2026-09-17 executing the first real adopter upgrade (ArggonStores-am absorb of ArggonManager 0.2.0). ArggonStores-am carries `.gitattributes` with `* text=auto eol=crlf` — the repo MANDATES CRLF working trees. ArggonManager generates docs with LF bytes and records checksums over those bytes. Consequences, all reproduced:

- Any FRESH checkout/worktree smudges every generated doc to CRLF -> every checksum mismatches -> doctor reports 14/14 `acknowledgedDrifted` (false; the content is byte-identical modulo EOL). In the user's primary (files written by init, never re-smudged by git) only the 3 files git had touched show drifted — which is exactly why primary vs worktree disagreed.
- `resolveProjectName` legacy recovery (and propose/doctor render-vs-disk compares) match LF-anchored template text against CRLF disk content -> extraction fails (`projectName: null`) -> propose returns ZERO proposals and doctor skips the outdated comparison. The upgrade channel is INERT on any eol=crlf adopter after a fresh checkout.
- `-c core.autocrlf=false` on worktree add does NOT help: `.gitattributes eol=crlf` overrides git config.

Checksums in `x-generated` are byte-based (sha256 of the file as written); the comparison and recovery layers are byte-based too. EOL-normalized trees break all of them.

## Acceptance

- [x] EOL-tolerant comparison layer: doctor's untouched/modified/acknowledgedDrifted checksum verification, the outdated render-vs-disk compare, propose's divergence decision, and `extractProjectNameFromContent` all normalize `\r\n`/`\r` to `\n` on both sides before comparing (state checksums stay as recorded; normalize at compare time only)
- [x] A CRLF working tree of a repo whose blobs are LF yields the same doctor buckets / projectName / proposals as the LF checkout (test: fixture committed with LF, checked out with a `text=auto eol=crlf` .gitattributes + `core.eol=crlf`, or a CRLF-written fixture variant — doctor projectName recovered, 0 false drifted, propose emits the same proposals)
- [x] Regenerated docs: decide + document the write convention (write LF and let gitattributes smudge, or match the on-disk EOL of the existing file) — either is fine, it must not re-break checksums on the next compare
- [x] Docs: README provenance section notes EOL-normalized comparison

## Notes

Evidence: ArggonStores-am (`.gitattributes` line 1 `* text=auto eol=crlf`); primary doctor 11 acked / 3 drifted / projectName recovered vs fresh worktree 0 acked / 14 drifted / projectName null / 0 proposals. Workaround used for the absorb PR: proposals generated from the LF primary, merges applied in the worktree, re-ack DEFERRED until this fix (a re-ack on CRLF bytes would bake tainted checksums).
