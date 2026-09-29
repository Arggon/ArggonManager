---
type: bug
status: done
id: bug-force-push-gate-misses-refspec-plus-git-push-origin-main
title: Force-push gate misses refspec-plus (git push origin +main)
assignee: Arggon
branch: fix/bug-force-push-gate-misses-refspec-plus-git-push-origin-main
parent: native-zcode-integration
labels: []
created: "2026-09-29"
updated: "2026-09-29"
---
# Force-push gate misses refspec-plus (git push origin +main)

## Context

Review finding (PR #437 mechanical pass): the force-push shell gate denies
`--force`/`-f<letters>`/`--force-with-lease` but not the refspec-plus spelling
`git push origin +main`. The gap is parity-consistent — the OpenCode seam's
generated `opencode.jsonc` gates (`templates/docs/opencode.jsonc`) have it
too — so this is a product-wide gate fix, not a ZCode-seam regression.

## Acceptance

- [x] Both gate surfaces deny `git push origin +main` (and `+<ref>` generally)
      while allowing ordinary pushes: `templates/docs/opencode.jsonc`
      permission pattern and `templates/docs/zcode/arggon/hooks/gate.mjs`
      GLOBAL_SHELL_GATES
- [x] `cli/src/init-zcode.test.ts` gains the `+main` case; the OpenCode seam
      side gets equivalent coverage wherever its gates are asserted
- [x] `arggon validate` + full gates green
