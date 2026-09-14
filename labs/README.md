# Labs: adversarial suite

Permanent home for the cross-cutting stress scenarios from the adoption
experiments (arggon-cv, cuentas-claras, guardian, suizo, racha — reference
repos at `/home/arggon/Projects/<name>`). Those experiments produced ~20
findings, all from cross-cutting flows: real-process concurrency, gate probes
from every entry point, upgrade flows over acked docs, legacy-tree adoption,
long MCP sessions. `labs/torture.test.ts` turns them into CI enforcement so
governance regressions are caught by `vitest run`, not by weeks of agent
experiments.

## Run

```bash
npx vitest run labs      # just the lab (2-3 min: spawns real tsx processes)
npx vitest run           # full suite (unit tests + lab; what CI runs)
```

Type-check the lab: `./node_modules/.bin/tsc -p labs/tsconfig.json --noEmit`.

## Catalog

| # | Scenario | Origin (experiment / finding) | What it asserts |
|---|----------|-------------------------------|-----------------|
| 1 | Mixed concurrent operations on one item family (N=8 processes: claims with same/different assignees, sibling done+cascade pressure racing a title bump, cross-item comments) | suizo claim race / bug-claim-race-no-lock (fix PR #134) | Single claim winner; deterministic refusals for every loser (claim conflict / lock timeout); all writes land; `arggon validate` clean |
| 2 | Concurrent tracker auto-commit (N=6 commenting processes, `x-tracker.auto-commit: true`) | suizo: "necesité reintentos por lock transitorio" | All comments on disk; no `index.lock` debris; no corrupted state. Two EXPOSED bugs tracked separately: bug-comment-race-no-lock (same-item comment loss, `it.todo`) and bug-autocommit-silent-skip (silent commit skip leaves file dirty) |
| 3 | Synthetic legacy tree, full adoption flow (init --full → adopt → sweep edit → adopt --ack → re-init → cleanup) | guardian/cuentas-claras/suizo/racha: adopt auto-hierarchy + ack sweep | Adopter files preserved; container chain auto-created; 8-step checklist task; acked doc byte-identical across re-runs (#127); cleanup runs clean |
| 4 | Upgrade flow over acked state (end-to-end CLI) | guardian ack loss / bug-ack-baseline-regen-loss (fix PR #127) | Hand edit after ack: skipped + preserved, never modified[]; `--backup` STILL never regenerates an acked doc; unacked `--backup` archive+regenerate path verified as control |
| 5 | Gate probes from every entry point (full matrix) | guardian/suizo steal + reopen probes | steal and reopen each refused via (a) CLI non-TTY spawn and (b) MCP `arggon_update`; (c) kernel-direct semantics documented (steal refused, reopen legal for human callers) |
| 6 | Long MCP session (~31 mixed tool calls, one server) | estanteria 53-call session | create x10 → update/claim x10 → comment x10 → list: zero errors, mutations on disk, clean shutdown |

Unit-level coverage that already exists is NOT duplicated; see the header
comment of `torture.test.ts` for the "covered by <file>" mapping
(claim-race, lock, cascade, steal-gate/reopen-gate, mcp-server/mcp-smoke,
init-docs/adopt, tracker-commit).

## Adding new scenarios

Every adoption experiment (and any future one) files its stress scenarios
here: add a test to `labs/torture.test.ts` with a catalog row in this README
and an origin tag in the file-header comment — or, if it is not testable yet,
file a follow-up `task`/`bug` under the relevant story via
`npm run arggon -- create` and reference the id from a `.todo`/skipped test.
If a scenario exposes a real kernel bug, file it (never encode a known-buggy
behavior as a green assertion) and document the id next to the relaxed
assertion.
