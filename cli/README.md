# cli/

TypeScript sources for arggon. Root package owns the install.

Shared kernel (import these; do not fork schema logic):

- `paths.ts` — package root, bundled templates, find `tasks/`, new item paths
- `frontmatter.ts` — v0 YAML frontmatter read/write
- `ids.ts` — kebab ids, uniqueness helpers, task-/bug- prefixes
- `status.ts` — statuses, transitions, claim / blocked_reason rules
- `items.ts` — walk + soft-load (`walkTasksTree`, `softTryLoadItem`, `loadItems`) for create/list/update/validate
- `relations.ts` — parent-type edges (epic→initiative, story→epic, task/bug→story)

Commands: `hello`, `init`, `create`, `list`, `validate`.

- `validate.ts` — schema + tree integrity; consumes shared items soft-scan
