# fixtures/tasks-invalid

One reject rule per subdirectory (run `arggon validate` from the subdirectory root).

| Dir | Rule |
| --- | --- |
| `parent-missing/` | `parent` does not resolve |
| `bad-status/` | unknown status |
| `wrong-parent-type/` | task parent is not a story |
| `leaf-under-epic/` | task/bug under epic (v0: only under story) |
| `broken-yaml/` | broken frontmatter YAML |
| `missing-index/` | container directory missing index `.md` |
