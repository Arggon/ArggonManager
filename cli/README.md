# cli/

TypeScript sources for arggon. Root package owns the install.

Shared kernel (import these; do not fork schema logic):

- `paths.ts` — package root, bundled templates, find `tasks/`, new item paths
- `frontmatter.ts` — v0 YAML frontmatter read/write
- `ids.ts` — kebab ids, uniqueness helpers, task-/bug- prefixes
- `status.ts` — statuses, transitions, claim / blocked_reason rules
- `items.ts` — walk the tasks tree (shared reader for create/list/update/validate)

Commands: `hello`, `init`, `create`.
