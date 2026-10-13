#!/usr/bin/env node
// cli/release-lockstep-check.mjs
//
// Surface a NON-LOCKSTEP open release PR — or one carrying a non-exact kernel
// pin — as a red maintenance run (bug-release-proposal-non-lockstep-undetected,
// bug-kernel-pin-never-exact).
//
// THE INCIDENT (2026-10-13, release PR #764). release-please auto-proposed
// 0.8.0 for the root package only — the wave's `feat` commits touched no
// `lib/` path — while `release-please-config.json`'s extra-files rule rewrote
// the root's kernel pin to the root's new version (`^0.8.0`), assuming
// lockstep. lib stayed 0.7.1. Lockstep is the recorded invariant (ADR 0018
// §1/§2; spec-release-pipeline-015 invariant 1; "per-package independent
// releases" is an explicit non-goal), so that proposal must never merge.
//
// WHY THE MAINTENANCE RUN DID NOT SEE IT. `release-please.yml` checked the
// aborted-release predicate and synced the lockfile, but never compared the
// open PR's two versions; the only red surface was the PR's own CI, whose runs
// start `action_required` and need a human to approve — #764 sat undetected
// until that approval. And merging it would have created tag v0.8.0 and only
// THEN failed release.yml's lockstep assert (which used to run after the tag),
// stranding the tag and wedging release-please on the merged PR — the
// 2026-10-02 → 2026-10-07 outage class. The assert now runs PRE-tag
// (`release.yml`, "Assert root-lib lockstep BEFORE tagging"); this check is the
// earlier, quieter surface that catches the proposal while it is still open.
//
// WHAT THIS CHECKS. For the open release PR on the manifest-mode branch
// (`release-please--branches--main`), read `package.json` and
// `lib/package.json` AT THE PR HEAD REF and compare their `version`s. Different
// -> exit 1, naming both versions and the remedy; equal -> exit 0, silent; no
// open release PR -> exit 0, silent (the ordinary push).
//
// THE SECOND CONCERN: THE EXACT KERNEL PIN (bug-kernel-pin-never-exact). The
// same read also yields the root's `dependencies["@arggondev/lib"]`, and the
// open PR must carry the BARE released version — no `^`/`~`/range operator
// (ADR 0018 §2; spec-release-pipeline-015 invariant 4 / A3), so that what an
// adopter installs is exactly what CI tested. Through v0.7.1 every release
// shipped a caret: the C1 amendment's one-time hand-unpin (2026-10-01) was
// written down but never executed, and nothing detected it. The un-pin finally
// landed in the 0.8.0 release PR (5fd10db4), and release-please's extra-files
// updater then kept exactness automatically — v0.9.0 rewrote
// `"@arggondev/lib": "0.8.0"` to `"0.9.0"` with no operator (#770) — because
// GenericJson preserves whatever operator the string carries, and the absence
// of one is sticky too. This check keeps it that way: a pin that is non-exact,
// stale (exact but not the version being released) or missing reddens the run
// while the fix is still available in review.
//
// NO NORMALIZATION STEP WRITES THE PIN, decided 2026-10-13: release-please owns
// that rewrite and exactness is sticky once main is exact; a caret-stripping
// step in this workflow would be a second writer on release-please's own PR
// branch — the alternative the spec rejected — and would silently repair a
// release-please regression instead of surfacing it. The detection gap is
// closed on both sides instead: this guard (release PR, ungated) and a test in
// cli/release-lockstep-check.test.ts (main, every CI run).
//
// THE REMEDY IN THE MESSAGE is the one verified against this repo's pinned
// release-please (17.11.2): an EMPTY commit carrying a `Release-As: X.Y.Z`
// trailer is applied to every component path (`CommitSplit includeEmpty:
// true`), so it forces BOTH packages to X.Y.Z and release-please updates the
// open PR to a lockstep proposal. The `linked-versions` plugin — the documented
// lockstep mechanism — is a no-op under this repo's tag contract
// (`include-component-in-tag: false` => `Strategy.getComponent()` returns '',
// so the plugin finds zero components), which is why the remedy is a commit,
// not a config.
//
// CANNOT CRY WOLF. The red condition is exactly "an OPEN release PR whose two
// versions differ" or "an OPEN release PR whose kernel pin is not the bare
// released version". An ordinary push opens no release PR (quiet path). A gh
// query or read that cannot run does NOT manufacture a red: it prints a loud
// WARNING and exits 0 (the pre-tag release.yml gate still refuses a broken
// release commit, so a missed proposal cannot ship), mirroring
// cli/release-abort-check.mjs. Only a genuine mismatch reddens.
//
// When the PIN guard reddens, the remedy (also printed) is: edit the release
// PR's package.json to the bare X.Y.Z being released, then re-run this workflow
// ("Re-run all jobs" on the red run) so the lockfile-sync step recomputes
// package-lock.json on the fixed branch — `npm ci` needs the lockfile to match
// a changed pin — and merge only after that run is green. The step order
// matters: the guard runs BEFORE the sync, so a broken proposal is not mutated.
//
// It runs in .github/workflows/release-please.yml right after the abort check
// and BEFORE the lockfile sync (a broken proposal must fail before this
// workflow mutates its branch), on every push, with no `if:`.
import { spawnSync } from "node:child_process";
import { writeSync } from "node:fs";

// The manifest-mode branch name default (release-please docs, manifest-releaser).
// release-please-config.json does not override `branch-name`, and the lockfile
// sync in release-please.yml keys off this same name — keep them in sync if it
// ever changes.
const RELEASE_PR_HEAD = "release-please--branches--main";
const ROOT_MANIFEST = "package.json";
const LIB_MANIFEST = "lib/package.json";
// The kernel dependency release-please's extra-files rule rewrites
// (release-please-config.json, package ".":
// `$.dependencies['@arggondev/lib']`).
const KERNEL = "@arggondev/lib";
// The exact-pin contract (ADR 0018 §2; spec invariant 4 / A3): the bare
// released version, optionally with a semver prerelease/build suffix. A leading
// `^`/`~`/`>=`/`<`/`=` or any other range syntax — `*`, `x`-ranges, bare minor
// versions, `||` unions — fails.
const EXACT_PIN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
// The media type that returns the raw file body instead of a base64 envelope
// (docs.github.com, "Get repository content").
const RAW_ACCEPT = "Accept: application/vnd.github.raw+json";

/** Parse `--repo <owner/name>` (the workflow also supplies GITHUB_REPOSITORY). */
function parseRepo(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") return argv[i + 1];
    if (argv[i]?.startsWith("--repo=")) return argv[i].slice("--repo=".length);
  }
  return undefined;
}

/** Run gh; `ok` is false when the binary failed (spawn error or non-zero). */
function ghRun(gh, args) {
  const run = spawnSync(gh, args, { encoding: "utf8" });
  if (run.error || run.status !== 0) {
    return { ok: false, detail: (run.stderr || String(run.error || "")).trim() };
  }
  return { ok: true, stdout: run.stdout };
}

/**
 * `gh api` has no `--repo`, so the endpoint carries owner/name. The `?ref=`
 * pins the read to the PR's head ref — never to main, whose versions say
 * nothing about what the PR proposes. `pin` is the raw kernel dependency value
 * (any shape; the verdict on it is `pinProblem`'s, not the read's).
 */
function readManifest(gh, repo, path, ref) {
  const endpoint = `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const run = ghRun(gh, ["api", endpoint, "-H", RAW_ACCEPT]);
  if (!run.ok) return { ok: false, detail: run.detail };
  let manifest;
  try {
    manifest = JSON.parse(run.stdout);
  } catch {
    manifest = undefined;
  }
  const version = manifest?.version;
  if (typeof version !== "string" || version === "") {
    return { ok: false, detail: `no version field in ${path} at ${ref}` };
  }
  return { ok: true, version, pin: manifest?.dependencies?.[KERNEL] };
}

/**
 * The exact-pin verdict for one release-PR manifest: `null` when the pin is the
 * bare released version, else a descriptor the caller renders (and the
 * main-side test in cli/release-lockstep-check.test.ts asserts on). Pure, so
 * the test corpus can drive every shape.
 *
 * @param pin The raw `dependencies["@arggondev/lib"]` value (any type).
 * @param releasedVersion The version the release PR proposes for the root.
 */
export function pinProblem(pin, releasedVersion) {
  if (typeof pin !== "string" || pin === "") return { kind: "missing" };
  if (!EXACT_PIN.test(pin)) return { kind: "range", pin };
  if (pin !== releasedVersion) return { kind: "stale", pin };
  return null;
}

/**
 * The fix for a `pinProblem`, shared by the FAIL block below and the main-side
 * test's failure message so the two cannot drift. The caller adds the
 * release-PR operational step (re-run the workflow so the lockfile sync runs on
 * the fixed branch) where it applies.
 */
export function pinFix(problem, releasedVersion) {
  if (problem.kind === "missing") {
    return (
      `restore dependencies["${KERNEL}"] = "${releasedVersion}" in package.json ` +
      `(check release-please-config.json's extra-files jsonpath)`
    );
  }
  if (problem.kind === "range") {
    return (
      `set dependencies["${KERNEL}"] to "${releasedVersion}" — the bare released version, ` +
      `no range operator (currently ${JSON.stringify(problem.pin)})`
    );
  }
  return (
    `set dependencies["${KERNEL}"] to "${releasedVersion}" — the version being released ` +
    `(currently ${JSON.stringify(problem.pin)})`
  );
}

/**
 * The higher of two x.y.z versions, so the printed remedy forces the release
 * number the higher proposal implies (the version you intend to ship). Falls
 * back to the root proposal on any shape it cannot compare.
 */
function higherVersion(rootV, libV) {
  const parts = (value) => (/^\d+\.\d+(\.\d+)?$/.test(value) ? value.split(".").map(Number) : null);
  const root = parts(rootV);
  const lib = parts(libV);
  if (!root || !lib) return rootV;
  for (let i = 0; i < Math.max(root.length, lib.length); i++) {
    const a = root[i] ?? 0;
    const b = lib[i] ?? 0;
    if (a !== b) return a > b ? rootV : libV;
  }
  return rootV;
}

function main() {
  const repo = parseRepo(process.argv.slice(2)) ?? process.env.GITHUB_REPOSITORY;
  if (!repo) {
    writeSync(
      1,
      "release-lockstep-check: FAIL — no repository: pass --repo <owner/name> or set GITHUB_REPOSITORY.\n",
    );
    process.exit(1);
  }
  // GH_BIN is the test-injection seam (cli/release-lockstep-check.test.ts); the
  // runner's gh is on PATH.
  const gh = process.env.GH_BIN || "gh";

  const listed = ghRun(gh, [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--head",
    RELEASE_PR_HEAD,
    "--json",
    "number,headRefName",
  ]);
  if (!listed.ok) {
    // Fail OPEN with a visible warning: a healthy push whose GitHub query
    // hiccups must not redden, and the pre-tag gate in release.yml still
    // refuses a broken release commit at merge time.
    writeSync(
      1,
      `release-lockstep-check: WARNING — could not list open release PRs via ${gh} ` +
        `(${listed.detail || "no detail"}); cannot tell whether a proposal is non-lockstep — ` +
        `not a detected mismatch (release.yml refuses a broken release commit at tag time).\n`,
    );
    process.exit(0);
  }
  let open;
  try {
    open = JSON.parse(listed.stdout);
  } catch {
    writeSync(
      1,
      `release-lockstep-check: WARNING — could not parse ${gh} output as JSON; not a detected ` +
        `mismatch. output: ${listed.stdout.trim()}\n`,
    );
    process.exit(0);
  }
  if (!Array.isArray(open) || open.length === 0) {
    // The ordinary push: no release PR is open. A green maintenance run stays
    // quiet — nothing to check, nothing to report.
    process.exit(0);
  }

  const broken = [];
  const pinBroken = [];
  for (const pr of open) {
    const ref = pr.headRefName ?? RELEASE_PR_HEAD;
    const root = readManifest(gh, repo, ROOT_MANIFEST, ref);
    const lib = root.ok ? readManifest(gh, repo, LIB_MANIFEST, ref) : root;
    if (!root.ok || !lib.ok) {
      writeSync(
        1,
        `release-lockstep-check: WARNING — could not read ` +
          `${root.ok ? LIB_MANIFEST : ROOT_MANIFEST} at ${ref} via ${gh} ` +
          `(${(!root.ok ? root : lib).detail || "no detail"}); that proposal was not checked — ` +
          `not a detected mismatch.\n`,
      );
      break;
    }
    if (root.version !== lib.version) {
      broken.push({ number: pr.number, ref, root: root.version, lib: lib.version });
    }
    const problem = pinProblem(root.pin, root.version);
    if (problem) {
      pinBroken.push({ number: pr.number, ref, version: root.version, problem });
    }
  }
  if (broken.length === 0 && pinBroken.length === 0) {
    // Lockstep and an exact pin (or the warning above already reported what
    // could not be read). Either way: exit 0 with no failure message.
    process.exit(0);
  }

  if (broken.length > 0) {
    const found = broken
      .map((pr) => {
        const forced = higherVersion(pr.root, pr.lib);
        return (
          `  #${pr.number ?? "?"} (${pr.ref})\n` +
          `      root (arggon-manager) ${pr.root} != lib (@arggondev/lib) ${pr.lib}\n` +
          `      remedy: git commit --allow-empty -m "chore(release): ${forced}" ` +
          `-m "Release-As: ${forced}" && git push origin main`
        );
      })
      .join("\n\n");
    writeSync(
      1,
      `release-lockstep-check: FAIL — an OPEN release PR proposes a NON-LOCKSTEP release, which must not merge.\n` +
        `Every release is lockstep (root version == lib version; ADR 0018 §1/§2, spec-release-pipeline-015\n` +
        `invariant 1) and release.yml refuses to tag a non-lockstep release commit, so merging this PR\n` +
        `would strand the release (the 2026-10-02 → 2026-10-07 outage class).\n\n` +
        `${found}\n\n` +
        `Why: release-please bumps only the components whose paths the wave touched, while\n` +
        `release-please-config.json's extra-files rule rewrites the root's kernel pin to the root's new\n` +
        `version assuming lockstep (the #764 mechanism: root 0.8.0, lib 0.7.1, pin ^0.8.0).\n\n` +
        `Remedy: force BOTH packages to one version with an EMPTY commit carrying a 'Release-As: X.Y.Z'\n` +
        `trailer pushed to main — release-please applies an empty commit to every component path\n` +
        `(CommitSplit includeEmpty: true) and updates the release PR to a lockstep proposal. X.Y.Z is the\n` +
        `version you intend to release; the remedy command above uses the higher of the two proposals.\n` +
        `See release.md §Exception: the release PR is non-lockstep.\n`,
    );
  }

  if (pinBroken.length > 0) {
    const found = pinBroken
      .map((pr) => {
        const why =
          pr.problem.kind === "range"
            ? "carries a range operator"
            : pr.problem.kind === "stale"
              ? "does not name the version being released"
              : "is missing or not a version string";
        return (
          `  #${pr.number ?? "?"} (${pr.ref})\n` +
          `      root (arggon-manager) ${pr.version}: dependencies["${KERNEL}"] ${why}\n` +
          `      fix: ${pinFix(pr.problem, pr.version)}\n` +
          `      then re-run release-please.yml (the red run → "Re-run all jobs") so the lockfile-sync\n` +
          `      step recomputes package-lock.json on the fixed branch; do not merge until it is green`
        );
      })
      .join("\n\n");
    writeSync(
      1,
      `release-lockstep-check: FAIL — an OPEN release PR carries a NON-EXACT or STALE kernel pin, which must not merge.\n` +
        `The root's dependencies["${KERNEL}"] must be the BARE released version — no ^ / ~ / >= or any\n` +
        `other range operator (ADR 0018 §2; spec-release-pipeline-015 invariant 4 / A3): the pin is what an\n` +
        `adopter installs, and it must be exactly what CI and release.yml tested.\n\n` +
        `${found}\n\n` +
        `Why: release-please's extra-files JSON updater rewrites the version inside the existing string and\n` +
        `preserves whatever operator is there — an exact pin stays exact across regenerations (sticky since\n` +
        `0.8.0, observed on #770) — and a range means the pin was hand-edited or release-please regressed. A\n` +
        `stale exact pin means the extra-files rewrite did not run for this proposal.\n\n` +
        `See release.md §The kernel pin stays exact (guard-enforced).\n`,
    );
  }

  process.exit(1);
}

// Only run when invoked directly (importable for future unit tests if needed).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
