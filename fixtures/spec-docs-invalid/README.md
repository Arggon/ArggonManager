# fixtures/spec-docs-invalid

One numbering-collision rule per subdirectory (the report-only doc-number
checks of `arggon spec validate` / `arggon spec analyze`, run from the
subdirectory root). Each tree is clean on every OTHER rule, so the only signal
it produces is the collision itself.

| Dir                     | Rule                                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `duplicate-doc-number/` | Two documents in one directory share a number under different slugs (`0020-alpha.md` + `0020-beta.md`) — invisible to the per-file `spec_id`/`plan_id` check, which only fires on two files carrying the SAME id |
