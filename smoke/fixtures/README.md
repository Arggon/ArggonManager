# Smoke transcript fixtures

`--format json` transcripts (`smoke/*.test.ts` reads them through the same
`parseTranscript`/`executeJson`/`executedTool` path the harness uses) for the
checks that a model run would otherwise have to produce. They exist so the
transcript-needle contract stays covered by `npm test` on CI, which has no
`opencode` binary and no provider quota.

`*.bracket-namespace.jsonl` are reconstructed in the shape recorded by the W4
runs that exposed `bug-opencode-smoke-normalize-bracket-namespace`: a completed
`execute` frame whose `input.code` is the valid bracket-member spelling
`tools.arggon["<name>"]({ … })` and whose `output` is the pretty-printed
envelope the native tool returned. Each frame pair is one bounded session
stdout, mirroring the W4 scenarios:

| Fixture                                      | Session                 | Needle the scenario asserts |
| -------------------------------------------- | ----------------------- | --------------------------- |
| `w4-lifecycle-start.bracket-namespace.jsonl` | lifecycle: claim        | `tools.arggon.start`        |
| `w4-lifecycle-close.bracket-namespace.jsonl` | lifecycle: done + prune | `tools.arggon.cleanup`      |
| `w4-invariants.bracket-namespace.jsonl`      | invariants (worker)     | `tools.arggon.update`       |

They are fixtures, not captured runs: the values are the ones the transcripts
showed (envelope fields, refused `ArgonToolError` messages) trimmed to what the
checks read. They assert the harness, never the product — the product side is
covered by `opencode/plugins/arggon/index.test.ts` and a real `npm run
smoke:opencode`.
