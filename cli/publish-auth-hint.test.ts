/**
 * Publish-failure classification + hint formatting
 * (bug-release-needs-auth-self-describing).
 *
 * `cli/publish-auth-hint.mjs` runs on the FAILURE PATH of both publish steps in
 * `.github/workflows/release.yml` (`@arggondev/lib`, then `arggon-manager`), so
 * a bare npm `ENEEDAUTH` now arrives with the cause, the package and the
 * pointer to the one-time npmjs.com trusted-publisher setup. Two properties are
 * pinned here, and both must hold for the mechanism to be worth having:
 *
 *   1. a GENUINE authentication failure gets the pointer — npm 10's `ERR!`
 *      prefix and npm 11's lowercase `error` prefix, the `E401` registry
 *      refusal, and a log with no code line at all;
 *   2. anything else gets NOTHING — a network error, a 404 on a name typo
 *      (which npm can also use to mask a trusted-publishing mismatch,
 *      npm/cli#9088, so it is deliberately not translated), a 403 for an
 *      already-published version, a pack/lifecycle failure, an unknown code and
 *      a passing publish. A wrong hint on a real failure is worse than none.
 *
 * The wrapper's own failure path is pinned too: when `spawnSync` fails (the
 * command is missing, or npm's stderr exceeds its 1 MiB maxBuffer — ENOBUFS),
 * the captured npm output is re-emitted before the wrapper fails closed with
 * exit 2, so the wrapper can never hide the npm error it exists to surface.
 *
 * Everything is offline: the "npm" is a fixture script that prints a saved npm
 * error log and exits, and the logs replay the shapes real runs produced (the
 * two release attempts this repo lost were a missing `@arggondev/lib` entry and
 * a lowercase-org repo string). No publish, no registry, no network.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { assertOrder } from "../test/assert-order.js";
import {
  classifyPublishFailure,
  extractErrorCodes,
  formatAuthHint,
  isAuthFailure,
  parseArgs,
  repoFromManifest,
  repoFromRepositoryUrl,
} from "./publish-auth-hint.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hintPath = join(repoRoot, "cli", "publish-auth-hint.mjs");
const LIB = "@arggondev/lib";
const ROOT = "arggon-manager";

/** npm 11's shape for the trusted-publishing failure (the real 2026-10 log). */
const ENEEDAUTH_NPM11 = [
  "npm error code ENEEDAUTH",
  "npm error",
  "npm error need auth This command requires you to be logged in to https://registry.npmjs.org/",
  "npm error need auth You need to authorize this machine using `npm adduser`",
  "npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-10-12T00_00_00_000Z-debug-0.log",
].join("\n");

/** npm 10's `ERR!` prefix, same failure. */
const ENEEDAUTH_NPM10 = [
  "npm ERR! code ENEEDAUTH",
  "npm ERR!",
  "npm ERR! need auth This command requires you to be logged in.",
  "npm ERR! need auth You need to authorize this machine using `npm adduser`",
  "npm ERR! A complete log of this run can be found in:",
  "npm ERR! /root/.npm/_logs/2026-10-12T00_00_00_000Z-debug.log",
].join("\n");

/** The registry refusing the credential: 401 on the PUT. */
const E401 = [
  "npm error code E401",
  "npm error 401 Unauthorized - PUT https://registry.npmjs.org/@arggondev%2flib",
  "npm error 401 Unauthorized - PUT https://registry.npmjs.org/arggon-manager",
  "npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-10-12T00_00_00_000Z-debug-0.log",
].join("\n");

/** An auth message with no `code` line at all (a trimmed log). */
const AUTH_MESSAGE_ONLY = [
  "npm error need auth This command requires you to be logged in to https://registry.npmjs.org/",
].join("\n");

/** A network error: no pointer, the original error stands. */
const NETWORK_RESET = [
  "npm error code ECONNRESET",
  "npm error network request to https://registry.npmjs.org/@arggondev%2flib failed, reason: socket hang up",
  "npm error network This is a problem related to network connectivity.",
  "npm error network",
  "npm error network If you are behind a proxy, please make sure that the",
  "npm error network 'proxy' config is set properly.",
].join("\n");

const NETWORK_TIMEOUT = [
  "npm error code ETIMEDOUT",
  "npm error network request to https://registry.npmjs.org/arggon-manager failed, reason: Client network socket disconnected before secure TLS connection was established",
  "npm error network This is a problem related to network connectivity.",
].join("\n");

const NETWORK_DNS = [
  "npm error code ENOTFOUND",
  "npm error network request to https://registry.npmjs.org/arggon-manager failed, reason: getaddrinfo ENOTFOUND registry.npmjs.org",
].join("\n");

/** A 404 on a name typo — npm also masks trusted-publishing mismatches as 404. */
const E404_NAME_TYPO = [
  "npm ERR! code E404",
  "npm ERR!",
  "npm ERR! 404 Not Found - GET https://registry.npmjs.org/@arggondev%2flibb",
  "npm ERR! 404",
  "npm ERR! 404  '@arggondev%2flibb@0.6.0' is not in this registry.",
  "npm ERR! 404",
  "npm ERR! 404 Note that you can also install from a",
  "npm ERR! 404 tarball, folder, or git url.",
].join("\n");

/** Version already on the registry: not an auth failure, never a pointer. */
const E403_VERSION_EXISTS = [
  "npm error code E403",
  "npm error 403 Forbidden - PUT https://registry.npmjs.org/arggon-manager - You cannot publish over the previously published versions: 0.6.0.",
  "npm error 403 In the case of a bad release, do not unpublish: deprecate it instead.",
].join("\n");

/** A pack failure (missing pack destination — the runbook's mkdir gotcha). */
const PACK_FAILURE = [
  "npm error code ENOENT",
  "npm error syscall open",
  "npm error path /home/runner/work/arggon/arggon-manager-0.6.0.tgz",
  "npm error errno -2",
  "npm error enoent ENOENT: no such file or directory, open '/home/runner/work/arggon/arggon-manager-0.6.0.tgz'",
  "npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-10-12T00_00_00_000Z-debug-0.log",
].join("\n");

/** A lifecycle-script failure from a workspace the workflow already builds. */
const LIFECYCLE_FAILURE = [
  "npm error code ELIFECYCLE",
  "npm error errno 1",
  "npm error arggon-manager@0.6.0 prepare: `tsc -p tsconfig.json`",
  "npm error Exit status 1",
  "npm error Failed at the arggon-manager@0.6.0 prepare script.",
].join("\n");

/** A passing publish's stderr: warnings only, never annotated. */
const WARNINGS_ONLY = [
  "npm warn deprecated har-validator@5.1.5: this library is no longer supported",
  "npm warn notice [french press] hello",
].join("\n");

const AUTH_LOGS: Array<[string, string]> = [
  ["npm 11's lowercase `error` prefix", ENEEDAUTH_NPM11],
  ["npm 10's `ERR!` prefix", ENEEDAUTH_NPM10],
  ["a 401 from the registry", E401],
  ["an auth message with no code line", AUTH_MESSAGE_ONLY],
];

const NON_AUTH_LOGS: Array<[string, string]> = [
  ["a connection reset", NETWORK_RESET],
  ["a network timeout", NETWORK_TIMEOUT],
  ["a DNS failure", NETWORK_DNS],
  ["a 404 on a name typo", E404_NAME_TYPO],
  ["a 403 for an already-published version", E403_VERSION_EXISTS],
  ["a pack failure", PACK_FAILURE],
  ["a lifecycle failure", LIFECYCLE_FAILURE],
  ["an empty log", ""],
  ["a log with no npm error line", "npm verb exit 1\nnpm verb code 1"],
];

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tmp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `arggon-publish-hint-${prefix}-`));
  tmpDirs.push(dir);
  return dir;
}

/** A stand-in for `npm`: prints one saved log to stderr and exits with `code`. */
function fakeNpm(log: string, code = 1): string {
  const script = join(tmp("fixture"), "npm.mjs");
  writeFileSync(script, `process.stderr.write(${JSON.stringify(log)});\nprocess.exit(${code});\n`);
  return script;
}

/** A saved npm error log on disk (the offline smoke's input). */
function logFile(log: string): string {
  const path = join(tmp("log"), "npm-error.log");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, log);
  return path;
}

function hint(
  args: string[],
  { maxBuffer = 1024 * 1024 }: { maxBuffer?: number } = {},
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [hintPath, ...args], { encoding: "utf8", maxBuffer });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("npm error-code extraction", () => {
  it("reads both npm's `ERR!` and lowercase `error` prefixes", () => {
    expect(extractErrorCodes(ENEEDAUTH_NPM10)).toEqual(["ENEEDAUTH"]);
    expect(extractErrorCodes(ENEEDAUTH_NPM11)).toEqual(["ENEEDAUTH"]);
    expect(extractErrorCodes(E404_NAME_TYPO)).toEqual(["E404"]);
  });

  it("ignores every line that is not a code line, and dedupes", () => {
    const log = [
      "npm warn deprecated left-pad@1.0.0",
      "npm verb exit 1",
      "npm error code ECONNRESET",
      "npm error code ECONNRESET",
      "npm ERR! code E404",
      "npm error A complete log of this run can be found in: ...",
    ].join("\n");
    expect(extractErrorCodes(log)).toEqual(["ECONNRESET", "E404"]);
    expect(extractErrorCodes("")).toEqual([]);
    expect(extractErrorCodes(undefined)).toEqual([]);
  });
});

describe("classifyPublishFailure — a genuine authentication failure", () => {
  it.each(AUTH_LOGS)("classifies %s as auth", (_label, log) => {
    const verdict = classifyPublishFailure({ exitCode: 1, stderr: log });
    expect(verdict.verdict).toBe("auth");
    expect(isAuthFailure({ exitCode: 1, stderr: log })).toBe(true);
    expect(verdict.evidence.length).toBeGreaterThan(0);
  });

  it("classifies E401 on a non-zero exit whatever the message says", () => {
    // A 401 IS the registry refusing the credential; no message reading needed.
    expect(isAuthFailure({ exitCode: 128, stderr: E401 })).toBe(true);
  });
});

describe("classifyPublishFailure — a code line is authoritative over message text", () => {
  it("consults the message patterns ONLY when the log carries no code line", () => {
    // The review observation this pins: the header says the message patterns
    // are for a log with no code line, and the code must agree. With a code
    // line present — auth or not — the code wins: an incidental auth phrase
    // must never turn a real `E404` into an auth hint (a wrong hint on a real
    // failure is worse than none).
    const phrase = "npm error need auth This command requires you to be logged in";
    // no code line + auth phrase -> auth (a trimmed log, an older npm)
    const messageOnly = classifyPublishFailure({ exitCode: 1, stderr: phrase });
    expect(messageOnly.verdict).toBe("auth");
    expect(messageOnly.evidence).toContain("message");
    // non-auth code + auth phrase -> other: the code is authoritative
    const codeWins = classifyPublishFailure({
      exitCode: 1,
      stderr: `npm error code E404\n${phrase}`,
    });
    expect(codeWins.verdict).toBe("other");
    expect(codeWins.evidence).toBe("npm error code E404");
    // no code line + no phrase -> other
    expect(classifyPublishFailure({ exitCode: 1, stderr: "npm error it broke" }).verdict).toBe(
      "other",
    );
  });
});

describe("classifyPublishFailure — everything else gets NO pointer", () => {
  it.each(NON_AUTH_LOGS)("does not mistranslate %s as an auth failure", (_label, log) => {
    const verdict = classifyPublishFailure({ exitCode: 1, stderr: log });
    expect(verdict.verdict).toBe("other");
    expect(isAuthFailure({ exitCode: 1, stderr: log })).toBe(false);
  });

  it("does not let a network blurb that mentions 401 read as a 401 status", () => {
    // The adversarial case: a network error whose prose mentions both "401" and
    // "logged in" must still be classified as the network error it is. Only a
    // status LINE (`401 Unauthorized`) or an auth code counts.
    const log = [
      "npm error code ECONNRESET",
      "npm error network request to https://registry.npmjs.org/arggon-manager failed, reason: socket hang up",
      "npm error network The proxy answered 401, which usually means you are not logged in to the registry",
    ].join("\n");
    expect(extractErrorCodes(log)).toEqual(["ECONNRESET"]);
    expect(classifyPublishFailure({ exitCode: 1, stderr: log }).verdict).toBe("other");
  });

  it("never annotates a passing publish, even with auth words in a warning", () => {
    const verdict = classifyPublishFailure({ exitCode: 0, stderr: WARNINGS_ONLY });
    expect(verdict.verdict).toBe("success");
    expect(verdict.evidence).toBe("");
  });
});

describe("formatAuthHint — the pointer itself", () => {
  const hint = formatAuthHint({
    packageName: LIB,
    version: "0.6.0",
    repo: "Arggon/ArggonManager",
    workflow: "release.yml",
    evidence: "npm error code ENEEDAUTH",
  });

  it("names the cause and the failing package", () => {
    expect(hint).toContain(`${LIB}@0.6.0`);
    expect(hint).toContain("AUTHENTICATION error");
    expect(hint).toContain("npm OIDC trusted-publishing authentication failed");
    expect(hint).toContain("npm error code ENEEDAUTH");
  });

  it("points at the one-time setup and the fastest check", () => {
    expect(hint).toContain(`npm trust list ${LIB}`);
    expect(hint).toContain('release.md, "One-time setup: npm trusted publishers"');
    expect(hint).toContain('"Exception: publish fails with an authentication error"');
    expect(hint).toContain("https://www.npmjs.com/package/@arggondev/lib/access");
  });

  it("states the binding and the case-sensitivity trap", () => {
    expect(hint).toContain("Arggon/ArggonManager");
    expect(hint).toContain("release.yml");
    expect(hint).toContain("`Arggon`, capital A");
    expect(hint).toContain("STAGE-ONLY publishing");
    expect(hint).toContain("environment       (none)");
  });

  it("names the recovery path (fix the entry, re-run the same push)", () => {
    expect(hint).toContain("Re-run failed jobs");
    expect(hint).toContain("idempotent re-run");
  });

  it("covers BOTH publish steps: each package gets its own name, URL and check", () => {
    // The two failures that cost this repo two attempts were per-package
    // (a missing `@arggondev/lib` entry, a lowercase-org string for the CLI),
    // so the hint is per-package, never generic.
    for (const [name, path] of [
      [LIB, "@arggondev/lib"],
      [ROOT, "arggon-manager"],
    ] as const) {
      const own = formatAuthHint({ packageName: name, evidence: "npm error code ENEEDAUTH" });
      expect(own).toContain(`npm trust list ${name}`);
      expect(own).toContain(`https://www.npmjs.com/package/${path}/access`);
      expect(own).not.toContain(name === LIB ? `trust list ${ROOT}` : `trust list ${LIB}`);
    }
  });

  it("falls back to the repo the trusted publisher must name", () => {
    expect(formatAuthHint({ packageName: ROOT })).toContain("Arggon/ArggonManager");
    expect(formatAuthHint({ packageName: ROOT, repo: "OTHER/repo" })).toContain("OTHER/repo");
    expect(formatAuthHint({ packageName: ROOT })).not.toContain("undefined");
  });
});

describe("parseArgs", () => {
  it("reads the flags and the command after `--`", () => {
    expect(
      parseArgs([
        "--package",
        LIB,
        "--version",
        "1.2.3",
        "--",
        "npm",
        "publish",
        "--workspace",
        "lib",
      ]),
    ).toEqual({
      opts: { package: LIB, version: "1.2.3" },
      command: ["npm", "publish", "--workspace", "lib"],
    });
  });

  it("rejects an unknown flag, a missing value and flags after `--`", () => {
    expect(() => parseArgs(["--bogus", "x"])).toThrow(/unknown argument/);
    expect(() => parseArgs(["--package"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--package", ""])).toThrow(/needs a value/);
    expect(parseArgs(["--", "--package", "x"]).command).toEqual(["--package", "x"]);
  });
});

describe("repo derivation from package.json", () => {
  it("normalizes the `git+https://…git` form npm requires", () => {
    expect(repoFromRepositoryUrl("git+https://github.com/Arggon/ArggonManager.git")).toBe(
      "Arggon/ArggonManager",
    );
    expect(repoFromRepositoryUrl("https://github.com/Arggon/ArggonManager")).toBe(
      "Arggon/ArggonManager",
    );
    expect(repoFromRepositoryUrl("git@github.com:Arggon/ArggonManager.git")).toBe(
      "Arggon/ArggonManager",
    );
  });

  it("returns null for anything that is not a GitHub repo", () => {
    expect(repoFromRepositoryUrl(undefined)).toBeNull();
    expect(repoFromRepositoryUrl("")).toBeNull();
    expect(repoFromRepositoryUrl("git+https://gitlab.com/a/b.git")).toBeNull();
    expect(repoFromRepositoryUrl("not a url")).toBeNull();
  });

  it("reads a manifest's `repository` field in both shapes, and fails closed", () => {
    const dir = tmp("manifest");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        repository: { type: "git", url: "git+https://github.com/Arggon/ArggonManager.git" },
      }),
    );
    expect(repoFromManifest(join(dir, "package.json"))).toBe("Arggon/ArggonManager");
    expect(repoFromManifest(join(dir, "absent.json"))).toBeNull();
    writeFileSync(join(dir, "norepo.json"), JSON.stringify({ name: "x" }));
    expect(repoFromManifest(join(dir, "norepo.json"))).toBeNull();
  });
});

describe("wrapper mode — the failure path the workflow runs", () => {
  it("prints the self-describing pointer on an ENEEDAUTH publish", () => {
    const run = hint([
      "--package",
      LIB,
      "--version",
      "0.6.0",
      "--",
      "node",
      fakeNpm(ENEEDAUTH_NPM11),
    ]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("npm error code ENEEDAUTH"); // npm's own error, verbatim
    expect(run.stderr).toContain(`${LIB}@0.6.0 failed with an AUTHENTICATION error`);
    expect(run.stderr).toContain(`npm trust list ${LIB}`);
    expect(run.stderr).toContain('"One-time setup: npm trusted publishers"');
    expect(run.stdout).toBe("");
  });

  it("prints nothing extra on a non-auth failure, and preserves the exit status", () => {
    for (const [label, log] of [
      ["ECONNRESET", NETWORK_RESET],
      ["E404", E404_NAME_TYPO],
    ] as const) {
      const run = hint(["--package", LIB, "--", "node", fakeNpm(log, 1)]);
      expect(run.status, label).toBe(1);
      expect(run.stderr, label).toContain(log); // npm's own error, re-emitted verbatim
      expect(run.stderr, label).not.toContain("AUTHENTICATION");
      expect(run.stderr, label).not.toContain("npm trust list");
      expect(run.stderr, label).not.toContain("trusted-publishing");
    }
  });

  it("does not annotate a non-auth code even when the log carries an auth phrase", () => {
    // The end-to-end shape of the message-fallback ordering fix: `E404` plus an
    // incidental "requires you to be logged in" is still the 404 it is — the
    // code line is authoritative, so no pointer is printed.
    const log = [
      "npm error code E404",
      "npm error 404 Not Found - PUT https://registry.npmjs.org/@arggondev%2flib",
      "npm error 404 This command requires you to be logged in to publish a package.",
    ].join("\n");
    const run = hint(["--package", LIB, "--", "node", fakeNpm(log, 1)]);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("npm error code E404"); // npm's own error, verbatim
    expect(run.stderr).not.toContain("AUTHENTICATION");
    expect(run.stderr).not.toContain("npm trust list");
  });

  it("preserves the child's exit code exactly, and a passing publish is silent", () => {
    expect(hint(["--package", LIB, "--", "node", fakeNpm(ENEEDAUTH_NPM11, 7)]).status).toBe(7);
    const ok = hint(["--package", LIB, "--", "node", fakeNpm(WARNINGS_ONLY, 0)]);
    expect(ok.status).toBe(0);
    expect(ok.stderr).not.toContain("AUTHENTICATION");
    expect(ok.stderr).toContain("npm warn deprecated"); // warnings still reach the log
  });

  it("covers both publish steps: lib and root each get their own pointer", () => {
    const lib = hint(["--package", LIB, "--", "node", fakeNpm(ENEEDAUTH_NPM10)]);
    expect(lib.stderr).toContain(`npm trust list ${LIB}`);
    expect(lib.stderr).toContain("npmjs.com/package/@arggondev/lib/access");
    const root = hint(["--package", ROOT, "--", "node", fakeNpm(ENEEDAUTH_NPM11)]);
    expect(root.stderr).toContain(`npm trust list ${ROOT}`);
    expect(root.stderr).toContain("npmjs.com/package/arggon-manager/access");
  });

  it("derives the repo from the manifest it is pointed at", () => {
    const dir = tmp("wrapper-manifest");
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ repository: "git+https://github.com/Arggon/ArggonManager.git" }),
    );
    const run = hint([
      "--package",
      ROOT,
      "--manifest",
      join(dir, "package.json"),
      "--",
      "node",
      fakeNpm(ENEEDAUTH_NPM11),
    ]);
    expect(run.stderr).toContain("Arggon/ArggonManager");
  });

  it("fails closed (exit 2) on a usage error", () => {
    expect(hint([]).status).toBe(2);
    expect(hint(["--package", LIB]).status).toBe(2);
    expect(hint(["--bogus", "x"]).status).toBe(2);
    expect(hint(["--package", LIB, "--log", join(tmp("missing"), "nope.log")]).status).toBe(2);
    expect(hint(["--package", LIB, "--", "arggon-no-such-binary-xyz"]).status).toBe(2);
  });

  it("re-emits captured npm output when spawnSync hits the maxBuffer edge (ENOBUFS)", () => {
    // npm stderr past spawnSync's 1 MiB default buffer makes spawnSync fail
    // with ENOBUFS and kill the child. Whatever npm wrote before that must
    // still be re-emitted — a hidden npm error must not become a hidden
    // wrapper error — before the wrapper fails closed with its own exit 2.
    // The marker sits past one pipe buffer, so it only arrives if the re-emit
    // is flushed rather than dropped by an exiting process; the parent's own
    // buffer is raised so it can observe the full re-emit.
    const script = join(tmp("maxbuffer"), "npm.mjs");
    writeFileSync(
      script,
      [
        'import { writeSync } from "node:fs";',
        'const chunk = "npm error code ENEEDAUTH\\n" + "x".repeat(65535);',
        "for (let i = 0; i < 8; i++) writeSync(2, chunk);",
        'writeSync(2, "CAPTURED-PAST-ONE-PIPE-BUFFER\\n");',
        "for (let i = 0; i < 16; i++) writeSync(2, chunk);",
        "process.exit(1);",
      ].join("\n"),
    );
    const run = hint(["--package", LIB, "--", "node", script], { maxBuffer: 8 * 1024 * 1024 });
    expect(run.status).toBe(2); // fail closed: spawnSync failed, not a publish result
    expect(run.stderr).toContain("npm error code ENEEDAUTH"); // npm's captured output…
    expect(run.stderr).toContain("CAPTURED-PAST-ONE-PIPE-BUFFER"); // …past one pipe buffer
    assertOrder(
      run.stderr,
      "npm error code ENEEDAUTH",
      "CAPTURED-PAST-ONE-PIPE-BUFFER",
      "cannot run", // the usage line comes after the re-emit
    );
    expect(run.stderr).toContain("ENOBUFS"); // the wrapper's own diagnosis still lands
    expect(run.stdout).toBe("");
  });
});

describe("log mode — the offline smoke (no publish, no network)", () => {
  it("replays a saved auth failure into the full pointer", () => {
    const run = hint(["--package", LIB, "--log", logFile(ENEEDAUTH_NPM11)]);
    expect(run.status).toBe(0); // report-only
    expect(run.stderr).toContain("npm error code ENEEDAUTH");
    expect(run.stderr).toContain(`npm trust list ${LIB}`);
    expect(run.stderr).toContain("Arggon/ArggonManager");
  });

  it("replays a saved non-auth failure with no pointer", () => {
    const run = hint(["--package", ROOT, "--log", logFile(E404_NAME_TYPO), "--exit-code", "1"]);
    expect(run.status).toBe(0);
    expect(run.stderr).toContain("404 Not Found - GET");
    expect(run.stderr).not.toContain("AUTHENTICATION");
    expect(run.stderr).not.toContain("npm trust list");
  });
});

describe("the release.yml publish steps (workflow contract)", () => {
  const workflowPath = join(repoRoot, ".github", "workflows", "release.yml");
  const workflow = readFileSync(workflowPath, "utf8");

  it("wraps BOTH publish steps — the two per-package failures that cost two attempts", () => {
    // release.yml is the trusted-publisher binding: the filename itself is pinned.
    expect(existsSync(workflowPath)).toBe(true);
    expect(workflow, "workflow name the binding points at").toContain("name: release");
    expect(workflow).toContain(
      `node cli/publish-auth-hint.mjs --package "${LIB}" --version "$VERSION" -- npm publish --workspace lib`,
    );
    expect(workflow).toContain(
      `node cli/publish-auth-hint.mjs --package "${ROOT}" --version "$VERSION" -- npm publish`,
    );
  });

  it("keeps the publish semantics the wrapper must not change", () => {
    // already-published = success, once per publish step
    expect(
      workflow.match(/already on the registry - already-published = success, never re-publish/g)
        ?.length,
    ).toBe(2);
    // OIDC only — no token anywhere
    expect(workflow).not.toMatch(/secrets\.NPM_TOKEN|NPM_TOKEN\s*:/);
    expect(workflow).toContain("id-token: write");
    // lib first, root second, with the propagation poll still between them
    assertOrder(
      workflow,
      `node cli/publish-auth-hint.mjs --package "${LIB}" --version "$VERSION" -- npm publish --workspace lib`,
      "Poll the registry until the kernel is visible",
      `node cli/publish-auth-hint.mjs --package "${ROOT}" --version "$VERSION" -- npm publish`,
    );
    // the propagation poll between the two publishes is untouched
    expect(workflow).toContain("propagation poll exceeded 300s");
  });
});
