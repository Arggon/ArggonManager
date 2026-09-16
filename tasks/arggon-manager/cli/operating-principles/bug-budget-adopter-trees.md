---
type: bug
status: done
id: bug-budget-adopter-trees
title: doctor --budget measures nothing in adopter trees (resolves cli/src from cwd)
assignee: Arggon
branch: fix/bug-budget-adopter-trees
parent: operating-principles
labels: [p2]
created: "2026-09-15"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/bug-budget-adopter-trees.md
  Leaves live only under a story. id is the filename stem: bug-budget-adopter-trees.
  CLI `arggon create bug budget-adopter-trees` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# doctor --budget measures nothing in adopter trees (resolves cli/src from cwd)

## Context

Found 2026-09-15 running `doctor --json --budget` in the fresh casa-pendiente adopter repo (first real use after PR #227): `budgetError: "budget measurement runs the CLI from source (npm run arggon) — cli/src/cli.ts not found"`, budget null. The measurement resolves the CLI relative to the CURRENT tree — which works in ArggonManager itself but is exactly backwards for adopters: they are the ones who need the ADR 0006 budget report on their generated tree. The vencimientos/casa-pendiente experiments are the target audience of doctor --budget, and it produces nothing there.

## Acceptance

- [x] The budget measurement resolves the CLI from the RUNNING installation (import.meta.url / dist of the executing arggon), not from the measured tree's cwd — `doctor --budget` works identically in ArggonManager and in any adopter tree
- [x] Test: doctor --budget run from a non-ArggonManager initialized tree returns a budget section (no budgetError)
- [x] docs/json-output.md budget documentation corrected if it implied ArggonManager-only

## Notes

Resolution (cli/src/measure.ts): new exported `cliCommand()` resolves the CLI entry from `import.meta.url` of the RUNNING module — `src/measure.ts` means from-source (tsx + `cli/src/cli.ts`, repo charter unchanged); anything else (installed `dist/measure.js`) runs `process.execPath dist/cli.js` directly from the package root of the executing installation. The measured tree is only the SUBJECT (cwd of spawned commands); the fresh temp `init --full` fixture method and /tmp hygiene are unchanged. `measureBudget`'s guard now checks the resolved entry instead of hard-coded `cli/src/cli.ts`.

Adopter end-to-end evidence (real installed-dist path, cwd OUTSIDE ArggonManager, 2026-09-15):

```
ADOPTER=$(mktemp -d /tmp/arggon-adopter-e2e-XXXXXX); cd "$ADOPTER"
node /home/arggon/Projects/ArggonManager-bug-budget-adopter-trees/dist/cli.js init --full --json
# {"ok":true,...,"command":"init",...}
node /home/arggon/Projects/ArggonManager-bug-budget-adopter-trees/dist/cli.js doctor --json --budget
# {"ok":true,...,"initialized":true,...,
#  "budget":{"initTreeBytes":54127,"generatedAgentsMdBytes":1872,"listCompactBytes":2539,
#            "listFullBytes":3347,"showBytes":730,"fixtureItems":8,
#            "mcp":{"toolCount":9,"totalBytes":9232,"tokenEstimate":2308,...}}}
rm -rf "$ADOPTER"
```

No `budgetError`; budget section fully populated. From-source path re-verified in the worktree: `npm run arggon -- doctor --json --budget` → budget present, no budgetError; `doctor --json` → 0 modified / 0 drifted. Tests: `npx vitest run` 58 files / 911 tests pass, incl. new measure.test.ts case "resolves the CLI from the RUNNING installation: doctor --json --budget works from an adopter tree outside the repo (bug-budget-adopter-trees)" (locates the CLI via the product `cliCommand()` resolution). `npm run lint` clean; `validate --json` ok:true.

### 2026-09-16 @Arggon
Lead-architect review: APPROVED. cliCommand() resolving from import.meta.url of the EXECUTING module (source->tsx in-repo, installed->dist/cli.js) is the correct fix — the measured tree stays subject-only and the adopter gets the ADR 0006 report on their own tree, which was the entire point. End-to-end adopter evidence with real numbers (init tree 54 KB, mcp 9,232 B vs the new 12 KiB budget) and a regression test that covers the resolution itself, not just the happy path. Merge follows.
