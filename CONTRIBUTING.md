# Contributing

Thanks for helping with ArggonManager. Work is **convention-first**: the repo (`tasks/`, Markdown + YAML) is the source of truth for humans and agents.

## Before you start

1. Read [`docs/convention.md`](docs/convention.md) (folder layout, frontmatter, statuses).
2. Read [`docs/engineering.md`](docs/engineering.md) (review bar, testing, ADRs).
3. Skim ADR [`docs/adr/0001-cli-stack.md`](docs/adr/0001-cli-stack.md) if you touch the CLI.

## Issues and PRs

- Prefer a **work item in `tasks/`** (`arggon create task|bug`) for anything beyond a typo — the tree is the issue tracker; GitHub issues are not used (see `docs/agents.md` §0).
- Keep PRs **small** and focused; one concern per PR when possible.
- Reference the work item id in the PR; move the item to `done` only when the PR fully finishes it.
- Branch names: `docs/…`, `feat/…`, `fix/…`, `chore/…` (see engineering.md).
- Commits: imperative mood (`docs: …`, `cli: …`, `test: …`).

### PR checklist

- [ ] Linked work item in `tasks/` (or clear docs-only / chore reason)
- [ ] Matches `docs/convention.md` if you touch `tasks/` or templates
- [ ] CLI behavior changes include tests when the CLI is involved
- [ ] User-facing changes update README and/or docs in the same PR

## Run the CLI locally

Requires **Node.js 22.12+** (needed by vitest 5 in the dev toolchain; `engines` enforces it). From the repo root:

- `npm install`
- `npm run arggon -- hello`
- `npm run arggon -- init /path/to/empty-repo`
- `npm run build`
- `npm test`
- `npm run lint`

The package manifests at the **repo root**; TypeScript sources live under `cli/`.

## Propose schema / convention changes

1. Open an issue describing the change and why (agents + humans must share one rule).
2. Update **`docs/convention.md`** in the same PR as any CLI/validate behavior that depends on it.
3. Update sample `tasks/` and `templates/` when the change affects them.
4. Breaking changes need an ADR under `docs/adr/` and a bump of `tasks/.convention.yml` `version` when applicable.
5. Do **not** invent unofficial frontmatter keys outside the reserved `x-*` / `extensions` rules in the convention.

## Claim work

Follow claim rules in the convention: for `story` / `task` / `bug`, `in_progress` requires an `assignee`. Prefer claiming via the CLI when those commands exist; until then, edit frontmatter + open a PR.

## License

MIT — see [LICENSE](LICENSE).
