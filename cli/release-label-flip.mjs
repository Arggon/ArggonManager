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

/** The abort predicate query: merged PRs still carrying the pending label. */
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

function renderPending(prs) {
  return prs.map((pr) => `  #${pr.number} ${pr.title ?? "(untitled)"}`).join("\n");
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

  for (const pr of stuck) {
    if (pr === null || typeof pr !== "object" || typeof pr.number !== "number") {
      warn(`skipping a malformed entry from ${gh} output: ${JSON.stringify(pr)}`);
      continue;
    }
    const edited = flip(gh, repo, pr.number);
    if (edited.error || edited.status !== 0) {
      warn(
        `could not flip #${pr.number} ${pr.title ?? "(untitled)"} to '${AUTORELEASE_TAGGED_LABEL}' ` +
          `(stderr: ${stderrOf(edited)}); continuing with the rest. Manual recovery: ${MANUAL_RECOVERY}`,
      );
      continue;
    }
    info(
      `flipped #${pr.number} ${pr.title ?? "(untitled)"}: '${AUTORELEASE_PENDING_LABEL}' -> '${AUTORELEASE_TAGGED_LABEL}'`,
    );
  }

  // Verify against the abort predicate itself, not against the edit exit codes:
  // the point is that release-please stops reading the PR as untagged.
  const after = listPending(gh, repo);
  if (after.error || after.status !== 0) {
    warn(
      `flipped what it could but could not re-query to verify (stderr: ${stderrOf(after)}). ` +
        `If a label is still '${AUTORELEASE_PENDING_LABEL}', the release-please backstop reddens ` +
        `the next push; manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  let remaining;
  try {
    remaining = JSON.parse(after.stdout);
  } catch {
    warn(
      `could not parse the verification query (output: ${after.stdout.trim()}). ` +
        `If a label is still '${AUTORELEASE_PENDING_LABEL}', the release-please backstop reddens ` +
        `the next push; manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  if (!Array.isArray(remaining)) {
    warn(
      `unexpected verification output shape (expected an array). If a label is still ` +
        `'${AUTORELEASE_PENDING_LABEL}', the release-please backstop reddens the next push; ` +
        `manual recovery: ${MANUAL_RECOVERY}`,
    );
    return;
  }
  if (remaining.length === 0) {
    info(
      `OK — flipped ${stuck.length} merged release PR(s) to '${AUTORELEASE_TAGGED_LABEL}'; ` +
        `release-please is not aborting.`,
    );
    return;
  }
  warn(
    `still '${AUTORELEASE_PENDING_LABEL}' on ${remaining.length} merged release PR(s) after the flip — ` +
      `release-please WILL abort until they are cleared. The backstop reddens the next push naming ` +
      `them; manual recovery:\n${renderPending(remaining)}\n  ${MANUAL_RECOVERY}`,
  );
}

// Only run when invoked directly (importable for unit tests if needed).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
