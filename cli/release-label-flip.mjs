#!/usr/bin/env node
// cli/release-label-flip.mjs
//
// Flip release-please's `autorelease: pending` label on the merged release PR
// once `release.yml` has tagged it (bug-autorelease-label-lifecycle-unowned).
//
// THE DEADLOCK THIS CLOSES. release-please tracks release PRs by label:
// `DEFAULT_LABELS = ["autorelease: pending"]`, `DEFAULT_RELEASE_LABELS =
// ["autorelease: tagged"]` (src/manifest.ts). `findMergedReleasePullRequests()`
// yields the MERGED PRs still carrying `autorelease: pending`, and
// `createPullRequests()` ABORTS while any exists — "There are untagged, merged
// release PRs outstanding - aborting" — a `logger.warn` inside a run that
// reports success. The label is normally moved to `tagged` by release-please's
// OWN tagging path (`createReleasesForPullRequest`: remove pending, add
// tagged). This repo deliberately does not use that path:
// `skip-github-release: true`, because a tag created with `GITHUB_TOKEN`
// triggers no workflow, so `release.yml` owns the tag (`git tag -a
// v${VERSION}`). Consequence, measured twice: release-please never tags, never
// flips its own label, and a merged release PR stays `pending` forever — #556
// (releases dead 2026-10-02 → 2026-10-07) and #664 (2026-10-09 → 2026-10-12)
// both had to be cleared by hand.
//
// WHO OWNS THE FLIP (decided 2026-10-12, recorded on the item): `release.yml`,
// the workflow that creates the tag, flips the label in the SAME run that tags
// — immediately after the tag↔version agreement assert, so the window between
// the tag and the flip is as short as the run allows. The label means "this
// merged release PR's release is not tagged yet"; the fact that resolves it
// (the tag) exists only in this run, so the workflow that creates the fact owns
// the bookkeeping the fact implies. Same-run placement is the atomicity
// argument: a run that dies BEFORE this step leaves the label pending, and the
// backstop in release-please.yml (cli/release-abort-check.mjs) reddens the next
// push naming the PR instead of the stuck label hiding inside green — the
// defect this item was filed for. The flip is idempotent: a rule-0 push
// (nothing to release) never reaches this step at all (`if: release == 'true'`)
// and a rule-2 re-run finds nothing pending once the first run flipped it.
//
// WHY THE FLIP TRACKS THE TAG, NOT THE PUBLISH. The step runs BEFORE the
// release object, build, pack and publish, so a later failure leaves the label
// already flipped — which is correct: the label gates "merged but UNTAGGED",
// and the tag is pushed before this point. release-please's own tagging path
// has the same property (it flips when it tags, not when anything ships). A
// failed publish is recovered by re-running the workflow, never by the label.
//
// HOW THE FLIP VERIFIES ITSELF (bug-release-label-flip-verification-index-lag).
// The first live run (v0.7.0, run 38296293861) flipped #744 and then warned
// "still 'autorelease: pending' … release-please WILL abort" on a release that
// was clean minutes later: the verification RE-RAN the discovery query ~0.4 s
// after the edit, and `gh pr list` is backed by GitHub's search index, which is
// eventually consistent — a healthy flip can still be listed as pending. The
// verification now reads each flipped PR back authoritatively (`gh pr view <n>
// --repo <repo> --json labels`, the PR object itself, which reports the edit
// immediately). A genuinely stuck label is still caught: "still pending" now
// means the label really is on the PR, with no index lag between the edit and
// the read to excuse it. The discovery query stays exactly as it was — it is
// release-please's own predicate (merged PRs carrying `autorelease: pending`,
// open PRs excluded), and a label it does not list is one release-please does
// not see either.
//
// FAILURE POLICY: WARN, NEVER FAIL THE RUN (exit 0 on every path). (a) The step
// sits before the publish, so a non-zero exit here would strand a tagged
// release at the worst moment — nothing shipped because bookkeeping failed.
// (b) By the time a rule-2 re-run arrives the artifacts may already have
// shipped, so failing would redden a complete release for bookkeeping alone.
// (c) The failure is neither silent nor undetectable: this script's warning
// lands in the run log, and the release-please backstop reddens the next push
// naming the stuck PR together with the manual recovery. The asymmetry with
// cli/release-abort-check.mjs is deliberate: a GATE fails closed (never claims
// green on unknown state), a REPAIR never strands the release it is tidying up
// after. The manual recovery is the same command this script runs, so the
// automation and the operator's instruction cannot drift:
//
//   gh pr edit <n> --add-label "autorelease: tagged" --remove-label "autorelease: pending"
//
// Usage: `node cli/release-label-flip.mjs --repo <owner/name>` (falls back to
// GITHUB_REPOSITORY). Exit codes: always 0. GH_BIN is the test-injection seam
// (cli/release-label-flip.test.ts); the runner's gh is on PATH.
import { spawnSync } from "node:child_process";
import { writeSync } from "node:fs";

const AUTORELEASE_PENDING_LABEL = "autorelease: pending";
const AUTORELEASE_TAGGED_LABEL = "autorelease: tagged";
// release-please scans the 200 most-recently-merged PRs (manifest.ts
// findMergedReleasePullRequests) — the same window the abort backstop queries.
const MERGED_SCAN_LIMIT = "200";

/** The exact command the operator runs by hand; this script runs the same one. */
const MANUAL_RECOVERY =
  `gh pr edit <n> --add-label "${AUTORELEASE_TAGGED_LABEL}" ` +
  `--remove-label "${AUTORELEASE_PENDING_LABEL}"`;

/** Parse `--repo <owner/name>` (the workflow also supplies GITHUB_REPOSITORY). */
function parseRepo(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") return argv[i + 1];
    if (argv[i]?.startsWith("--repo=")) return argv[i].slice("--repo=".length);
  }
  return undefined;
}

function info(message) {
  writeSync(1, `release-label-flip: ${message}\n`);
}

function warn(message) {
  writeSync(2, `release-label-flip: WARNING — ${message}\n`);
}

/** `gh` failure detail for a warning, never an empty string. */
function stderrOf(run) {
  return (run.stderr || String(run.error || "")).trim() || "(no stderr)";
}

/**
 * The abort predicate query: merged PRs still carrying the pending label.
 * DISCOVERY ONLY — never the post-flip verdict: it is backed by GitHub's search
 * index, which lags the edit (see the header).
 */
function listPending(gh, repo) {
  return spawnSync(
    gh,
    [
      "pr",
      "list",
      "--repo",
      repo,
      "--state",
      "merged",
      "--label",
      AUTORELEASE_PENDING_LABEL,
      "--limit",
      MERGED_SCAN_LIMIT,
      "--json",
      "number,title,headRefName",
    ],
    { encoding: "utf8" },
  );
}

/** One flip, through the same command the manual recovery documents. */
function flip(gh, repo, number) {
  return spawnSync(
    gh,
    [
      "pr",
      "edit",
      String(number),
      "--repo",
      repo,
      "--add-label",
      AUTORELEASE_TAGGED_LABEL,
      "--remove-label",
      AUTORELEASE_PENDING_LABEL,
    ],
    { encoding: "utf8" },
  );
}

/**
 * The authoritative read of one PR's labels — the post-flip verdict. `gh pr
 * view` reads the PR object itself, so it reports the edit immediately; the
 * `gh pr list` search query does not (the index lag this verification exists to
 * stop trusting).
 */
function viewLabels(gh, repo, number) {
  return spawnSync(gh, ["pr", "view", String(number), "--repo", repo, "--json", "labels"], {
    encoding: "utf8",
  });
}

/**
 * What `gh pr view --json labels` says about the pending label: `true` still
 * carries it, `false` cleared, `undefined` unreadable — and an unreadable
 * verdict is never a green claim (the caller counts it as unverified).
 */
function stillPending(labelsRun) {
  if (labelsRun.error || labelsRun.status !== 0) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(labelsRun.stdout);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed?.labels)) return undefined;
  return parsed.labels.some((label) => label?.name === AUTORELEASE_PENDING_LABEL);
}

function renderPending(prs) {
  // Defensive like the flip loop above: a malformed entry (null, a bare
  // number) must not throw — this script's contract is exit 0 on EVERY path,
  // and the verification payload is the last thing it reads before the run
  // continues to the publish.
  return prs.map((pr) => `  #${pr?.number ?? "?"} ${pr?.title ?? "(untitled)"}`).join("\n");
}

function main() {
  const repo = parseRepo(process.argv.slice(2)) ?? process.env.GITHUB_REPOSITORY;
  if (!repo) {
    warn(
      "no repository: pass --repo <owner/name> or set GITHUB_REPOSITORY — skipping the label flip " +
        `(bookkeeping only, the release is not affected). If a merged release PR is stuck, run: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  // GH_BIN is the test-injection seam (cli/release-label-flip.test.ts); the
  // runner's gh is on PATH.
  const gh = process.env.GH_BIN || "gh";

  const before = listPending(gh, repo);
  if (before.error || before.status !== 0) {
    warn(
      `could not query ${gh} for merged '${AUTORELEASE_PENDING_LABEL}' PRs (stderr: ` +
        `${stderrOf(before)}); skipping the flip. A stuck label is caught by the release-please ` +
        `backstop on the next push; manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  let stuck;
  try {
    stuck = JSON.parse(before.stdout);
  } catch {
    warn(
      `could not parse ${gh} output as JSON (output: ${before.stdout.trim()}); skipping the flip. ` +
        `Manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  if (!Array.isArray(stuck)) {
    warn(
      `unexpected ${gh} output shape (expected an array); skipping the flip. ` +
        `Manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  if (stuck.length === 0) {
    info(
      `OK — no merged PR carries '${AUTORELEASE_PENDING_LABEL}'; nothing to flip ` +
        `(idempotent no-op on rule-0/rule-2 runs and on re-runs).`,
    );
    return;
  }

  // Flip, then verify EACH PR against the PR OBJECT — never against the search
  // query that found it. `gh pr list` reads GitHub's search index, which is
  // eventually consistent: re-running it ~0.4 s after the edit is how the
  // healthy v0.7.0 flip of #744 warned "release-please WILL abort" (run
  // 38296293861). `remaining` holds what the PR itself still reports as
  // pending; `unverified` counts reads that failed, so an unreadable label can
  // never be reported as a clean release.
  const remaining = [];
  let flipped = 0;
  let unverified = 0;

  for (const pr of stuck) {
    if (pr === null || typeof pr !== "object" || typeof pr.number !== "number") {
      warn(`skipping a malformed entry from ${gh} output: ${JSON.stringify(pr)}`);
      // Fail closed for the WARNING (never the run): an entry we cannot read is
      // an entry we cannot prove cleared, so it keeps the summary from claiming
      // release-please is not aborting.
      remaining.push(pr);
      continue;
    }
    const edited = flip(gh, repo, pr.number);
    if (edited.error || edited.status !== 0) {
      warn(
        `could not flip #${pr.number} ${pr.title ?? "(untitled)"} to '${AUTORELEASE_TAGGED_LABEL}' ` +
          `(stderr: ${stderrOf(edited)}); continuing with the rest, and reading its label back ` +
          `anyway. Manual recovery: ${MANUAL_RECOVERY}`,
      );
    } else {
      flipped += 1;
      info(
        `flipped #${pr.number} ${pr.title ?? "(untitled)"}: '${AUTORELEASE_PENDING_LABEL}' -> '${AUTORELEASE_TAGGED_LABEL}'`,
      );
    }

    // The verdict is the PR object, not the edit's exit code: `gh pr view`
    // reports the edit immediately, and a label it still shows is really there.
    const labelsRun = viewLabels(gh, repo, pr.number);
    const pending = stillPending(labelsRun);
    if (pending === undefined) {
      unverified += 1;
      warn(
        `could not re-query to verify #${pr.number} ${pr.title ?? "(untitled)"}: ${gh} pr view ` +
          `failed or returned an unreadable label payload (stderr: ${stderrOf(labelsRun)}; ` +
          `output: ${(labelsRun.stdout || "").trim() || "(empty)"}). If its label is still ` +
          `'${AUTORELEASE_PENDING_LABEL}', the release-please backstop reddens the next push; ` +
          `manual recovery: ${MANUAL_RECOVERY}`,
      );
      continue;
    }
    if (pending) remaining.push(pr);
  }

  if (remaining.length > 0) {
    warn(
      `still '${AUTORELEASE_PENDING_LABEL}' on ${remaining.length} merged release PR(s) after the flip — ` +
        `release-please WILL abort until they are cleared. The backstop reddens the next push naming ` +
        `them; manual recovery:\n${renderPending(remaining)}\n  ${MANUAL_RECOVERY}`,
    );
    return;
  }
  if (unverified > 0) {
    warn(
      `flipped what it could but could not verify ${unverified} merged release PR(s) — if a label ` +
        `is still '${AUTORELEASE_PENDING_LABEL}', the release-please backstop reddens the next ` +
        `push; manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  info(
    `OK — flipped ${flipped} merged release PR(s) to '${AUTORELEASE_TAGGED_LABEL}'; ` +
      `release-please is not aborting.`,
  );
}

// Only run when invoked directly (importable for unit tests if needed).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
