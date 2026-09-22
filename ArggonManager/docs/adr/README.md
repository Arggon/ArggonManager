# Architecture decision records

See [ADR process](../engineering.md#adr-process) in `docs/engineering.md`.

Files: `NNNN-short-title.md` (four-digit number, kebab title).

| ADR                                             | Title                                                                        | Status                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------- |
| [0001](./0001-cli-stack.md)                     | CLI stack (Phase 1)                                                          | Accepted                        |
| [0002](./0002-board-viewer-v0.md)               | Board viewer v0 (static + serve)                                             | Proposed (shipped as prototype) |
| [0003](./0003-milestone-field.md)               | Milestone field (folded into v3)                                             | Proposed                        |
| [0004](./0004-milestone-deps-v3.md)             | Convention v3: milestone + dependency graph                                  | Proposed                        |
| [0010](./0010-opencode2-native-architecture.md) | OpenCode2 native architecture: portable kernel, native V2 surface            | Partially superseded by 0011    |
| [0011](./0011-native-first-architecture.md)     | Native-first architecture: OpenCode-native surface over a git-native tracker | Accepted (amended by 0013)      |
| [0012](./0012-tracker-root-layout.md)           | Tracker root and product docs layout: `ArggonManager/`                       | Accepted                        |
| [0013](./0013-lib-package-split.md)             | Kernel package: `@arggondev/lib`                                                | Accepted                        |
