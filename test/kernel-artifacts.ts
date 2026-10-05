/**
 * bug-test-suite-lib-dist-rebuild-race: the suite-wide half of the shared-build
 * isolation, registered as a vitest `globalSetup` next to `./teardown-tmp.ts`
 * (vitest has no separate globalTeardown hook, so setup returns the teardown).
 *
 * The problem, in one line: `lib/dist` is the one directory in the tree a test
 * is expected to rebuild, and a spawned CLI child used to ESM-load it. `tsc`
 * rewrites every output file (`open(O_TRUNC)` + write, even when the bytes are
 * identical), so a lane that rebuilt the shared build in place could hand a
 * concurrently linking child a half-written module. The child then died inside
 * Node's ESM loader and the lane reported an unrelated
 * `SyntaxError: ... does not provide an export named ...`.
 *
 * Why this file exists rather than a per-suite assertion: the existing gate
 * (`cli/src/test-spawn.test.ts`) says out loud that "which cwd an argv literal
 * carries cannot be decided statically", so that discipline could only be
 * observed, never enforced. This enforces it, in two halves:
 *
 *  1. FREEZE — the repo's built artifact directories are read-only for the
 *     duration of the run (POSIX; a no-op elsewhere). A writer then fails with
 *     EACCES in the lane that WROTE, which is the diagnostic the flake needed,
 *     and no reader can observe a partial file. This is the structural form of
 *     the item's own preference: one build, made by the project's build step
 *     (`npm run build`, which CI runs before `npm run test`), with per-suite
 *     rebuilds forbidden rather than merely discouraged.
 *  2. DRIFT — the same fingerprint `cli/src/test-spawn.ts` takes around every
 *     child is taken here around the WHOLE run. That covers the window a
 *     per-child check cannot see: a writer that runs while no child is alive. A
 *     drift fails the run from the teardown (vitest exits non-zero on a throwing
 *     teardown), so the class reports itself by name instead of surfacing as
 *     somebody else's SyntaxError.
 *
 * Neither half fails a run on its own account: an unstattable path, an
 * unsupported platform or a missing permission degrades to "not enforced here"
 * and the other half still reports. What must never happen is a silent false
 * green, so every degradation is reported by {@link describeSetup} and printed
 * by the setup.
 *
 * Test-only: `test/` is outside the `cli/src` build project and outside the
 * published `files` allowlist, so nothing here ships.
 */
import { chmodSync, lstatSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { artifactFingerprint, KERNEL_ARTIFACTS } from "../cli/src/test-spawn.js";

/** Repo root, derived from this file (`<repo>/test/`). */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The build outputs the freeze covers: the kernel package's `lib/dist` and the
 * root `dist`. Both are read by something during a run (a child for the kernel
 * before `cliNodeArgs`, `dist/cli.js` for `measure`'s source-run child and the
 * `build-info` suites) and both are written by a rebuild.
 */
const FROZEN_DIRS = ["lib/dist", "dist"] as const;

/** A directory needs `x` to stay traversable while it is read-only. */
const READ_ONLY_FILE = 0o444;
const READ_ONLY_DIR = 0o555;

/** A path whose mode this run changed, with the mode to put back. */
export type FrozenPath = { path: string; mode: number };

/** What the freeze covers, and what it could not cover. */
export type FreezeReport = {
  /** Regular files made read-only, in a stable order. */
  readonly files: readonly FrozenPath[];
  /** Directories made read-only (and still traversable), in a stable order. */
  readonly dirs: readonly FrozenPath[];
  /** Why something was not covered — never silently dropped. */
  readonly skipped: readonly string[];
  /** False when this platform cannot express the freeze at all. */
  readonly enforced: boolean;
};

/**
 * POSIX modes are the whole mechanism, so say so where a caller can act on it
 * rather than letting a Windows run look green for the wrong reason: the drift
 * half still reports there, but nothing is read-only.
 */
const FREEZE_SUPPORTED = process.platform !== "win32";

/** Depth guard for the walk: build output is shallow, and this is not a crawler. */
const MAX_DEPTH = 4;

/**
 * Every regular file and directory under `dir`, sorted so a report is stable.
 * A missing directory (a checkout that never built) is reported rather than
 * treated as an error — the drift half then catches a build appearing mid-run.
 */
function walk(dir: string, depth: number, skipped: string[]): { files: string[]; dirs: string[] } {
  const files: string[] = [];
  const dirs: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    skipped.push(`${dir}: absent or unreadable`);
    return { files, dirs };
  }
  for (const entry of entries.sort()) {
    const full = join(dir, entry);
    let isDir: boolean;
    try {
      isDir = lstatSync(full).isDirectory();
    } catch {
      skipped.push(`${full}: vanished while freezing`);
      continue;
    }
    if (!isDir) {
      files.push(full);
      continue;
    }
    dirs.push(full);
    if (depth >= MAX_DEPTH) {
      skipped.push(`${full}: not walked (deeper than ${MAX_DEPTH})`);
      continue;
    }
    const nested = walk(full, depth + 1, skipped);
    files.push(...nested.files);
    dirs.push(...nested.dirs);
  }
  return { files, dirs };
}

/**
 * The modes the freeze would apply, or the reasons it cannot cover something.
 * Pure and read-only: `cli/src/kernel-isolation.test.ts` pins this shape without
 * chmod-ing anyone's tree.
 */
export function describeSetup(
  dirs: readonly string[] = FROZEN_DIRS,
  supported: boolean = FREEZE_SUPPORTED,
): FreezeReport {
  const skipped: string[] = [];
  if (!supported) {
    skipped.push(
      `platform ${process.platform}: POSIX read-only modes unavailable, freeze not applied`,
    );
    return { files: [], dirs: [], skipped, enforced: false };
  }
  const files: FrozenPath[] = [];
  const frozenDirs: FrozenPath[] = [];
  for (const rel of dirs) {
    // `resolve`, not `join`: a caller may pass an absolute path (the tests
    // exercise the freeze on a temp tree), and `join` would graft it onto the
    // repo root.
    const dir = resolve(repoRoot, rel);
    const covered = walk(dir, 1, skipped);
    for (const path of [dir, ...covered.dirs]) {
      try {
        frozenDirs.push({ path, mode: lstatSync(path).mode });
      } catch {
        skipped.push(`${path}: vanished while freezing`);
      }
    }
    for (const path of covered.files) {
      try {
        files.push({ path, mode: lstatSync(path).mode });
      } catch {
        skipped.push(`${path}: vanished while freezing`);
      }
    }
  }
  return { files, dirs: frozenDirs, skipped, enforced: true };
}

/**
 * Apply the read-only modes. Returns every mode it changed so
 * {@link unfreeze} can put it back exactly; a path whose chmod fails is skipped
 * (best effort), never fatal.
 */
export function freeze(report: FreezeReport = describeSetup()): FrozenPath[] {
  const applied: FrozenPath[] = [];
  for (const [entries, mode] of [
    [report.files, READ_ONLY_FILE],
    [report.dirs, READ_ONLY_DIR],
  ] as const) {
    for (const entry of entries) {
      try {
        chmodSync(entry.path, mode);
        applied.push(entry);
      } catch {
        // best effort: the drift half still reports a writer that got through
      }
    }
  }
  return applied;
}

/** Put the recorded modes back. Never throws: it runs on the exit path. */
export function unfreeze(applied: readonly FrozenPath[]): void {
  for (const entry of [...applied].reverse()) {
    try {
      chmodSync(entry.path, entry.mode & 0o7777);
    } catch {
      // best effort
    }
  }
}

/** The directories the freeze is expected to cover, for assertions and reports. */
export function frozenDirs(): string[] {
  return FROZEN_DIRS.map((rel) => join(repoRoot, rel));
}

/** The watched build artifacts, for assertions. */
export const watchedArtifacts: readonly string[] = KERNEL_ARTIFACTS.map((rel) =>
  join(repoRoot, rel),
);

/** Fingerprint of the watched artifacts right now (`size:mtimeMs`, or absent). */
export function fingerprintNow(): string {
  return artifactFingerprint(repoRoot);
}

export default function globalSetup(): () => void {
  const before = fingerprintNow();
  const report = describeSetup();
  const applied = freeze(report);
  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    unfreeze(applied);
  };
  // A run that dies hard still has to give the tree back: a leftover read-only
  // `lib/dist` would make the next `npm run build` fail with EACCES and read as
  // a broken checkout rather than as this gate.
  process.once("exit", restore);

  if (report.skipped.length > 0) {
    console.log(`[kernel-artifacts] freeze not complete: ${report.skipped.join("; ")}`);
  }

  return function teardown(): void {
    const after = fingerprintNow();
    restore();
    if (after !== before) {
      throw new Error(
        [
          "[kernel-artifacts] kernel artifact drift across the suite (not an assertion failure)",
          `  before[${before}]`,
          `  after [${after}]`,
          "  a suite lane rebuilt the repo's built artifacts in place. The freeze above",
          `  covers ${frozenDirs().join(", ")} on POSIX, so a write that landed came from`,
          "  outside it. Build into your own temp root instead (see freshCloneCopy in",
          "  cli/src/pack-fixtures.ts), and fix the writer, not the reader.",
        ].join("\n"),
      );
    }
  };
}
