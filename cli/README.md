# cli/

TypeScript sources for arggon. Root package owns the install.

Shared kernel (import these; do not fork schema logic):

- `paths.ts` — package root, bundled templates, find `tasks/`, new item paths
- `frontmatter.ts` — v0 YAML frontmatter read/write
- `ids.ts` — kebab ids, uniqueness helpers, task-/bug- prefixes
- `status.ts` — statuses, transitions, claim / blocked_reason rules
- `items.ts` — walk + soft-load (`walkTasksTree`, `softTryLoadItem`, `loadItems`) for create/list/update/validate/board
- `relations.ts` — parent-type edges (epic→initiative, story→epic, task/bug→story)
- `dates.ts` — v0 `YYYY-MM-DD` helpers (`formatDate`)
- `board.ts` — static HTML board renderer (`renderBoardHtml` pure; `runBoard` writes the file). Cards are drag-and-drop enabled: the page script embeds `evaluateDrop` (same transition/claim/blocked rules as `status.ts` + `update.ts`), moves optimistically, and POSTs `{id, status, blocked_reason?}` to the endpoint in `<body data-update-endpoint>` (default `/api/update`). On any failure it reverts and shows the equivalent `arggon update` command. The future `board --serve` server must implement that endpoint by shelling through `arggon update` — the browser never writes `tasks/` directly; a 2xx `{"ok":true}` persists, any error must answer `{"ok":false,"error":{"message"}}`.
- `detect-repo.ts` — GitHub owner/repo from the `origin` remote (sync)
- `get-open-prs.ts` — shared open-PR reader for board/sync: one `gh pr list` invocation contract (`--limit 100` + `--json`), with `gh api` fallback on the sync path
- `sync-types.ts` — PR↔item matching + result aggregation (`matchItem`, `toSyncResult`)

Commands: `hello`, `init`, `create`, `list`, `next`, `update`, `validate`, `branch`, `start`, `board`, `report`, `sync`.

- `update.ts` — in-place frontmatter edits (status transitions, claim rule, labels)
- `validate.ts` — schema + tree integrity; consumes shared items soft-scan
- `sync-command.ts` — reconcile open PRs back into `tasks/` (`--check` default CI gate, `--write` fills empty `branch` fields only; never overwrites, never guesses, never auto-done)
