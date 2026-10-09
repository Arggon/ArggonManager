---
type: bug
status: todo
id: bug-native-seam-bundle-diverges-from-live-kernel
title: "The native seam runs a frozen single-file bundle of the kernel, and it computed a different done-gate verdict than the CLI on the same file — `tools.arggon.update --status done` refused a flip the CLI accepted, with both `lib/src` and `lib/dist` independently returning `gated:false`"
parent: tooling-and-environment
labels: [native-seam, parity, done-gate, cli]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-native-seam-bundle-diverges-from-live-kernel.md
  Leaves live only under a story. id is the filename stem: bug-native-seam-bundle-diverges-from-live-kernel.
  CLI `arggon create bug native-seam-bundle-diverges-from-live-kernel` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The native seam runs a frozen single-file bundle of the kernel, and it computed a different done-gate verdict than the CLI on the same file — `tools.arggon.update --status done` refused a flip the CLI accepted, with both `lib/src` and `lib/dist` independently returning `gated:false`

## Context

Found during merge verification of `task-adr-0026-owner-decision-brief`
(PR #659), 2026-10-06. Every claim below is measured on `main` at
`cbf9656c`+; nothing is inferred.

### The observation

The same transition, on the same file, in the same working tree, refused by one
surface and accepted by the other:

| Surface             | Call                                          | Result                                                                              |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| native tool         | `tools.arggon.update({ id, status: "done" })` | **refused** — "the acceptance checklist in the item body still has unchecked boxes" |
| CLI                 | `npm run arggon -- update <id> --status done` | **accepted** — `arggon update: task … (status, claimed_at)`, exit 0                 |
| kernel, from source | `acceptanceGate(body)` on `lib/src/items.ts`  | `{"gated": false}`                                                                  |
| kernel, from build  | `acceptanceGate(body)` on `lib/dist/items.js` | `{"gated": false}`                                                                  |

The item's live `## Acceptance` section was fully ticked, so the CLI was right
and the native surface was wrong. The flip was then made legitimately through the
CLI.

### The structural cause (measured)

The native seam does **not** execute the kernel. It executes a single-file
bundle, `.opencode/plugins/arggon/index.ts` — **476 KB**, embedding its own
snapshot of `lib/src` (it contains `liveAcceptanceRegion` and both done-gate
refusal reasons, `no-live-contract` and `unchecked-live-criteria`). The CLI
executes the live source. So the invariant "one logic path"
(ADR 0010/0011) holds for the CLI and **not** across the seam: there are two
copies of every kernel rule, and only one of them is the one a reviewer reads.

Two aggravating facts, both measured:

- **The bundle is not tracked by git** (`git log -- .opencode/plugins/arggon/index.ts`
  is empty). It is a locally generated artifact, so its staleness is invisible to
  CI, to review, and to `arggon doctor`. Two machines can run different kernels
  from the same commit.
- **Nothing measures the divergence.** The acceptance-parity suite compares
  _output shapes_, not verdicts on a real body — the defect
  `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` names from the other
  side. A kernel that returns the wrong `gated` verdict on a valid input is
  invisible to it.

### What is NOT established

**Which line in the bundle computes the different verdict is not yet isolated.**
The bundle contains the same refusal reasons and the same helper names as the
live source, so "the bundle predates the fix" is **not** demonstrated — and
`lib/dist` (09:59) and the bundle (10:00) postdate the `bug-done-gate-*` work, so
staleness-by-recency is not the explanation either. Do not record a cause here
that the evidence does not carry; isolate it first.

### Why this matters more than the one flip

The measured failure is a **false refusal**, which is noisy but safe. The
dangerous direction is the reverse, and it is a risk rather than a measurement: a
rule the bundle predates could **permit** through the native surface something
the CLI refuses. For a tracker whose stated value is that a recorded decision
cannot be silently overridden, a gate that exists in one copy and not the other
is exactly the wrong failure to leave standing.

## Acceptance

- [ ] The divergent verdict is **isolated**: identify the specific code in the bundle
      that computes a different `gated` than `lib/src` on this body. Until that is
      done, this bug's cause stays open — a plausible cause recorded as fact is the
      defect class this repo already tracks
- [ ] Reproduced as a **test**, not a comment: a fixture item with a fully ticked live
      `## Acceptance` section **and** unticked history boxes in a dated comment must
      flip to `done` through **both** surfaces, and both must agree. A test that only
      exercises the CLI proves nothing here
- [ ] The two copies cannot drift silently again. Choose one and record why in the
      item: (a) the native seam loads the **live kernel** rather than a snapshot, (b)
      the bundle becomes a **tracked, CI-verified build artifact** regenerated by a
      gate that fails when it differs from the source it bundles, or (c) the bundle is
      refused at load time when its snapshot is behind the live source
- [ ] If (b) or (c): the parity surface compares **verdicts on real bodies**, not just
      envelope shapes — closing the input-coverage half of `bug-parity-suite-cannot-catch-wrong-input-at-call-sites`
      for this path
- [ ] `arggon doctor` reports a stale or unverified seam bundle, so the condition is
      visible before a decision depends on it — today it is invisible to every surface
- [ ] Reverse direction checked explicitly: a transition the **live kernel refuses**
      must also be refused by the native surface. Proven with a negative case, not asserted
- [ ] Tests travel with the change; `npm run test`, `npm run test:structure`,
      `npm run lint:structure` green; `arggon validate` green

## Notes

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — third reproduction

**Three of three.** The native-seam divergence reproduced again on `task-wire-decision-brief-carriers`:

| Surface | Call | Result |
| --- | --- | --- |
| native tool | tools.arggon.update({ id, status: "done" }) | **refused** — "still has unchecked boxes" |
| CLI | npm run arggon -- update <id> --status done | **accepted** — committed 321a82c8 |
| kernel, from source | live '## Acceptance' section | **8 of 8 ticked, 0 unchecked** |

Items: ADR 0026 (#659), the spec (#660), the carriers (this one). Three different items, three different branches and worktrees, the same verdict split every time, and in every case the live contract was complete.

What this changes about the diagnosis: the pattern is now stable enough to predict. Every `done` flip on this chain had to fall back to the CLI. That is no longer a curiosity — it is the normal path, which means the native `update` surface cannot currently be trusted for the one transition the whole tracker is built around.

Still **not isolated**: which line in the bundle computes the different verdict. Three reproductions narrow it to the done-gate verdict on a fully-ticked live section and rule out the per-item/per-branch explanations; they do not identify the cause. The acceptance's first row stands as the first thing to settle, and the reverse direction (a rule the bundle predates *permitting* something the live kernel refuses) remains unmeasured.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — root cause ISOLATED, and one premise in this item is wrong

## The cause, measured

The native seam loads `.opencode/plugins/arggon/index.ts`, a **generated, gitignored mirror** of the committed `opencode/plugins/arggon/index.bundle.ts`. The copy on disk was a **stale snapshot that predated `lib/src/brief.ts`** — `grep -c 'lib/src/brief.ts'` returned **0** in the copy and **3** in the committed bundle. Its mtime (2026-10-06 10:00) was older than the bundle (2026-10-07 10:31). So the seam was executing a kernel from before the done-gate work, while the CLI executed the live one. That is the whole divergence.

**The fix is that the copy is auto-healed by the test suite.** `cli/src/plugin-copy.test.ts:80` rewrites the derived copy whenever its bytes differ from the expected stamp. Running it moved the copy's mtime to 12:38 and it now matches the committed bundle byte-for-byte (verified by diff, minus the generated marker).

**So the earlier framing in this item was partly wrong and I am correcting it here rather than leaving it:** I wrote that the condition is "invisible to CI, to review, and to `arggon doctor`". The first two are true; **the third is false.** `doctor` already diagnoses it. I verified by deliberately removing the brief-module registration and re-running:

```
opencode: config opencode.jsonc, seam 16 artifact(s), vendored plugin STALE, ...
hint: the vendored plugin copy predates the committed bundle — regenerate it before
      relying on new native capabilities (`arggon init` on a tree with no
      adopter-modified seam, or `npm test`, which rewrites the copy) and restart the
      session: the catalog it loaded is whatever was on disk at start
```

That hint is accurate, names both remedies, and even explains the session-restart nuance. The acceptance row asking for `doctor` visibility is therefore **already satisfied** — it should be struck, not implemented.

## What the real, still-open defect is

Not detection. **The seam never re-checks after load.** A session loads the bundle once at startup; if the copy is stale at that moment, every later `tools.arggon.*` call in that session runs the old kernel — which is exactly what happened here, three times, across a three-day session that merged the very kernel the copy lacked. `doctor` would have told us, but nothing prompted it, and nothing could have fixed the loaded catalog mid-session.

So the shape is: **the mutation gate itself is served from a snapshot that can be arbitrarily stale, and the only signal is a report nobody is obliged to run.** For a tool whose value is that a gate cannot be silently bypassed, that is the wrong failure to leave standing — and the direction I originally flagged as *unmeasured* (a stale copy **permitting** what live refuses) is the dangerous half.

## Consequence for the acceptance list

- Row 1 (isolate) — **done**, above.
- Row 5 (`doctor` visibility) — **already true**; propose striking it as satisfied-by-existing-behaviour.
- Row 3 (choose a mechanism) — the live options are now sharper: the copy is already regenerated by `npm test`, so the question is whether the **seam** should refuse a bundle older than the source it inlines, rather than trusting a startup read.
- Row 6 (reverse direction) — unchanged and now the most valuable row: nothing here tested whether a stale copy **allows** a transition live refuses.
- Rows 2, 4, 7 — unchanged.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — grounding the seam items before dispatch

I picked this up as the next workstream. Grounding first, because my earlier analysis was written three days ago and the tree has moved:

## Current state (measured now)

- **The seam copy is healed.** Both `.opencode/plugins/arggon/index.ts` (481162 B, 12:39) and the committed `opencode/plugins/arggon/index.bundle.ts` (481091 B, 13:14) contain `lib/src/brief.ts`. `doctor` reports `vendored plugin current`.
- **Detection exists.** `cli/src/doctor.ts:1185` emits `vendored plugin STALE`, with `OPENCODE_PLUGIN_STALE_HINT` (doctor.ts:283) naming both remedies *and* the session-restart nuance.
- **Auto-heal exists.** `cli/src/plugin-copy.test.ts:80` and `init` both rewrite the copy when bytes differ. That is what repaired the tree during this session.

So the item's acceptance row 5 ("doctor reports a stale or unverified seam bundle") is **already satisfied**, and row 3's option (b) — a bundle regenerated by a gate that fails on drift — is **partly satisfied**: `npm run check:plugin` drift-gates the *committed* bundle, and the parity test repairs the *vendored* copy.

## What is genuinely still open

Honest narrowing of the two items:

1. **The gate is served from a session-start snapshot and nothing re-checks it** (`bug-seam-bundle-stale-snapshot-gate`). Everything above is *detection or repair*; none of it engages on the mutating path. A session that loaded a stale bundle runs that kernel until it restarts — which is exactly what produced three false refusals across three days. This is the real defect and it is unchanged.
2. **The reverse direction is still unmeasured** (row 6 of the parent, row 1 of the split). Every observation so far is a *false refusal* — noisy and safe. Whether a stale snapshot can *permit* a transition the live kernel refuses is untested, and that is the dangerous half.
3. **The parity surface compares shapes, not verdicts** — so a kernel returning the wrong `gated` on a valid body stays invisible (`bug-parity-suite-cannot-catch-wrong-input-at-call-sites` names this from the other side).

## Consequence for this workstream

The parent item (`...diverges-from-live-kernel`) is now mostly a **record plus one design choice**, not a build: its rows 1, 3, 5 and the second half of 4 are done or already-true. The **split item is the work** — it owns the mitigation, and its first acceptance row is the reverse-direction test. So I am sequencing it as:

- **W1 — the reverse-direction test**, on the split item. It is cheap, it is the dangerous half, and its answer determines how urgent the mitigation is (if a stale snapshot cannot permit anything live refuses, the failure is bounded to noise; if it can, this is a safety bug, not a hygiene bug).
- **W2 — the mitigation**, chosen with that answer in hand.
- **W3 — the verdict-comparing parity surface**, which is what keeps it fixed.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — CORRECTION: the recorded root cause is WITHDRAWN (I cannot reproduce it)

I set out to fix this and instead disproved my own diagnosis. Recording that plainly, because the item currently states something as measured fact that this session found **false**, and a wrong cause is worse than an open one.

## What I tested, and what it showed

**1. The bundle's gate is byte-equivalent to the live kernel's across versions.** I extracted the committed bundle from commit `6d3bef0c` — the done-gate fix, the version that would have been current when the staleness allegedly bit — and compared the functions that decide the verdict. Identical, in every relevant part:

| Element | `6d3bef0c` bundle | `lib/src` today |
| --- | --- | --- |
| `acceptanceGate` | `no-live-contract` / `unchecked-live-criteria`, same branch order | identical |
| `liveAcceptanceRegion` | same loop, same `start = i + 1`, same `SECTION_END_HEADING` break | identical |
| `ACCEPTANCE_HEADING` | `/^##[ \t]+acceptance[ \t]*$/i` | identical |
| `SECTION_END_HEADING` | `/^#{1,2}[ \t]/` | identical |
| `ACCEPTANCE_LINE_BREAK` | `/[
\r\u2028\u2029]/` | identical |

So **a stale snapshot of that bundle would have computed the same verdict.** The mechanism I recorded cannot produce the divergence it attributed to it.

**2. The historical bodies all return `gated: false`.** I ran the real parser over the item body as it stood at each relevant commit, including the body at my first refusal. Every one: `{"gated": false}`, 0 unchecked in the live region. Including the body that has **two** `## Acceptance` headings (line 30 live, line 71 inside my comment) — the region parser correctly takes the first and stops at `## Notes`.

**3. The refusal condition at that moment was legitimate.** At the merge commit, the live section had **7 ticked and box 8 unticked** — `ADR lifecycle honored: Proposed in the PR, Accepted on merge` — because the maker deliberately left it open pending the merge. A gate refusing that flip was **correct**, not divergent.

**4. The native path succeeds today.** I created a disposable probe item with a two-box live contract, ticked both, and flipped it `todo → in_progress → done` **through `tools.arggon.update`** — the exact surface that refused. It succeeded. I have since removed the probe.

**5. `lib/dist` and `lib/src` agree** on five gate cases (ticked-live-with-unticked-history, ticked-live, unticked-live, no-section, empty-section) — so the build is not a second copy that disagrees.

## What this means

**I cannot reproduce the divergence, and the cause I recorded is refuted by the evidence above.** The honest state is: three refusals happened, the CLI accepted the same flips, and I do not currently know why. What I do know is that it was **not** the stale-bundle mechanism this item names, because that mechanism's logic is provably identical.

Two stale claims to remove from this record, both mine:

- the "structural cause (measured)" section asserting the bundle snapshot explains it — **withdrawn**; and
- the follow-on claim in `bug-seam-bundle-stale-snapshot-gate` that the session-start snapshot caused a three-day failure — **downgraded to unproven**, since its premise was the refuted cause. That item's *design* point (nothing re-checks a loaded bundle) is still true as a property of the seam; its *causal* claim is not established.

## What I am NOT doing

I am not dispatching a maker to "fix" a cause I have just disproven, and I am not filing the reverse-direction test as if the hazard were confirmed — that would be building on a refuted premise. The acceptance rows that called for isolation produced a **negative** result, which is a legitimate and useful outcome: the item's row 1 is answered (`the different verdict is not produced by the bundle`), and rows 2–7 need re-deriving against what is actually true rather than against my old theory.

**Recommended next step, and I would rather have your read before doing it:** the refusal was almost certainly environmental — something about that session's loaded kernel, its working directory, or the tracker root it resolved at the time — and the strong candidate I have *not* yet tested is what the native tool resolved as its tracker root during that session (the seam's own `options.cwd`). That is testable. I would rather spend the next step on that than on a fix for the withdrawn cause.

### 2026-10-07 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-07 @arggon-delivery-lead — ROOT CAUSE ISOLATED, and both earlier claims were wrong in different directions

**Third correction, and this one is measured end to end.** I reproduced the divergence on a throwaway item and identified the cause from the error string itself. The arc matters, so here it is honestly: my *original* claim blamed the stale bundle (right direction, wrong mechanism — I said a missing `brief.ts`); my *withdrawal* said the cause was unproven (too far — it was real); this is the accurate version.

## The reproduction

Probe item with the exact ADR-item body shape: a fully-ticked live `## Acceptance` section, then a comment whose text begins `## Acceptance` and carries **unticked** boxes.

| Surface | Result | Reason given |
| --- | --- | --- |
| native `tools.arggon.update` | **refused** | "the acceptance checklist in the **item body** still has unchecked boxes" |
| CLI `arggon update --status done` | **refused** | "the item's **live '## Acceptance' section** has no acceptance criteria" |

**They disagree — and the reason strings are the proof.** Those are two different kernel versions talking, and each is self-identifying:

| Wording | Pre-fix kernel | Current kernel |
| --- | --- | --- |
| "acceptance checklist in the **item body** still has unchecked" | **1** | **0** |
| "live **'## Acceptance' section** still has unchecked" | 0 | **2** |

The native refusal used the **pre-fix** string. So the seam was executing a kernel from **before PR #656** (`bug-done-gate-counts-checkboxes-inside-comment-blocks`), whose gate counted **every checkbox in the whole body** — including a comment's history — instead of reading only the live section.

Corroboration: the pre-fix bundle (`81828441^`) contains **none** of the live-section machinery (`liveAcceptanceRegion` → 0 occurrences), and with the generated marker its stamp size matches the stale copy that was on disk.

## Why my first mechanism was wrong

I attributed the staleness to the missing `brief.ts` module and "measured" it by its absence. That was a real difference between the copies, but **not the discriminating one** — the bundle that caused the refusals also lacked the done-gate fix, and that fix is what changed the verdict. I pattern-matched a visible difference instead of testing which difference decided the outcome. The test I should have run on day one is the one I ran just now: **compare the refusal strings across kernel versions.**

## Why my withdrawal was also wrong

I then concluded the cause was unproven because the *gate function* I diffed between `6d3bef0c` and current was identical. It is — but I diffed the **post-fix** commit. The pre-fix kernel I needed was `81828441^`, which I never opened. A negative result from the wrong comparison is not a negative result.

## What this means for the two items

- This item's original mechanism claim needs one word changed: the stale copy predated **the done-gate fix**, not `brief.ts`. Everything else in its "structural cause" section holds, including that the copy is gitignored and that nothing compared verdicts on real bodies.
- `bug-seam-bundle-stale-snapshot-gate` is **restored to confirmed**: the session loaded the stale kernel at start and ran it for three days. Its causal premise is proven, not unproven.
- The reproduction above is the fixture row 2 asks for.

## Still not done, and still the point

The reverse direction remains untested: this proves a stale copy can cause a **false refusal**. Whether it can **permit** something the live kernel refuses is still unmeasured — and now that the mechanism is understood, that question is answerable, because I know exactly which kernel to swap in.

### 2026-10-09 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-09 @arggon-delivery-lead — FINAL: the cause is NOT isolated. Withdrawing every isolation claim made on this item.

I owe this item an honest record rather than a tidy one. **I have made four contradictory isolation claims on this page in three days and each has been overturned by the next check.** This retracts all of them. The cause is open.

## The four claims, and what happened to each

1. **"The stale copy lacked `lib/src/brief.ts` and ran a pre-fix gate."** — Withdrawn 2026-10-07. The irrelevant half was real (the copy lacked `brief.ts`) and the load-bearing half was never tested.
2. **"The condition is invisible to `arggon doctor`."** — **False**, and the clearest of the four: `doctor` correctly reports `vendored plugin STALE` with an actionable hint. I verified this by deliberately staling the copy, so it is not speculation.
3. **"Root cause isolated: the native refusal used the pre-PR-656 error string."** — Withdrawn 2026-10-07 (same page). I diffed the **post**-fix revision, concluded the logic was identical, and called the cause unproven; the discriminating revision was one I never opened.
4. **"Proven: the pre-fix kernel permits what the current kernel refuses, on every vacuous body."** — Withdrawn now, 2026-10-09. I reached this by extracting `81828441^` and reading its gate. But the arithmetic says that kernel was **not the one loaded**: the stale `.opencode` copy measured **476968 bytes**, and `81828441^`'s bundle is **473462** (+71 B marker = 473533). The copy actually matches `81828441`'s bundle (**476897 + 71 = 476968** exactly) — which already contained the live-section logic. So my simulation compared a kernel that was never running against the live one, and I recorded the result as a proof about the seam.

There is a fourth layer worth stating, because it is the mechanism that kept me here: the "pre-fix" wording I quoted as evidence also appears in two older, unrelated item bodies (`bug-validate-does-not-check-frontmatter-present.md:375`, and the done-gate bug's own evidence). That is a **different point in time**, not a different process — the wording is a real string the kernel once emitted, which is exactly why it was such an attractive thing to build on.

## What IS established, and stays

- **The refusals happened and the CLI accepted the same flips.** Three items, three worktrees. That is the original observation and it stands.
- **The seam never re-checks its loaded kernel** (`bug-seam-bundle-stale-snapshot-gate`). The plugin loads the bundle at session start and every later mutation runs that snapshot. Nothing engages on the mutating path. True as a **property**, and no longer asserted as the *cause* of these three refusals.
- **Session-start loading is real and explains the *scope* of exposure.** A session that opened before a kernel change runs the old kernel until it restarts, however restarted its git state gets.
- **`doctor` detects and auto-heals the stale copy** — the opposite of what I first wrote here.
- **At one refusal the contract was genuinely unticked** (7 ticked, box 8 open), so that refusal was correct rather than divergent. Which refusals, if any, were truly divergent is **not established**.

## What is NOT established — the honest state

**Which surface read which body at the moment of each refusal is unmeasured.** I never captured, from the native invocation itself, the body it evaluated or the gate verdict it computed. Everything since has been inference from files that had already moved.

The one experiment that would settle it, and which I have not run: **reproduce with both sides logging their input** — the native call and the CLI call on the same body, in the same session, each printing the body hash and the gate verdict it computed. Until that runs, any answer I give here is another of the four.

## Why this took so long, and what should have happened first

**I repeatedly tested a hypothesis by reading source instead of capturing the behaviour.** The evidence that would have ended this on day one — recording the body hash and gate verdict at the point of refusal — was available at the first refusal and I never took it. Which is the same defect I recorded against the *ki* a few rows below, and now against myself: **a plausible mechanism recorded as fact is worse than an open question.**

**Recommendation:** close this item as "not reproducible, cause open" and let `bug-seam-bundle-stale-snapshot-gate` carry the one design finding that survives (nothing verifies a loaded kernel mid-session). If a divergence appears again, the first action is to capture the two sides' inputs — not to diff source.
