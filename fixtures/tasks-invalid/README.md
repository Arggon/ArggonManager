# fixtures/tasks-invalid

One reject rule per subdirectory (run `arggon validate` from the subdirectory root).

| Dir                          | Rule                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `parent-missing/`            | `parent` does not resolve                                                                                |
| `bad-status/`                | unknown status                                                                                           |
| `wrong-parent-type/`         | task parent is not a story                                                                               |
| `leaf-under-epic/`           | task/bug under epic (v0: only under story)                                                               |
| `broken-yaml/`               | broken frontmatter YAML                                                                                  |
| `missing-index/`             | container directory missing index `.md`                                                                  |
| `missing-frontmatter/`       | item file whose frontmatter block was deleted entirely (`MISSING_FRONTMATTER`)                           |
| `missing-frontmatter-index/` | container index whose frontmatter block was deleted entirely (`MISSING_FRONTMATTER`)                     |
| `unterminated-frontmatter/`  | frontmatter block opened but never closed by `---` (`UNTERMINATED_FRONTMATTER`)                          |
| `empty-item-file/`           | zero-byte item file — no block at all (`MISSING_FRONTMATTER`)                                            |
| `non-item-markdown/`         | plain `.md` in a NON-item position stays ignored — the no-false-positive control for the two rules above |
