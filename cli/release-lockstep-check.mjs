#!/usr/bin/env node
// cli/release-lockstep-check.mjs
//
// Surface a NON-LOCKSTEP open release PR as a red maintenance run
// (bug-release-proposal-non-lockstep-undetected).
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
// versions differ". An ordinary push opens no release PR (quiet path). A gh
// query or read that cannot run does NOT manufacture a red: it prints a loud
// WARNING and exits 0 (the pre-tag release.yml gate still refuses a broken
// release commit, so a missed proposal cannot ship), mirroring
// cli/release-abort-check.mjs. Only a genuine mismatch reddens.
//
// It runs in .github/workflows/release-please.yml right after the abort check
// and BEFORE the lockfile sync (a non-lockstep proposal must fail before this
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
 * nothing about what the PR proposes.
 */
function readVersion(gh, repo, path, ref) {
  const endpoint = `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const run = ghRun(gh, ["api", endpoint, "-H", RAW_ACCEPT]);
  if (!run.ok) return { ok: false, detail: run.detail };
  let version;
  try {
    version = JSON.parse(run.stdout).version;
  } catch {
    version = undefined;
  }
  if (typeof version !== "string" || version === "") {
    return { ok: false, detail: `no version field in ${path} at ${ref}` };
  }
  return { ok: true, version };
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
  for (const pr of open) {
    const ref = pr.headRefName ?? RELEASE_PR_HEAD;
    const root = readVersion(gh, repo, ROOT_MANIFEST, ref);
    const lib = root.ok ? readVersion(gh, repo, LIB_MANIFEST, ref) : root;
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
  }
  if (broken.length === 0) {
    // Lockstep (or the warning above already reported what could not be read).
    // Either way: exit 0 with no failure message.
    process.exit(0);
  }

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
  process.exit(1);
}

// Only run when invoked directly (importable for future unit tests if needed).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
