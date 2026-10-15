---
type: bug
status: cancelled
id: bug-prettier-reflow-breaks-item-frontmatter
title: prettier reflows a long inline frontmatter list into a form the arggon parser rejects — an item file becomes valid-to-prettier and invalid-to-validate
parent: tooling-and-environment
labels: []
created: "2026-10-15"
updated: "2026-10-15"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-prettier-reflow-breaks-item-frontmatter.md
  Leaves live only under a story. id is the filename stem: bug-prettier-reflow-breaks-item-frontmatter.
  CLI `arggon create bug prettier-reflow-breaks-item-frontmatter` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# prettier reflows a long inline frontmatter list into a form the arggon parser rejects — an item file becomes valid-to-prettier and invalid-to-validate

## Context

Hit live 2026-10-15 while closing `task-clip-class-sweep-remaining-sites`: `npx prettier --write <item-file>` on a work-item whose frontmatter carries a long inline list **reflows** it. For example

```yaml
depends_on:
  [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
```

becomes

```yaml
depends_on:
  [task-cli-start-remediation-tail-clipped-on-human-channel, bug-three-acceptance-parsers-diverging]
```

`arggon validate` then fails with `invalid frontmatter line: "  [task-…, task-…]"` and
`arggon update --status done` refuses with the same error — the item becomes un-flippable
through the repo's own standard close-out flow (tick acceptance → format → flip). The shape
spreads to every long inline frontmatter list (`depends_on`, `labels`) and to every item file
a formatter touches.

## Acceptance

- [ ] The two-line inline-list form parses as the same list — a prettier-formatted item file stays loadable (`arggon validate` + `arggon update` on such a file must succeed)
- [ ] A test pins the round-trip: a long inline list wrapped by the formatter parses back to the identical value (both `depends_on` and `labels`)
- [ ] The fix is at the meeting point (the parser or the writer), not in the usage; a genuinely broken line must still be refused — the permissiveness is scoped to the wrapped-list shape
- [ ] `arggon validate`, the frontmatter suites and the touched-item suites green

## Notes

- Discovered on the standard usage path, not an exotic one; the repo's own gates run the formatter over these files, so the collision is reachable from any item with a long list.

## Notes

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
**Reconciliation (2026-10-15, delivery lead): closed as a duplicate — the fix belongs to the class, not to this instance.**

This instance (prettier --write reflowing a long inline `depends_on` list into a two-line form the parser refuses, hit on the standard tick → format → flip close-out path) is the same parser-side defect as `bug-update-depends-on-multiline-rejected` (`lib/src/frontmatter.ts`'s strictly single-line `key: value` parse refusing continuation-line forms, with the WRITE side as a second producer), and the same formatter class as `bug-start-claim-commit-frontmatter-fails-prettier` and `bug-session-formatter-normalizes-tracker-item-files`. Three producers, one parser line. Fixing this as its own item would split the fix in two, so it is cancelled with its evidence cross-posted to `bug-update-depends-on-multiline-rejected` — including the acceptance box that the fix must make the WRAPPED-list shape parse back to the identical list while a genuinely broken line is still refused.

Restored on main the same day: the affected item file was repaired to single-line frontmatter (`b265f6b7`), `arggon validate` green throughout.
