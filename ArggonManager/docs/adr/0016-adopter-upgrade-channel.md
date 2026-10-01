# 0016 Adopter upgrade channel

- Status: Accepted
> Numbering note (2026-09-29): originally filed as 0014 in collision with `0014-zcode-native-seam.md` (landed first via #439); renumbered to the next free id. Decision content unchanged.
> Status note (2026-10-01): flipped from Proposed to Accepted — [exploration-adopter-upgrade-experience-007](../explorations/exploration-adopter-upgrade-experience-007.md)'s Decision records this ADR as adopted (stages A–C + D shipped); the status line had lagged the merge. Distribution of the tool itself lands separately as [ADR 0018](./0018-update-delivery-and-distribution-channel.md).
- Date: 2026-09-29
- Deciders: Gonzalo Arganaraz

## Context

Adopting repos receive methodology and template updates only by re-running
`arggon init`, but the adoption flow sanctions its completed docs
(`arggon adopt --ack` → `acknowledged`), and acked docs are skipped on every
re-run. The two semantics are mutually exclusive: ack means "yours, never
touched again" while upgrade means "untouched files get improvements" — and
every real adoption ends on the ack side. The reference adoption
(ArggonStores-am, observed 2026-09-15) had all 14 generated docs acked, so the
designed upgrade channel was a no-op there, and the 2026-09-16 methodology
update reached it only via a manual seven-step port. Full analysis:
[exploration-adopter-upgrade-experience-007](../explorations/exploration-adopter-upgrade-experience-007.md).

## Decision

Adopt the staged upgrade channel proposed by that exploration, with one
inviolable rule — **acked/modified docs are never overwritten** — and every
upgrade an explicit, reviewable act:

1. **Visibility first (pure read).** `arggon init --dry-run` previews the
   per-destination outcome (created / would-update / modified-skip /
   acked-skip) without writing; `arggon doctor` reports an `outdated` bucket
   when the current template render of a managed doc differs from the on-disk
   file, so staleness is visible on every doctor run.
2. **Propose, never overwrite (the core fix).** `arggon init --propose` writes
   each new template render to a side file (`<dest>.proposed-<arggonVersion>`)
   beside the acked/modified original; the adopting repo absorbs proposals as
   normal work items and re-acks the merged result. Section-level backports are
   opt-in (`spec-propose-section-backports-007`).
3. **Version discipline.** Package version, release tags (v0.2.0–v0.4.0) and
   the generated CHANGELOG make `arggonVersion` provenance stamps meaningful.
   A structured `whatsnew --since <v>` command for agents is explicitly
   deferred until needed.

Distribution of the tool itself (npm package / release tarballs as the
update channel) stays deferred behind its own future ADR.

## Consequences

- Fully-adopted repos stop silently missing methodology updates: doctor
  surfaces staleness, proposals arrive as side files, and humans/agents merge
  them deliberately through the normal work loop.
- Adopters carry a recurring merge duty — proposals do not apply themselves.
  Accepted: the alternative (silently rewriting acked docs) breaks the ack
  contract that makes adoption safe.
- The proposal flow needs ongoing discipline on this repo's side: template
  changes land as normal PRs and appear as proposals only when adopters run
  `init --propose`, so release notes should call out methodology-affecting
  changes.
- `whatsnew` and package distribution remain open, tracked separately.

## Alternatives considered

- **Whole-file three-way git merge** (base = the file's first init commit in
  the adopting repo, ours = on-disk, theirs = new render): nicer for small
  diffs, rejected for now — more machinery and edge cases than the
  propose-file channel needs; revisit only if proposals prove too manual.
- **Auto-apply updates to acked docs (with backup)**: violates "acked = yours";
  rejected.
- **Status quo (manual ports)**: every real adoption ends on the ack side, so
  the status quo is the observed failure mode; rejected.
