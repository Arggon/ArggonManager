#!/usr/bin/env node
// cli/release-abort-check.mjs
//
// Surface an aborted release-please run (bug-release-config-workflow-agreement-ungated).
//
// release-please can ABORT without failing. `Manifest.createPullRequests()`
// warns "There are untagged, merged release PRs outstanding - aborting" and
// returns [] (it opens no new release PR), while the job reports success. That
// warning is a `logger.warn` inside a successful action: invisible to CI
// status, to any dashboard reading conclusions, and to anyone who has not read
// the log line. That is exactly how the release pipeline stayed dead from
// 2026-10-02 to 2026-10-07 while every run was green.
//
// This step turns the silent abort into a red run. Its predicate is
// release-please's OWN abort condition, lifted from src/manifest.ts:
//
//   findMergedReleasePullRequests() yields the MERGED pull requests that carry
//   the `autorelease: pending` label (DEFAULT_LABELS); createPullRequests()
//   aborts if it yields anything. A merged release PR only drops that label via
//   createReleasesForPullRequest() (removeIssueLabels(pending) +
//   addIssueLabels(tagged)) — i.e. once release-please matches the merged
//   release PR to its tag. So "a merged PR still carrying `autorelease:
//   pending`" IS "release-please is currently aborting", and it is exactly
//   detectable with `gh pr list --state merged --label "autorelease: pending"`.
//
// It runs in .github/workflows/release-please.yml right after the
// googleapis/release-please-action step, and fails the job (exit 1) when the
// predicate holds, so an aborted release can no longer masquerade as success.
//
// WHY THIS CANNOT GO RED ON A LEGITIMATE NO-RELEASE PUSH. The red condition is
// precisely the predicate above — a MERGED release PR stuck `autorelease:
// pending`. An ordinary push to main (tracker flip, docs, CI, this pipeline's
// own post-merge push — every push without a `Release-As:` trailer) proposes no
// release, and in the healthy steady state each already-merged release PR has
// been completed (label flipped `autorelease: pending` → `autorelease: tagged`
// by release-please matching the plain tag), so the query returns [] and the
// step is green — that path is proven green in cli/release-abort-check.test.ts
// (the injected empty gh). An OPEN release PR (just proposed) is excluded by
// `--state merged`. A gh query that cannot run at all does NOT manufacture a
// red: that same failure has already reddened the release-please action step
// (same token, same GitHub API), so rather than cry wolf on a healthy push this
// prints a loud visible warning and exits 0 — the crying-wolf defect is the
// entire reason this item exists. Only a genuine stuck PR reddens.
//
// LANDED (bug-autorelease-label-lifecycle-unowned): release.yml now flips the
// label (`cli/release-label-flip.mjs`, immediately after the tag↔version
// agreement assert), so in the steady state this check finds nothing even
// though release-please's own tagging path never runs. The failure message
// below carries the manual recovery for the residual cases — a run that died
// between the tag and the flip, or a flip that could not reach GitHub — and
// release.md documents the lifecycle. The seam is at the marked comment.
import { spawnSync } from "node:child_process";
import { writeSync } from "node:fs";

const AUTORELEASE_PENDING_LABEL = "autorelease: pending";
const AUTORELEASE_TAGGED_LABEL = "autorelease: tagged";
// release-please scans the 200 most-recently-merged PRs (manifest.ts
// findMergedReleasePullRequests); a stuck release PR is rare and recent, so a
// generous window cannot miss it.
const MERGED_SCAN_LIMIT = "200";

/** Parse `--repo <owner/name>` (the workflow also supplies GITHUB_REPOSITORY). */
function parseRepo(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") return argv[i + 1];
    if (argv[i]?.startsWith("--repo=")) return argv[i].slice("--repo=".length);
  }
  return undefined;
}

function main() {
  const repo = parseRepo(process.argv.slice(2)) ?? process.env.GITHUB_REPOSITORY;
  if (!repo) {
    writeSync(
      1,
      "release-abort-check: FAIL — no repository: pass --repo <owner/name> or set GITHUB_REPOSITORY.\n",
    );
    process.exit(1);
  }
  // GH_BIN is the test-injection seam (cli/release-abort-check.test.ts); the
  // runner's gh is on PATH.
  const gh = process.env.GH_BIN || "gh";
  const args = [
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
  ];
  const run = spawnSync(gh, args, { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    // Fail OPEN with a visible warning: this is the cannot-cry-wolf guarantee.
    // The action step that ran right before this one uses the same gh/API and
    // would already be red, so a reddening here would be noise, not a signal.
    writeSync(
      1,
      `release-abort-check: WARNING — could not query ${gh} for merged '${AUTORELEASE_PENDING_LABEL}' PRs; ` +
        `not a detected abort (the release-please action step uses the same API and gates the run). ` +
        `stderr: ${(run.stderr || String(run.error || "")).trim()}\n`,
    );
    process.exit(0);
  }
  let stuck;
  try {
    stuck = JSON.parse(run.stdout);
  } catch {
    writeSync(
      1,
      `release-abort-check: WARNING — could not parse ${gh} output as JSON; not a detected abort. output: ${run.stdout.trim()}\n`,
    );
    process.exit(0);
  }
  if (!Array.isArray(stuck) || stuck.length === 0) {
    writeSync(
      1,
      `release-abort-check: OK — no merged release PRs still carrying '${AUTORELEASE_PENDING_LABEL}'; ` +
        `release-please is not aborting.\n`,
    );
    process.exit(0);
  }
  const list = stuck
    .map((pr) => `  #${pr.number} ${pr.title ?? "(untitled)"} (${pr.headRefName ?? "?"})`)
    .join("\n");
  writeSync(
    1,
    `release-abort-check: FAIL — release-please is STUCK and this run would otherwise report success.\n` +
      `${stuck.length} MERGED release PR(s) still carry the '${AUTORELEASE_PENDING_LABEL}' label, which is\n` +
      `release-please's own abort condition (src/manifest.ts: "There are untagged, merged release PRs\n` +
      `outstanding - aborting"). While any merged release PR stays pending, release-please opens NO new\n` +
      `release PR — the pipeline is dead, exactly as it was dead 2026-10-02 → 2026-10-07 behind green runs.\n\n` +
      `${list}\n\n` +
      // The manual recovery (bug-autorelease-label-lifecycle-unowned): the flip
      // is automated in release.yml, but a run that died between the tag and the
      // flip — or a flip that could not reach GitHub — leaves this state, and
      // the red run is where the operator reads how to clear it.
      `Manual recovery (one command per PR above; release.yml normally does this automatically in\n` +
      `the run that creates the tag):\n` +
      `  gh pr edit <n> --add-label "${AUTORELEASE_TAGGED_LABEL}" --remove-label "${AUTORELEASE_PENDING_LABEL}"\n\n` +
      `First suspect is the tag↔config agreement cli/src/release-config-agreement.test.ts pins: ` +
      `release.yml tags the plain vX.Y.Z (git tag -a "v\${VERSION}") and release-please-config.json must set ` +
      `"include-component-in-tag": false so release-please looks for that same tag.\n`,
  );
  process.exit(1);
}

// Only run when invoked directly (importable for future unit tests if needed).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
