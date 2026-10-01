#!/usr/bin/env node
/**
 * Release guard: the C3 ordered predicate of spec-release-pipeline-015, run as
 * the FIRST step of `.github/workflows/release.yml` (`on: push: branches:
 * [main]`). Classify the pushed commit first; consult the tag only for
 * version-changing pushes:
 *
 *   0. version unchanged from the parent commit -> not a release commit:
 *      exit 0 without publishing. This rule runs FIRST so the steady state
 *      after any release is permanently green — a tracker flip, a docs push or
 *      the pipeline's own post-release push carries the already-tagged version
 *      and must never read as "re-shipping" (the flaw of consulting the tag
 *      before classifying the commit).
 *   1. version-changing push, tag `v(V)` absent -> this is the release:
 *      proceed (tag -> GitHub Release -> build -> pack -> inspect -> publish).
 *   2. tag `v(V)` exists and points at the pushed commit -> idempotent re-run:
 *      proceed and complete the remaining steps ("Re-run failed jobs", or a
 *      publish that failed before the npmjs.com trusted-publisher setup).
 *   3. tag `v(V)` exists pointing elsewhere -> fail loudly: a shipped version
 *      is being re-shipped (agreement gate).
 *
 * Parent-comparison is safe for squash-merged release PRs: the merge lands as
 * exactly one commit whose parent is pre-bump main, so the version differs
 * exactly once — at the merge commit. Corollary: the bump must be the pushed
 * commit's HEAD to fire the release.
 *
 * Outputs (printed always; appended to `$GITHUB_OUTPUT` when set):
 * `rule` (0-3), `release` (true/false), `tag_exists` (true/false/unverified),
 * `version`.
 *
 * Usage: `node cli/release-guard.mjs --sha <commit> [--remote origin] [--cwd <dir>]`
 * Exit codes: 0 — proceed (rules 1-2) or no-op (rule 0); 1 — loud failure
 * (rule 3); 2 — usage / git error (fail closed: a guard that cannot classify
 * never starts a release).
 *
 * Offline-testable by design: everything it needs is the local clone plus
 * `git ls-remote <remote>`, so the fixture tests point `--remote` at a local
 * bare repo (cli/release-guard.test.ts) and exercise all four rules.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** `package.json` version at a commit ("sha:path" syntax; peel ^ via rev-parse). */
function versionAt(cwd, rev) {
  const blob = git(cwd, ["show", `${rev}:package.json`]);
  return JSON.parse(blob).version;
}

/**
 * Sha the tag `refs/tags/v<version>` names, peeled (annotated tag -> commit).
 * Empty string when the tag does not exist on the remote. Reads both the raw
 * and the `^{}` entry so lightweight tags resolve to their commit too.
 */
function tagPointsAt(cwd, remote, version) {
  let out = "";
  try {
    out = git(cwd, [
      "ls-remote",
      remote,
      `refs/tags/v${version}`,
      `refs/tags/v${version}^{}`,
    ]);
  } catch (err) {
    // Fail closed: a guard that cannot classify never starts a release.
    console.error(`release-guard: ls-remote failed for v${version} — cannot classify the push (${err.message}). Not a release; re-run when the network is healthy.`);
    process.exit(2);
  }
  const shas = new Map();
  for (const line of out.split("\n")) {
    const [sha, ref] = line.split(/\t/);
    if (sha && ref) shas.set(ref, sha);
  }
  const direct = shas.get(`refs/tags/v${version}`);
  if (!direct) return { exists: false, sha: "" };
  const peeled = shas.get(`refs/tags/v${version}^{}`) ?? direct;
  return { exists: true, sha: peeled };
}

function usage(message) {
  console.error(`release-guard: ${message}`);
  console.error("usage: node cli/release-guard.mjs --sha <commit> [--remote origin] [--cwd <dir>]");
  process.exitCode = 2;
}

export function parseArgs(argv) {
  const args = { remote: "origin", cwd: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--sha") args.sha = argv[++i];
    else if (arg === "--remote") args.remote = argv[++i];
    else if (arg === "--cwd") args.cwd = argv[++i];
    else return null;
  }
  return args.sha ? args : null;
}

export function run(args) {
  let version;
  let parentVersion;
  try {
    version = versionAt(args.cwd, args.sha);
    parentVersion = versionAt(args.cwd, `${args.sha}^`);
  } catch (err) {
    console.error(
      `release-guard: cannot classify ${args.sha} (git show failed: ${String(err?.message ?? err)}); refusing to start a release`,
    );
    process.exitCode = 2;
    return;
  }

  const finish = (rule, release, tagExists) => {
    const outputs = [
      `rule=${rule}`,
      `release=${release}`,
      `tag_exists=${tagExists}`,
      `version=${version}`,
    ];
    for (const line of outputs) console.log(line.replace(/^/, "release-guard: "));
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, outputs.join("\n") + "\n");
    }
    if (release === "false") {
      console.log(
        `release-guard: version unchanged from the parent (${parentVersion} -> ${version}) — not a release commit, nothing to do`,
      );
      return;
    }
    if (rule === 2) {
      console.log(
        `release-guard: tag v${version} already names ${args.sha} — idempotent re-run, completing the remaining steps`,
      );
    }
  };

  // Rule 0 FIRST: steady state stays green, tag never consulted.
  if (version === parentVersion) {
    finish(0, "false", "unverified");
    return;
  }

  const tag = tagPointsAt(args.cwd, args.remote, version);
  if (!tag.exists) {
    console.log(`release-guard: version-changing push (${parentVersion} -> ${version}), tag v${version} absent — this is the release`);
    finish(1, "true", "false");
    return;
  }
  if (tag.sha === args.sha) {
    finish(2, "true", "true");
    return;
  }
  console.error(
    `release-guard: FAILING LOUDLY — version bumped to ${version} but tag v${version} already points at ${tag.sha}, not at the pushed ${args.sha}: a shipped version is being re-shipped. Cut the next version instead; never move tags.`,
  );
  process.exitCode = 1;
}

// Direct-run guard: the test suite imports the pure parts above.
const invokedDirectly = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  const args = parseArgs(process.argv.slice(2));
  if (!args) usage("missing --sha <commit> (or unknown flag)");
  else run(args);
}
